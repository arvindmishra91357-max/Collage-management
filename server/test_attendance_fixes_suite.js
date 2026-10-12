const http = require('http');
const db = require('./db');
const fs = require('fs');
const path = require('path');
const { generateToken } = require('./middleware/auth');

const PORT = 3005;
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

function getTomorrowDateString() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getTodayDateString() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function runTests() {
  console.log('================================================================');
  console.log('⚡ RUNNING ATTENDANCE BUG FIXES VALIDATION SUITE');
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
    console.log('[Phase 1] Starting Test Server on port ' + PORT + '...');
    await db.initDB();
    const { startServer } = require('./server');
    server = await startServer(PORT);
    await new Promise(r => setTimeout(r, 600));

    // Authenticate Teacher & Admin & Student tokens
    console.log('[Phase 2] Generating Test Tokens...');
    const teacherToken = generateToken({
      id: 999,
      teacher_id: 'TESTTEACHER',
      name: 'Prof. N. Wagh',
      role: 'TEACHER',
      subjects: 'DBMS, NCS',
      batch: 'Both'
    });

    const adminToken = generateToken({
      id: 1,
      name: 'Bettu&Bunny',
      role: 'ADMIN'
    });

    const studentToken = generateToken({
      id: 13,
      ug_id: '26UG033181',
      name: 'ARVIND KUMAR',
      roll_number: 13,
      batch: 'Batch 1',
      role: 'STUDENT'
    });

    assert(!!teacherToken, 'Teacher token generated successfully');
    assert(!!adminToken, 'Admin token generated successfully');
    assert(!!studentToken, 'Student token generated successfully');

    const tomorrow = getTomorrowDateString();
    const today = getTodayDateString();

    // Phase 3: Future Date Attendance Rejection Tests
    console.log('\n[Phase 3] Testing Future Date Attendance Rejection...');
    
    // Teacher future date attempt
    const teacherFutureRes = await makeRequest('/api/teacher/attendance/manual', 'POST', {
      subject: 'DBMS',
      batch: 'Batch 1',
      date: tomorrow,
      records: [{ ug_id: '26UG033181', name: 'ARVIND KUMAR', status: 'PRESENT' }]
    }, teacherToken);
    assert(teacherFutureRes.status === 400, 'Teacher: Future date attendance rejected with 400', `Got status ${teacherFutureRes.status}`);
    assert(teacherFutureRes.data?.message?.includes('future'), 'Teacher: Error message specifies future date not allowed', teacherFutureRes.data?.message);

    // Admin future date attempt
    const adminFutureRes = await makeRequest('/api/attendance/manual', 'POST', {
      subject: 'DBMS',
      batch: 'Batch 1',
      date: tomorrow,
      records: [{ ug_id: '26UG033181', student_name: 'ARVIND KUMAR', status: 'PRESENT' }]
    }, adminToken);
    assert(adminFutureRes.status === 400, 'Admin: Future date attendance rejected with 400', `Got status ${adminFutureRes.status}`);
    assert(adminFutureRes.data?.message?.includes('future'), 'Admin: Error message specifies future date not allowed', adminFutureRes.data?.message);

    // Teacher valid today attendance attempt
    const teacherTodayRes = await makeRequest('/api/teacher/attendance/manual', 'POST', {
      subject: 'DBMS',
      batch: 'Batch 1',
      date: today,
      records: [{ ug_id: '26UG033181', name: 'ARVIND KUMAR', status: 'PRESENT', remarks: 'Faculty Roll Call' }]
    }, teacherToken);
    assert(teacherTodayRes.status === 200, 'Teacher: Today attendance successfully recorded (status 200)', `Got status ${teacherTodayRes.status}`);

    // Phase 4: Student Portal Method Label & Attendance History Tests
    console.log('\n[Phase 4] Testing Student Portal Method Label & Summary...');
    const studentSummaryRes = await makeRequest('/api/attendance/student-summary', 'GET', null, studentToken);
    assert(studentSummaryRes.status === 200, 'Student attendance summary retrieved successfully');
    
    const history = studentSummaryRes.data?.history || [];
    assert(history.length > 0, 'Attendance history has records');

    const manualRecord = history.find(h => h.subject === 'DBMS' && h.date === today);
    assert(!!manualRecord, 'Found today DBMS record in student history');
    assert(manualRecord?.method === 'MANUAL', 'Record has method === "MANUAL" (not QR scan)');

    // Test label mapping logic exactly as in studentApp.js
    const mapMethodLabel = (h) => {
      const isManual = (h.method === 'MANUAL' || (h.remarks && (h.remarks.toLowerCase().includes('manual') || h.remarks.toLowerCase().includes('roll call') || h.remarks.toLowerCase().includes('admin') || h.remarks.toLowerCase().includes('faculty') || h.remarks.toLowerCase().includes('teacher'))));
      const isFaceScan = (h.method === 'FACE_SCAN' || (h.remarks && h.remarks.toLowerCase().includes('face')));
      const isLeave = (h.status === 'LEAVE' || (h.remarks && h.remarks.toLowerCase().includes('leave')));
      if (isLeave) return '➖ Leave / Excused';
      if (isFaceScan) return '👤 Biometric Face Scan';
      if (isManual) return '✍️ Faculty Manual Entry';
      return '📷 QR Code Scan';
    };

    assert(mapMethodLabel(manualRecord) === '✍️ Faculty Manual Entry', 'Manual record correctly labeled "✍️ Faculty Manual Entry"');
    assert(mapMethodLabel({ method: 'QR_GPS', status: 'PRESENT' }) === '📷 QR Code Scan', 'QR record correctly labeled "📷 QR Code Scan"');
    assert(mapMethodLabel({ method: 'FACE_SCAN', status: 'PRESENT' }) === '👤 Biometric Face Scan', 'Face scan correctly labeled "👤 Biometric Face Scan"');
    assert(mapMethodLabel({ method: 'MANUAL', status: 'LEAVE' }) === '➖ Leave / Excused', 'Leave record correctly labeled "➖ Leave / Excused"');

    // Phase 5: Frontend Code Inspection & UI Safeguards
    console.log('\n[Phase 5] Verifying Frontend Code Integrity & Safeguards...');
    
    // Check teacherApp.js
    const teacherAppCode = fs.readFileSync(path.join(__dirname, '../public/js/teacherApp.js'), 'utf8');
    assert(teacherAppCode.includes('id="quick-date-input" class="form-control" value="${todayStr}" max="${todayStr}"'), 'teacherApp.js: quick-date-input has max="${todayStr}"');
    assert(teacherAppCode.includes('id="manual-date-input" class="form-control" value="${todayStr}" max="${todayStr}"'), 'teacherApp.js: manual-date-input has max="${todayStr}"');
    assert(teacherAppCode.includes('id="report-date-select" class="form-control" value="${todayStr}" max="${todayStr}"'), 'teacherApp.js: report-date-select has max="${todayStr}"');
    assert(teacherAppCode.includes('Attendance cannot be recorded for a future date.'), 'teacherApp.js: has future date validation warning');

    // Check adminApp.js
    const adminAppCode = fs.readFileSync(path.join(__dirname, '../public/js/adminApp.js'), 'utf8');
    assert(adminAppCode.includes('id="manual-date" class="form-control" value="${todayStr}" max="${todayStr}"'), 'adminApp.js: manual-date has max="${todayStr}"');
    assert(adminAppCode.includes('id="admin-quick-date" class="form-control" value="${todayStr}" max="${todayStr}"'), 'adminApp.js: admin-quick-date has max="${todayStr}"');
    assert(adminAppCode.includes('Attendance cannot be recorded for a future date.'), 'adminApp.js: has future date validation warning');

    // Check studentApp.js
    const studentAppCode = fs.readFileSync(path.join(__dirname, '../public/js/studentApp.js'), 'utf8');
    assert(studentAppCode.includes('id="btn-refresh-student-attendance"'), 'studentApp.js: has interactive refresh button in attendance tab');
    assert(studentAppCode.includes('refreshAttendanceTabWithFeedback'), 'studentApp.js: has refreshAttendanceTabWithFeedback function');
    assert(studentAppCode.includes('Faculty Manual Entry'), 'studentApp.js: dynamic attendance label differentiates Faculty Manual Entry from QR Scan');
    assert(!studentAppCode.includes('• 📷 QR Scan</div>'), 'studentApp.js: hardcoded "• 📷 QR Scan" removed completely');
    assert(studentAppCode.includes("this.currentTab === 'attendance'") && studentAppCode.includes('12000'), 'studentApp.js: auto-syncs attendance in background interval');

    console.log('\n================================================================');
    console.log(`🎉 TEST SUMMARY: Passed: ${passed} | Failed: ${failed}`);
    console.log('================================================================');

  } catch (err) {
    console.error('Test error:', err);
    failed++;
  } finally {
    if (server) {
      server.close();
    }
    process.exit(failed > 0 ? 1 : 0);
  }
}

runTests();
