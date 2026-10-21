const http = require('http');
const fs = require('fs');
const path = require('path');
const db = require('./db');

const PORT = 3028;
process.env.PORT = PORT;

let server;

function makeRequest(reqPath, method = 'GET', headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(reqPath, `http://localhost:${PORT}`);
    const reqHeaders = { ...headers };

    const req = http.request({
      hostname: 'localhost',
      port: PORT,
      path: url.pathname + url.search,
      method,
      headers: reqHeaders
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let parsed = data;
        try { parsed = JSON.parse(data); } catch (e) {}
        resolve({ status: res.statusCode, headers: res.headers, data: parsed, raw: data });
      });
    });

    req.on('error', reject);
    req.end();
  });
}

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

async function runTestSuite() {
  console.log('========================================================================');
  console.log('🎨 STUDENT ID CARD REDESIGN & INTEGRATION VERIFICATION SUITE');
  console.log('========================================================================\n');

  try {
    const { startServer } = require('./server');
    server = await startServer(PORT);
    await new Promise(r => setTimeout(r, 600));

    // 1. Verify 3D Avatar Assets Exist on disk and are valid SVGs
    console.log('[Test 1] Verifying 3D Student Avatar Assets...');
    const neutralPath = path.join(__dirname, '..', 'public', 'assets', 'avatars', 'student-neutral.svg');
    const malePath = path.join(__dirname, '..', 'public', 'assets', 'avatars', 'student-male.svg');
    const femalePath = path.join(__dirname, '..', 'public', 'assets', 'avatars', 'student-female.svg');

    assert(fs.existsSync(neutralPath), '3D Neutral avatar asset exists');
    assert(fs.existsSync(malePath), '3D Male avatar asset exists');
    assert(fs.existsSync(femalePath), '3D Female avatar asset exists');

    const neutralSvg = fs.readFileSync(neutralPath, 'utf8');
    assert(neutralSvg.includes('<svg') && neutralSvg.includes('STUDENT'), 'Neutral avatar is valid SVG');

    // 2. Verify Client-side Rendering Rules in idCardApp.js
    console.log('\n[Test 2] Verifying Client-side ID Card Rendering Rules...');
    const idCardAppCode = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'idCardApp.js'), 'utf8');
    
    // Check Roll Number removal from rendered card
    assert(!idCardAppCode.includes('ROLL #${rollNo}'), 'Roll number section completely removed from Front card');
    assert(!idCardAppCode.includes('ROLL #${String(s.roll_number)'), 'No visible roll number template on Front card');

    // Check Prominent UG ID badge
    assert(idCardAppCode.includes('id-card-ugid-badge-wrap'), 'Prominent UG ID badge wrapper is present');
    assert(idCardAppCode.includes('id-card-ugid-number'), 'UG ID number element is present');

    // Check Single QR code and Barcode removal
    assert(idCardAppCode.includes('id-card-qr-box'), 'Single sharp QR box container is present');
    assert(!idCardAppCode.includes('id-card-barcode-wrap'), 'Barcode wrapper removed from Back face');
    assert(!idCardAppCode.includes('generateBarcodeSvg'), 'Barcode generator removed from Back face');

    // Check 3D Avatar Fallback Logic
    assert(idCardAppCode.includes('getAvatarForStudent'), 'Avatar resolver function getAvatarForStudent present');
    assert(idCardAppCode.includes('student-male.svg') && idCardAppCode.includes('student-female.svg') && idCardAppCode.includes('student-neutral.svg'), 'All three 3D avatar fallbacks wired into resolver');
    assert(idCardAppCode.includes('handleImageError'), 'Graceful image error fallback handler present');

    // Check Large Preview Modal
    assert(idCardAppCode.includes('id-card-large-modal'), 'Large preview modal class wired into openPreviewModal');
    assert(idCardAppCode.includes('renderSideBySideHTML'), 'Side-by-Side view renderer present');
    assert(idCardAppCode.includes('switchModalView'), 'Modal view switcher between Side-by-Side and 3D Flip present');

    // 3. Verify Server Endpoints for Public Verification
    console.log('\n[Test 3] Verifying Public Verification Server Endpoints...');
    // A. Check that /verify-card.html serves 200 OK
    const htmlPageRes = await makeRequest('/verify-card.html');
    assert(htmlPageRes.status === 200, 'GET /verify-card.html returns 200 OK');
    assert(htmlPageRes.raw.includes('Official Student ID Card Verification'), 'verify-card.html contains verification page title');

    // B. Check that /verify/:code serves 200 OK (Rewritten route)
    const cardRecord = await db.get("SELECT qr_verification_code, ug_id FROM student_id_cards LIMIT 1");
    const testCode = cardRecord ? cardRecord.qr_verification_code : 'MGI-VER-26UG033789';

    const cleanUrlRes = await makeRequest(`/verify/${testCode}`);
    assert(cleanUrlRes.status === 200, `GET /verify/${testCode} returns 200 OK HTML page`);

    // C. Check API verification endpoint with JSON Accept
    const apiJsonRes = await makeRequest(`/api/id-cards/verify/${testCode}`, 'GET', { 'Accept': 'application/json' });
    assert(apiJsonRes.status === 200 && apiJsonRes.data.valid === true, 'GET /api/id-cards/verify/:code returns valid JSON for API consumers');
    assert(apiJsonRes.data.student && apiJsonRes.data.student.password_hash === undefined, 'No password_hash leaked in public verification JSON');
    assert(apiJsonRes.data.student && apiJsonRes.data.student.phone_number === undefined, 'No private phone_number leaked in public verification JSON');

    // D. Check Browser Request to API endpoint redirects to verify-card.html
    const apiHtmlRes = await makeRequest(`/api/id-cards/verify/${testCode}`, 'GET', { 'Accept': 'text/html,application/xhtml+xml' });
    assert(apiHtmlRes.status === 302, 'Browser request with Accept: text/html is redirected (302) to verify-card.html');
    assert(apiHtmlRes.headers.location && apiHtmlRes.headers.location.includes('/verify-card.html?code='), 'Redirect location points to /verify-card.html?code=...');

    // 4. Verify CSS Stylesheet Upgrades
    console.log('\n[Test 4] Verifying CSS Stylesheet in style.css...');
    const styleCss = fs.readFileSync(path.join(__dirname, '..', 'public', 'css', 'style.css'), 'utf8');
    assert(styleCss.includes('.id-card-large-modal'), 'CSS has .id-card-large-modal definition');
    assert(styleCss.includes('.id-card-side-by-side'), 'CSS has .id-card-side-by-side definition');
    assert(styleCss.includes('.mgi-id-card-static'), 'CSS has .mgi-id-card-static definition');
    assert(styleCss.includes('.id-card-ugid-badge-wrap'), 'CSS has .id-card-ugid-badge-wrap definition');
    assert(styleCss.includes('.id-card-qr-box'), 'CSS has .id-card-qr-box definition');

    // 5. Zero Harm Database Check
    console.log('\n[Test 5] Confirming Zero Harm to Existing Database...');
    const studentCount = (await db.get("SELECT COUNT(*) as c FROM students")).c;
    assert(studentCount === 65, 'Exact 65 student records preserved in students table');
    const firstStudent = await db.get("SELECT roll_number, ug_id, name FROM students WHERE ug_id = '26UG033789'");
    assert(firstStudent && firstStudent.roll_number === 1, 'Student 26UG033789 roll_number is preserved intact in database');

    console.log('\n========================================================================');
    console.log(`📊 REDESIGN TEST SUITE SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('========================================================================\n');

  } catch (err) {
    console.error('Fatal Test Error:', err);
    process.exit(1);
  } finally {
    if (server) {
      server.close();
    }
    process.exit(failed > 0 ? 1 : 0);
  }
}

runTestSuite();
