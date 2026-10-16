// ==============================================================================
// AUTOMATED TEST SUITE: STUDENT PROFILE CARDS & ROLE PERMISSIONS VERIFICATION
// ==============================================================================

const assert = require('assert');
const http = require('http');
const db = require('./db');
const { generateToken } = require('./middleware/auth');
const { startServer } = require('./server');

const PORT = 3025;
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
          resolve({ status: res.statusCode, data: JSON.parse(data), raw: data });
        } catch (e) {
          resolve({ status: res.statusCode, data, raw: data });
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
  console.log('🧪 VERIFYING STUDENT PROFILE CARDS & ROLE PERMISSIONS');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    try {
      fn();
      console.log(`  ✓ PASS: ${name}`);
      passed++;
    } catch (e) {
      console.error(`  ✗ FAIL: ${name} ->`, e.message);
      failed++;
    }
  }

  // 1. Snapshot check on DB students before any request
  const studentsBefore = await db.query("SELECT ug_id, name, roll_number, batch, department FROM students ORDER BY roll_number ASC");
  test('Existing Student Data Integrity: 65 students exist in DB', () => {
    assert.strictEqual(studentsBefore.length, 65);
    assert.strictEqual(studentsBefore[0].ug_id, '26UG033789');
    assert.strictEqual(studentsBefore[0].roll_number, 1);
  });

  // Start test server using official startServer export
  console.log('[Setup] Launching test server on port ' + PORT + '...');
  server = await startServer(PORT);
  await new Promise(r => setTimeout(r, 600));

  // Generate tokens
  const teacherToken = generateToken({
    id: 1,
    role: 'TEACHER',
    teacher_id: 'TESTTEACHER',
    name: 'Prof. N. Wagh',
    department: 'Computer Science & Engineering',
    division: '3CYBER7',
    batch: 'Both',
    subjects: 'DBMS, NCS'
  });

  const teacherBatch1Token = generateToken({
    id: 2,
    role: 'TEACHER',
    teacher_id: 'TCH_BATCH1',
    name: 'Prof. Batch 1 Specialist',
    department: 'Computer Science & Engineering',
    division: '3CYBER7',
    batch: 'Batch 1',
    subjects: 'DBMS'
  });

  const hodToken = generateToken({
    id: 99,
    role: 'HOD',
    username: 'HOD_CSE',
    name: 'Prof. (Dr.) A. K. Sharma',
    department: 'Computer Science & Engineering'
  });

  const studentToken = generateToken({
    id: 10,
    role: 'STUDENT',
    ug_id: '26UG033789'
  });

  console.log('\n[Phase 1] Testing Teacher Students API for Profile Cards...');
  const teacherStudentsRes = await makeRequest('/api/teacher/students', 'GET', null, teacherToken);

  test('Teacher GET /api/teacher/students returns 200 OK', () => {
    assert.strictEqual(teacherStudentsRes.status, 200);
    assert.strictEqual(teacherStudentsRes.data.success, true);
    assert.ok(Array.isArray(teacherStudentsRes.data.data));
    assert.strictEqual(teacherStudentsRes.data.data.length, 65);
  });

  test('Teacher students contain all required Profile Card fields', () => {
    const s = teacherStudentsRes.data.data[0];
    assert.ok(s.ug_id, 'Has ug_id');
    assert.ok(s.name, 'Has name');
    assert.ok(s.roll_number !== undefined, 'Has roll_number');
    assert.ok(s.batch, 'Has batch');
    assert.ok(s.division, 'Has division');
    assert.ok(s.department, 'Has department');
    assert.ok(s.semester, 'Has semester');
    assert.ok(s.attendance_percentage !== undefined, 'Has attendance_percentage');
    assert.ok(s.status, 'Has status');
    assert.strictEqual(s.password_hash, undefined, 'password_hash is NOT exposed');
  });

  console.log('\n[Phase 2] Testing Teacher Student Profile "More Details" API...');
  const teacherProfileRes = await makeRequest(`/api/teacher/students/${studentsBefore[0].ug_id}`, 'GET', null, teacherToken);

  test('Teacher GET /api/teacher/students/:ug_id returns 200 with complete profile', () => {
    assert.strictEqual(teacherProfileRes.status, 200);
    assert.strictEqual(teacherProfileRes.data.success, true);
    const data = teacherProfileRes.data.data;
    assert.ok(data.student, 'Contains student object');
    assert.strictEqual(data.student.ug_id, studentsBefore[0].ug_id);
    assert.strictEqual(data.student.password_hash, undefined, 'password_hash is NOT exposed');
    assert.ok(Array.isArray(data.attendanceHistory), 'Contains attendanceHistory array');
    assert.ok(Array.isArray(data.submissions), 'Contains submissions array');
    assert.ok(Array.isArray(data.results), 'Contains results array');
    assert.ok(Array.isArray(data.mentoring), 'Contains mentoring array');
  });

  console.log('\n[Phase 3] Testing Teacher Batch Scope RBAC Guard...');
  // Find a Batch 2 student
  const batch2Student = studentsBefore.find(s => s.batch === 'Batch 2');
  assert.ok(batch2Student, 'Batch 2 student found');

  const teacherBatch1RestrictedRes = await makeRequest(`/api/teacher/students/${batch2Student.ug_id}`, 'GET', null, teacherBatch1Token);

  test('Teacher restricted to Batch 1 is blocked from Batch 2 student with 403', () => {
    assert.strictEqual(teacherBatch1RestrictedRes.status, 403);
    assert.strictEqual(teacherBatch1RestrictedRes.data.success, false);
  });

  console.log('\n[Phase 4] Testing HOD Students API for Profile Cards...');
  const hodStudentsRes = await makeRequest('/api/hod/students?limit=30', 'GET', null, hodToken);

  test('HOD GET /api/hod/students returns 200 OK', () => {
    assert.strictEqual(hodStudentsRes.status, 200);
    assert.strictEqual(hodStudentsRes.data.success, true);
    assert.ok(Array.isArray(hodStudentsRes.data.students));
  });

  test('HOD students contain all required Profile Card fields with zero credential exposure', () => {
    const s = hodStudentsRes.data.students[0];
    assert.ok(s.ug_id, 'Has ug_id');
    assert.ok(s.name, 'Has name');
    assert.ok(s.roll_number !== undefined, 'Has roll_number');
    assert.ok(s.department, 'Has department');
    assert.ok(s.semester, 'Has semester');
    assert.ok(s.batch, 'Has batch');
    assert.ok(s.attendance_percentage !== undefined, 'Has attendance_percentage');
    assert.strictEqual(s.password_hash, undefined, 'password_hash is NOT exposed');
  });

  console.log('\n[Phase 5] Testing HOD Student "More Details" API...');
  const hodStudentDetailRes = await makeRequest(`/api/hod/students/${studentsBefore[0].ug_id}`, 'GET', null, hodToken);

  test('HOD GET /api/hod/students/:id returns 200 with complete student record', () => {
    assert.strictEqual(hodStudentDetailRes.status, 200);
    assert.strictEqual(hodStudentDetailRes.data.success, true);
    const d = hodStudentDetailRes.data;
    assert.ok(d.student, 'Has student object');
    assert.strictEqual(d.student.password_hash, undefined, 'password_hash is NOT exposed');
    assert.ok(Array.isArray(d.results), 'Has results array');
    assert.ok(Array.isArray(d.attendanceManual), 'Has attendanceManual array');
    assert.ok(Array.isArray(d.attendanceScans), 'Has attendanceScans array');
    assert.ok(Array.isArray(d.mentoring), 'Has mentoring array');
    assert.ok(Array.isArray(d.submissions), 'Has submissions array');
    assert.ok(Array.isArray(d.leaves), 'Has leaves array');
  });

  console.log('\n[Phase 6] Testing Security RBAC: Student blocked from HOD & Teacher endpoints...');
  const studentAccessTeacherRes = await makeRequest('/api/teacher/students', 'GET', null, studentToken);
  test('Student token blocked from /api/teacher/students with 403', () => {
    assert.strictEqual(studentAccessTeacherRes.status, 403);
  });

  const studentAccessHodRes = await makeRequest('/api/hod/students', 'GET', null, studentToken);
  test('Student token blocked from /api/hod/students with 403', () => {
    assert.strictEqual(studentAccessHodRes.status, 403);
  });

  // Final DB Check: Verify 100% preservation of student database rows
  const studentsAfter = await db.query("SELECT ug_id, name, roll_number, batch, department FROM students ORDER BY roll_number ASC");
  test('STRICT RULE: Existing Student Records 100% Unchanged', () => {
    assert.strictEqual(studentsAfter.length, studentsBefore.length);
    for (let i = 0; i < studentsBefore.length; i++) {
      assert.strictEqual(studentsAfter[i].ug_id, studentsBefore[i].ug_id);
      assert.strictEqual(studentsAfter[i].name, studentsBefore[i].name);
      assert.strictEqual(studentsAfter[i].roll_number, studentsBefore[i].roll_number);
      assert.strictEqual(studentsAfter[i].batch, studentsBefore[i].batch);
    }
  });

  console.log('\n================================================================');
  console.log(`TEST SUITE RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (server && server.close) server.close();
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
