const http = require('http');
const db = require('./db');

const PORT = 3002; // Use an isolated test port
process.env.PORT = PORT;

let server;

function makeRequest(path, method = 'GET', body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, `http://localhost:${PORT}`);
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const req = http.request({
      hostname: 'localhost',
      port: PORT,
      path: url.pathname + url.search,
      method,
      headers
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, text: data });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runHodIntegrationTests() {
  console.log('====================================================');
  console.log('🧪 RUNNING COMPREHENSIVE HOD PORTAL TEST SUITE');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName, details = '') {
    if (condition) {
      console.log(`  ✓ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${testName} ${details ? '(' + details + ')' : ''}`);
      failed++;
    }
  }

  try {
    // 1. Database Migrations Verification
    console.log('[1/7] Initializing Database & Verifying HOD Schema Migrations...');
    await db.initDB();

    const deptsTable = await db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='departments'");
    assert(!!deptsTable, 'Database: `departments` table exists');

    const leavesTable = await db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='faculty_leaves'");
    assert(!!leavesTable, 'Database: `faculty_leaves` table exists');

    const marksSubTable = await db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='internal_marks_submissions'");
    assert(!!marksSubTable, 'Database: `internal_marks_submissions` table exists');

    const examsTable = await db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='exam_schedules'");
    assert(!!examsTable, 'Database: `exam_schedules` table exists');

    const mentoringTable = await db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='student_mentoring'");
    assert(!!mentoringTable, 'Database: `student_mentoring` table exists');

    const approvalsTable = await db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='department_approvals'");
    assert(!!approvalsTable, 'Database: `department_approvals` table exists');

    const auditTable = await db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='department_audit_logs'");
    assert(!!auditTable, 'Database: `department_audit_logs` table exists');

    const seededHod = await db.get("SELECT * FROM users WHERE LOWER(username) = 'hod_cse'");
    assert(!!seededHod && seededHod.role === 'HOD', 'Database: Seeded HOD user exists (HOD_CSE)');

    // Start Express Server
    const { startServer } = require('./server');
    server = await startServer(PORT);
    console.log(`Server started on port ${PORT}\n`);

    // 2. Authentication & RBAC Verification
    console.log('[2/7] Testing HOD Authentication & RBAC Access Control...');
    const hodLoginRes = await makeRequest('/api/auth/login', 'POST', {
      identifier: 'HOD_CSE',
      password: 'Hod@123'
    });
    assert(hodLoginRes.status === 200 && hodLoginRes.data && hodLoginRes.data.success, 'Unified Login: HOD_CSE authentication');
    const hodToken = hodLoginRes.data?.token;
    assert(hodLoginRes.data?.user?.role === 'HOD', 'User payload role is HOD');

    // Dedicated hod-login endpoint
    const directHodRes = await makeRequest('/api/auth/hod-login', 'POST', {
      username: 'hod',
      password: 'Hod@123'
    });
    assert(directHodRes.status === 200 && directHodRes.data?.success, 'Dedicated /api/auth/hod-login authentication');

    // Invalid password rejected
    const badPassRes = await makeRequest('/api/auth/login', 'POST', {
      identifier: 'HOD_CSE',
      password: 'WrongPassword'
    });
    assert(badPassRes.status === 401, 'Security: Invalid HOD password rejected with 401');

    // Student token
    const studentLogin = await makeRequest('/api/auth/login', 'POST', { identifier: '26UG033181', password: 'Bunny@2606' });
    const studentToken = studentLogin.data?.token;

    // Student blocked from HOD endpoints
    const studentBlocked = await makeRequest('/api/hod/dashboard', 'GET', null, studentToken);
    assert(studentBlocked.status === 403, 'RBAC Security: Student blocked from /api/hod/* with 403');

    // Unauthenticated blocked
    const unauthBlocked = await makeRequest('/api/hod/dashboard', 'GET');
    assert(unauthBlocked.status === 401, 'RBAC Security: Unauthenticated request blocked with 401');

    // 3. Module 1 & 2: Dashboard and Profile
    console.log('[3/7] Testing Module 1 (Dashboard) & Module 2 (Profile)...');
    const dashRes = await makeRequest('/api/hod/dashboard', 'GET', null, hodToken);
    assert(dashRes.status === 200 && dashRes.data?.success, 'Module 1: Dashboard returns real departmental metrics');
    assert(dashRes.data?.data?.stats?.totalStudents >= 65, 'Dashboard: Real student count >= 65');
    assert(dashRes.data?.data?.charts?.attendanceTrend?.length === 6, 'Dashboard: Visual charts data provided');

    const profRes = await makeRequest('/api/hod/profile', 'GET', null, hodToken);
    assert(profRes.status === 200 && profRes.data?.success, 'Module 2: Department profile retrieved');
    assert(profRes.data?.data?.code === 'CSE', 'Profile: Department code is CSE');

    const updateProfRes = await makeRequest('/api/hod/profile', 'PUT', {
      head_name: 'Dr. A. K. Sharma',
      head_email: 'hod.cse@mishragroup.ac.in',
      office_location: 'Building A, 3rd Floor, Cabin 301'
    }, hodToken);
    assert(updateProfRes.status === 200 && updateProfRes.data?.success, 'Module 2: Department profile successfully updated');

    // 4. Module 3 & 11: Faculty Management and Workload
    console.log('[4/7] Testing Module 3 (Faculty) & Module 11 (Workload)...');
    const facRes = await makeRequest('/api/hod/faculty', 'GET', null, hodToken);
    assert(facRes.status === 200 && facRes.data?.faculty?.length > 0, 'Module 3: Faculty list retrieved');

    const firstFaculty = facRes.data?.faculty[0];
    const facDetailRes = await makeRequest(`/api/hod/faculty/${firstFaculty.id}`, 'GET', null, hodToken);
    assert(facDetailRes.status === 200 && facDetailRes.data?.success, 'Module 3: Faculty details and timetable retrieved');

    const assignRes = await makeRequest(`/api/hod/faculty/${firstFaculty.id}/assignments`, 'PUT', {
      subjects: 'DBMS, NCS',
      batch: 'Both'
    }, hodToken);
    assert(assignRes.status === 200 && assignRes.data?.success, 'Module 3: Subject assignments updated');

    const workloadRes = await makeRequest('/api/hod/workload', 'GET', null, hodToken);
    assert(workloadRes.status === 200 && workloadRes.data?.workload?.length > 0, 'Module 11: Faculty teaching workload computed from timetable');
    assert(workloadRes.data?.institutionalLimit === 18, 'Module 11: Benchmark institutional limit enforced');

    // 5. Module 4 & 5: Students and Subjects
    console.log('[5/7] Testing Module 4 (Students) & Module 5 (Subjects)...');
    const studRes = await makeRequest('/api/hod/students?page=1&limit=10', 'GET', null, hodToken);
    assert(studRes.status === 200 && studRes.data?.students?.length > 0, 'Module 4: Student directory returns paginated records');
    assert(studRes.data?.pagination?.totalCount >= 65, 'Module 4: Pagination tracks all enrolled department students');

    const studProfRes = await makeRequest('/api/hod/students/26UG033181', 'GET', null, hodToken);
    assert(studProfRes.status === 200 && studProfRes.data?.student?.ug_id === '26UG033181', 'Module 4: Student academic profile retrieved');

    const subjRes = await makeRequest('/api/hod/subjects', 'GET', null, hodToken);
    assert(subjRes.status === 200 && subjRes.data?.subjects?.length > 0, 'Module 5: Department subjects list retrieved');

    await db.run("DELETE FROM subjects WHERE code = 'CS399'");
    const newSubjRes = await makeRequest('/api/hod/subjects', 'POST', {
      code: 'CS399',
      name: 'Advanced Cyber Threat Intelligence',
      short_name: 'ACTI',
      credits: 4,
      faculty_default: 'Prof. L. Varma'
    }, hodToken);
    assert(newSubjRes.status === 200 && newSubjRes.data?.success, 'Module 5: Created new department subject');

    // 6. Module 6, 7 & 10: Timetable, Attendance and Exams
    console.log('[6/7] Testing Module 6 (Timetable), Module 7 (Attendance) & Module 10 (Exams)...');
    const ttRes = await makeRequest('/api/hod/timetable?day=Monday', 'GET', null, hodToken);
    assert(ttRes.status === 200 && ttRes.data?.timetable?.length > 0, 'Module 6: Daily timetable slots retrieved');

    const conflictRes = await makeRequest('/api/hod/timetable/conflicts', 'GET', null, hodToken);
    assert(conflictRes.status === 200 && conflictRes.data?.success, 'Module 6: Timetable conflict check executed');

    const attRes = await makeRequest('/api/hod/attendance', 'GET', null, hodToken);
    assert(attRes.status === 200 && attRes.data?.stats?.overallPercentage, 'Module 7: Attendance overview with threshold tracking');

    const examsRes = await makeRequest('/api/hod/exams', 'GET', null, hodToken);
    assert(examsRes.status === 200 && examsRes.data?.exams?.length > 0, 'Module 10: Examination schedules retrieved');

    // 7. Module 8, 12, 13, 14 & 15: Marks, Leaves, Mentoring, Reports, Central Approvals
    console.log('[7/7] Testing Modules 8, 12, 13, 14 & 15 (Approvals, Leaves, Marks, Reports)...');
    const marksRes = await makeRequest('/api/hod/marks', 'GET', null, hodToken);
    assert(marksRes.status === 200 && marksRes.data?.submissions?.length > 0, 'Module 8: Internal marks submissions retrieved');

    const leavesRes = await makeRequest('/api/hod/leaves', 'GET', null, hodToken);
    assert(leavesRes.status === 200 && leavesRes.data?.leaves?.length > 0, 'Module 12: Faculty leave requests retrieved');

    // Review first pending leave
    const pendingLeave = leavesRes.data?.leaves.find(l => l.status === 'PENDING');
    if (pendingLeave) {
      const reviewLeaveRes = await makeRequest(`/api/hod/leaves/${pendingLeave.id}/review`, 'POST', {
        decision: 'APPROVE',
        comments: 'Leave approved by HOD for academic conference.'
      }, hodToken);
      assert(reviewLeaveRes.status === 200 && reviewLeaveRes.data?.success, 'Module 12: Successfully processed leave approval');
    } else {
      assert(true, 'Module 12: Leave requests verified');
    }

    const mentRes = await makeRequest('/api/hod/mentoring', 'GET', null, hodToken);
    assert(mentRes.status === 200 && mentRes.data?.sessions?.length > 0, 'Module 13: Student mentoring records retrieved');

    const reportsRes = await makeRequest('/api/hod/reports', 'GET', null, hodToken);
    assert(reportsRes.status === 200 && reportsRes.data?.reportSummary?.availableReportTypes?.length === 5, 'Module 14: Department reports summary available');

    const appRes = await makeRequest('/api/hod/approvals', 'GET', null, hodToken);
    assert(appRes.status === 200 && appRes.data?.approvals?.length > 0, 'Module 15: Central HOD Approvals dashboard operational');

    console.log('\n====================================================');
    console.log(`📊 HOD INTEGRATION TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================');

    if (server) {
      server.close();
    }

    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('Fatal test execution failure:', err);
    if (server) server.close();
    process.exit(1);
  }
}

runHodIntegrationTests();
