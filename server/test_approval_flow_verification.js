// ============================================================================
// VERIFICATION TEST SUITE: HOD APPROVAL & PENDING STATUS SYNCHRONIZATION
// ============================================================================

const http = require('http');
const db = require('./db');

let server;
const PORT = 3012;

function makeRequest(path, method = 'GET', body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, `http://localhost:${PORT}`);
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const req = http.request(url, { method, headers }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runVerification() {
  console.log('================================================================');
  console.log('⚡ VERIFYING HOD APPROVAL SYSTEM & PENDING STATE RESOLUTION');
  console.log('================================================================');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✓ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${message}`);
      failed++;
    }
  }

  try {
    await db.initDB();
    const { startServer } = require('./server');
    server = await startServer(PORT);
    await new Promise(r => setTimeout(r, 600));

    // 1. Authenticate as HOD
    const loginRes = await makeRequest('/api/auth/hod-login', 'POST', {
      username: 'HOD_CSE',
      password: 'Hod@123'
    });
    assert(loginRes.status === 200, 'HOD Login succeeds with 200 OK');
    const token = loginRes.data.token;

    // 2. Initial Dashboard State
    const initDash = await makeRequest('/api/hod/dashboard', 'GET', null, token);
    assert(initDash.status === 200, 'GET /api/hod/dashboard returns 200');
    const initialPendingApprovals = initDash.data.stats.pendingApprovalsCount;
    const initialPendingLeaves = initDash.data.stats.pendingLeavesCount;
    console.log(`  ℹ Initial pending approvals: ${initialPendingApprovals}, pending leaves: ${initialPendingLeaves}`);

    // 3. Test Central Approvals: Create a new pending ticket
    const ticketDb = await db.run(`
      INSERT INTO department_approvals (
        request_type, title, description, department, requester_id, requester_name, requester_role, status
      ) VALUES (
        'GENERAL', 'Lab Upgrade Request 2026', 'Procurement of GPU nodes for AI lab',
        'Computer Science & Engineering', 'TCH01', 'Prof. N. Wagh', 'TEACHER', 'PENDING'
      )
    `);
    const ticketId = ticketDb.id;

    // Verify ticket appears in PENDING queue
    const pendingQueueBefore = await makeRequest('/api/hod/approvals?status=PENDING', 'GET', null, token);
    assert(pendingQueueBefore.status === 200, 'GET /api/hod/approvals?status=PENDING returns 200');
    const foundPendingBefore = (pendingQueueBefore.data.approvals || []).some(a => a.id === ticketId);
    assert(foundPendingBefore === true, 'New ticket is present in PENDING queue');

    // Verify dashboard reflects incremented pending approvals
    const dashAfterInsert = await makeRequest('/api/hod/dashboard', 'GET', null, token);
    assert(dashAfterInsert.data.stats.pendingApprovalsCount === initialPendingApprovals + 1, 'Dashboard pendingApprovalsCount incremented by 1');

    // 4. Process approval action: APPROVE
    const approveRes = await makeRequest(`/api/hod/approvals/${ticketId}/process`, 'POST', {
      action: 'APPROVED',
      remarks: 'Approved by HOD for budget cycle 2026-27'
    }, token);
    assert(approveRes.status === 200 && approveRes.data.success === true, 'POST /api/hod/approvals/:id/process with action APPROVED succeeds');

    // 5. CRITICAL TEST: Verify ticket NO LONGER appears in PENDING queue
    const pendingQueueAfter = await makeRequest('/api/hod/approvals?status=PENDING', 'GET', null, token);
    const foundPendingAfter = (pendingQueueAfter.data.approvals || []).some(a => a.id === ticketId);
    assert(foundPendingAfter === false, 'CRITICAL: Approved ticket is NO LONGER present in PENDING queue!');

    // Verify ticket appears in APPROVED history
    const approvedQueue = await makeRequest('/api/hod/approvals?status=APPROVED', 'GET', null, token);
    const foundApproved = (approvedQueue.data.approvals || []).some(a => a.id === ticketId && a.status === 'APPROVED');
    assert(foundApproved === true, 'Approved ticket is properly listed in APPROVED history');

    // 6. CRITICAL TEST: Verify Dashboard pending count is decremented back to initial
    const dashAfterApprove = await makeRequest('/api/hod/dashboard', 'GET', null, token);
    assert(dashAfterApprove.data.stats.pendingApprovalsCount === initialPendingApprovals, 'CRITICAL: Dashboard pendingApprovalsCount decremented back to original count');
    const inDashPendingList = (dashAfterApprove.data.pendingApprovals || []).some(a => a.id === ticketId);
    assert(inDashPendingList === false, 'CRITICAL: Approved ticket does NOT show up in dashboard pending list');

    // 7. Test Leave Request Flow
    const leaveDb = await db.run(`
      INSERT INTO leave_requests (
        applicant_type, applicant_id, applicant_name, leave_type, start_date, end_date, total_days, reason, status
      ) VALUES (
        'FACULTY', 'TCH01', 'Prof. N. Wagh', 'SICK', '2026-10-20', '2026-10-21', 2, 'Medical recovery', 'PENDING'
      )
    `);
    const leaveId = leaveDb.id;

    // Verify leave in PENDING leaves
    const leavesPendingBefore = await makeRequest('/api/hod/leaves?status=PENDING', 'GET', null, token);
    const foundLeaveBefore = (leavesPendingBefore.data.leaves || []).some(l => l.id === leaveId);
    assert(foundLeaveBefore === true, 'New leave request is in PENDING leaves');

    // Review and Approve leave
    const reviewLeaveRes = await makeRequest(`/api/hod/leaves/${leaveId}/review`, 'POST', {
      action: 'APPROVED',
      remarks: 'Granted with full duty pay'
    }, token);
    assert(reviewLeaveRes.status === 200 && reviewLeaveRes.data.success === true, 'POST /api/hod/leaves/:id/review with action APPROVED succeeds');

    // CRITICAL: Verify leave is no longer pending
    const leavesPendingAfter = await makeRequest('/api/hod/leaves?status=PENDING', 'GET', null, token);
    const foundLeaveAfter = (leavesPendingAfter.data.leaves || []).some(l => l.id === leaveId);
    assert(foundLeaveAfter === false, 'CRITICAL: Approved leave is NO LONGER in PENDING leaves');

    // 8. Test Internal Marks Moderation syncing with department_approvals
    // Check if there is an INTERNAL_MARKS pending approval ticket
    const marksApproval = await db.get("SELECT * FROM department_approvals WHERE request_type = 'INTERNAL_MARKS' AND status = 'PENDING'");
    if (marksApproval) {
      console.log(`  ℹ Found pending internal marks approval ticket #${marksApproval.id}: "${marksApproval.title}"`);
      const reviewMarksRes = await makeRequest('/api/hod/internal-marks/review', 'POST', {
        subject: 'Database Management System',
        exam_name: 'Mid-Semester Assessment',
        action: 'APPROVE',
        remarks: 'Marks verified and approved by HOD'
      }, token);
      assert(reviewMarksRes.status === 200 && reviewMarksRes.data.success === true, 'POST /api/hod/internal-marks/review succeeds');

      const updatedTicket = await db.get("SELECT * FROM department_approvals WHERE id = ?", [marksApproval.id]);
      assert(updatedTicket && updatedTicket.status === 'APPROVED', 'CRITICAL: Linked department_approvals ticket for marks is automatically marked APPROVED');
    }

    console.log('\n================================================================');
    console.log(`VERIFICATION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================');

    if (server) server.close();
    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('Fatal test error:', err);
    if (server) server.close();
    process.exit(1);
  }
}

runVerification();
