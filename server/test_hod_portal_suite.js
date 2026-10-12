const http = require('http');
const db = require('./db');
const { generateToken } = require('./middleware/auth');

const PORT = 3010;
process.env.PORT = PORT;

let server;

function makeRequest(reqPath, method = 'GET', body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(reqPath, `http://localhost:${PORT}`);
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

async function runTests() {
  console.log('================================================================');
  console.log('⚡ RUNNING HOD PORTAL COMPREHENSIVE AUTOMATED TEST SUITE');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(cond, name, details = '') {
    if (cond) {
      console.log(`  ✓ PASS: ${name}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${name} ${details ? '(' + details + ')' : ''}`);
      failed++;
    }
  }

  try {
    console.log('[Setup] Initializing database & launching test server on port ' + PORT + '...');
    await db.initDB();
    const { startServer } = require('./server');
    server = await startServer(PORT);
    await new Promise(r => setTimeout(r, 600));

    // Phase 1: Authentication Tests
    console.log('\n[Phase 1] Testing HOD Authentication & Unified Login...');
    
    // Test 1: Direct HOD Login endpoint
    const hodLoginRes = await makeRequest('/api/auth/hod-login', 'POST', {
      username: 'HOD_CSE',
      password: 'Hod@123'
    });
    assert(hodLoginRes.status === 200, 'Direct HOD login returns 200 OK');
    assert(hodLoginRes.data.user && hodLoginRes.data.user.role === 'HOD', 'User object has role HOD');
    assert(Boolean(hodLoginRes.data.token), 'Valid JWT token returned');
    const hodToken = hodLoginRes.data.token;

    // Test 2: Unified Login with alias
    const unifiedLoginRes = await makeRequest('/api/auth/login', 'POST', {
      username: 'hod',
      password: 'Hod@123'
    });
    assert(unifiedLoginRes.status === 200, 'Unified login with alias "hod" returns 200 OK');
    assert(unifiedLoginRes.data.user && unifiedLoginRes.data.user.role === 'HOD', 'Unified login identifies role as HOD');

    // Test 3: Get profile with HOD token
    const profileRes = await makeRequest('/api/auth/profile', 'GET', null, hodToken);
    assert(profileRes.status === 200, 'Get profile with HOD token returns 200 OK');
    assert(profileRes.data.user && profileRes.data.user.role === 'HOD', 'Profile matches HOD');

    // Phase 2: Role-Based Access Control (RBAC) Security
    console.log('\n[Phase 2] Testing RBAC Security & Token Guarding...');
    
    // No token
    const unauthRes = await makeRequest('/api/hod/dashboard', 'GET');
    assert(unauthRes.status === 401, 'Unauthenticated request to HOD dashboard returns 401');

    // Student token
    const studentToken = generateToken({ id: 101, username: 'std1', role: 'STUDENT' });
    const studentRes = await makeRequest('/api/hod/dashboard', 'GET', null, studentToken);
    assert(studentRes.status === 403, 'Student token access to HOD dashboard returns 403 Forbidden');

    // Teacher token
    const teacherToken = generateToken({ id: 201, username: 'tch1', role: 'TEACHER' });
    const teacherRes = await makeRequest('/api/hod/dashboard', 'GET', null, teacherToken);
    assert(teacherRes.status === 403, 'Teacher token access to HOD dashboard returns 403 Forbidden');

    // HOD token
    const hodDashRes = await makeRequest('/api/hod/dashboard', 'GET', null, hodToken);
    assert(hodDashRes.status === 200, 'HOD token access to HOD dashboard returns 200 OK');

    // Phase 3: Module 1 - Department Dashboard
    console.log('\n[Phase 3] Testing Module 1: Department Dashboard Metrics...');
    assert(hodDashRes.data.stats && typeof hodDashRes.data.stats.totalStudents === 'number', 'Dashboard totalStudents is numeric');
    assert(typeof hodDashRes.data.stats.totalFaculty === 'number', 'Dashboard totalFaculty is numeric');
    assert(typeof hodDashRes.data.stats.totalSubjects === 'number', 'Dashboard totalSubjects is numeric');
    assert(typeof hodDashRes.data.stats.attendancePercentageToday === 'number', 'Dashboard attendancePercentageToday is numeric');
    assert(Array.isArray(hodDashRes.data.todayLectures), 'Dashboard contains todayLectures array');

    // Phase 4: Module 2 - Department Profile
    console.log('\n[Phase 4] Testing Module 2: Department Profile...');
    const deptProfRes = await makeRequest('/api/hod/profile', 'GET', null, hodToken);
    assert(deptProfRes.status === 200, 'GET /api/hod/profile returns 200 OK');
    assert(deptProfRes.data.profile && deptProfRes.data.profile.code === 'CSE', 'Department code is CSE');
    
    const updateProfRes = await makeRequest('/api/hod/profile', 'PUT', {
      head_name: 'Prof. (Dr.) A. K. Sharma',
      contact_email: 'hod.cse@mishragroup.ac.in',
      office_location: 'Block B, Level 4, Academic Complex',
      contact_phone: '+91-11-28001234',
      description: 'Department of Computer Science & Engineering'
    }, hodToken);
    assert(updateProfRes.status === 200, 'PUT /api/hod/profile returns 200 OK');

    const verifyProfRes = await makeRequest('/api/hod/profile', 'GET', null, hodToken);
    assert(verifyProfRes.data.profile.office_location.includes('Block B'), 'Office location successfully persisted');

    // Phase 5: Module 3 - Faculty Management
    console.log('\n[Phase 5] Testing Module 3: Faculty Management...');
    const facultyRes = await makeRequest('/api/hod/faculty', 'GET', null, hodToken);
    assert(facultyRes.status === 200, 'GET /api/hod/faculty returns 200 OK');
    assert(Array.isArray(facultyRes.data.faculty) && facultyRes.data.faculty.length > 0, 'Faculty list returned with records');
    
    const testFac = facultyRes.data.faculty[0];
    const updateFacRes = await makeRequest(`/api/hod/faculty/${testFac.id}`, 'PUT', {
      name: testFac.name,
      qualification: 'Ph.D. / M.Tech',
      experience_years: 8,
      workload_limit_hours: 22,
      office_room: 'Cabin 402'
    }, hodToken);
    assert(updateFacRes.status === 200, 'PUT /api/hod/faculty/:id returns 200 OK');

    // Phase 6: Module 4 - Student Management
    console.log('\n[Phase 6] Testing Module 4: Student Management...');
    const studentsRes = await makeRequest('/api/hod/students?limit=20', 'GET', null, hodToken);
    assert(studentsRes.status === 200, 'GET /api/hod/students returns 200 OK');
    assert(Array.isArray(studentsRes.data.students), 'Students list returned');
    assert(studentsRes.data.pagination && typeof studentsRes.data.pagination.total === 'number', 'Students total count returned');

    // Phase 7: Module 5 - Subject Management
    console.log('\n[Phase 7] Testing Module 5: Subject Management...');
    const subjectsRes = await makeRequest('/api/hod/subjects', 'GET', null, hodToken);
    assert(subjectsRes.status === 200, 'GET /api/hod/subjects returns 200 OK');
    assert(Array.isArray(subjectsRes.data.subjects), 'Subjects list returned');
    if (subjectsRes.data.subjects.length > 0) {
      const sub = subjectsRes.data.subjects[0];
      const updateSubRes = await makeRequest(`/api/hod/subjects/${sub.id}`, 'PUT', {
        name: sub.name,
        assigned_faculty_name: testFac.name,
        assigned_faculty_id: testFac.teacher_id,
        syllabus_progress: 45
      }, hodToken);
      assert(updateSubRes.status === 200, 'PUT /api/hod/subjects/:id updates assigned faculty & progress');
    }

    // Phase 8: Module 6 - Timetable Management
    console.log('\n[Phase 8] Testing Module 6: Timetable Management...');
    const ttRes = await makeRequest('/api/hod/timetable', 'GET', null, hodToken);
    assert(ttRes.status === 200, 'GET /api/hod/timetable returns 200 OK');
    assert(Array.isArray(ttRes.data.timetable), 'Timetable entries list returned');

    // Test conflict checking with dynamic test room
    const testRoom = 'TestRoom_' + Math.floor(Math.random() * 80000 + 10000);
    const slotRes = await makeRequest('/api/hod/timetable', 'POST', {
      day: 'Monday',
      start_time: '18:00',
      end_time: '19:00',
      subject: 'Network Security Lab',
      room: testRoom,
      batch: 'Batch 1',
      division: '3CYBER7',
      is_lab: 1
    }, hodToken);
    assert(slotRes.status === 200, 'POST /api/hod/timetable creates new slot');

    // Attempting overlapping slot with same room/time should detect conflict
    const conflictRes = await makeRequest('/api/hod/timetable', 'POST', {
      day: 'Monday',
      start_time: '18:30',
      end_time: '19:30',
      subject: 'Cloud Security',
      room: testRoom,
      batch: 'Batch 2',
      division: '3CYBER7',
      is_lab: 0
    }, hodToken);
    assert(conflictRes.status === 409, 'POST conflicting slot returns 409 Conflict detection');

    // Phase 9: Module 7 - Attendance Management
    console.log('\n[Phase 9] Testing Module 7: Attendance Management...');
    const attRes = await makeRequest('/api/hod/attendance', 'GET', null, hodToken);
    assert(attRes.status === 200, 'GET /api/hod/attendance returns 200 OK');
    assert(Array.isArray(attRes.data.manualRecords), 'Attendance manualRecords array returned');
    assert(Array.isArray(attRes.data.lowAttendanceStudents), 'Attendance lowAttendanceStudents array returned');

    // Phase 10: Module 8 - Internal Marks & Approvals
    console.log('\n[Phase 10] Testing Module 8: Internal Marks Approvals...');
    const marksRes = await makeRequest('/api/hod/internal-marks', 'GET', null, hodToken);
    assert(marksRes.status === 200, 'GET /api/hod/internal-marks returns 200 OK');
    assert(Array.isArray(marksRes.data.marks), 'Internal marks array returned');
    assert(Array.isArray(marksRes.data.summary), 'Internal marks summary array returned');

    const reviewMarksRes = await makeRequest('/api/hod/internal-marks/review', 'POST', {
      subject: 'Data Structures',
      action: 'APPROVE',
      remarks: 'Verified by HOD'
    }, hodToken);
    assert(reviewMarksRes.status === 200, 'POST /api/hod/internal-marks/review approves marks batch');

    // Phase 11: Module 9 - Assignment Monitoring
    console.log('\n[Phase 11] Testing Module 9: Assignments Monitoring...');
    const assignmRes = await makeRequest('/api/hod/assignments', 'GET', null, hodToken);
    assert(assignmRes.status === 200, 'GET /api/hod/assignments returns 200 OK');
    assert(Array.isArray(assignmRes.data.assignments), 'Assignments array returned');

    // Phase 12: Module 10 - Examination Management
    console.log('\n[Phase 12] Testing Module 10: Examination Management...');
    const createExamRes = await makeRequest('/api/hod/exams', 'POST', {
      exam_name: 'Mid-Term Exam Autumn 2026',
      subject: 'Cryptography & System Security',
      subject_code: 'CYB-301',
      semester: '3rd Semester',
      exam_date: '2026-10-25',
      start_time: '10:00',
      end_time: '13:00',
      room: 'Examination Hall 1',
      total_students: 65
    }, hodToken);
    assert(createExamRes.status === 200, 'POST /api/hod/exams creates exam');
    
    const examsRes = await makeRequest('/api/hod/exams', 'GET', null, hodToken);
    assert(examsRes.status === 200, 'GET /api/hod/exams returns 200 OK');
    assert(Array.isArray(examsRes.data.exams) && examsRes.data.exams.length > 0, 'Exam list returned');

    // Phase 13: Module 11 - Faculty Workload Calculation
    console.log('\n[Phase 13] Testing Module 11: Faculty Workload Calculations...');
    const wlRes = await makeRequest('/api/hod/workload', 'GET', null, hodToken);
    assert(wlRes.status === 200, 'GET /api/hod/workload returns 200 OK');
    assert(Array.isArray(wlRes.data.workload), 'Faculty workload array returned');
    if (wlRes.data.workload.length > 0) {
      const facWl = wlRes.data.workload[0];
      assert(typeof facWl.total_weekly_hours === 'number', 'Weekly hours is calculated numeric value');
      assert(typeof facWl.workload_limit_hours === 'number', 'Workload limit hours is numeric value');
    }

    // Phase 14: Module 12 - Faculty Leave Requests & Approvals
    console.log('\n[Phase 14] Testing Module 12: Faculty Leave Requests...');
    // Seed a leave request directly to test approval
    const leaveDbRes = await db.run(
      `INSERT INTO leave_requests (applicant_type, applicant_id, applicant_name, department, leave_type, start_date, end_date, total_days, reason, status)
       VALUES ('FACULTY', ?, ?, 'Computer Science & Engineering', 'Casual Leave', '2026-10-20', '2026-10-21', 2, 'Attending IEEE Conference', 'PENDING')`,
      [testFac.teacher_id || 'TCH01', testFac.name]
    );
    const leaveId = leaveDbRes.id;

    const leavesRes = await makeRequest('/api/hod/leaves', 'GET', null, hodToken);
    assert(leavesRes.status === 200, 'GET /api/hod/leaves returns 200 OK');
    assert(Array.isArray(leavesRes.data.leaves), 'Leaves array returned');

    const approveLeaveRes = await makeRequest(`/api/hod/leaves/${leaveId}/review`, 'POST', {
      action: 'APPROVED',
      remarks: 'Granted for academic conference'
    }, hodToken);
    assert(approveLeaveRes.status === 200, 'POST /api/hod/leaves/:id/review approves leave');

    // Phase 15: Module 13 - Student Mentoring
    console.log('\n[Phase 15] Testing Module 13: Student Mentoring...');
    const addMentorRes = await makeRequest('/api/hod/mentoring', 'POST', {
      student_ug_id: '24UG1001',
      student_name: 'Test Student',
      mentor_name: testFac.name,
      session_date: '2026-10-12',
      academic_concerns: 'Career Guidance & Academic Progress',
      action_plan: 'Focus on database assignments and competitive programming.'
    }, hodToken);
    assert(addMentorRes.status === 200, 'POST /api/hod/mentoring creates record');

    const mentorRes = await makeRequest('/api/hod/mentoring', 'GET', null, hodToken);
    assert(mentorRes.status === 200, 'GET /api/hod/mentoring returns 200 OK');
    assert(Array.isArray(mentorRes.data.records) && mentorRes.data.records.length > 0, 'Mentoring records returned');

    // Phase 16: Module 14 - Department Reports
    console.log('\n[Phase 16] Testing Module 14: Department Reports...');
    const reportsRes = await makeRequest('/api/hod/reports?report_type=attendance', 'GET', null, hodToken);
    assert(reportsRes.status === 200, 'GET /api/hod/reports returns 200 OK');
    assert(Array.isArray(reportsRes.data.data), 'Reports contain academic dataset array');

    // Phase 17: Module 15 - Centralized Approvals Queue
    console.log('\n[Phase 17] Testing Module 15: Centralized Approvals Queue...');
    // Seed an approval item to test processing
    const appDbRes = await db.run(
      `INSERT INTO department_approvals (department, title, request_type, requester_id, requester_name, requester_role, description, status)
       VALUES ('Computer Science & Engineering', 'Lab Hardware Requisition', 'GENERAL', ?, ?, 'TEACHER', 'Hardware request for cryptography lab', 'PENDING')`,
      [testFac.teacher_id || 'TCH01', testFac.name]
    );
    const approvalId = appDbRes.id;

    const approvalsRes = await makeRequest('/api/hod/approvals', 'GET', null, hodToken);
    assert(approvalsRes.status === 200, 'GET /api/hod/approvals returns 200 OK');
    assert(Array.isArray(approvalsRes.data.approvals), 'Approvals queue returned');

    const processAppRes = await makeRequest(`/api/hod/approvals/${approvalId}/process`, 'POST', {
      action: 'APPROVED',
      remarks: 'Sanctioned from department lab funds.'
    }, hodToken);
    assert(processAppRes.status === 200, 'POST /api/hod/approvals/:id/process processes approval');

    console.log('\n================================================================');
    console.log(`TEST SUITE RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================');

    if (server) {
      server.close();
    }
    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('Fatal test error:', err);
    if (server) server.close();
    process.exit(1);
  }
}

runTests();
