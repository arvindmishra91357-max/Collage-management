// ==========================================================================
// STUDENT ID CARD MANAGEMENT SYSTEM - CLIENT RENDERING & INTERACTIVE ENGINE
// Master Redesign: Navy-Blue & Cyan Theme • 3D Avatar Fallback • Large Preview
// ==========================================================================

const IdCardSystem = {
  activeModal: null,

  // 3D Student Avatar Fallback Mapping
  getAvatarForStudent(student) {
    const s = student || {};
    const gender = s.gender ? String(s.gender).trim().toUpperCase() : '';
    if (gender === 'M' || gender === 'MALE' || gender === 'BOY') {
      return '/assets/avatars/student-male.svg';
    }
    if (gender === 'F' || gender === 'FEMALE' || gender === 'GIRL') {
      return '/assets/avatars/student-female.svg';
    }
    // Neutral professional 3D student avatar
    return '/assets/avatars/student-neutral.svg';
  },

  // Priority Image URL Resolver (Supports either student object or string path)
  getPhotoUrl(studentOrPath) {
    let photoPath = null;
    let s = {};
    if (typeof studentOrPath === 'string') {
      photoPath = studentOrPath;
    } else if (studentOrPath && typeof studentOrPath === 'object') {
      s = studentOrPath;
      photoPath = s.profile_photo_url;
    }

    if (!photoPath || typeof photoPath !== 'string' || photoPath.trim() === '') {
      return this.getAvatarForStudent(s);
    }
    if (photoPath.startsWith('data:') || photoPath.startsWith('http://') || photoPath.startsWith('https://')) {
      return photoPath;
    }
    if (window.API && typeof window.API.getFileUrl === 'function') {
      return window.API.getFileUrl(photoPath);
    }
    return photoPath.startsWith('/') ? photoPath : `/${photoPath}`;
  },

  // Graceful Image Error Handler (Swaps to gender-appropriate 3D Avatar without broken icon)
  handleImageError(imgEl, genderVal) {
    if (!imgEl) return;
    imgEl.onerror = null;
    let gender = '';
    try {
      gender = typeof genderVal === 'string' ? genderVal : '';
    } catch (e) {}
    imgEl.src = this.getAvatarForStudent({ gender });
  },

  getVerificationUrl(qrVerificationCode, ug_id) {
    let raw = (qrVerificationCode || ug_id || '').trim();
    if (!raw && typeof this._activeStudent === 'object' && this._activeStudent?.ug_id) {
      raw = this._activeStudent.ug_id;
    }
    const code = encodeURIComponent(raw || '26UG033181');
    
    // Check if running on a live public domain (e.g. Render, custom production domain)
    const host = (typeof window !== 'undefined' && window.location && window.location.hostname) ? window.location.hostname.toLowerCase() : '';
    const protocol = (typeof window !== 'undefined' && window.location && window.location.protocol) ? window.location.protocol : '';
    
    const isLocalOrPrivate = !host ||
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '0.0.0.0' ||
      host.startsWith('192.168.') ||
      host.startsWith('10.') ||
      host.startsWith('172.') ||
      protocol === 'file:';

    // If local or private, use official live cloud URL so scanning on ANY phone works immediately:
    const baseUrl = isLocalOrPrivate ? 'https://collage-managemnet-1.onrender.com' : window.location.origin;

    return `${baseUrl}/verify-card.html?code=${code}`;
  },

  // Renders Front Face of the ID Card (Roll Number Completely Removed, UG Prominent)
  renderCardFrontHTML(student, card, isStatic = false) {
    const s = student || {};
    const c = card || {};
    const photoUrl = this.getPhotoUrl(s);
    const batch = s.batch || 'Batch 1';
    const ugId = s.ug_id || c.ug_id || '26UG033181';
    const prog = s.program || 'B.Tech Cyber Security';
    const div = s.division || '3CYBER7';
    const yearSem = `${s.year || '2nd Year'} • ${s.semester || '3rd Sem'}`;
    const acadYear = s.academic_year || '2026-27';
    const validUntil = c.valid_until ? (c.valid_until.length >= 4 ? c.valid_until.substring(0, 4) : c.valid_until) : '2028';
    const studentName = (s.name || 'STUDENT NAME').toUpperCase();
    const genderAttr = s.gender ? String(s.gender).replace(/"/g, '&quot;') : '';

    const containerClass = isStatic ? 'mgi-id-card-static mgi-id-card-front' : 'mgi-id-card mgi-id-card-front';

    return `
      <div class="${containerClass}" id="mgi-card-front-${s.ug_id}">
        <!-- Top Institutional Header -->
        <div class="id-card-header">
          <div class="id-card-crest">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#0284c7" stroke-width="2.3">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
            </svg>
          </div>
          <div style="flex:1; min-width:0;">
            <h4 class="id-card-inst-title">MISHRA GROUP INSTITUTE OF TECHNOLOGY</h4>
            <span class="id-card-dept-sub">DEPT OF COMPUTER SCIENCE & ENGINEERING</span>
          </div>
        </div>

        <!-- Body Layout -->
        <div class="id-card-body">
          <div class="id-card-watermark">MGI</div>

          <!-- Photo Container with 3D Avatar Fallback -->
          <div class="id-card-photo-box">
            <img src="${photoUrl}" 
                 alt="" 
                 class="id-card-photo" 
                 loading="lazy" 
                 onerror="IdCardSystem.handleImageError(this, '${genderAttr}');" />
            <div class="id-card-batch-tag">${batch}</div>
          </div>

          <!-- Core Academic Information (ROLL NUMBER REMOVED) -->
          <div class="id-card-details">
            <div class="id-card-name" title="${studentName}">${studentName}</div>
            
            <!-- Prominent Cyan-Outlined UG ID Badge -->
            <div class="id-card-ugid-badge-wrap">
              <span class="id-card-ugid-label">UG NO</span>
              <span class="id-card-ugid-number">${ugId}</span>
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
            <span style="font-size:7.5px; color:#94a3b8; font-weight:700;">HOD (CSE Dept)</span>
          </div>
        </div>
      </div>
    `;
  },

  // Renders Back Face of the ID Card (Single Clean QR Code, No Duplicates, No Barcode)
  // Renders Back Face of the ID Card (Single Clean QR Code, No Duplicates, No Barcode)
  renderCardBackHTML(student, card, qrBoxId, isStatic = false) {
    const s = student || {};
    const c = card || {};
    const ugId = s.ug_id || c.ug_id || '26UG033181';
    const cardNum = c.card_number || `MGI-3CYBER7-${ugId}`;
    const blood = c.blood_group || s.blood_group || 'O+';
    const phone = '+91 94717 50496'; // Official college office helpline

    const containerClass = isStatic ? 'mgi-id-card-static mgi-id-card-back' : 'mgi-id-card mgi-id-card-back';

    return `
      <div class="${containerClass}" id="mgi-card-back-${s.ug_id}">
        <!-- Back Header -->
        <div class="id-card-back-header">
          <div>
            <div style="font-size:9.5px; font-weight:800; color:#38bdf8; letter-spacing:0.5px;">MGI OFFICIAL STUDENT IDENTITY</div>
            <div style="font-size:8.5px; color:#cbd5e1; font-family:monospace; margin-top:1px;">${cardNum}</div>
          </div>
          <div style="text-align:right;">
            <span style="font-size:8.5px; font-weight:800; color:#22c55e; background:rgba(34,197,94,0.18); border:1px solid rgba(34,197,94,0.4); padding:2px 7px; border-radius:5px;">● VERIFIED ACTIVE</span>
          </div>
        </div>

        <!-- Middle Grid: Rules + Single Sharp QR Code -->
        <div class="id-card-back-grid">
          <div>
            <div style="display:flex; gap:14px; margin-bottom:6px; font-size:8.5px;">
              <div><span style="color:#94a3b8;">Blood Grp:</span> <strong style="color:#f8fafc;">${blood}</strong></div>
              <div><span style="color:#94a3b8;">Helpline:</span> <strong style="color:#38bdf8;">${phone}</strong></div>
            </div>
            
            <ul class="id-card-instructions">
              <li>Official property of Mishra Group Institute of Technology.</li>
              <li>Mandatory for campus access, exams & library services.</li>
              <li>Scan QR code to verify real-time institutional status.</li>
              <li>If found, return to: Office of HOD, CSE Department.</li>
            </ul>
          </div>

          <!-- Single Centered High-Contrast QR Code Box -->
          <div style="display:flex; flex-direction:column; align-items:center;">
            <div class="id-card-qr-box" id="${qrBoxId}">
              <!-- Live QRCode generated here -->
            </div>
            <div class="id-card-qr-label">Scan to Verify</div>
          </div>
        </div>

        <!-- Bottom University Contact (Clean & Unclipped) -->
        <div class="id-card-back-footer">
          Tech Park Campus • Office of Dean CSE • Helpline: +91 94717 50496
        </div>
      </div>
    `;
  },

  // Renders Side-by-Side Display (Default on Wide Screens)
  renderSideBySideHTML(student, card, qrBoxId) {
    const s = student || {};
    const c = card || {};
    return `
      <div class="id-card-side-by-side">
        <div class="id-card-preview-wrapper">
          <div class="id-card-side-label"><span>🪪</span> Front Side View</div>
          ${this.renderCardFrontHTML(s, c, true)}
        </div>
        <div class="id-card-preview-wrapper">
          <div class="id-card-side-label"><span>🔄</span> Back Side View</div>
          ${this.renderCardBackHTML(s, c, qrBoxId, true)}
        </div>
      </div>
    `;
  },

  // Renders Interactive 3D Flip Showcase
  renderShowcaseHTML(student, card, containerId = 'id-card-flip-wrap') {
    const s = student || {};
    const c = card || {};
    const qrId = `qr-box-${s.ug_id || 'preview'}`;

    return `
      <div class="id-card-showcase">
        <div class="id-card-flip-wrap" id="${containerId}" onclick="IdCardSystem.toggleFlip('${containerId}')" title="Click anywhere on card to flip Front / Back">
          <div class="id-card-flipper">
            ${this.renderCardFrontHTML(s, c, false)}
            ${this.renderCardBackHTML(s, c, qrId, false)}
          </div>
        </div>

        <div style="font-size:11.5px; color:#94a3b8; display:flex; align-items:center; gap:8px;">
          <span>👆 Tap card or button below to flip Front / Back</span>
        </div>
      </div>
    `;
  },

  // Toggle 3D flip animation
  toggleFlip(containerId = 'id-card-flip-wrap') {
    const el = document.getElementById(containerId);
    if (el) el.classList.toggle('flipped');
  },

  // Mounts Live High-Resolution QR Code into container using window.QRCode or API fallback
  mountQrCode(containerId, qrCodeValue) {
    setTimeout(() => {
      const el = document.getElementById(containerId);
      if (!el) return;
      el.innerHTML = '';

      const verifyUrl = this.getVerificationUrl(qrCodeValue);

      if (typeof window.QRCode !== 'undefined') {
        try {
          new window.QRCode(el, {
            text: verifyUrl,
            width: 160,
            height: 160,
            margin: 2,
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
        <svg viewBox="0 0 100 100" width="76" height="76" fill="#0a1128">
          <rect x="8" y="8" width="28" height="28" fill="#0a1128" rx="2" />
          <rect x="14" y="14" width="16" height="16" fill="#ffffff" />
          <rect x="18" y="18" width="8" height="8" fill="#0a1128" />
          <rect x="64" y="8" width="28" height="28" fill="#0a1128" rx="2" />
          <rect x="70" y="14" width="16" height="16" fill="#ffffff" />
          <rect x="74" y="18" width="8" height="8" fill="#0a1128" />
          <rect x="8" y="64" width="28" height="28" fill="#0a1128" rx="2" />
          <rect x="14" y="70" width="16" height="16" fill="#ffffff" />
          <rect x="18" y="74" width="8" height="8" fill="#0a1128" />
          <rect x="42" y="12" width="10" height="10" fill="#0a1128" />
          <rect x="42" y="32" width="16" height="10" fill="#0a1128" />
          <rect x="64" y="44" width="12" height="12" fill="#0a1128" />
          <rect x="42" y="64" width="12" height="18" fill="#0a1128" />
          <rect x="64" y="72" width="20" height="10" fill="#0a1128" />
        </svg>
      `;
    }, 60);
  },

  // Fallback high-contrast collegiate 3D avatar
  getDefaultAvatarSvg() {
    return './assets/avatars/student-neutral.svg';
  },

  // Open Large Desktop/Mobile Modal with Side-by-Side and 3D Flip View
  async openPreviewModal(ug_id) {
    document.querySelectorAll('.id-card-preview-modal-overlay').forEach(el => el.remove());

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay id-card-preview-modal-overlay';
    overlay.style.cssText = 'position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(2,6,23,0.88); backdrop-filter:blur(8px); display:flex; align-items:center; justify-content:center; z-index:99999; padding:16px; overflow-y:auto;';

    overlay.innerHTML = `
      <div class="card id-card-large-modal">
        <!-- Top Modal Toolbar -->
        <div class="id-card-modal-toolbar">
          <div style="display:flex; align-items:center; gap:12px;">
            <div style="width:36px; height:36px; border-radius:10px; background:linear-gradient(135deg, #0284c7, #06b6d4); display:flex; align-items:center; justify-content:center; font-size:18px;">
              🪪
            </div>
            <div>
              <h3 style="font-size:16px; font-weight:800; margin:0; font-family:'Outfit',sans-serif; color:#ffffff;">Official Student ID Card</h3>
              <span style="font-size:11.5px; color:#38bdf8; font-weight:600;">Division 3CYBER7 • B.Tech Cyber Security</span>
            </div>
          </div>

          <!-- Controls: View Switcher + Print + Close -->
          <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
            <div class="id-card-view-tabs" id="id-card-modal-tabs">
              <button class="id-card-tab-btn active" id="tab-side-by-side" onclick="IdCardSystem.switchModalView('sideBySide')">
                <span>🔀</span> <span>Side-by-Side</span>
              </button>
              <button class="id-card-tab-btn" id="tab-flip" onclick="IdCardSystem.switchModalView('flip')">
                <span>🔄</span> <span>3D Flip</span>
              </button>
            </div>

            <button class="btn btn-primary" onclick="IdCardSystem.printSingleCard('${ug_id || ''}')" style="display:inline-flex; align-items:center; gap:6px; font-size:12px; padding:7px 16px; border-radius:8px;">
              <span>🖨️</span> <span>Print Official Card</span>
            </button>

            <button class="icon-btn" onclick="this.closest('.id-card-preview-modal-overlay').remove()" style="width:34px; height:34px; border-radius:8px; border:1px solid rgba(255,255,255,0.15); background:rgba(255,255,255,0.05); color:#ffffff; cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:14px;" title="Close (Esc)">✕</button>
          </div>
        </div>

        <!-- Dynamic Card View Content -->
        <div id="modal-id-card-content">
          <div style="text-align:center; padding:60px 0;">
            <div style="width:36px; height:36px; border:3px solid rgba(255,255,255,0.1); border-top-color:#06b6d4; border-radius:50%; animation:spin 0.8s linear infinite; margin:0 auto 14px;"></div>
            <p style="font-size:13px; color:#94a3b8;">Loading student ID card credential...</p>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    // Keyboard navigation (Esc to close)
    const handleKeydown = (e) => {
      if (e.key === 'Escape') {
        overlay.remove();
        document.removeEventListener('keydown', handleKeydown);
      }
    };
    document.addEventListener('keydown', handleKeydown);

    try {
      let res;
      if (!ug_id) {
        res = await API.getMyIdCard();
      } else {
        res = await API.getStudentIdCard(ug_id);
      }

      const student = res.student;
      const card = res.card || {
        card_number: `MGI-3CYBER7-${student.ug_id}`,
        valid_until: '2028-06-30',
        status: 'ACTIVE',
        qr_verification_code: `MGI-VER-${student.ug_id}`
      };

      // Cache for view switching
      this._activeStudent = student;
      this._activeCard = card;
      this._activeView = 'sideBySide';

      this.renderModalActiveView();
    } catch (e) {
      const contentBox = document.getElementById('modal-id-card-content');
      if (contentBox) {
        contentBox.innerHTML = `
          <div style="padding:40px 20px; text-align:center; color:#ef4444; font-size:13px;">
            ⚠️ Failed to load student ID card. Please check network permissions and try again.
          </div>
        `;
      }
    }
  },

  // Switches between Side-by-Side and 3D Flip in modal
  switchModalView(view) {
    this._activeView = view;
    const tabSide = document.getElementById('tab-side-by-side');
    const tabFlip = document.getElementById('tab-flip');
    if (tabSide) tabSide.classList.toggle('active', view === 'sideBySide');
    if (tabFlip) tabFlip.classList.toggle('active', view === 'flip');
    this.renderModalActiveView();
  },

  // Renders the currently selected view inside the modal
  renderModalActiveView() {
    const contentBox = document.getElementById('modal-id-card-content');
    if (!contentBox || !this._activeStudent || !this._activeCard) return;

    const student = this._activeStudent;
    const card = this._activeCard;
    const qrId = `modal-qr-${student.ug_id || 'preview'}`;

    if (this._activeView === 'flip') {
      contentBox.innerHTML = `
        ${this.renderShowcaseHTML(student, card, 'modal-flipper-wrap')}
        <div style="display:flex; justify-content:center; gap:12px; margin-top:16px;">
          <button class="btn btn-sec" onclick="IdCardSystem.toggleFlip('modal-flipper-wrap')" style="display:inline-flex; align-items:center; gap:6px; font-size:12px; padding:8px 16px; border-radius:8px;">
            <span>🔄</span> <span>Flip Front / Back</span>
          </button>
        </div>
      `;
      this.mountQrCode(`qr-box-${student.ug_id || 'preview'}`, card.qr_verification_code || student.ug_id);
    } else {
      contentBox.innerHTML = `
        ${this.renderSideBySideHTML(student, card, qrId)}
        <div style="margin-top:16px; font-size:11.5px; color:#64748b; text-align:center; display:flex; justify-content:center; gap:16px;">
          <span>Standard ISO/IEC 7810 ID-1 Physical Format</span> • 
          <span>High-Resolution Digital Credential</span>
        </div>
      `;
      this.mountQrCode(qrId, card.qr_verification_code || student.ug_id);
    }
  },

  // Prints a Single Student Card (Front + Back side-by-side on single sheet)
  async printSingleCard(ug_id) {
    try {
      let res;
      if (!ug_id) {
        res = await API.getMyIdCard();
      } else {
        res = await API.getStudentIdCard(ug_id);
      }

      const s = res.student;
      const c = res.card || {
        card_number: `MGI-3CYBER7-${s.ug_id}`,
        valid_until: '2028-06-30',
        status: 'ACTIVE',
        qr_verification_code: `MGI-VER-${s.ug_id}`
      };

      const printWindow = window.open('', '_blank', 'width=900,height=750');
      if (!printWindow) {
        alert('Please allow popups in your browser to print the official ID card.');
        return;
      }

      const qrId = `print-qr-${s.ug_id}`;
      const frontHtml = this.renderCardFrontHTML(s, c, true);
      const backHtml = this.renderCardBackHTML(s, c, qrId, true);
      const verifyUrl = this.getVerificationUrl(c.qr_verification_code);

      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>MGI Official ID Card • ${s.ug_id} • ${s.name}</title>
          <link rel="preconnect" href="https://fonts.googleapis.com">
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
          <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&family=Outfit:wght@700;800&display=swap" rel="stylesheet">
          <link rel="stylesheet" href="./css/style.css">
          <style>
            @page {
              size: A4 portrait;
              margin: 15mm;
            }
            body {
              font-family: 'Inter', -apple-system, sans-serif;
              background: #ffffff !important;
              color: #0f172a !important;
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
              border: 1px dashed #64748b;
              border-radius: 12px;
              overflow: hidden;
              box-shadow: 0 4px 12px rgba(0,0,0,0.1);
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            .card-wrapper .mgi-id-card,
            .card-wrapper .mgi-id-card-static {
              position: absolute !important;
              top: 0 !important;
              left: 0 !important;
              width: 85.6mm !important;
              height: 53.98mm !important;
              border-radius: 0 !important;
              box-shadow: none !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            .cut-instructions {
              text-align: center;
              font-size: 11px;
              color: #64748b;
              margin-top: 24px;
            }
          </style>
        </head>
        <body>
          <div class="print-header">
            <h2 style="margin:0; font-size:16px; text-transform:uppercase; font-family:'Outfit',sans-serif;">Mishra Group Institute of Technology</h2>
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
            ✂️ <strong>Print Instructions:</strong> Print at 100% scale (no scaling) on heavy cardstock or PVC sheet. Cut along dashed lines. Standard ID-1 physical card dimension (85.6mm x 53.98mm). Valid across campus and university examination halls.
          </div>

          <script src="./js/qrcode.min.js"></script>
          <script>
            setTimeout(function() {
              var el = document.getElementById('${qrId}');
              if (el && typeof QRCode !== 'undefined') {
                new QRCode(el, {
                  text: "${verifyUrl}",
                  width: 160,
                  height: 160,
                  margin: 2,
                  colorDark: "#000000",
                  colorLight: "#ffffff",
                  correctLevel: QRCode.CorrectLevel ? QRCode.CorrectLevel.M : 0
                });
              }
              setTimeout(function() { window.print(); }, 400);
            }, 100);
          </script>
        </body>
        </html>
      `);
      printWindow.document.close();
    } catch (e) {
      alert('Failed to prepare official card for printing: ' + e.message);
    }
  },

  // Prints A4 Sheet of Cards for Department / Faculty
  async printBatchSheet(batch = 'All') {
    try {
      const res = await API.getBatchPrintIdCards({ batch });
      if (!res.success || !res.cards || res.cards.length === 0) {
        alert('No active cards found for batch print in the selected filter.');
        return;
      }

      const printWindow = window.open('', '_blank', 'width=950,height=850');
      if (!printWindow) {
        alert('Please allow popups in your browser to print the official ID card sheet.');
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
              ${this.renderCardFrontHTML(s, c, true)}
            </div>
          </div>
        `;
      }).join('');

      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>MGI Official ID Cards Sheet • ${batch} • ${res.cards.length} Students</title>
          <link rel="preconnect" href="https://fonts.googleapis.com">
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
          <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&family=Outfit:wght@700;800&display=swap" rel="stylesheet">
          <link rel="stylesheet" href="./css/style.css">
          <style>
            @page {
              size: A4 portrait;
              margin: 10mm;
            }
            body {
              font-family: 'Inter', -apple-system, sans-serif;
              background: #ffffff !important;
              color: #0f172a !important;
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
            .card-wrapper .mgi-id-card-static,
            .card-wrapper .mgi-id-card {
              position: absolute !important;
              top: 0 !important;
              left: 0 !important;
              width: 85.6mm !important;
              height: 53.98mm !important;
              border-radius: 0 !important;
              box-shadow: none !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
          </style>
        </head>
        <body>
          <div class="sheet-header">
            <h2 style="margin:0; font-size:15px; text-transform:uppercase; font-family:'Outfit',sans-serif;">Mishra Group Institute of Technology</h2>
            <p style="margin:2px 0 0; font-size:11px; color:#475569;">Batch ID Card Sheet • ${batch} • ${res.cards.length} Students • Division 3CYBER7</p>
          </div>
          <div class="batch-grid">
            ${cardsHtml}
          </div>
          <script>
            setTimeout(function() { window.print(); }, 400);
          </script>
        </body>
        </html>
      `);
      printWindow.document.close();
    } catch (e) {
      console.error('[IdCardSystem printBatchSheet Error]:', e);
      alert('Failed to generate batch print sheet: ' + e.message);
    }
  }
};

window.IdCardSystem = IdCardSystem;
