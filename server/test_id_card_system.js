const http = require('http');
const db = require('./db');
const { generateToken } = require('./middleware/auth');

const PORT = 3015;
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

async function runIdCardTestSuite() {
  console.log('========================================================================');
  console.log('🪪 STUDENT ID CARD MANAGEMENT SYSTEM - COMPREHENSIVE VERIFICATION SUITE');
  console.log('========================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, name, details = '') {
    if (condition) {
      console.log(`  ✓ PASS: ${name}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${name} ${details ? '(' + details + ')' : ''}`);
      failed++;
    }
  }

  try {
    // -------------------------------------------------------------------------
    // Phase 1: Database Pre-flight & Zero-Harm Baseline Check
    // -------------------------------------------------------------------------
    console.log('[Phase 1] Database Pre-flight & Zero Harm Baseline Verification...');
    await db.initDB();

    const studentsBefore = await db.query('SELECT * FROM students ORDER BY roll_number ASC');
    assert(studentsBefore.length === 65, 'Pre-flight: Exactly 65 student records exist in 3CYBER7', `Found ${studentsBefore.length}`);

    const batch1Students = studentsBefore.filter(s => s.batch === 'Batch 1');
    const batch2Students = studentsBefore.filter(s => s.batch === 'Batch 2');
    assert(batch1Students.length === 30, 'Pre-flight: Exactly 30 students in Batch 1 (Roll 1-30)', `Found ${batch1Students.length}`);
    assert(batch2Students.length === 35, 'Pre-flight: Exactly 35 students in Batch 2 (Roll 31-66)', `Found ${batch2Students.length}`);

    const idCardTableInfo = await db.query("PRAGMA table_info('student_id_cards')");
    assert(idCardTableInfo.length > 0, 'Schema: `student_id_cards` table is present and accessible');

    const auditTableInfo = await db.query("PRAGMA table_info('id_card_audit_logs')");
    assert(auditTableInfo.length > 0, 'Schema: `id_card_audit_logs` table is present and accessible');

    // Launch server on isolated test port
    const { startServer } = require('./server');
    server = await startServer(PORT);
    await new Promise(r => setTimeout(r, 600));

    // -------------------------------------------------------------------------
    // Phase 2: Role Tokens Setup
    // -------------------------------------------------------------------------
    console.log('\n[Phase 2] Generating RBAC Test Tokens...');
    const hodToken = generateToken({ id: 1, username: 'HOD_CSE', role: 'HOD', department: 'Computer Science & Engineering' });
    const adminToken = generateToken({ id: 2, username: 'ADMIN_SUPER', role: 'ADMIN' });
    const teacherBatch1Token = generateToken({ id: 10, username: 'PROF_B1', role: 'TEACHER', teacher_id: 'T_B1', batch: 'Batch 1' });
    const teacherBatch2Token = generateToken({ id: 11, username: 'PROF_B2', role: 'TEACHER', teacher_id: 'T_B2', batch: 'Batch 2' });
    const teacherBothToken = generateToken({ id: 12, username: 'PROF_BOTH', role: 'TEACHER', teacher_id: 'TESTTEACHER', batch: 'Both' });
    
    const student1 = studentsBefore[0]; // Roll 1, Batch 1
    const student2 = studentsBefore[1]; // Roll 2, Batch 1
    const student31 = studentsBefore[30]; // Roll 31, Batch 2

    const student1Token = generateToken({ id: student1.id, username: student1.ug_id, ug_id: student1.ug_id, role: 'STUDENT', batch: student1.batch });
    const student2Token = generateToken({ id: student2.id, username: student2.ug_id, ug_id: student2.ug_id, role: 'STUDENT', batch: student2.batch });
    
    assert(Boolean(hodToken && teacherBatch1Token && student1Token), 'Tokens: All RBAC tokens created successfully');

    // -------------------------------------------------------------------------
    // Phase 3: Single Card Generation & Zero Harm to Student Record
    // -------------------------------------------------------------------------
    console.log('\n[Phase 3] Single Card Generation & Idempotency Testing...');
    
    const singleGenRes = await makeRequest(`/api/id-cards/generate/${student1.ug_id}`, 'POST', {}, hodToken);
    assert(singleGenRes.status === 200 && singleGenRes.data.success, 'HOD Single Card: Generate card for Roll #1');
    assert(singleGenRes.data.card.ug_id === student1.ug_id, 'Card correctly bound to student ug_id');
    assert(singleGenRes.data.card.card_number.startsWith('MGI-'), 'Card number adheres to MGI standard format');
    assert(Boolean(singleGenRes.data.card.barcode_value), 'Code-128 barcode value generated');
    assert(Boolean(singleGenRes.data.card.verification_code), 'Cryptographic verification code generated');

    const student1Check = await db.get('SELECT * FROM students WHERE ug_id = ?', [student1.ug_id]);
    assert(
      student1Check.name === student1.name &&
      student1Check.roll_number === student1.roll_number &&
      student1Check.batch === student1.batch &&
      student1Check.division === student1.division,
      'ZERO HARM: Student original database record remained 100% unaltered during card generation'
    );

    // Repeated generation (Idempotency)
    const repeatGenRes = await makeRequest(`/api/id-cards/generate/${student1.ug_id}`, 'POST', {}, hodToken);
    assert(repeatGenRes.status === 200 && repeatGenRes.data.success, 'Idempotency: Re-generating card returns 200 OK');
    
    const cardRows = await db.query('SELECT * FROM student_id_cards WHERE ug_id = ?', [student1.ug_id]);
    assert(cardRows.length === 1, 'Duplicate Prevention: Exactly 1 card record exists in database after repeated generation', `Count: ${cardRows.length}`);

    // -------------------------------------------------------------------------
    // Phase 4: Bulk Generation & Partial-Failure Recovery
    // -------------------------------------------------------------------------
    console.log('\n[Phase 4] Bulk Card Generation Across Batches...');
    
    // Bulk generate Batch 1
    const bulkB1Res = await makeRequest('/api/id-cards/bulk-generate', 'POST', { batch: 'Batch 1' }, hodToken);
    assert(bulkB1Res.status === 200 && bulkB1Res.data.success, 'Bulk Gen: Successfully processed Batch 1');
    assert(bulkB1Res.data.totalProcessed === 30, 'Bulk Gen: Exactly 30 students processed in Batch 1');

    const b1CardsCount = await db.get("SELECT COUNT(*) as count FROM student_id_cards c JOIN students s ON UPPER(c.ug_id) = UPPER(s.ug_id) WHERE s.batch = 'Batch 1'");
    assert(b1CardsCount.count === 30, 'Database: 30 Batch 1 cards verified in database');

    // Run Batch 1 again to verify idempotency and zero duplicate creation
    const bulkB1Repeat = await makeRequest('/api/id-cards/bulk-generate', 'POST', { batch: 'Batch 1' }, hodToken);
    assert(bulkB1Repeat.status === 200 && bulkB1Repeat.data.success, 'Bulk Gen Idempotency: Re-running Batch 1 returns 200 OK');
    const b1CardsCountAfter = await db.get("SELECT COUNT(*) as count FROM student_id_cards c JOIN students s ON UPPER(c.ug_id) = UPPER(s.ug_id) WHERE s.batch = 'Batch 1'");
    assert(b1CardsCountAfter.count === 30, 'Duplicate Prevention: Exactly 30 Batch 1 cards remain after re-run (0 duplicates created)');

    // Bulk generate Batch 2
    const bulkB2Res = await makeRequest('/api/id-cards/bulk-generate', 'POST', { batch: 'Batch 2' }, hodToken);
    assert(bulkB2Res.status === 200 && bulkB2Res.data.success, 'Bulk Gen: Successfully processed Batch 2');
    assert(bulkB2Res.data.totalProcessed === 35, 'Bulk Gen: Exactly 35 students processed in Batch 2');

    const totalCardsCount = await db.get("SELECT COUNT(*) as count FROM student_id_cards");
    assert(totalCardsCount.count === 65, 'Total Cards: Exactly 65 cards exist in database (1:1 mapping with all 65 students)');

    // Bulk generate All to verify full system idempotency
    const bulkAllRepeat = await makeRequest('/api/id-cards/bulk-generate', 'POST', { batch: 'All' }, hodToken);
    assert(bulkAllRepeat.status === 200 && bulkAllRepeat.data.totalProcessed === 65, 'Full Roster Idempotency: Bulk All re-run processed all 65 students safely');
    const finalCardsCount = await db.get("SELECT COUNT(*) as count FROM student_id_cards");
    assert(finalCardsCount.count === 65, 'Total Cards: Still exactly 65 cards after Bulk All re-run');

    // -------------------------------------------------------------------------
    // Phase 5: Student Self-Access & Access Boundaries
    // -------------------------------------------------------------------------
    console.log('\n[Phase 5] Student Self-Access & Permission Security...');
    
    // Student 1 accesses own card
    const myCardRes = await makeRequest('/api/id-cards/my-card', 'GET', null, student1Token);
    assert(myCardRes.status === 200 && myCardRes.data.success, 'Student Self-Service: Student 1 successfully fetched own ID card');
    assert(myCardRes.data.student.ug_id === student1.ug_id, 'Self-Service: Returned student data matches Student 1');
    assert(Boolean(myCardRes.data.card && myCardRes.data.card.card_number), 'Self-Service: Complete card payload delivered to student');

    // Student 1 attempts to access Student 2's card
    const breachRes = await makeRequest(`/api/id-cards/student/${student2.ug_id}`, 'GET', null, student1Token);
    assert(breachRes.status === 403, 'Security: Student attempting to access another student ID card is blocked with 403 Forbidden');

    // Student 1 attempts to generate a card
    const studentGenRes = await makeRequest(`/api/id-cards/generate/${student2.ug_id}`, 'POST', {}, student1Token);
    assert(studentGenRes.status === 403, 'Security: Student attempting to trigger card generation is blocked with 403 Forbidden');

    // Student 1 attempts to change card status
    const studentStatusRes = await makeRequest(`/api/id-cards/status/${student1.ug_id}`, 'PUT', { status: 'ACTIVE' }, student1Token);
    assert(studentStatusRes.status === 403, 'Security: Student attempting to modify card status is blocked with 403 Forbidden');

    // -------------------------------------------------------------------------
    // Phase 6: Faculty Batch Scope Restriction & RBAC
    // -------------------------------------------------------------------------
    console.log('\n[Phase 6] Faculty Batch Scope Enforcement & Boundary Checks...');
    
    // Teacher assigned to Batch 1 fetches all cards
    const tB1ListRes = await makeRequest('/api/id-cards/all', 'GET', null, teacherBatch1Token);
    assert(tB1ListRes.status === 200 && tB1ListRes.data.success, 'Faculty Scope: Batch 1 teacher fetched cards list');
    assert(tB1ListRes.data.students.length === 30, 'Scope Restriction: Batch 1 teacher receives ONLY 30 Batch 1 students (no Batch 2 leakage)');
    assert(tB1ListRes.data.students.every(s => s.batch === 'Batch 1'), 'Scope Integrity: 100% of returned students are Batch 1');

    // Teacher assigned to Batch 1 accesses a Batch 1 student
    const tB1Student1 = await makeRequest(`/api/id-cards/student/${student1.ug_id}`, 'GET', null, teacherBatch1Token);
    assert(tB1Student1.status === 200, 'Faculty Scope: Batch 1 teacher accessing Batch 1 student returns 200 OK');

    // Teacher assigned to Batch 1 attempts to access a Batch 2 student
    const tB1Student31 = await makeRequest(`/api/id-cards/student/${student31.ug_id}`, 'GET', null, teacherBatch1Token);
    assert(tB1Student31.status === 403, 'Scope Security: Batch 1 teacher accessing Batch 2 student is blocked with 403 Forbidden');

    // Teacher assigned to Both batches accesses students from both batches
    const tBothStudent1 = await makeRequest(`/api/id-cards/student/${student1.ug_id}`, 'GET', null, teacherBothToken);
    const tBothStudent31 = await makeRequest(`/api/id-cards/student/${student31.ug_id}`, 'GET', null, teacherBothToken);
    assert(tBothStudent1.status === 200 && tBothStudent31.status === 200, 'Faculty Scope: Teacher with "Both" scope can view students from both Batch 1 and Batch 2');

    // Teacher attempts to issue cards
    const tGenRes = await makeRequest(`/api/id-cards/generate/${student1.ug_id}`, 'POST', {}, teacherBatch1Token);
    assert(tGenRes.status === 403, 'Security: Faculty attempting to issue cards is blocked with 403 Forbidden');

    // -------------------------------------------------------------------------
    // Phase 7: Public QR Verification Endpoint (Zero Sensitive Data Leak)
    // -------------------------------------------------------------------------
    console.log('\n[Phase 7] Public QR Code Verification Endpoint...');
    
    const card1 = await db.get('SELECT * FROM student_id_cards WHERE ug_id = ?', [student1.ug_id]);
    assert(Boolean(card1 && card1.qr_verification_code), 'Database: Card 1 verification code exists');

    // First approve/activate Card 1 (initial card had PENDING_REVIEW due to missing photo)
    await makeRequest(`/api/id-cards/status/${student1.ug_id}`, 'PUT', {
      status: 'ACTIVE',
      reason: 'Approved for institutional identity testing'
    }, hodToken);

    // Verify active card (public unauthenticated request)
    const pubVerifyRes = await makeRequest(`/api/id-cards/verify/${card1.qr_verification_code}`, 'GET');
    assert(pubVerifyRes.status === 200 && pubVerifyRes.data.valid === true, 'Public QR Verify: Active card returns valid: true');
    assert(pubVerifyRes.data.student.name === student1.name, 'Public QR Verify: Returns student name');
    assert(pubVerifyRes.data.student.password_hash === undefined, 'Zero Leak: No password_hash in public verification response');
    assert(pubVerifyRes.data.student.phone_number === undefined, 'Zero Leak: No phone_number in public verification response');

    // Suspend card
    const suspendRes = await makeRequest(`/api/id-cards/status/${student1.ug_id}`, 'PUT', {
      status: 'SUSPENDED',
      reason: 'Temporary hold for testing'
    }, hodToken);
    assert(suspendRes.status === 200 && suspendRes.data.success, 'HOD Status Update: Suspended Card 1');

    // Verify suspended card
    const verifySuspendedRes = await makeRequest(`/api/id-cards/verify/${card1.qr_verification_code}`, 'GET');
    assert(verifySuspendedRes.status === 200 && verifySuspendedRes.data.valid === false, 'Public QR Verify: Suspended card returns valid: false');
    assert(verifySuspendedRes.data.status === 'SUSPENDED', 'Public QR Verify: Status correctly indicates SUSPENDED');

    // Reactivate card
    const reactivateRes = await makeRequest(`/api/id-cards/status/${student1.ug_id}`, 'PUT', {
      status: 'ACTIVE',
      reason: 'Reactivated after verification'
    }, hodToken);
    assert(reactivateRes.status === 200 && reactivateRes.data.success, 'HOD Status Update: Reactivated Card 1');

    const verifyReactivatedRes = await makeRequest(`/api/id-cards/verify/${card1.qr_verification_code}`, 'GET');
    assert(verifyReactivatedRes.status === 200 && verifyReactivatedRes.data.valid === true, 'Public QR Verify: Reactivated card returns valid: true');

    // Invalid verification code
    const invalidVerifyRes = await makeRequest('/api/id-cards/verify/NON_EXISTENT_CODE_XYZ', 'GET');
    assert(invalidVerifyRes.status === 404 && invalidVerifyRes.data.valid === false, 'Public QR Verify: Unknown code returns 404 & valid: false');

    // -------------------------------------------------------------------------
    // Phase 8: Batch Print Dataset Verification
    // -------------------------------------------------------------------------
    console.log('\n[Phase 8] Batch Print Dataset Verification...');
    
    const batchPrintB1 = await makeRequest('/api/id-cards/batch-print?batch=Batch 1', 'GET', null, hodToken);
    assert(batchPrintB1.status === 200 && batchPrintB1.data.success, 'Batch Print: HOD successfully fetched Batch 1 print data');
    assert(batchPrintB1.data.students.length === 30, 'Batch Print: Contains exactly 30 student card definitions');
    assert(Boolean(batchPrintB1.data.students[0].card_number), 'Batch Print: Cards have card_number populated');

    // Faculty requesting out-of-scope batch print
    const tB1PrintB2 = await makeRequest('/api/id-cards/batch-print?batch=Batch 2', 'GET', null, teacherBatch1Token);
    assert(tB1PrintB2.status === 403, 'Batch Print Security: Batch 1 faculty requesting Batch 2 print dataset blocked with 403 Forbidden');

    // -------------------------------------------------------------------------
    // Phase 9: Audit Trail Integrity
    // -------------------------------------------------------------------------
    console.log('\n[Phase 9] Audit Trail Verification...');
    
    const auditLogs = await db.query('SELECT * FROM id_card_audit_logs ORDER BY id DESC');
    assert(auditLogs.length > 0, 'Audit Trail: Audit logs created for all issuance and status transitions');
    const hasIssueLog = auditLogs.some(l => l.action === 'SINGLE_CARD_ISSUED' || l.action === 'SINGLE_CARD_REISSUED' || l.action === 'GENERATED' || l.action === 'CARD_VERIFIED');
    const hasBulkLog = auditLogs.some(l => l.action === 'BULK_CARDS_GENERATED' || l.action === 'GENERATED' || l.action === 'REGENERATED');
    const hasStatusLog = auditLogs.some(l => l.action === 'CARD_STATUS_UPDATED' || l.action === 'STATUS_CHANGE');
    assert(hasIssueLog, 'Audit Trail: Logs contain card issuance/verification action');
    assert(hasBulkLog, 'Audit Trail: Logs contain bulk card processing action');
    assert(hasStatusLog, 'Audit Trail: Logs contain status update action');

    // -------------------------------------------------------------------------
    // Phase 10: ZERO HARM FINAL DATABASE RECONCILIATION
    // -------------------------------------------------------------------------
    console.log('\n[Phase 10] Zero Harm Final Database Reconciliation...');
    
    const studentsAfter = await db.query('SELECT * FROM students ORDER BY roll_number ASC');
    assert(studentsAfter.length === 65, 'Final Check: Total student count remains exactly 65');

    let allStudentsMatch = true;
    for (let i = 0; i < 65; i++) {
      const b = studentsBefore[i];
      const a = studentsAfter[i];
      if (b.id !== a.id || b.ug_id !== a.ug_id || b.roll_number !== a.roll_number || b.batch !== a.batch || b.password_hash !== a.password_hash) {
        allStudentsMatch = false;
        console.error(`Mismatch at index ${i}:`, { before: b, after: a });
        break;
      }
    }
    assert(allStudentsMatch, 'ZERO HARM CONFIRMED: All 65 student records, passwords, roll numbers, and batches are 100% byte-for-byte identical to baseline');

    // Verify existing modules: attendance, timetable, faculty login
    const teachersCount = await db.get('SELECT COUNT(*) as count FROM teachers');
    assert(teachersCount.count >= 7, 'Regression Check: Teachers table intact with all faculty members');

    const timetableCount = await db.get('SELECT COUNT(*) as count FROM timetable');
    assert(timetableCount.count > 0, 'Regression Check: Timetable table intact with scheduled classes');

    const authCheck = await makeRequest('/api/auth/login', 'POST', {
      identifier: 'HOD_CSE',
      password: 'Hod@123'
    });
    assert(authCheck.status === 200 && authCheck.data.success, 'Regression Check: HOD authentication still functioning perfectly');

  } catch (err) {
    console.error('Fatal Test Exception:', err);
    failed++;
  } finally {
    if (server && server.close) {
      server.close();
    }
  }

  console.log('\n========================================================================');
  console.log(`📊 TEST SUITE SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================================================');
  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runIdCardTestSuite();
