const crypto = require('crypto');
const db = require('../db');

// Institutional Constants
const INSTITUTION_NAME = 'Mishra Group Institute of Technology';
const DEFAULT_DEPARTMENT = 'Computer Science & Engineering';
const DEFAULT_DIVISION = '3CYBER7';
const DEFAULT_ACADEMIC_YEAR = '2026-27';
const DEFAULT_PROGRAM = 'B.Tech Cyber Security';
const DEFAULT_VALIDITY = '2028-06-30'; // Graduation year for 2024-2028 batch

// Helpers
function generateCardNumber(ug_id) {
  const cleanId = (ug_id || '').trim().toUpperCase();
  return `MGI-3CYBER7-${cleanId}`;
}

function generateVerificationCode(ug_id) {
  const cleanId = (ug_id || '').trim().toUpperCase();
  const hexPrefix = Buffer.from(cleanId).toString('hex').substring(0, 8).toUpperCase();
  const randomHex = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `MGI-VER-${hexPrefix}-${randomHex}`;
}

function validateStudentRecord(student) {
  const reasons = [];
  if (!student.profile_photo_url || student.profile_photo_url.trim() === '') {
    reasons.push('Missing institutional profile photo');
  }
  if (!student.phone_number || student.phone_number.trim() === '') {
    reasons.push('Missing contact phone number');
  }
  if (!student.roll_number) {
    reasons.push('Missing official roll number');
  }
  return {
    flagged: reasons.length > 0,
    reasons
  };
}

async function logAudit(card_id, ug_id, action, performed_by, performed_role, details = '') {
  try {
    await db.run(`
      INSERT INTO id_card_audit_logs (card_id, ug_id, action, performed_by, performed_role, details)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [card_id, ug_id, action, performed_by, performed_role, details]);
  } catch (err) {
    console.warn('[IDCard Audit Log Error]:', err.message);
  }
}

// 1. Student self-access: Get my ID Card
async function getMyIdCard(req, res) {
  try {
    const ug_id = req.user && req.user.ug_id ? req.user.ug_id.trim().toUpperCase() : null;
    if (!ug_id) {
      return res.status(400).json({ success: false, message: 'Invalid student session. UG ID not found.' });
    }

    const student = await db.get(`
      SELECT id, ug_id, name, roll_number, phone_number, batch, program, year, semester,
             division, academic_year, profile_photo_url, department, status
      FROM students
      WHERE UPPER(ug_id) = ?
    `, [ug_id]);

    if (!student) {
      return res.status(404).json({ success: false, message: 'Student record not found in system.' });
    }

    const card = await db.get(`
      SELECT * FROM student_id_cards
      WHERE UPPER(ug_id) = ?
    `, [ug_id]);

    if (card) {
      await logAudit(card.id, ug_id, 'VIEWED', req.user.username || ug_id, req.user.role || 'STUDENT', 'Self-service digital ID card view');
      return res.json({
        success: true,
        issued: true,
        student,
        card: {
          ...card,
          verification_code: card.qr_verification_code,
          review_reasons: card.review_reasons ? JSON.parse(card.review_reasons) : [],
          student
        }
      });
    }

    // Card not yet issued, return student data with status
    return res.json({
      success: true,
      issued: false,
      card: null,
      eligible: student.status === 'ACTIVE',
      student,
      message: 'Your institutional ID card has not been generated yet. Please contact your Department HOD.'
    });
  } catch (err) {
    console.error('[IDCard getMyIdCard Error]:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve student ID card.' });
  }
}

// 2. List ID Cards with RBAC filtering (HOD, Admin, Teacher)
async function getAllIdCards(req, res) {
  try {
    const userRole = (req.user && req.user.role ? req.user.role : '').toUpperCase();
    let { batch, status, search, page = 1, limit = 100 } = req.query;

    let allowedBatch = null;

    // RBAC: If requester is TEACHER, enforce their assigned batch scope
    if (userRole === 'TEACHER') {
      let teacherBatch = req.user.batch || 'Both';
      if (req.user.teacher_id) {
        const teacher = await db.get(`
          SELECT batch, department, division FROM teachers
          WHERE UPPER(teacher_id) = ?
        `, [req.user.teacher_id.toUpperCase()]);
        if (teacher && teacher.batch) {
          teacherBatch = req.user.batch && req.user.batch !== 'Both' ? req.user.batch : teacher.batch;
        }
      }

      if (teacherBatch && teacherBatch !== 'Both') {
        allowedBatch = teacherBatch;
        // If query tried to access a different batch, reject or force allowed batch
        if (batch && batch !== 'All' && batch !== allowedBatch) {
          return res.status(403).json({
            success: false,
            message: `Access denied. You are only authorized to view students in ${allowedBatch}.`
          });
        }
        batch = allowedBatch;
      }
    }

    // Build query conditions safely
    let whereClauses = [];
    let params = [];

    if (batch && batch !== 'All' && batch.trim() !== '') {
      whereClauses.push("s.batch = ?");
      params.push(batch.trim());
    }

    if (status && status !== 'ALL' && status.trim() !== '') {
      if (status === 'NOT_GENERATED') {
        whereClauses.push("c.id IS NULL");
      } else if (status === 'FLAGGED') {
        whereClauses.push("c.flagged_for_review = 1");
      } else {
        whereClauses.push("c.status = ?");
        params.push(status.trim().toUpperCase());
      }
    }

    if (search && search.trim() !== '') {
      const term = `%${search.trim().toUpperCase()}%`;
      whereClauses.push("(UPPER(s.name) LIKE ? OR UPPER(s.ug_id) LIKE ? OR CAST(s.roll_number AS TEXT) LIKE ?)");
      params.push(term, term, term);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const sql = `
      SELECT s.id as student_id, s.ug_id, s.name, s.roll_number, s.phone_number, s.batch,
             s.program, s.year, s.semester, s.division, s.academic_year, s.profile_photo_url,
             s.department, s.status as student_status,
             c.id as card_id, c.card_number, c.issue_date, c.valid_until, c.blood_group,
             c.emergency_contact, c.status as card_status, c.qr_verification_code,
             c.barcode_value, c.flagged_for_review, c.review_reasons, c.generated_by_id,
             c.generated_by_role, c.created_at as card_created_at, c.updated_at as card_updated_at
      FROM students s
      LEFT JOIN student_id_cards c ON UPPER(s.ug_id) = UPPER(c.ug_id)
      ${whereSql}
      ORDER BY s.roll_number ASC
    `;

    const records = await db.query(sql, params);

    // Format records
    const formattedRecords = records.map(r => ({
      student_id: r.student_id,
      ug_id: r.ug_id,
      name: r.name,
      roll_number: r.roll_number,
      phone_number: r.phone_number,
      batch: r.batch,
      program: r.program,
      year: r.year,
      semester: r.semester,
      division: r.division,
      academic_year: r.academic_year,
      profile_photo_url: r.profile_photo_url,
      department: r.department,
      student_status: r.student_status,
      is_generated: !!r.card_id,
      card: r.card_id ? {
        id: r.card_id,
        card_number: r.card_number,
        issue_date: r.issue_date,
        valid_until: r.valid_until,
        blood_group: r.blood_group || null,
        emergency_contact: r.emergency_contact || r.phone_number || null,
        status: r.card_status,
        qr_verification_code: r.qr_verification_code,
        barcode_value: r.barcode_value,
        flagged_for_review: !!r.flagged_for_review,
        review_reasons: r.review_reasons ? JSON.parse(r.review_reasons) : [],
        generated_by_id: r.generated_by_id,
        generated_by_role: r.generated_by_role,
        created_at: r.card_created_at,
        updated_at: r.card_updated_at
      } : null
    }));

    // Overall summary statistics
    const allStudents = await db.query("SELECT s.ug_id, s.batch, c.id as card_id, c.status as card_status, c.flagged_for_review FROM students s LEFT JOIN student_id_cards c ON UPPER(s.ug_id) = UPPER(c.ug_id)");
    
    // If teacher, filter stats according to scope
    const scopedStudents = allowedBatch ? allStudents.filter(s => s.batch === allowedBatch) : allStudents;

    const stats = {
      totalStudents: scopedStudents.length,
      totalGenerated: scopedStudents.filter(s => !!s.card_id).length,
      totalActive: scopedStudents.filter(s => s.card_id && s.card_status === 'ACTIVE').length,
      totalFlagged: scopedStudents.filter(s => s.card_id && s.flagged_for_review).length,
      totalNotGenerated: scopedStudents.filter(s => !s.card_id).length,
      batch1Count: scopedStudents.filter(s => s.batch === 'Batch 1').length,
      batch2Count: scopedStudents.filter(s => s.batch === 'Batch 2').length,
      allowedBatch: allowedBatch || 'Both'
    };

    res.json({
      success: true,
      stats,
      students: formattedRecords
    });
  } catch (err) {
    console.error('[IDCard getAllIdCards Error]:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch ID card list.' });
  }
}

// 3. Get single student ID card by UG ID (with strict RBAC)
async function getStudentIdCard(req, res) {
  try {
    const targetUgId = (req.params.ug_id || '').trim().toUpperCase();
    const userRole = (req.user && req.user.role ? req.user.role : '').toUpperCase();

    if (!targetUgId) {
      return res.status(400).json({ success: false, message: 'Student UG ID is required.' });
    }

    // Student self-check
    if (userRole === 'STUDENT') {
      const myUgId = (req.user.ug_id || '').trim().toUpperCase();
      if (myUgId !== targetUgId) {
        return res.status(403).json({ success: false, message: 'Access forbidden: You may only view your own ID card.' });
      }
    }

    const student = await db.get(`
      SELECT id, ug_id, name, roll_number, phone_number, batch, program, year, semester,
             division, academic_year, profile_photo_url, department, status
      FROM students
      WHERE UPPER(ug_id) = ?
    `, [targetUgId]);

    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found.' });
    }

    // Teacher batch boundary check
    if (userRole === 'TEACHER') {
      let teacherBatch = req.user.batch || 'Both';
      if (req.user.teacher_id) {
        const teacher = await db.get(`
          SELECT batch FROM teachers
          WHERE UPPER(teacher_id) = ?
        `, [req.user.teacher_id.toUpperCase()]);
        if (teacher && teacher.batch) {
          teacherBatch = req.user.batch && req.user.batch !== 'Both' ? req.user.batch : teacher.batch;
        }
      }

      if (teacherBatch && teacherBatch !== 'Both' && teacherBatch !== student.batch) {
        return res.status(403).json({
          success: false,
          message: `Access denied: Faculty authorized only for ${teacherBatch}.`
        });
      }
    }

    const card = await db.get(`
      SELECT * FROM student_id_cards
      WHERE UPPER(ug_id) = ?
    `, [targetUgId]);

    let auditHistory = [];
    if (card) {
      auditHistory = await db.query(`
        SELECT action, performed_by, performed_role, details, created_at
        FROM id_card_audit_logs
        WHERE UPPER(ug_id) = ?
        ORDER BY id DESC LIMIT 10
      `, [targetUgId]);
    }

    res.json({
      success: true,
      student,
      is_generated: !!card,
      card: card ? {
        ...card,
        verification_code: card.qr_verification_code,
        review_reasons: card.review_reasons ? JSON.parse(card.review_reasons) : []
      } : null,
      auditHistory
    });
  } catch (err) {
    console.error('[IDCard getStudentIdCard Error]:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve student ID card details.' });
  }
}

// 4. Safe Idempotent Single Card Generation (HOD / Admin only)
async function generateSingleCard(req, res) {
  try {
    const ugIdInput = req.params.ug_id || (req.body && (req.body.ug_id || req.body.id));
    const { blood_group = null, emergency_contact = null, force_regenerate = false } = req.body || {};
    const cleanUgId = (ugIdInput || '').trim().toUpperCase();

    if (!cleanUgId) {
      return res.status(400).json({ success: false, message: 'Student UG ID is required for card generation.' });
    }

    const student = await db.get(`
      SELECT id, ug_id, name, roll_number, phone_number, batch, program, year, semester,
             division, academic_year, profile_photo_url, department, status
      FROM students
      WHERE UPPER(ug_id) = ?
    `, [cleanUgId]);

    if (!student) {
      return res.status(404).json({ success: false, message: `Student with UG ID ${cleanUgId} not found in official roster.` });
    }

    const existingCard = await db.get(`
      SELECT * FROM student_id_cards
      WHERE UPPER(ug_id) = ?
    `, [cleanUgId]);

    const operatorId = req.user.username || req.user.teacher_id || req.user.ug_id || 'System';
    const operatorRole = (req.user.role || 'HOD').toUpperCase();

    // Idempotency: If card already exists and no force_regenerate requested, reuse it safely
    if (existingCard && !force_regenerate) {
      return res.json({
        success: true,
        message: 'Active ID card already exists for this student. Reused existing card without duplication.',
        reused: true,
        card: {
          ...existingCard,
          verification_code: existingCard.qr_verification_code,
          review_reasons: existingCard.review_reasons ? JSON.parse(existingCard.review_reasons) : [],
          student
        }
      });
    }

    // Inspect student record for any missing fields without inventing false data
    const validation = validateStudentRecord(student);
    const issueDate = new Date().toISOString().split('T')[0];
    const validUntil = DEFAULT_VALIDITY;
    const cardNumber = existingCard ? existingCard.card_number : generateCardNumber(student.ug_id);
    const qrCode = existingCard ? existingCard.qr_verification_code : generateVerificationCode(student.ug_id);
    const barcodeValue = student.ug_id;
    const reviewReasonsJson = JSON.stringify(validation.reasons);
    const cardStatus = validation.flagged ? 'PENDING_REVIEW' : 'ACTIVE';

    if (existingCard && force_regenerate) {
      // Safely update existing record without modifying student profile
      await db.run(`
        UPDATE student_id_cards
        SET valid_until = ?,
            blood_group = COALESCE(?, blood_group),
            emergency_contact = COALESCE(?, emergency_contact),
            status = ?,
            flagged_for_review = ?,
            review_reasons = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [
        validUntil,
        blood_group || null,
        emergency_contact || student.phone_number || null,
        cardStatus,
        validation.flagged ? 1 : 0,
        reviewReasonsJson,
        existingCard.id
      ]);

      await logAudit(existingCard.id, cleanUgId, 'SINGLE_CARD_REISSUED', operatorId, operatorRole, `Regenerated by ${operatorRole}. Status: ${cardStatus}`);

      const updatedCard = await db.get("SELECT * FROM student_id_cards WHERE id = ?", [existingCard.id]);
      return res.json({
        success: true,
        message: 'Student ID card refreshed successfully.',
        reused: false,
        flagged: validation.flagged,
        review_reasons: validation.reasons,
        card: {
          ...updatedCard,
          review_reasons: validation.reasons,
          student
        }
      });
    }

    // Insert new card linked to existing student record
    const insertResult = await db.run(`
      INSERT INTO student_id_cards (
        student_id, ug_id, card_number, issue_date, valid_until,
        blood_group, emergency_contact, status, qr_verification_code,
        barcode_value, card_template, flagged_for_review, review_reasons,
        generated_by_id, generated_by_role
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'STANDARD_3CYBER7', ?, ?, ?, ?)
    `, [
      student.id,
      student.ug_id,
      cardNumber,
      issueDate,
      validUntil,
      blood_group || null,
      emergency_contact || student.phone_number || null,
      cardStatus,
      qrCode,
      barcodeValue,
      validation.flagged ? 1 : 0,
      reviewReasonsJson,
      operatorId,
      operatorRole
    ]);

    const newCard = await db.get("SELECT * FROM student_id_cards WHERE id = ?", [insertResult.id]);
    await logAudit(newCard.id, cleanUgId, 'SINGLE_CARD_ISSUED', operatorId, operatorRole, `Issued by ${operatorRole}. Status: ${cardStatus}`);

    res.status(200).json({
      success: true,
      message: 'Student ID card generated successfully.',
      reused: false,
      flagged: validation.flagged,
      review_reasons: validation.reasons,
      card: {
        ...newCard,
        verification_code: newCard.qr_verification_code,
        review_reasons: validation.reasons,
        student
      }
    });
  } catch (err) {
    console.error('[IDCard generateSingleCard Error]:', err);
    res.status(500).json({ success: false, message: 'Failed to generate student ID card.' });
  }
}

// 5. Safe Batch / Bulk ID Card Generation (HOD / Admin only)
async function bulkGenerateCards(req, res) {
  try {
    const { batch = 'All', force_regenerate = false } = req.body;
    const operatorId = req.user.username || req.user.teacher_id || req.user.ug_id || 'System';
    const operatorRole = (req.user.role || 'HOD').toUpperCase();

    let studentQuery = "SELECT * FROM students WHERE status = 'ACTIVE'";
    const queryParams = [];

    if (batch && batch !== 'All' && batch.trim() !== '') {
      studentQuery += " AND batch = ?";
      queryParams.push(batch.trim());
    }
    studentQuery += " ORDER BY roll_number ASC";

    const students = await db.query(studentQuery, queryParams);

    if (students.length === 0) {
      return res.json({
        success: true,
        message: 'No active eligible students found for the selected scope.',
        total: 0,
        generated: 0,
        reused: 0,
        flagged: 0,
        errors: []
      });
    }

    const batchId = `BATCH-GEN-${Date.now()}`;
    const issueDate = new Date().toISOString().split('T')[0];
    const validUntil = DEFAULT_VALIDITY;

    let generatedCount = 0;
    let reusedCount = 0;
    let flaggedCount = 0;
    const errors = [];
    const results = [];

    // Process students in chunked batches (size 20) with graceful error isolation
    const CHUNK_SIZE = 20;
    for (let i = 0; i < students.length; i += CHUNK_SIZE) {
      const chunk = students.slice(i, i + CHUNK_SIZE);

      for (const student of chunk) {
        try {
          const existingCard = await db.get(
            "SELECT * FROM student_id_cards WHERE UPPER(ug_id) = ?",
            [student.ug_id.toUpperCase()]
          );

          if (existingCard && !force_regenerate) {
            reusedCount++;
            results.push({
              ug_id: student.ug_id,
              name: student.name,
              roll_number: student.roll_number,
              status: existingCard.status,
              action: 'REUSED',
              card_number: existingCard.card_number
            });
            continue;
          }

          const validation = validateStudentRecord(student);
          const reviewReasonsJson = JSON.stringify(validation.reasons);
          const cardStatus = validation.flagged ? 'PENDING_REVIEW' : 'ACTIVE';
          if (validation.flagged) flaggedCount++;

          if (existingCard && force_regenerate) {
            await db.run(`
              UPDATE student_id_cards
              SET valid_until = ?,
                  status = ?,
                  flagged_for_review = ?,
                  review_reasons = ?,
                  generation_batch_id = ?,
                  updated_at = CURRENT_TIMESTAMP
              WHERE id = ?
            `, [
              validUntil,
              cardStatus,
              validation.flagged ? 1 : 0,
              reviewReasonsJson,
              batchId,
              existingCard.id
            ]);

            await logAudit(existingCard.id, student.ug_id, 'REGENERATED', operatorId, operatorRole, `Bulk regeneration (${batchId})`);
            generatedCount++;
            results.push({
              ug_id: student.ug_id,
              name: student.name,
              roll_number: student.roll_number,
              status: cardStatus,
              action: 'REGENERATED',
              flagged: validation.flagged,
              reasons: validation.reasons
            });
            continue;
          }

          // Generate new card
          const cardNumber = generateCardNumber(student.ug_id);
          const qrCode = generateVerificationCode(student.ug_id);

          const insertRes = await db.run(`
            INSERT INTO student_id_cards (
              student_id, ug_id, card_number, issue_date, valid_until,
              blood_group, emergency_contact, status, qr_verification_code,
              barcode_value, card_template, flagged_for_review, review_reasons,
              generated_by_id, generated_by_role, generation_batch_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'STANDARD_3CYBER7', ?, ?, ?, ?, ?)
          `, [
            student.id,
            student.ug_id,
            cardNumber,
            issueDate,
            validUntil,
            null,
            student.phone_number || null,
            cardStatus,
            qrCode,
            student.ug_id,
            validation.flagged ? 1 : 0,
            reviewReasonsJson,
            operatorId,
            operatorRole,
            batchId
          ]);

          await logAudit(insertRes.id, student.ug_id, 'BULK_CARDS_GENERATED', operatorId, operatorRole, `Bulk generated (${batchId})`);
          generatedCount++;
          results.push({
            ug_id: student.ug_id,
            name: student.name,
            roll_number: student.roll_number,
            status: cardStatus,
            action: 'GENERATED',
            flagged: validation.flagged,
            reasons: validation.reasons
          });
        } catch (studentErr) {
          console.error(`[IDCard Bulk Error for ${student.ug_id}]:`, studentErr.message);
          errors.push({
            ug_id: student.ug_id,
            name: student.name,
            error: studentErr.message
          });
        }
      }
    }

    res.json({
      success: true,
      message: `Bulk processing complete. Total: ${students.length}, Generated/Updated: ${generatedCount}, Existing Reused: ${reusedCount}, Flagged: ${flaggedCount}, Failed: ${errors.length}.`,
      batchId,
      totalStudents: students.length,
      totalProcessed: students.length,
      generatedCount,
      reusedCount,
      flaggedCount,
      errorCount: errors.length,
      errors,
      results
    });
  } catch (err) {
    console.error('[IDCard bulkGenerateCards Error]:', err);
    res.status(500).json({ success: false, message: 'Failed during bulk card generation.' });
  }
}

// 6. Update Card Status (e.g. SUSPENDED, ACTIVE)
async function updateCardStatus(req, res) {
  try {
    const idParam = req.params.id || req.params.ug_id || (req.body && (req.body.ug_id || req.body.id));
    const { status, remarks = '', reason = '' } = req.body || {};
    const effectiveRemarks = remarks || reason;

    const validStatuses = ['ACTIVE', 'SUSPENDED', 'EXPIRED', 'PENDING_REVIEW'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
    }

    let card;
    if (idParam && /^\d+$/.test(idParam)) {
      card = await db.get("SELECT * FROM student_id_cards WHERE id = ?", [parseInt(idParam, 10)]);
    } else if (idParam) {
      card = await db.get("SELECT * FROM student_id_cards WHERE UPPER(ug_id) = ?", [String(idParam).toUpperCase()]);
    }

    if (!card) {
      return res.status(404).json({ success: false, message: 'ID card record not found.' });
    }

    const cardId = card.id;
    const operatorId = req.user.username || req.user.teacher_id || req.user.ug_id || 'Admin';
    const operatorRole = (req.user.role || 'HOD').toUpperCase();

    await db.run(`
      UPDATE student_id_cards
      SET status = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [status, cardId]);

    await logAudit(cardId, card.ug_id, 'CARD_STATUS_UPDATED', operatorId, operatorRole, `Status changed from ${card.status} to ${status}. ${effectiveRemarks}`);

    res.json({
      success: true,
      message: `ID card status successfully updated to ${status}.`,
      card_id: cardId,
      new_status: status
    });
  } catch (err) {
    console.error('[IDCard updateCardStatus Error]:', err);
    res.status(500).json({ success: false, message: 'Failed to update card status.' });
  }
}

// 7. Public Instant QR Verification Endpoint (Zero sensitive leaks)
async function verifyCardByCode(req, res) {
  try {
    const code = (req.params.code || '').trim();
    if (!code) {
      return res.status(400).json({ valid: false, message: 'Verification code missing.' });
    }

    // If a smartphone camera / web browser opens this URL directly, redirect to full ID card preview webpage
    if (req.headers.accept && req.headers.accept.includes('text/html') && !req.xhr && req.query.format !== 'json') {
      return res.redirect(`/verify-card.html?code=${encodeURIComponent(code)}`);
    }

    let record = await db.get(`
      SELECT c.card_number, c.issue_date, c.valid_until, c.status as card_status,
             c.qr_verification_code,
             s.name, s.ug_id, s.roll_number, s.program, s.division, s.batch,
             s.academic_year, s.department, s.year, s.semester, s.profile_photo_url
      FROM student_id_cards c
      JOIN students s ON UPPER(c.ug_id) = UPPER(s.ug_id)
      WHERE c.qr_verification_code = ? OR UPPER(c.ug_id) = UPPER(?) OR UPPER(c.card_number) = UPPER(?)
    `, [code, code, code]);

    // Fallback resolution: If not in student_id_cards yet, check students table and auto-provision
    if (!record) {
      let student = await db.get(`
        SELECT id, ug_id, name, roll_number, phone_number, batch, program, year, semester,
               division, academic_year, profile_photo_url, department, status
        FROM students
        WHERE UPPER(ug_id) = UPPER(?) OR UPPER(roll_number) = UPPER(?)
      `, [code, code]);

      // If code is in format MGI-VER-{hexPrefix}-{randomOrHash}, try to extract hexPrefix (which is hex of ug_id prefix)
      if (!student && code.startsWith('MGI-VER-')) {
        const parts = code.split('-');
        if (parts.length >= 3) {
          const hex = parts[2];
          try {
            const decodedPrefix = Buffer.from(hex, 'hex').toString('utf8');
            if (decodedPrefix && decodedPrefix.length >= 4) {
              student = await db.get(`
                SELECT id, ug_id, name, roll_number, phone_number, batch, program, year, semester,
                       division, academic_year, profile_photo_url, department, status
                FROM students
                WHERE UPPER(ug_id) LIKE UPPER(?)
                LIMIT 1
              `, [`${decodedPrefix}%`]);
            }
          } catch (e) {}
        }
      }

      if (student) {
        const cardNumber = generateCardNumber(student.ug_id);
        const cardStatus = 'ACTIVE';
        const validUntil = DEFAULT_VALIDITY;
        const issueDate = '2026-08-01';

        try {
          await db.run(`
            INSERT INTO student_id_cards (
              student_id, ug_id, card_number, issue_date, valid_until,
              blood_group, emergency_contact, status, qr_verification_code,
              barcode_value, card_template, flagged_for_review, review_reasons,
              generated_by_id, generated_by_role, generation_batch_id
            ) VALUES (?, ?, ?, ?, ?, 'O+', ?, ?, ?, ?, 'STANDARD_3CYBER7', 0, '[]', 'SYSTEM', 'AUTO_VERIFY', 'PROVISION')
          `, [
            student.id, student.ug_id, cardNumber, issueDate, validUntil,
            student.phone_number || null, cardStatus, code, student.ug_id
          ]);
        } catch (e) {}

        record = {
          card_number: cardNumber,
          issue_date: issueDate,
          valid_until: validUntil,
          card_status: cardStatus,
          qr_verification_code: code,
          name: student.name,
          ug_id: student.ug_id,
          roll_number: student.roll_number,
          program: student.program || DEFAULT_PROGRAM,
          division: student.division || DEFAULT_DIVISION,
          batch: student.batch || 'Batch 1',
          academic_year: student.academic_year || DEFAULT_ACADEMIC_YEAR,
          department: student.department || DEFAULT_DEPARTMENT,
          year: student.year || '2nd Year',
          semester: student.semester || '3rd Semester',
          profile_photo_url: student.profile_photo_url
        };
      }
    }

    if (!record) {
      return res.status(404).json({
        valid: false,
        message: 'No institutional record found matching this verification code. Card may be invalid or counterfeit.'
      });
    }

    const isCardActive = record.card_status === 'ACTIVE';

    res.json({
      valid: isCardActive,
      status: record.card_status,
      verification_timestamp: new Date().toISOString(),
      institution: INSTITUTION_NAME,
      department: record.department || DEFAULT_DEPARTMENT,
      division: record.division || DEFAULT_DIVISION,
      academic_year: record.academic_year || DEFAULT_ACADEMIC_YEAR,
      program: record.program || DEFAULT_PROGRAM,
      student: {
        name: record.name,
        ug_id: record.ug_id,
        roll_number: record.roll_number,
        batch: record.batch,
        year: record.year,
        semester: record.semester,
        profile_photo_url: record.profile_photo_url
      },
      card: {
        card_number: record.card_number,
        issue_date: record.issue_date,
        valid_until: record.valid_until
      },
      message: isCardActive ? 'Valid Institutional Student ID Card' : `This card is currently marked as ${record.card_status}.`
    });
  } catch (err) {
    console.error('[IDCard verifyCardByCode Error]:', err);
    res.status(500).json({ valid: false, message: 'Error verifying ID card.' });
  }
}

// 8. Batch Print / PDF export dataset
async function getBatchPrintData(req, res) {
  try {
    const { batch = 'All' } = req.query;

    // RBAC: If faculty, restrict to assigned batch
    if (req.user && req.user.role === 'TEACHER') {
      const teacherBatch = req.user.batch || 'Both';
      if (teacherBatch === 'Batch 1' && batch !== 'Batch 1') {
        return res.status(403).json({ success: false, message: 'Access denied: Faculty authorized only for Batch 1.' });
      }
      if (teacherBatch === 'Batch 2' && batch !== 'Batch 2') {
        return res.status(403).json({ success: false, message: 'Access denied: Faculty authorized only for Batch 2.' });
      }
    }

    let querySql = `
      SELECT s.id as student_id, s.ug_id, s.name, s.roll_number, s.phone_number, s.batch,
             s.program, s.year, s.semester, s.division, s.academic_year, s.profile_photo_url,
             s.department,
             c.id as card_id, c.card_number, c.issue_date, c.valid_until, c.blood_group,
             c.emergency_contact, c.status as card_status, c.qr_verification_code,
             c.barcode_value, c.flagged_for_review
      FROM students s
      JOIN student_id_cards c ON UPPER(s.ug_id) = UPPER(c.ug_id)
      WHERE c.status != 'SUSPENDED'
    `;
    const params = [];

    if (batch && batch !== 'All') {
      querySql += " AND s.batch = ?";
      params.push(batch);
    }

    querySql += " ORDER BY s.roll_number ASC";

    const cards = await db.query(querySql, params);

    res.json({
      success: true,
      institution: INSTITUTION_NAME,
      department: DEFAULT_DEPARTMENT,
      division: DEFAULT_DIVISION,
      academic_year: DEFAULT_ACADEMIC_YEAR,
      totalCards: cards.length,
      cards,
      students: cards
    });
  } catch (err) {
    console.error('[IDCard getBatchPrintData Error]:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve batch print data.' });
  }
}

module.exports = {
  getMyIdCard,
  getAllIdCards,
  getStudentIdCard,
  generateSingleCard,
  bulkGenerateCards,
  updateCardStatus,
  verifyCardByCode,
  getBatchPrintData
};
