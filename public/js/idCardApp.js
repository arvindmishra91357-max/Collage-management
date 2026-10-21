// ==========================================================================
// STUDENT ID CARD MANAGEMENT SYSTEM - CLIENT RENDERING & INTERACTIVE ENGINE
// ==========================================================================

const IdCardSystem = {
  activeModal: null,

  // Fallback high-contrast collegiate silhouette avatar
  getDefaultAvatarSvg() {
    return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="%2338bdf8"><circle cx="50" cy="35" r="22" /><path d="M15 88 C15 65 35 55 50 55 C65 55 85 65 85 88 Z" /></svg>`;
  },

  getPhotoUrl(photoPath) {
    if (!photoPath || photoPath.trim() === '') {
      return this.getDefaultAvatarSvg();
    }
    if (photoPath.startsWith('data:') || photoPath.startsWith('http://') || photoPath.startsWith('https://')) {
      return photoPath;
    }
    if (window.API && typeof window.API.getFileUrl === 'function') {
      return window.API.getFileUrl(photoPath);
    }
    return photoPath.startsWith('/') ? photoPath : `/${photoPath}`;
  },

  // Generates clean SVG barcode bars for the UG ID
  generateBarcodeSvg(text = '26UG033181') {
    const clean = String(text || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    const bars = [];
    let x = 10;
    
    // Start sentinel
    bars.push(`<rect x="${x}" y="0" width="2" height="24" fill="#000000" />`);
    x += 4;
    bars.push(`<rect x="${x}" y="0" width="1" height="24" fill="#000000" />`);
    x += 3;

    // Pattern generator from character codes
    for (let i = 0; i < clean.length; i++) {
      const code = clean.charCodeAt(i);
      const w1 = (code % 3) + 1;
      const w2 = ((code >> 1) % 2) + 1;
      const gap = ((code >> 2) % 2) + 1;

      bars.push(`<rect x="${x}" y="0" width="${w1}" height="24" fill="#000000" />`);
      x += w1 + gap;
      bars.push(`<rect x="${x}" y="0" width="${w2}" height="24" fill="#000000" />`);
      x += w2 + 2;
    }

    // Stop sentinel
    bars.push(`<rect x="${x}" y="0" width="2" height="24" fill="#000000" />`);
    x += 4;
    bars.push(`<rect x="${x}" y="0" width="1" height="24" fill="#000000" />`);
    x += 10;

    return `
      <svg viewBox="0 0 ${x} 24" preserveAspectRatio="none" style="width:100%; height:24px; display:block;">
        <rect width="${x}" height="24" fill="#ffffff" />
        ${bars.join('')}
      </svg>
    `;
  },

  // Renders Front face of the ID card
  renderCardFrontHTML(student, card) {
    const s = student || {};
    const c = card || {};
    const photoUrl = this.getPhotoUrl(s.profile_photo_url);
    const batch = s.batch || 'Batch 1';
    const rollNo = s.roll_number != null ? String(s.roll_number).padStart(2, '0') : '--';
    const ugId = s.ug_id || c.ug_id || 'UG-PENDING';
    const prog = s.program || 'B.Tech Cyber Security';
    const div = s.division || '3CYBER7';
    const yearSem = `${s.year || '2nd Year'} • ${s.semester || '3rd Sem'}`;
    const acadYear = s.academic_year || '2026-27';
    const validUntil = c.valid_until ? (c.valid_until.length === 10 ? c.valid_until.substring(0, 4) : c.valid_until) : '2028';

    return `
      <div class="mgi-id-card mgi-id-card-front" id="mgi-card-front-${s.ug_id}">
        <!-- Top Institutional Crest Header -->
        <div class="id-card-header">
          <div class="id-card-crest">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#0284c7" stroke-width="2.4">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
            </svg>
          </div>
          <div style="flex:1; min-width:0;">
            <h4 class="id-card-inst-title">MISHRA GROUP INSTITUTE OF TECHNOLOGY</h4>
            <span class="id-card-dept-sub">Dept of Computer Science & Engineering</span>
          </div>
        </div>

        <!-- Body Layout -->
        <div class="id-card-body">
          <div class="id-card-watermark">MGI</div>

          <!-- Photo Container -->
          <div class="id-card-photo-box">
            <img src="${photoUrl}" alt="${s.name || 'Student'}" class="id-card-photo" onerror="this.src='${this.getDefaultAvatarSvg()}';" />
            <div class="id-card-batch-tag">${batch}</div>
          </div>

          <!-- Core Academic Information -->
          <div class="id-card-details">
            <div class="id-card-name" title="${s.name || 'STUDENT NAME'}">${(s.name || 'STUDENT NAME').toUpperCase()}</div>
            
            <div style="display:flex; align-items:center; gap:6px; margin:1px 0;">
              <span class="id-card-ugid-badge">${ugId}</span>
              <span style="font-size:9px; font-weight:800; color:#38bdf8;">ROLL #${rollNo}</span>
            </div>

            <div class="id-card-info-grid">
              <span class="id-card-lbl">Program:</span>
              <span class="id-card-val">${prog}</span>
              <span class="id-card-lbl">Division:</span>
              <span class="id-card-val">${div}</span>
              <span class="id-card-lbl">Term:</span>
              <span class="id-card-val">${yearSem}</span>
              <span class="id-card-lbl">Session:</span>
              <span class="id-card-val">${acadYear}</span>
            </div>
          </div>
        </div>

        <!-- Footer With Official Endorsement -->
        <div class="id-card-footer">
          <div class="id-card-validity">
            VALID TILL: <strong>JUNE ${validUntil}</strong>
          </div>
          <div class="id-card-sign-block">
            <span class="id-card-sign-text">Dr. A. K. Sharma</span>
            <span style="font-size:7px; color:#94a3b8; font-weight:600;">HOD (CSE Dept)</span>
          </div>
        </div>
      </div>
    `;
  },

  // Renders Back face of the ID card with Verification QR & Barcode
  renderCardBackHTML(student, card, qrBoxId) {
    const s = student || {};
    const c = card || {};
    const ugId = s.ug_id || c.ug_id || '26UG033181';
    const cardNum = c.card_number || `MGI-3CYBER7-${ugId}`;
    const blood = c.blood_group || s.blood_group || 'Pending';
    const phone = c.emergency_contact || s.phone_number || 'College Office';
    const barcodeSvg = this.generateBarcodeSvg(ugId);

    return `
      <div class="mgi-id-card mgi-id-card-back" id="mgi-card-back-${s.ug_id}">
        <!-- Back Header -->
        <div class="id-card-back-header">
          <div>
            <div style="font-size:8.5px; font-weight:800; color:#38bdf8; letter-spacing:0.4px;">MGI OFFICIAL STUDENT IDENTITY</div>
            <div style="font-size:7.5px; color:#cbd5e1; font-family:monospace;">${cardNum}</div>
          </div>
          <div style="text-align:right;">
            <span style="font-size:8px; font-weight:800; color:#22c55e; background:rgba(34,197,94,0.15); border:1px solid rgba(34,197,94,0.3); padding:1px 5px; border-radius:4px;">VERIFIED</span>
          </div>
        </div>

        <!-- Middle Grid: Rules + QR Code -->
        <div class="id-card-back-grid">
          <div>
            <div style="display:flex; gap:12px; margin-bottom:6px; font-size:8px;">
              <div><span style="color:#94a3b8;">Blood Grp:</span> <strong style="color:#f8fafc;">${blood}</strong></div>
              <div><span style="color:#94a3b8;">Emergency:</span> <strong style="color:#f8fafc;">${phone}</strong></div>
            </div>
            
            <ul class="id-card-instructions">
              <li>Card is property of Mishra Group Institute.</li>
              <li>Mandatory for campus gate & library entry.</li>
              <li>Scan QR for instant real-time cryptographic audit.</li>
              <li>Report loss immediately to Department HOD.</li>
            </ul>
          </div>

          <!-- QR Code Box -->
          <div class="id-card-qr-box" id="${qrBoxId}">
            <!-- QRCode canvas/img generated here -->
          </div>
        </div>

        <!-- Bottom Barcode & Contact -->
        <div>
          <div class="id-card-barcode-wrap" style="background:#ffffff; padding:2px 4px; border-radius:4px;">
            ${barcodeSvg}
            <div class="id-card-barcode-txt" style="color:#0f172a; font-weight:700;">* ${ugId} *</div>
          </div>
          <div style="font-size:6.5px; color:#64748b; text-align:center; margin-top:3px;">
            Campus: Mishra Group Institute Campus, Tech Park • Helpline: +91 94717 50496
          </div>
        </div>
      </div>
    `;
  },

  // Renders the interactive 3D Flip showcase
  renderShowcaseHTML(student, card, containerId = 'id-card-flip-wrap') {
    const s = student || {};
    const c = card || {};
    const qrId = `qr-box-${s.ug_id || 'preview'}`;

    return `
      <div class="id-card-showcase">
        <div class="id-card-flip-wrap" id="${containerId}" onclick="IdCardSystem.toggleFlip('${containerId}')" title="Click anywhere on card to flip Front / Back">
          <div class="id-card-flipper">
            ${this.renderCardFrontHTML(s, c)}
            ${this.renderCardBackHTML(s, c, qrId)}
          </div>
        </div>

        <!-- Controls -->
        <div class="id-card-actions-bar" style="display:flex; align-items:center; gap:10px;">
          <button class="btn btn-sec" onclick="IdCardSystem.toggleFlip('${containerId}')" style="display:inline-flex; align-items:center; gap:6px; font-size:12px; padding:7px 14px; border-radius:8px;">
            <span>🔄</span> <span>Flip Front / Back</span>
          </button>
          <button class="btn btn-primary" onclick="IdCardSystem.printSingleCard('${s.ug_id}')" style="display:inline-flex; align-items:center; gap:6px; font-size:12px; padding:7px 16px; border-radius:8px;">
            <span>🖨️</span> <span>Print Official Card</span>
          </button>
        </div>
      </div>
    `;
  },

  // Toggle 3D flip animation
  toggleFlip(containerId = 'id-card-flip-wrap') {
    const el = document.getElementById(containerId);
    if (el) el.classList.toggle('flipped');
  },

  // Mounts QR Code into container using window.QRCode or API fallback
  mountQrCode(containerId, qrCodeValue) {
    setTimeout(() => {
      const el = document.getElementById(containerId);
      if (!el) return;
      el.innerHTML = '';

      const verifyUrl = `${window.location.origin}/api/id-cards/verify/${encodeURIComponent(qrCodeValue || 'MGI-DEMO')}`;

      if (typeof window.QRCode !== 'undefined') {
        try {
          new window.QRCode(el, {
            text: verifyUrl,
            width: 58,
            height: 58,
            colorDark: "#000000",
            colorLight: "#ffffff",
            correctLevel: window.QRCode.CorrectLevel ? window.QRCode.CorrectLevel.M : 0
          });
          return;
        } catch (e) {
          console.warn('[IdCardSystem] QRCode lib error, fallback to SVG:', e.message);
        }
      }

      // Safe SVG fallback QR representation
      el.innerHTML = `
        <svg viewBox="0 0 100 100" width="58" height="58" fill="#0f172a">
          <rect x="10" y="10" width="25" height="25" fill="#0f172a" />
          <rect x="15" y="15" width="15" height="15" fill="#ffffff" />
          <rect x="18" y="18" width="9" height="9" fill="#0f172a" />
          <rect x="65" y="10" width="25" height="25" fill="#0f172a" />
          <rect x="70" y="15" width="15" height="15" fill="#ffffff" />
          <rect x="73" y="18" width="9" height="9" fill="#0f172a" />
          <rect x="10" y="65" width="25" height="25" fill="#0f172a" />
          <rect x="15" y="70" width="15" height="15" fill="#ffffff" />
          <rect x="18" y="73" width="9" height="9" fill="#0f172a" />
          <rect x="42" y="15" width="8" height="8" fill="#0f172a" />
          <rect x="42" y="32" width="16" height="8" fill="#0f172a" />
          <rect x="65" y="45" width="12" height="12" fill="#0f172a" />
          <rect x="42" y="65" width="12" height="16" fill="#0f172a" />
          <rect x="65" y="70" width="20" height="10" fill="#0f172a" />
        </svg>
      `;
    }, 60);
  },

  // Open Full Screen Interactive Preview Modal
  async openPreviewModal(ug_id) {
    document.querySelectorAll('.id-card-preview-modal-overlay').forEach(el => el.remove());

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay id-card-preview-modal-overlay';
    overlay.style.cssText = 'position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.85); backdrop-filter:blur(6px); display:flex; align-items:center; justify-content:center; z-index:99999; padding:16px;';

    overlay.innerHTML = `
      <div class="card glass-card" style="max-width:440px; width:100%; padding:22px; border-radius:18px; border:1px solid rgba(56,189,248,0.3); text-align:center;">
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:14px; border-bottom:1px solid var(--border-color); padding-bottom:10px;">
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="font-size:18px;">🪪</span>
            <div style="text-align:left;">
              <h3 style="font-size:14px; font-weight:800; margin:0;">Official Student ID Card</h3>
              <span style="font-size:11px; color:var(--text-muted);">MGI Division 3CYBER7</span>
            </div>
          </div>
          <button class="icon-btn" onclick="this.closest('.id-card-preview-modal-overlay').remove()" style="width:30px; height:30px; border-radius:8px; border:1px solid var(--border-color); background:transparent; color:var(--text-muted); cursor:pointer;">✕</button>
        </div>

        <div id="modal-id-card-content">
          <div style="padding:40px 0;">
            <div style="width:34px; height:34px; border:3px solid rgba(255,255,255,0.1); border-top-color:#38bdf8; border-radius:50%; animation:spin 0.8s linear infinite; margin:0 auto 10px;"></div>
            <p style="font-size:12px; color:var(--text-muted);">Loading student ID card...</p>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    try {
      const res = await API.getStudentIdCard(ug_id);
      const student = res.student;
      const card = res.card || {
        card_number: `MGI-3CYBER7-${student.ug_id}`,
        valid_until: '2028-06-30',
        status: 'ACTIVE',
        qr_verification_code: `MGI-VER-${student.ug_id}-DEMO`
      };

      const contentBox = document.getElementById('modal-id-card-content');
      if (contentBox) {
        contentBox.innerHTML = `
          ${this.renderShowcaseHTML(student, card, 'modal-flipper-wrap')}
          <div style="margin-top:14px; font-size:11px; color:var(--text-muted); display:flex; justify-content:center; gap:16px;">
            <span>Tap card to flip</span> • <span>ISO/IEC 7810 ID-1 standard format</span>
          </div>
        `;
        this.mountQrCode(`qr-box-${student.ug_id || 'preview'}`, card.qr_verification_code);
      }
    } catch (e) {
      const contentBox = document.getElementById('modal-id-card-content');
      if (contentBox) {
        contentBox.innerHTML = `
          <div style="padding:20px; color:#ef4444; font-size:13px;">
            Failed to load student ID card. Please try again.
          </div>
        `;
      }
    }
  },

  // Prints a Single Student Card (Front + Back side-by-side or stacked on single sheet)
  async printSingleCard(ug_id) {
    try {
      const res = await API.getStudentIdCard(ug_id);
      const s = res.student;
      const c = res.card || {
        card_number: `MGI-3CYBER7-${s.ug_id}`,
        valid_until: '2028-06-30',
        status: 'ACTIVE',
        qr_verification_code: `MGI-VER-${s.ug_id}-DEMO`
      };

      const printWindow = window.open('', '_blank', 'width=800,height=700');
      if (!printWindow) {
        alert('Please allow popups to print official ID card.');
        return;
      }

      const qrId = `print-qr-${s.ug_id}`;
      const frontHtml = this.renderCardFrontHTML(s, c);
      const backHtml = this.renderCardBackHTML(s, c, qrId);

      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>MGI Official ID Card • ${s.ug_id} • ${s.name}</title>
          <link rel="stylesheet" href="./css/style.css">
          <style>
            @page {
              size: A4 portrait;
              margin: 15mm;
            }
            body {
              font-family: 'Inter', -apple-system, sans-serif;
              background: #ffffff;
              color: #0f172a;
              padding: 20px;
              margin: 0;
            }
            .print-header {
              text-align: center;
              border-bottom: 2px solid #0284c7;
              padding-bottom: 12px;
              margin-bottom: 24px;
            }
            .cards-print-row {
              display: flex;
              gap: 20px;
              justify-content: center;
              align-items: center;
              flex-wrap: wrap;
              margin: 30px 0;
            }
            .card-wrapper {
              width: 85.6mm;
              height: 53.98mm;
              position: relative;
              border: 1px dashed #94a3b8;
              border-radius: 12px;
              overflow: hidden;
              box-shadow: 0 4px 12px rgba(0,0,0,0.1);
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            .card-wrapper .mgi-id-card {
              position: relative !important;
              border-radius: 0 !important;
              box-shadow: none !important;
            }
            .cut-instructions {
              text-align: center;
              font-size: 11px;
              color: #64748b;
              margin-top: 20px;
            }
          </style>
        </head>
        <body>
          <div class="print-header">
            <h2 style="margin:0; font-size:16px; text-transform:uppercase;">Mishra Group Institute of Technology</h2>
            <p style="margin:3px 0 0; font-size:12px; color:#475569;">Official Student Identity Credential • Division 3CYBER7 (2026-27)</p>
          </div>

          <div class="cards-print-row">
            <div>
              <div style="font-size:11px; font-weight:700; color:#475569; margin-bottom:6px; text-align:center;">FRONT SIDE</div>
              <div class="card-wrapper">${frontHtml}</div>
            </div>
            <div>
              <div style="font-size:11px; font-weight:700; color:#475569; margin-bottom:6px; text-align:center;">BACK SIDE</div>
              <div class="card-wrapper">${backHtml}</div>
            </div>
          </div>

          <div class="cut-instructions">
            ✂️ <strong>Instructions:</strong> Cut along the dashed lines. Standard ID-1 physical card dimension (85.6mm x 53.98mm). Valid across campus and university examination halls.
          </div>

          <script src="./js/qrcode.min.js"></script>
          <script>
            setTimeout(function() {
              var el = document.getElementById('${qrId}');
              if (el && typeof QRCode !== 'undefined') {
                new QRCode(el, {
                  text: "${window.location.origin}/api/id-cards/verify/${c.qr_verification_code}",
                  width: 58,
                  height: 58,
                  colorDark: "#000000",
                  colorLight: "#ffffff",
                  correctLevel: QRCode.CorrectLevel ? QRCode.CorrectLevel.M : 0
                });
              }
              setTimeout(function() {
                window.print();
              }, 500);
            }, 300);
          </script>
        </body>
        </html>
      `);
      printWindow.document.close();
    } catch (e) {
      console.error('[IdCardSystem printSingleCard Error]:', e);
      alert('Failed to initialize print engine.');
    }
  },

  // Prints a full A4 sheet containing 8 student ID cards for the department
  async printBatchSheet(batch = 'All') {
    try {
      const res = await API.getBatchPrintIdCards({ batch });
      if (!res.success || !res.cards || res.cards.length === 0) {
        alert('No active cards found for batch print in the selected filter.');
        return;
      }

      const printWindow = window.open('', '_blank', 'width=900,height=800');
      if (!printWindow) {
        alert('Please allow popups to print official ID card sheet.');
        return;
      }

      const cardsHtml = res.cards.map((s, idx) => {
        const c = {
          card_number: s.card_number,
          valid_until: s.valid_until,
          blood_group: s.blood_group,
          emergency_contact: s.emergency_contact
        };
        return `
          <div class="batch-card-cell">
            <div class="card-wrapper">
              ${this.renderCardFrontHTML(s, c)}
            </div>
          </div>
        `;
      }).join('');

      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>MGI Official ID Cards Sheet • ${batch} • ${res.cards.length} Students</title>
          <link rel="stylesheet" href="./css/style.css">
          <style>
            @page {
              size: A4 portrait;
              margin: 10mm;
            }
            body {
              font-family: 'Inter', -apple-system, sans-serif;
              background: #ffffff;
              color: #0f172a;
              padding: 0;
              margin: 0;
            }
            .sheet-header {
              text-align: center;
              border-bottom: 2px solid #0284c7;
              padding-bottom: 8px;
              margin-bottom: 16px;
            }
            .batch-grid {
              display: grid;
              grid-template-columns: repeat(2, 85.6mm);
              gap: 8mm 12mm;
              justify-content: center;
            }
            .batch-card-cell {
              display: flex;
              justify-content: center;
            }
            .card-wrapper {
              width: 85.6mm;
              height: 53.98mm;
              position: relative;
              border: 1px dashed #64748b;
              border-radius: 10px;
              overflow: hidden;
              page-break-inside: avoid;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            .card-wrapper .mgi-id-card {
              position: relative !important;
              border-radius: 0 !important;
              box-shadow: none !important;
            }
            @media print {
              .no-print { display: none !important; }
            }
          </style>
        </head>
        <body>
          <div class="sheet-header">
            <h3 style="margin:0; font-size:14px; text-transform:uppercase;">MISHRA GROUP INSTITUTE OF TECHNOLOGY • CSE DEPARTMENT</h3>
            <p style="margin:2px 0 0; font-size:11px; color:#475569;">Official Institutional ID Cards Sheet • Division 3CYBER7 (${batch}) • Total: ${res.cards.length} Students</p>
          </div>

          <div class="batch-grid">
            ${cardsHtml}
          </div>

          <script>
            setTimeout(function() {
              window.print();
            }, 600);
          </script>
        </body>
        </html>
      `);
      printWindow.document.close();
    } catch (e) {
      console.error('[IdCardSystem printBatchSheet Error]:', e);
      alert('Failed to generate batch print sheet.');
    }
  }
};

window.IdCardSystem = IdCardSystem;
