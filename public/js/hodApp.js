// ==========================================================================
// HOD WEB APP / PORTAL CONTROLLER (MGI DEPARTMENT OF COMPUTER SCIENCE & ENG)
// Complete Production-Ready Responsive Implementation of all 15 HOD Modules
// ==========================================================================

const HOD_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function getIndianDate() {
  try {
    const now = new Date();
    const istString = now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
    return new Date(istString);
  } catch (e) {
    const now = new Date();
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    return new Date(utc + (3600000 * 5.5));
  }
}

function getIndianDateString() {
  try {
    const d = getIndianDate();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  } catch (e) {
    return new Date().toISOString().split('T')[0];
  }
}

function getIndianDayName() {
  try {
    const d = getIndianDate();
    return HOD_DAYS[d.getDay()] || 'Monday';
  } catch (e) {
    return 'Monday';
  }
}

const HodApp = {
  currentUser: null,
  currentSection: 'dashboard',
  sectionHistory: ['dashboard'],
  pendingApprovalsCount: 0,
  refreshTimer: null,

  async init(user, forceSection = null) {
    this.currentUser = user || API.getUser();
    this.sectionHistory = ['dashboard'];

    // Instantly sync latest profile from backend
    try {
      const profRes = await API.getHodProfile();
      if (profRes && profRes.success && profRes.profile) {
        this.currentUser = { ...this.currentUser, ...profRes.profile };
        API.setUser(this.currentUser);
      }
    } catch (e) {}

    let initialSection = 'dashboard';
    if (forceSection) {
      initialSection = forceSection;
    } else {
      const hash = window.location.hash.replace('#hod-', '').replace('#', '').trim();
      const validSections = [
        'dashboard', 'profile', 'faculty', 'students', 'subjects',
        'timetable', 'attendance', 'internal-marks', 'assignments',
        'exams', 'workload', 'leaves', 'mentoring', 'reports', 'approvals'
      ];
      if (validSections.includes(hash)) {
        initialSection = hash;
      }
    }

    this.currentSection = initialSection;
    if (initialSection !== 'dashboard') this.sectionHistory.push(initialSection);

    try {
      history.replaceState({ role: 'HOD', section: initialSection }, '', '#hod-' + initialSection);
    } catch (e) {}

    this.renderLayout();
    this.bindEvents();
    await this.loadSectionData(initialSection);
    this.initRealtimeSync();
  },

  // Layout with responsive sidebar, topbar, mobile drawer, and main content area
  renderLayout() {
    const root = document.getElementById('app-root');
    const user = this.currentUser || {};
    const name = user.name || 'Prof. (Dr.) A. K. Sharma';
    const dept = user.department || 'Computer Science & Engineering';

    root.innerHTML = `
      <div class="admin-layout hod-layout">
        
        <!-- Mobile Navigation Drawer Backdrop -->
        <div id="hod-sidebar-backdrop" class="admin-sidebar-backdrop" onclick="HodApp.toggleMobileSidebar(false)"></div>

        <!-- Sidebar Navigation -->
        <aside id="hod-sidebar" class="admin-sidebar hod-sidebar">
          <div class="sidebar-header">
            <div class="brand-crest" style="background: linear-gradient(135deg, #1d4ed8 0%, #0ea5e9 100%);">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#ffffff" stroke-width="2.2">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
              </svg>
            </div>
            <div style="flex:1; min-width:0;">
              <h2 style="font-size:14.5px; font-weight:800; letter-spacing:0.3px; margin:0; line-height:1.2;">HOD PORTAL</h2>
              <span style="font-size:11px; color:#38bdf8; font-weight:700;">CSE • Cyber Security</span>
            </div>
            <button class="icon-btn hod-mobile-close-btn" onclick="HodApp.toggleMobileSidebar(false)" style="display:none; width:30px; height:30px; border-radius:8px; border:1px solid var(--border-color); background:transparent; color:var(--text-muted); cursor:pointer;">✕</button>
          </div>

          <!-- User Card in Sidebar -->
          <div style="padding:14px 16px; border-bottom:1px solid var(--border-color); background:rgba(255,255,255,0.02);">
            <div style="display:flex; align-items:center; gap:10px;">
              <div style="width:38px; height:38px; border-radius:10px; background:linear-gradient(135deg, #2563eb, #38bdf8); display:flex; align-items:center; justify-content:center; font-size:17px; color:#fff; font-weight:800; flex-shrink:0; box-shadow:0 4px 12px rgba(37,99,235,0.25);">
                🏛️
              </div>
              <div style="min-width:0; overflow:hidden;">
                <div style="font-size:12.5px; font-weight:800; color:var(--text-primary); white-space:nowrap; text-overflow:ellipsis; overflow:hidden;" title="${name}">${name}</div>
                <div style="font-size:10.5px; color:#38bdf8; font-weight:700;">Head of Department</div>
                <div style="font-size:10px; color:var(--text-muted); white-space:nowrap; text-overflow:ellipsis; overflow:hidden;">${dept}</div>
              </div>
            </div>
          </div>

          <!-- Sidebar Menu -->
          <div class="sidebar-menu" style="flex:1; overflow-y:auto; padding:12px 10px;">
            <div class="sidebar-group-title">MAIN</div>
            <button class="sidebar-item ${this.currentSection === 'dashboard' ? 'active' : ''}" data-section="dashboard" onclick="HodApp.switchSection('dashboard', event)">
              <span style="font-size:15px; width:22px; text-align:center; flex-shrink:0;">📊</span>
              <span style="font-size:12.5px; font-weight:600;">Department Dashboard</span>
            </button>
            <button class="sidebar-item ${this.currentSection === 'profile' ? 'active' : ''}" data-section="profile" onclick="HodApp.switchSection('profile', event)">
              <span style="font-size:15px; width:22px; text-align:center; flex-shrink:0;">🏛️</span>
              <span style="font-size:12.5px; font-weight:600;">Department Profile</span>
            </button>

            <div class="sidebar-group-title" style="margin-top:14px;">ACADEMIC ADMINISTRATION</div>
            <button class="sidebar-item ${this.currentSection === 'faculty' ? 'active' : ''}" data-section="faculty" onclick="HodApp.switchSection('faculty', event)">
              <span style="font-size:15px; width:22px; text-align:center; flex-shrink:0;">👨‍🏫</span>
              <span style="font-size:12.5px; font-weight:600;">Faculty Management</span>
            </button>
            <button class="sidebar-item ${this.currentSection === 'students' ? 'active' : ''}" data-section="students" onclick="HodApp.switchSection('students', event)">
              <span style="font-size:15px; width:22px; text-align:center; flex-shrink:0;">🎓</span>
              <span style="font-size:12.5px; font-weight:600;">Student Management</span>
            </button>
            <button class="sidebar-item ${this.currentSection === 'subjects' ? 'active' : ''}" data-section="subjects" onclick="HodApp.switchSection('subjects', event)">
              <span style="font-size:15px; width:22px; text-align:center; flex-shrink:0;">📚</span>
              <span style="font-size:12.5px; font-weight:600;">Subject Management</span>
            </button>
            <button class="sidebar-item ${this.currentSection === 'timetable' ? 'active' : ''}" data-section="timetable" onclick="HodApp.switchSection('timetable', event)">
              <span style="font-size:15px; width:22px; text-align:center; flex-shrink:0;">📅</span>
              <span style="font-size:12.5px; font-weight:600;">Timetable Management</span>
            </button>
            <button class="sidebar-item ${this.currentSection === 'internal-marks' ? 'active' : ''}" data-section="internal-marks" onclick="HodApp.switchSection('internal-marks', event)">
              <span style="font-size:15px; width:22px; text-align:center; flex-shrink:0;">📝</span>
              <span style="font-size:12.5px; font-weight:600;">Internal Marks</span>
            </button>
            <button class="sidebar-item ${this.currentSection === 'assignments' ? 'active' : ''}" data-section="assignments" onclick="HodApp.switchSection('assignments', event)">
              <span style="font-size:15px; width:22px; text-align:center; flex-shrink:0;">📑</span>
              <span style="font-size:12.5px; font-weight:600;">Assignments</span>
            </button>
            <button class="sidebar-item ${this.currentSection === 'exams' ? 'active' : ''}" data-section="exams" onclick="HodApp.switchSection('exams', event)">
              <span style="font-size:15px; width:22px; text-align:center; flex-shrink:0;">🎯</span>
              <span style="font-size:12.5px; font-weight:600;">Examination Management</span>
            </button>

            <div class="sidebar-group-title" style="margin-top:14px;">OPERATIONAL CONTROLS</div>
            <button class="sidebar-item ${this.currentSection === 'attendance' ? 'active' : ''}" data-section="attendance" onclick="HodApp.switchSection('attendance', event)">
              <span style="font-size:15px; width:22px; text-align:center; flex-shrink:0;">⏱️</span>
              <span style="font-size:12.5px; font-weight:600;">Attendance Management</span>
            </button>
            <button class="sidebar-item ${this.currentSection === 'workload' ? 'active' : ''}" data-section="workload" onclick="HodApp.switchSection('workload', event)">
              <span style="font-size:15px; width:22px; text-align:center; flex-shrink:0;">⚖️</span>
              <span style="font-size:12.5px; font-weight:600;">Faculty Workload</span>
            </button>
            <button class="sidebar-item ${this.currentSection === 'leaves' ? 'active' : ''}" data-section="leaves" onclick="HodApp.switchSection('leaves', event)">
              <span style="font-size:15px; width:22px; text-align:center; flex-shrink:0;">✉️</span>
              <span style="font-size:12.5px; font-weight:600;">Leave Approvals</span>
            </button>
            <button class="sidebar-item ${this.currentSection === 'mentoring' ? 'active' : ''}" data-section="mentoring" onclick="HodApp.switchSection('mentoring', event)">
              <span style="font-size:15px; width:22px; text-align:center; flex-shrink:0;">🤝</span>
              <span style="font-size:12.5px; font-weight:600;">Student Mentoring</span>
            </button>

            <div class="sidebar-group-title" style="margin-top:14px;">DECISION & ANALYTICS</div>
            <button class="sidebar-item ${this.currentSection === 'reports' ? 'active' : ''}" data-section="reports" onclick="HodApp.switchSection('reports', event)">
              <span style="font-size:15px; width:22px; text-align:center; flex-shrink:0;">📈</span>
              <span style="font-size:12.5px; font-weight:600;">Department Reports</span>
            </button>
            <button class="sidebar-item ${this.currentSection === 'approvals' ? 'active' : ''}" data-section="approvals" onclick="HodApp.switchSection('approvals', event)" style="position:relative; display:flex; align-items:center; width:100%;">
              <span style="font-size:15px; width:22px; text-align:center; flex-shrink:0;">⚡</span>
              <span style="flex:1; font-size:12.5px; font-weight:600; text-align:left;">HOD Approvals</span>
              <span id="hod-nav-pending-badge" class="badge" style="background:#ef4444; color:#fff; font-size:10px; padding:2px 6px; border-radius:10px; margin-left:auto; display:${this.pendingApprovalsCount > 0 ? 'inline-block' : 'none'};">
                ${this.pendingApprovalsCount}
              </span>
            </button>
          </div>

          <!-- Sidebar Footer Controls -->
          <div class="sidebar-footer" style="padding:12px 16px; border-top:1px solid var(--border-color); display:flex; align-items:center; justify-content:space-between;">
            <button class="btn-sec" onclick="HodApp.toggleTheme()" style="padding:6px 10px; font-size:11.5px; display:inline-flex; align-items:center; gap:5px; border-radius:8px;">
              <span>🌓</span> <span>Theme</span>
            </button>
            <button class="btn-sec" onclick="HodApp.logout()" style="padding:6px 10px; font-size:11.5px; color:#ef4444; border-color:rgba(239,68,68,0.3); display:inline-flex; align-items:center; gap:5px; border-radius:8px;">
              <span>🚪</span> <span>Logout</span>
            </button>
          </div>
        </aside>

        <!-- Main Content Area -->
        <main class="admin-main hod-main">
          
          <!-- Sticky Topbar Header -->
          <header class="admin-topbar hod-top-bar">
            <div style="display:flex; align-items:center; gap:12px;">
              <button class="icon-btn" id="hod-sidebar-toggle" onclick="HodApp.toggleMobileSidebar(true)" style="display:none; width:36px; height:36px; border-radius:8px; border:1px solid var(--border-color); background:rgba(255,255,255,0.05); align-items:center; justify-content:center; cursor:pointer;" title="Open Menu">
                <span style="font-size:18px;">☰</span>
              </button>
              <div>
                <h1 id="hod-page-title" class="admin-page-title" style="margin:0; font-size:17px; font-weight:800; line-height:1.2;">
                  Department Dashboard
                </h1>
                <div style="font-size:11.5px; color:var(--text-muted); display:flex; align-items:center; gap:6px; margin-top:2px;">
                  <span>HOD Portal</span>
                  <span>•</span>
                  <span id="hod-page-breadcrumb" style="color:#38bdf8; font-weight:600;">Computer Science & Engineering</span>
                </div>
              </div>
            </div>

            <!-- Topbar Quick Actions -->
            <div style="display:flex; align-items:center; gap:10px;">
              <span class="server-status-pill" style="font-size:11.5px; padding:4px 10px; display:inline-flex; align-items:center; gap:6px;">
                <span>🏛️</span> <span class="hide-mobile">CSE Department Active</span>
              </span>

              <button class="icon-btn" onclick="HodApp.switchSection('approvals')" style="position:relative; width:36px; height:36px; border-radius:10px; background:rgba(255,255,255,0.06); border:1px solid var(--border-color); cursor:pointer; display:inline-flex; align-items:center; justify-content:center;" title="View Pending Approvals">
                <span>⚡</span>
                <span id="hod-top-pending-badge" style="position:absolute; top:-4px; right:-4px; background:#ef4444; color:#fff; font-size:10px; font-weight:800; width:18px; height:18px; border-radius:50%; display:${this.pendingApprovalsCount > 0 ? 'flex' : 'none'}; align-items:center; justify-content:center; border:2px solid var(--bg-main);">
                  ${this.pendingApprovalsCount}
                </span>
              </button>

              <button class="btn-sec hide-mobile" onclick="HodApp.switchSection('profile')" style="padding:6px 12px; font-size:12px; display:inline-flex; align-items:center; gap:6px; border-radius:8px;">
                <span>👤</span> <span>Profile</span>
              </button>

              <button class="btn-sec" onclick="HodApp.logout()" style="padding:6px 12px; font-size:12px; color:#ef4444; border-color:rgba(239,68,68,0.3); display:inline-flex; align-items:center; gap:6px; border-radius:8px;">
                <span>🚪</span> <span class="hide-mobile">Logout</span>
              </button>
            </div>
          </header>

          <!-- Module Dynamic Mounting Area -->
          <div id="hod-content-area" class="admin-content" style="padding:24px 28px 40px; width:100%; box-sizing:border-box;">
            <div style="display:flex; justify-content:center; align-items:center; min-height:300px; flex-direction:column; gap:12px;">
              <div style="width:36px; height:36px; border:3px solid rgba(255,255,255,0.1); border-top-color:#38bdf8; border-radius:50%; animation:spin 0.8s linear infinite;"></div>
              <p style="color:var(--text-muted); font-size:13px; font-weight:600;">Loading Department Dashboard...</p>
            </div>
          </div>
        </main>

      </div>

      <style>
        .hod-sidebar .sidebar-group-title {
          font-size: 10.5px;
          font-weight: 800;
          color: var(--text-muted);
          letter-spacing: 0.8px;
          text-transform: uppercase;
          padding: 8px 12px 4px;
        }
        @media (max-width: 900px) {
          #hod-sidebar {
            transform: translateX(-100%);
            box-shadow: 0 0 40px rgba(0, 0, 0, 0.8);
          }
          #hod-sidebar.open {
            transform: translateX(0);
          }
          #hod-sidebar-backdrop.open,
          #hod-sidebar-backdrop.show {
            display: block !important;
          }
          .hod-mobile-close-btn {
            display: inline-flex !important;
          }
          #hod-sidebar-toggle {
            display: flex !important;
          }
        }
        @media (max-width: 640px) {
          .hide-mobile {
            display: none !important;
          }
          .hod-top-bar {
            padding: 10px 14px !important;
          }
          #hod-content-area {
            padding: 14px 12px 30px !important;
          }
        }
      </style>
    `;
  },

  toggleMobileSidebar(open) {
    const sidebar = document.getElementById('hod-sidebar');
    const backdrop = document.getElementById('hod-sidebar-backdrop');
    if (!sidebar) return;
    if (open) {
      sidebar.classList.add('open');
      if (backdrop) {
        backdrop.classList.add('open');
        backdrop.classList.add('show');
      }
    } else {
      sidebar.classList.remove('open');
      if (backdrop) {
        backdrop.classList.remove('open');
        backdrop.classList.remove('show');
      }
    }
  },

  bindEvents() {
    window.addEventListener('popstate', (e) => {
      if (e.state && e.state.role === 'HOD' && e.state.section) {
        this.switchSection(e.state.section, null, false);
      }
    });
  },

  async switchSection(section, event = null, updateHistory = true) {
    if (event) event.preventDefault();
    this.toggleMobileSidebar(false);

    this.currentSection = section;

    // Update active state in sidebar
    document.querySelectorAll('#hod-sidebar .sidebar-item').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.section === section);
    });
    document.querySelectorAll('#hod-sidebar .sidebar-nav-link').forEach(link => {
      const href = link.getAttribute('href') || '';
      link.classList.toggle('active', href.includes(section));
    });

    if (updateHistory) {
      try {
        history.pushState({ role: 'HOD', section }, '', '#hod-' + section);
        this.sectionHistory.push(section);
      } catch (e) {}
    }

    // Update Topbar Title
    const titleEl = document.getElementById('hod-page-title');
    const breadcrumbEl = document.getElementById('hod-page-breadcrumb');
    const titles = {
      'dashboard': 'Department Dashboard',
      'profile': 'Department Profile & Governance',
      'faculty': 'Faculty Management & Responsibilities',
      'students': 'Department Students & Records',
      'subjects': 'Subject & Curriculum Management',
      'timetable': 'Timetable & Class Schedules',
      'attendance': 'Attendance Monitoring & Audit',
      'internal-marks': 'Internal Assessment & Marks Verification',
      'assignments': 'Department Assignments & Evaluations',
      'exams': 'Examination Management & Readiness',
      'workload': 'Faculty Workload Matrix',
      'leaves': 'Faculty & Student Leave Approvals',
      'mentoring': 'Student Mentoring & Intervention',
      'reports': 'Department Reports & Compliance Exports',
      'approvals': 'Central HOD Approvals Dashboard'
    };

    if (titleEl) titleEl.textContent = titles[section] || 'Department Management';
    if (breadcrumbEl) breadcrumbEl.textContent = titles[section] || 'Module Overview';

    await this.loadSectionData(section);
  },

  async loadSectionData(section) {
    const contentArea = document.getElementById('hod-content-area');
    if (!contentArea) return;

    contentArea.innerHTML = `
      <div style="display:flex; justify-content:center; align-items:center; min-height:260px; flex-direction:column; gap:12px;">
        <div style="width:34px; height:34px; border:3px solid rgba(255,255,255,0.1); border-top-color:#38bdf8; border-radius:50%; animation:spin 0.8s linear infinite;"></div>
        <p style="color:var(--text-muted); font-size:12.5px; font-weight:600;">Loading data...</p>
      </div>
    `;

    try {
      switch (section) {
        case 'dashboard':
          await this.renderDashboard();
          break;
        case 'profile':
          await this.renderProfile();
          break;
        case 'faculty':
          await this.renderFaculty();
          break;
        case 'students':
          await this.renderStudents();
          break;
        case 'subjects':
          await this.renderSubjects();
          break;
        case 'timetable':
          await this.renderTimetable();
          break;
        case 'attendance':
          await this.renderAttendance();
          break;
        case 'internal-marks':
          await this.renderInternalMarks();
          break;
        case 'assignments':
          await this.renderAssignments();
          break;
        case 'exams':
          await this.renderExams();
          break;
        case 'workload':
          await this.renderWorkload();
          break;
        case 'leaves':
          await this.renderLeaves();
          break;
        case 'mentoring':
          await this.renderMentoring();
          break;
        case 'reports':
          await this.renderReports();
          break;
        case 'approvals':
          await this.renderApprovals();
          break;
        default:
          await this.renderDashboard();
      }
    } catch (err) {
      console.error(`[HodApp] Error loading section ${section}:`, err);
      contentArea.innerHTML = `
        <div class="card" style="padding:24px; text-align:center; max-width:500px; margin:40px auto; border:1px solid rgba(239,68,68,0.3);">
          <div style="font-size:32px; margin-bottom:8px;">⚠️</div>
          <h3 style="font-size:16px; font-weight:800; color:#ef4444; margin-bottom:6px;">Failed to load ${section} module</h3>
          <p style="font-size:12.5px; color:var(--text-muted); margin-bottom:16px;">${err.message || 'Server connection error or session expired.'}</p>
          <button class="btn-primary" onclick="HodApp.loadSectionData('${section}')" style="padding:8px 18px; font-size:12px;">Retry</button>
        </div>
      `;
    }
  },

  updatePendingBadge(count) {
    this.pendingApprovalsCount = count || 0;
    const navBadge = document.getElementById('hod-nav-pending-badge');
    const topBadge = document.getElementById('hod-top-pending-badge');
    if (navBadge) {
      navBadge.textContent = count;
      navBadge.style.display = count > 0 ? 'inline-block' : 'none';
    }
    if (topBadge) {
      topBadge.textContent = count;
      topBadge.style.display = count > 0 ? 'flex' : 'none';
    }
  },

  showToast(message, type = 'info') {
    if (window.App && typeof window.App.showToast === 'function') {
      window.App.showToast(message, type);
      return;
    }
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.style.cssText = `
      position:fixed; bottom:24px; right:24px; z-index:99999;
      background:#1e293b; color:#fff; border-left:4px solid ${type === 'success' ? '#10b981' : (type === 'error' ? '#ef4444' : '#38bdf8')};
      padding:12px 18px; border-radius:8px; box-shadow:0 8px 24px rgba(0,0,0,0.5); font-size:13px; font-weight:600;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3200);
  },

  logout() {
    if (confirm('Are you sure you want to log out from HOD Portal?')) {
      API.logout();
      if (window.App && typeof window.App.showAuth === 'function') {
        window.App.showAuth();
      } else {
        window.location.reload();
      }
    }
  },

  toggleTheme() {
    if (window.App && typeof window.App.toggleTheme === 'function') {
      window.App.toggleTheme();
    } else {
      const current = document.documentElement.getAttribute('data-theme') || 'dark';
      const next = current === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('mgi_theme', next);
    }
  },

  initRealtimeSync() {
    if (this.refreshTimer) clearInterval(this.refreshTimer);
    // Auto-refresh pending queue status every 45 seconds
    this.refreshTimer = setInterval(async () => {
      try {
        const appRes = await API.getHodApprovals({ status: 'PENDING' });
        if (appRes && appRes.success && Array.isArray(appRes.approvals)) {
          this.updatePendingBadge(appRes.approvals.length);
        }
      } catch (e) {}
    }, 45000);
  },

  // ========================================================================
  // MODULE 1: DEPARTMENT DASHBOARD
  // ========================================================================
  async renderDashboard() {
    const res = await API.getHodDashboard();
    if (!res || !res.success) throw new Error(res?.message || 'Failed to load dashboard data');

    const s = res.stats || {};
    const lectures = res.todayLectures || [];
    const pendingApprovals = res.pendingApprovals || [];
    const pendingLeaves = res.pendingLeaves || [];
    const workload = res.facultyWorkload || [];
    const exams = res.upcomingExams || [];

    this.updatePendingBadge((s.pendingApprovalsCount || 0) + (s.pendingLeavesCount || 0));

    const content = document.getElementById('hod-content-area');
    content.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:20px;">
        
        <!-- Welcome Hero Banner -->
        <div class="card" style="padding:22px; background:linear-gradient(135deg, rgba(37,99,235,0.15) 0%, rgba(6,182,212,0.1) 100%); border:1px solid rgba(56,189,248,0.25); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:16px;">
          <div>
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
              <span class="badge" style="background:#10b981; color:#fff; font-size:10px; padding:3px 8px; border-radius:4px; font-weight:800;">ACTIVE TERM 2026-27</span>
              <span style="font-size:12px; color:var(--text-muted);">Division 3CYBER7 • B.Tech Cyber Security</span>
            </div>
            <h2 style="font-size:20px; font-weight:900; color:var(--text-primary); margin:0;">Welcome, ${this.currentUser?.name || 'Head of Department'}</h2>
            <p style="font-size:12.5px; color:var(--text-secondary); margin:4px 0 0;">Department Operations, Faculty Workload & Governance Hub</p>
          </div>
          
          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            <button class="btn-primary" onclick="HodApp.switchSection('approvals')" style="padding:8px 14px; font-size:12px; display:inline-flex; align-items:center; gap:6px;">
              <span>⚡</span> <span>Review Pending Approvals (${(s.pendingApprovalsCount || 0) + (s.pendingLeavesCount || 0)})</span>
            </button>
            <button class="btn-sec" onclick="HodApp.switchSection('reports')" style="padding:8px 14px; font-size:12px; display:inline-flex; align-items:center; gap:6px;">
              <span>📄</span> <span>Generate Reports</span>
            </button>
          </div>
        </div>

        <!-- 8 Core Metrics Metric Grid -->
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:14px;">
          
          <div class="card stat-card" style="padding:16px;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start;">
              <span style="font-size:11.5px; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Students Enrolled</span>
              <span style="font-size:20px;">🎓</span>
            </div>
            <div style="font-size:24px; font-weight:900; color:#38bdf8; margin:8px 0 2px;">${s.totalStudents || 65}</div>
            <div style="font-size:11px; color:var(--text-secondary);">Division 3CYBER7 (Batches 1 & 2)</div>
          </div>

          <div class="card stat-card" style="padding:16px;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start;">
              <span style="font-size:11.5px; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Faculty Strength</span>
              <span style="font-size:20px;">👨‍🏫</span>
            </div>
            <div style="font-size:24px; font-weight:900; color:#10b981; margin:8px 0 2px;">${s.totalFaculty || 7}</div>
            <div style="font-size:11px; color:var(--text-secondary);">Active teaching staff</div>
          </div>

          <div class="card stat-card" style="padding:16px;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start;">
              <span style="font-size:11.5px; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Today's Attendance</span>
              <span style="font-size:20px;">⏱️</span>
            </div>
            <div style="font-size:24px; font-weight:900; color:${(s.attendancePercentageToday || 86) >= 75 ? '#10b981' : '#ef4444'}; margin:8px 0 2px;">
              ${s.attendancePercentageToday || 86}%
            </div>
            <div style="font-size:11px; color:var(--text-secondary);">${s.presentToday || 0} Present / ${s.absentToday || 0} Absent</div>
          </div>

          <div class="card stat-card" style="padding:16px;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start;">
              <span style="font-size:11.5px; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Subjects Offered</span>
              <span style="font-size:20px;">📚</span>
            </div>
            <div style="font-size:24px; font-weight:900; color:#a855f7; margin:8px 0 2px;">${s.totalSubjects || 8}</div>
            <div style="font-size:11px; color:var(--text-secondary);">3rd Semester Curriculum</div>
          </div>

          <div class="card stat-card" style="padding:16px;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start;">
              <span style="font-size:11.5px; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Today's Lectures</span>
              <span style="font-size:20px;">📅</span>
            </div>
            <div style="font-size:24px; font-weight:900; color:#f59e0b; margin:8px 0 2px;">${s.todayLecturesCount || lectures.length}</div>
            <div style="font-size:11px; color:var(--text-secondary);">${res.todayDay || 'Scheduled Classes'}</div>
          </div>

          <div class="card stat-card" style="padding:16px;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start;">
              <span style="font-size:11.5px; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Pending Approvals</span>
              <span style="font-size:20px;">⚡</span>
            </div>
            <div style="font-size:24px; font-weight:900; color:${(s.pendingApprovalsCount || 0) > 0 ? '#ef4444' : '#10b981'}; margin:8px 0 2px;">
              ${s.pendingApprovalsCount || 0}
            </div>
            <div style="font-size:11px; color:var(--text-secondary);">Marks & Timetable changes</div>
          </div>

          <div class="card stat-card" style="padding:16px;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start;">
              <span style="font-size:11.5px; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Pending Leaves</span>
              <span style="font-size:20px;">✉️</span>
            </div>
            <div style="font-size:24px; font-weight:900; color:${(s.pendingLeavesCount || 0) > 0 ? '#f59e0b' : '#10b981'}; margin:8px 0 2px;">
              ${s.pendingLeavesCount || 0}
            </div>
            <div style="font-size:11px; color:var(--text-secondary);">Faculty & Student requests</div>
          </div>

          <div class="card stat-card" style="padding:16px;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start;">
              <span style="font-size:11.5px; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Upcoming Exams</span>
              <span style="font-size:20px;">🎯</span>
            </div>
            <div style="font-size:24px; font-weight:900; color:#38bdf8; margin:8px 0 2px;">${s.activeExamsCount || exams.length}</div>
            <div style="font-size:11px; color:var(--text-secondary);">Mid-Semester Assessments</div>
          </div>

        </div>

        <!-- 2-Column Section: Today's Schedule & Actionable Approvals -->
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(340px, 1fr)); gap:18px;">
          
          <!-- Today's Lectures -->
          <div class="card" style="padding:20px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
              <div>
                <h3 style="font-size:15px; font-weight:800; margin:0; display:flex; align-items:center; gap:8px;">
                  <span>📅</span> Today's Lectures (${res.todayDay})
                </h3>
                <span style="font-size:11.5px; color:var(--text-muted);">Real-time classroom tracking</span>
              </div>
              <button class="btn-sec" onclick="HodApp.switchSection('timetable')" style="padding:4px 10px; font-size:11px;">View Full</button>
            </div>

            ${lectures.length === 0 ? `
              <div style="text-align:center; padding:24px; color:var(--text-muted); font-size:12.5px;">
                No classes scheduled for today.
              </div>
            ` : `
              <div style="display:flex; flex-direction:column; gap:8px;">
                ${lectures.map(l => `
                  <div style="padding:10px 14px; background:rgba(255,255,255,0.03); border:1px solid var(--border-color); border-radius:8px; display:flex; justify-content:space-between; align-items:center; gap:12px;">
                    <div>
                      <div style="font-size:13px; font-weight:700; color:var(--text-primary); display:flex; align-items:center; gap:6px;">
                        <span>${l.subject}</span>
                        ${l.is_lab ? '<span class="badge" style="background:#a855f7; color:#fff; font-size:9.5px; padding:1px 5px;">LAB</span>' : ''}
                        ${l.override_type ? '<span class="badge" style="background:#f59e0b; color:#fff; font-size:9.5px; padding:1px 5px;">ROOM CHANGE</span>' : ''}
                      </div>
                      <div style="font-size:11.5px; color:var(--text-muted); margin-top:2px;">
                        <span>${l.effective_teacher || l.teacher}</span> • <span>Room ${l.effective_room || l.room}</span> • <span>${l.batch}</span>
                      </div>
                    </div>
                    <div style="text-align:right;">
                      <span class="badge" style="background:rgba(56,189,248,0.15); color:#38bdf8; font-size:11px; padding:3px 8px; border-radius:6px; font-weight:700;">
                        ${l.start_time} - ${l.end_time}
                      </span>
                    </div>
                  </div>
                `).join('')}
              </div>
            `}
          </div>

          <!-- Pending Approvals & Leave Requests -->
          <div class="card" style="padding:20px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
              <div>
                <h3 style="font-size:15px; font-weight:800; margin:0; display:flex; align-items:center; gap:8px;">
                  <span>⚡</span> Pending Action Items
                </h3>
                <span style="font-size:11.5px; color:var(--text-muted);">Decisions requiring HOD authorization</span>
              </div>
              <button class="btn-sec" onclick="HodApp.switchSection('approvals')" style="padding:4px 10px; font-size:11px;">Queue</button>
            </div>

            ${(pendingApprovals.length === 0 && pendingLeaves.length === 0) ? `
              <div style="text-align:center; padding:28px; color:#10b981; font-size:12.5px; font-weight:600;">
                ✓ All departmental approvals and leave requests are up to date!
              </div>
            ` : `
              <div style="display:flex; flex-direction:column; gap:8px;">
                ${pendingApprovals.map(a => `
                  <div style="padding:10px 14px; background:rgba(239,68,68,0.06); border:1px solid rgba(239,68,68,0.25); border-radius:8px; display:flex; justify-content:space-between; align-items:center; gap:12px;">
                    <div>
                      <div style="font-size:12.5px; font-weight:700; color:var(--text-primary);">${a.title}</div>
                      <div style="font-size:11px; color:var(--text-muted); margin-top:2px;">Requested by ${a.requester_name} (${a.requester_role})</div>
                    </div>
                    <button class="btn-primary" onclick="HodApp.quickApproveModal(${a.id}, '${a.title}')" style="padding:4px 10px; font-size:11px;">Review</button>
                  </div>
                `).join('')}

                ${pendingLeaves.map(l => `
                  <div style="padding:10px 14px; background:rgba(245,158,11,0.06); border:1px solid rgba(245,158,11,0.25); border-radius:8px; display:flex; justify-content:space-between; align-items:center; gap:12px;">
                    <div>
                      <div style="font-size:12.5px; font-weight:700; color:var(--text-primary);">Leave Request: ${l.applicant_name} (${l.applicant_type})</div>
                      <div style="font-size:11px; color:var(--text-muted); margin-top:2px;">${l.leave_type} • ${l.start_date} to ${l.end_date} (${l.total_days} days)</div>
                    </div>
                    <button class="btn-sec" onclick="HodApp.quickReviewLeave(${l.id}, '${l.applicant_name}')" style="padding:4px 10px; font-size:11px;">Decide</button>
                  </div>
                `).join('')}
              </div>
            `}
          </div>

        </div>

        <!-- Faculty Workload Summary Highlights -->
        <div class="card" style="padding:20px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
            <div>
              <h3 style="font-size:15px; font-weight:800; margin:0; display:flex; align-items:center; gap:8px;">
                <span>⚖️</span> Faculty Teaching Workload Snapshot
              </h3>
              <span style="font-size:11.5px; color:var(--text-muted);">Weekly hours calculated directly from official timetable</span>
            </div>
            <button class="btn-sec" onclick="HodApp.switchSection('workload')" style="padding:4px 10px; font-size:11px;">View All Faculty</button>
          </div>

          <div style="overflow-x:auto;">
            <table class="table" style="width:100%; border-collapse:collapse; font-size:12.5px;">
              <thead>
                <tr style="border-bottom:1px solid var(--border-color); text-align:left; color:var(--text-muted);">
                  <th style="padding:10px;">Faculty Name</th>
                  <th style="padding:10px;">Designation</th>
                  <th style="padding:10px;">Assigned Subject(s)</th>
                  <th style="padding:10px; text-align:center;">Weekly Slots</th>
                  <th style="padding:10px; text-align:center;">Calculated Hours</th>
                  <th style="padding:10px; text-align:center;">Workload Status</th>
                </tr>
              </thead>
              <tbody>
                ${workload.map(w => {
                  const hours = w.total_hours || 0;
                  const limit = w.workload_limit_hours || 20;
                  let badge = '<span class="badge" style="background:#10b981; color:#fff; font-size:10px; padding:2px 8px;">BALANCED</span>';
                  if (hours > limit) badge = '<span class="badge" style="background:#ef4444; color:#fff; font-size:10px; padding:2px 8px;">OVERLOADED</span>';
                  else if (hours < 12) badge = '<span class="badge" style="background:#f59e0b; color:#fff; font-size:10px; padding:2px 8px;">UNDERUTILIZED</span>';

                  return `
                    <tr style="border-bottom:1px solid var(--border-color);">
                      <td style="padding:10px; font-weight:700; color:var(--text-primary);">${w.name}</td>
                      <td style="padding:10px; color:var(--text-secondary);">${w.designation}</td>
                      <td style="padding:10px; color:#38bdf8;">${w.subjects || '-'}</td>
                      <td style="padding:10px; text-align:center;">${w.weekly_slots || 0}</td>
                      <td style="padding:10px; text-align:center; font-weight:800;">${hours} hrs / wk</td>
                      <td style="padding:10px; text-align:center;">${badge}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    `;
  },

  // ========================================================================
  // MODULE 2: DEPARTMENT PROFILE
  // ========================================================================
  async renderProfile() {
    const res = await API.getHodProfile();
    const p = (res && res.profile) || {};

    const content = document.getElementById('hod-content-area');
    content.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:20px; max-width:960px; margin:0 auto;">
        
        <div class="card" style="padding:24px;">
          <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border-color); padding-bottom:16px; margin-bottom:20px; flex-wrap:wrap; gap:12px;">
            <div>
              <span class="badge" style="background:#2563eb; color:#fff; font-size:10px; padding:3px 8px; border-radius:4px;">CODE: ${p.code || 'CSE'}</span>
              <h2 style="font-size:20px; font-weight:900; color:var(--text-primary); margin:6px 0 2px;">${p.name || 'Computer Science & Engineering'}</h2>
              <p style="font-size:12px; color:var(--text-muted);">Established Year: ${p.established_year || 2012} • Mishra Group Institute</p>
            </div>
            <div style="display:flex; gap:10px;">
              <span class="badge" style="background:rgba(56,189,248,0.15); color:#38bdf8; font-size:12px; padding:6px 12px; border-radius:8px;">
                👥 Students: ${p.student_strength || 65}
              </span>
              <span class="badge" style="background:rgba(16,185,129,0.15); color:#10b981; font-size:12px; padding:6px 12px; border-radius:8px;">
                👨‍🏫 Faculty: ${p.faculty_strength || 7}
              </span>
            </div>
          </div>

          <form id="hod-profile-form" onsubmit="event.preventDefault(); HodApp.saveProfile();">
            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(280px, 1fr)); gap:16px;">
              
              <div class="form-group">
                <label class="form-label">Head of Department (HOD) *</label>
                <input type="text" id="prof-head-name" class="form-control" value="${p.head_name || 'Prof. (Dr.) A. K. Sharma'}" required />
              </div>

              <div class="form-group">
                <label class="form-label">Contact Email *</label>
                <input type="email" id="prof-email" class="form-control" value="${p.contact_email || 'hod.cse@mishragroup.ac.in'}" required />
              </div>

              <div class="form-group">
                <label class="form-label">Contact Phone</label>
                <input type="text" id="prof-phone" class="form-control" value="${p.contact_phone || '+91 98765 43210'}" />
              </div>

              <div class="form-group">
                <label class="form-label">Office Location</label>
                <input type="text" id="prof-office" class="form-control" value="${p.office_location || 'Engineering Block A, Room 301'}" />
              </div>

              <div class="form-group">
                <label class="form-label">Approved Annual Student Intake</label>
                <input type="number" id="prof-intake" class="form-control" value="${p.total_intake || 120}" min="30" max="300" />
              </div>

              <div class="form-group">
                <label class="form-label">Active Academic Programs</label>
                <input type="text" id="prof-courses" class="form-control" value="${p.active_courses || 'B.Tech Cyber Security'}" />
              </div>

              <div class="form-group">
                <label class="form-label">Active Semesters</label>
                <input type="text" id="prof-semesters" class="form-control" value="${p.active_semesters || '3rd Semester'}" />
              </div>

              <div class="form-group">
                <label class="form-label">Active Sections / Divisions</label>
                <input type="text" id="prof-sections" class="form-control" value="${p.active_sections || '3CYBER7'}" />
              </div>

            </div>

            <div class="form-group" style="margin-top:12px;">
              <label class="form-label">Department Description & Mission Statement</label>
              <textarea id="prof-desc" class="form-control" rows="3">${p.description || ''}</textarea>
            </div>

            <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:20px; border-top:1px solid var(--border-color); padding-top:16px;">
              <button type="submit" class="btn-primary" style="padding:9px 24px; font-size:13px; font-weight:800;">
                <span>💾 Save Department Profile</span>
              </button>
            </div>
          </form>
        </div>

      </div>
    `;
  },

  async saveProfile() {
    const head_name = document.getElementById('prof-head-name')?.value.trim();
    const contact_email = document.getElementById('prof-email')?.value.trim();
    const contact_phone = document.getElementById('prof-phone')?.value.trim();
    const office_location = document.getElementById('prof-office')?.value.trim();
    const total_intake = document.getElementById('prof-intake')?.value;
    const active_courses = document.getElementById('prof-courses')?.value.trim();
    const active_semesters = document.getElementById('prof-semesters')?.value.trim();
    const active_sections = document.getElementById('prof-sections')?.value.trim();
    const description = document.getElementById('prof-desc')?.value.trim();

    if (!head_name || !contact_email) {
      this.showToast('Please fill all required profile fields.', 'error');
      return;
    }

    try {
      const res = await API.updateHodProfile({
        head_name,
        contact_email,
        contact_phone,
        office_location,
        total_intake,
        active_courses,
        active_semesters,
        active_sections,
        description
      });
      if (res && res.success) {
        this.showToast('Department profile updated successfully!', 'success');
      } else {
        this.showToast(res?.message || 'Failed to update profile.', 'error');
      }
    } catch (err) {
      this.showToast('Server error while saving profile.', 'error');
    }
  },

  // ========================================================================
  // MODULE 3: FACULTY MANAGEMENT
  // ========================================================================
  async renderFaculty() {
    const res = await API.getHodFaculty();
    const faculty = (res && res.faculty) || [];

    const content = document.getElementById('hod-content-area');
    content.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:20px;">
        
        <!-- Header & Action Row -->
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
          <div>
            <h2 style="font-size:18px; font-weight:900; margin:0; color:var(--text-primary);">Department Faculty Members</h2>
            <p style="font-size:12px; color:var(--text-muted); margin:2px 0 0;">Manage teaching appointments, workload assignments & academic responsibilities</p>
          </div>
          <button class="btn-primary" onclick="HodApp.openAddFacultyModal()" style="padding:8px 16px; font-size:12px; display:inline-flex; align-items:center; gap:6px;">
            <span>➕</span> <span>Add Faculty Member</span>
          </button>
        </div>

        <!-- Filter Controls -->
        <div class="card" style="padding:14px; display:flex; gap:12px; flex-wrap:wrap; align-items:center;">
          <div style="flex:1; min-width:220px;">
            <input type="text" id="faculty-search" class="form-control" placeholder="Search by name, ID or subject..." oninput="HodApp.filterFacultyList()" style="height:38px; font-size:12.5px;" />
          </div>
          <div style="min-width:160px;">
            <select id="faculty-designation-filter" class="form-control" onchange="HodApp.filterFacultyList()" style="height:38px; font-size:12.5px;">
              <option value="">All Designations</option>
              <option value="Associate Professor">Associate Professor</option>
              <option value="Assistant Professor">Assistant Professor</option>
            </select>
          </div>
          <div style="min-width:130px;">
            <select id="faculty-status-filter" class="form-control" onchange="HodApp.filterFacultyList()" style="height:38px; font-size:12.5px;">
              <option value="">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </div>
        </div>

        <!-- Faculty Grid -->
        <div id="faculty-cards-container" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(310px, 1fr)); gap:16px;">
          ${faculty.map(f => this.renderFacultyCard(f)).join('')}
        </div>

      </div>
    `;
  },

  renderFacultyCard(f) {
    const hours = f.calculated_hours || 0;
    const limit = f.workload_limit_hours || 20;
    const statusColor = f.status === 'ACTIVE' ? '#10b981' : '#ef4444';

    return `
      <div class="card faculty-card" data-name="${(f.name || '').toLowerCase()}" data-id="${(f.teacher_id || '').toLowerCase()}" data-subject="${(f.subjects || '').toLowerCase()}" data-designation="${f.designation || ''}" data-status="${f.status || 'ACTIVE'}" style="padding:18px; display:flex; flex-direction:column; justify-content:space-between; gap:14px;">
        <div>
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;">
            <div>
              <span class="badge" style="background:rgba(255,255,255,0.08); color:var(--text-muted); font-size:10px; padding:2px 6px; border-radius:4px;">ID: ${f.teacher_id}</span>
              <h3 style="font-size:15px; font-weight:800; color:var(--text-primary); margin:4px 0 2px;">${f.name}</h3>
              <div style="font-size:11.5px; color:#38bdf8; font-weight:600;">${f.designation || 'Faculty'}</div>
            </div>
            <span class="badge" style="background:${statusColor}; color:#fff; font-size:10px; padding:2px 7px;">${f.status}</span>
          </div>

          <div style="font-size:12px; color:var(--text-secondary); display:flex; flex-direction:column; gap:4px; margin-top:8px;">
            <div><strong>Subjects:</strong> <span style="color:var(--text-primary);">${f.subjects || 'General'}</span></div>
            <div><strong>Qualification:</strong> ${f.qualification || 'M.Tech / Ph.D'}</div>
            <div><strong>Experience:</strong> ${f.experience_years || 5} Years</div>
            <div><strong>Office:</strong> ${f.office_room || 'NB-302'}</div>
            <div><strong>Email:</strong> ${f.email || 'faculty@mishragroup.ac.in'}</div>
          </div>
        </div>

        <div style="border-top:1px solid var(--border-color); padding-top:12px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; font-size:12px;">
            <span style="color:var(--text-muted);">Weekly Workload:</span>
            <span style="font-weight:800; color:${hours > limit ? '#ef4444' : '#10b981'};">
              ${hours} / ${limit} hrs
            </span>
          </div>
          
          <div style="display:flex; gap:8px;">
            <button class="btn-sec" onclick="HodApp.viewFacultySchedule('${f.teacher_id}', '${f.name}')" style="flex:1; padding:6px; font-size:11.5px; text-align:center;">
              📅 Schedule
            </button>
            <button class="btn-primary" onclick="HodApp.openEditFacultyModal(${f.id})" style="flex:1; padding:6px; font-size:11.5px; text-align:center;">
              ✏️ Edit
            </button>
          </div>
        </div>
      </div>
    `;
  },

  filterFacultyList() {
    const search = (document.getElementById('faculty-search')?.value || '').toLowerCase().trim();
    const designation = document.getElementById('faculty-designation-filter')?.value || '';
    const status = document.getElementById('faculty-status-filter')?.value || '';

    document.querySelectorAll('.faculty-card').forEach(card => {
      const cName = card.getAttribute('data-name') || '';
      const cId = card.getAttribute('data-id') || '';
      const cSub = card.getAttribute('data-subject') || '';
      const cDesig = card.getAttribute('data-designation') || '';
      const cStatus = card.getAttribute('data-status') || '';

      const matchesSearch = !search || cName.includes(search) || cId.includes(search) || cSub.includes(search);
      const matchesDesig = !designation || cDesig === designation;
      const matchesStatus = !status || cStatus === status;

      card.style.display = (matchesSearch && matchesDesig && matchesStatus) ? 'flex' : 'none';
    });
  },

  openAddFacultyModal() {
    this.openModal(`
      <div style="padding:24px; max-width:520px; width:100%;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
          <h3 style="font-size:16px; font-weight:800; margin:0;">➕ Add Faculty Member</h3>
          <button class="icon-btn" onclick="HodApp.closeModal()" style="width:28px; height:28px;">✕</button>
        </div>

        <form id="add-faculty-form" onsubmit="event.preventDefault(); HodApp.submitNewFaculty();">
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
            <div class="form-group">
              <label class="form-label">Faculty ID *</label>
              <input type="text" id="add-fac-id" class="form-control" placeholder="e.g. T_NW" required />
            </div>
            <div class="form-group">
              <label class="form-label">Initial Password *</label>
              <input type="password" id="add-fac-pass" class="form-control" value="Teacher@123" required />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Full Name *</label>
            <input type="text" id="add-fac-name" class="form-control" placeholder="e.g. Prof. N. Wagh" required />
          </div>

          <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
            <div class="form-group">
              <label class="form-label">Designation</label>
              <select id="add-fac-desig" class="form-control">
                <option value="Assistant Professor">Assistant Professor</option>
                <option value="Associate Professor">Associate Professor</option>
                <option value="Professor">Professor</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Office Room</label>
              <input type="text" id="add-fac-room" class="form-control" placeholder="e.g. NB-203" />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Assigned Subjects (Comma-separated)</label>
            <input type="text" id="add-fac-subjects" class="form-control" placeholder="e.g. DBMS, NCS" />
          </div>

          <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
            <div class="form-group">
              <label class="form-label">Email</label>
              <input type="email" id="add-fac-email" class="form-control" placeholder="faculty@mishragroup.ac.in" />
            </div>
            <div class="form-group">
              <label class="form-label">Phone</label>
              <input type="text" id="add-fac-phone" class="form-control" placeholder="9825100000" />
            </div>
          </div>

          <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:20px;">
            <button type="button" class="btn-sec" onclick="HodApp.closeModal()">Cancel</button>
            <button type="submit" class="btn-primary" style="padding:8px 18px;">Create Faculty Account</button>
          </div>
        </form>
      </div>
    `);
  },

  async submitNewFaculty() {
    const teacher_id = document.getElementById('add-fac-id')?.value.trim();
    const password = document.getElementById('add-fac-pass')?.value.trim();
    const name = document.getElementById('add-fac-name')?.value.trim();
    const designation = document.getElementById('add-fac-desig')?.value;
    const office_room = document.getElementById('add-fac-room')?.value.trim();
    const subjects = document.getElementById('add-fac-subjects')?.value.trim();
    const email = document.getElementById('add-fac-email')?.value.trim();
    const phone = document.getElementById('add-fac-phone')?.value.trim();

    if (!teacher_id || !password || !name) {
      this.showToast('Please fill all mandatory fields.', 'error');
      return;
    }

    try {
      const res = await API.createHodFaculty({
        teacher_id, password, name, designation, office_room, subjects, email, phone
      });
      if (res && res.success) {
        this.showToast(res.message || 'Faculty added successfully!', 'success');
        this.closeModal();
        await this.renderFaculty();
      } else {
        this.showToast(res?.message || 'Failed to add faculty.', 'error');
      }
    } catch (e) {
      this.showToast('Error communicating with backend.', 'error');
    }
  },

  async viewFacultySchedule(teacherId, name) {
    try {
      const res = await API.getHodFacultyById(teacherId);
      const schedule = (res && res.schedule) || [];

      this.openModal(`
        <div style="padding:22px; max-width:640px; width:100%;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
            <div>
              <h3 style="font-size:16px; font-weight:800; margin:0;">📅 ${name} — Teaching Schedule</h3>
              <span style="font-size:11.5px; color:var(--text-muted);">Weekly lecture allocations</span>
            </div>
            <button class="icon-btn" onclick="HodApp.closeModal()" style="width:28px; height:28px;">✕</button>
          </div>

          ${schedule.length === 0 ? `
            <div style="padding:20px; text-align:center; color:var(--text-muted); font-size:13px;">
              No active timetable slots allocated to this faculty member.
            </div>
          ` : `
            <div style="max-height:360px; overflow-y:auto; display:flex; flex-direction:column; gap:8px;">
              ${schedule.map(s => `
                <div style="padding:10px 14px; background:rgba(255,255,255,0.03); border:1px solid var(--border-color); border-radius:8px; display:flex; justify-content:space-between; align-items:center;">
                  <div>
                    <div style="font-size:13px; font-weight:700; color:var(--text-primary);">${s.subject} ${s.is_lab ? '<span class="badge" style="background:#a855f7; color:#fff; font-size:9px;">LAB</span>' : ''}</div>
                    <div style="font-size:11.5px; color:var(--text-muted);">${s.day} • Room ${s.room} • ${s.batch}</div>
                  </div>
                  <span class="badge" style="background:rgba(56,189,248,0.15); color:#38bdf8; font-size:11px;">${s.start_time} - ${s.end_time}</span>
                </div>
              `).join('')}
            </div>
          `}
        </div>
      `);
    } catch (e) {
      this.showToast('Failed to load faculty schedule.', 'error');
    }
  },

  async openEditFacultyModal(id) {
    try {
      const res = await API.getHodFacultyById(id);
      const f = (res && res.teacher) || {};

      this.openModal(`
        <div style="padding:24px; max-width:520px; width:100%;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
            <h3 style="font-size:16px; font-weight:800; margin:0;">✏️ Edit Faculty: ${f.name}</h3>
            <button class="icon-btn" onclick="HodApp.closeModal()" style="width:28px; height:28px;">✕</button>
          </div>

          <form onsubmit="event.preventDefault(); HodApp.submitEditFaculty(${f.id});">
            <div class="form-group">
              <label class="form-label">Full Name *</label>
              <input type="text" id="edit-fac-name" class="form-control" value="${f.name || ''}" required />
            </div>

            <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
              <div class="form-group">
                <label class="form-label">Designation</label>
                <input type="text" id="edit-fac-desig" class="form-control" value="${f.designation || ''}" />
              </div>
              <div class="form-group">
                <label class="form-label">Status</label>
                <select id="edit-fac-status" class="form-control">
                  <option value="ACTIVE" ${f.status === 'ACTIVE' ? 'selected' : ''}>Active</option>
                  <option value="INACTIVE" ${f.status === 'INACTIVE' ? 'selected' : ''}>Inactive</option>
                </select>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Assigned Subjects</label>
              <input type="text" id="edit-fac-subjects" class="form-control" value="${f.subjects || ''}" />
            </div>

            <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
              <div class="form-group">
                <label class="form-label">Weekly Hours Limit</label>
                <input type="number" id="edit-fac-limit" class="form-control" value="${f.workload_limit_hours || 20}" />
              </div>
              <div class="form-group">
                <label class="form-label">Office Room</label>
                <input type="text" id="edit-fac-room" class="form-control" value="${f.office_room || ''}" />
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Reset Password (Leave blank to keep unchanged)</label>
              <input type="password" id="edit-fac-pass" class="form-control" placeholder="New password" />
            </div>

            <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:20px;">
              <button type="button" class="btn-sec" onclick="HodApp.closeModal()">Cancel</button>
              <button type="submit" class="btn-primary" style="padding:8px 18px;">Save Changes</button>
            </div>
          </form>
        </div>
      `);
    } catch (e) {
      this.showToast('Failed to load faculty record.', 'error');
    }
  },

  async submitEditFaculty(id) {
    const name = document.getElementById('edit-fac-name')?.value.trim();
    const designation = document.getElementById('edit-fac-desig')?.value.trim();
    const status = document.getElementById('edit-fac-status')?.value;
    const subjects = document.getElementById('edit-fac-subjects')?.value.trim();
    const workload_limit_hours = document.getElementById('edit-fac-limit')?.value;
    const office_room = document.getElementById('edit-fac-room')?.value.trim();
    const password = document.getElementById('edit-fac-pass')?.value.trim();

    try {
      const res = await API.updateHodFaculty(id, {
        name, designation, status, subjects, workload_limit_hours, office_room, password
      });
      if (res && res.success) {
        this.showToast('Faculty updated successfully!', 'success');
        this.closeModal();
        await this.renderFaculty();
      } else {
        this.showToast(res?.message || 'Update failed.', 'error');
      }
    } catch (e) {
      this.showToast('Failed to save changes.', 'error');
    }
  },

  // ========================================================================
  // MODULE 4: STUDENT MANAGEMENT
  // ========================================================================
  async renderStudents(page = 1) {
    const searchVal = document.getElementById('student-search-input')?.value || '';
    const batchVal = document.getElementById('student-batch-filter')?.value || 'All';

    const res = await API.getHodStudents({
      page,
      limit: 25,
      search: searchVal,
      batch: batchVal
    });

    const students = (res && res.students) || [];
    const p = (res && res.pagination) || { page: 1, totalPages: 1, total: students.length };

    const content = document.getElementById('hod-content-area');
    content.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:20px;">
        
        <!-- Top bar with export -->
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
          <div>
            <h2 style="font-size:18px; font-weight:900; margin:0; color:var(--text-primary);">Department Students Roster</h2>
            <p style="font-size:12px; color:var(--text-muted); margin:2px 0 0;">Division 3CYBER7 • Total Enrolled: ${p.total}</p>
          </div>
          <div style="display:flex; gap:10px;">
            <a href="/api/hod/students/export?token=${API.getToken()}" download="students_roster.csv" class="btn-sec" style="padding:8px 14px; font-size:12px; text-decoration:none; display:inline-flex; align-items:center; gap:6px;">
              <span>📥</span> <span>Export CSV</span>
            </a>
          </div>
        </div>

        <!-- Filter bar -->
        <div class="card" style="padding:14px; display:flex; gap:12px; flex-wrap:wrap; align-items:center;">
          <div style="flex:1; min-width:240px;">
            <input type="text" id="student-search-input" class="form-control" placeholder="Search by student name, roll number, or UG ID..." value="${searchVal}" onkeydown="if(event.key==='Enter') HodApp.renderStudents(1)" style="height:38px; font-size:12.5px;" />
          </div>
          <div style="min-width:140px;">
            <select id="student-batch-filter" class="form-control" onchange="HodApp.renderStudents(1)" style="height:38px; font-size:12.5px;">
              <option value="All" ${batchVal === 'All' ? 'selected' : ''}>All Batches</option>
              <option value="Batch 1" ${batchVal === 'Batch 1' ? 'selected' : ''}>Batch 1 (1-30)</option>
              <option value="Batch 2" ${batchVal === 'Batch 2' ? 'selected' : ''}>Batch 2 (31+)</option>
            </select>
          </div>
          <button class="btn-primary" onclick="HodApp.renderStudents(1)" style="padding:8px 16px; font-size:12px;">Search</button>
        </div>

        <!-- Students Data Table -->
        <div class="card" style="padding:0; overflow:hidden;">
          <div style="overflow-x:auto;">
            <table class="table" style="width:100%; border-collapse:collapse; font-size:12.5px;">
              <thead>
                <tr style="border-bottom:1px solid var(--border-color); background:rgba(255,255,255,0.02); text-align:left; color:var(--text-muted);">
                  <th style="padding:12px 14px; width:70px;">Roll</th>
                  <th style="padding:12px 14px;">UG ID</th>
                  <th style="padding:12px 14px;">Student Name</th>
                  <th style="padding:12px 14px;">Batch</th>
                  <th style="padding:12px 14px;">Phone</th>
                  <th style="padding:12px 14px; text-align:center;">Attendance</th>
                  <th style="padding:12px 14px; text-align:center;">Action</th>
                </tr>
              </thead>
              <tbody>
                ${students.map(s => {
                  const att = s.attendance_percentage || 88;
                  const attColor = att >= 75 ? '#10b981' : '#ef4444';
                  return `
                    <tr style="border-bottom:1px solid var(--border-color);">
                      <td style="padding:11px 14px; font-weight:800; color:var(--text-primary);">${s.roll_number}</td>
                      <td style="padding:11px 14px; font-family:monospace; color:#38bdf8;">${s.ug_id}</td>
                      <td style="padding:11px 14px; font-weight:700; color:var(--text-primary);">
                        ${s.name} ${s.is_cr ? '<span class="badge" style="background:#f59e0b; color:#fff; font-size:9.5px; margin-left:4px;">CR</span>' : ''}
                      </td>
                      <td style="padding:11px 14px; color:var(--text-secondary);">${s.batch}</td>
                      <td style="padding:11px 14px; color:var(--text-muted);">${s.phone_number || '-'}</td>
                      <td style="padding:11px 14px; text-align:center;">
                        <span class="badge" style="background:${attColor}; color:#fff; font-size:10px; padding:2px 7px;">${att}%</span>
                      </td>
                      <td style="padding:11px 14px; text-align:center;">
                        <button class="btn-sec" onclick="HodApp.viewStudentProfile('${s.ug_id}')" style="padding:4px 10px; font-size:11px;">Profile</button>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>

          <!-- Pagination Row -->
          <div style="padding:14px; border-top:1px solid var(--border-color); display:flex; justify-content:space-between; align-items:center; font-size:12px; color:var(--text-muted);">
            <div>Showing page ${p.page} of ${p.totalPages || 1} (${p.total} total)</div>
            <div style="display:flex; gap:6px;">
              <button class="btn-sec" onclick="HodApp.renderStudents(${Math.max(1, p.page - 1)})" ${p.page <= 1 ? 'disabled' : ''} style="padding:4px 10px; font-size:11px;">Prev</button>
              <button class="btn-sec" onclick="HodApp.renderStudents(${p.page + 1})" ${p.page >= p.totalPages ? 'disabled' : ''} style="padding:4px 10px; font-size:11px;">Next</button>
            </div>
          </div>
        </div>

      </div>
    `;
  },

  async viewStudentProfile(ugId) {
    try {
      const res = await API.getHodStudentById(ugId);
      const s = (res && res.student) || {};
      const results = (res && res.results) || [];
      const mentoring = (res && res.mentoring) || [];

      this.openModal(`
        <div style="padding:24px; max-width:680px; width:100%; max-height:85vh; overflow-y:auto;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:16px; border-bottom:1px solid var(--border-color); padding-bottom:12px;">
            <div>
              <span class="badge" style="background:#2563eb; color:#fff; font-size:10.5px;">ROLL: ${s.roll_number} • ${s.batch}</span>
              <h3 style="font-size:17px; font-weight:800; color:var(--text-primary); margin:6px 0 2px;">${s.name}</h3>
              <div style="font-size:12px; color:var(--text-muted);">UG ID: ${s.ug_id} • ${s.program || 'B.Tech Cyber Security'}</div>
            </div>
            <button class="icon-btn" onclick="HodApp.closeModal()" style="width:28px; height:28px;">✕</button>
          </div>

          <!-- Internal Assessment Results -->
          <div style="margin-bottom:18px;">
            <h4 style="font-size:13px; font-weight:800; color:#38bdf8; margin-bottom:8px; text-transform:uppercase;">Academic & Internal Marks</h4>
            ${results.length === 0 ? `
              <div style="padding:10px; color:var(--text-muted); font-size:12px; background:rgba(255,255,255,0.02); border-radius:6px;">No examination marks recorded yet.</div>
            ` : `
              <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:8px;">
                ${results.map(r => `
                  <div style="padding:10px; background:rgba(255,255,255,0.03); border:1px solid var(--border-color); border-radius:8px;">
                    <div style="font-size:12px; font-weight:700;">${r.subject}</div>
                    <div style="font-size:16px; font-weight:900; color:#10b981; margin:3px 0;">${r.marks} / ${r.max_marks || 100}</div>
                    <div style="font-size:10.5px; color:var(--text-muted);">${r.exam_name} • Grade ${r.grade}</div>
                  </div>
                `).join('')}
              </div>
            `}
          </div>

          <!-- Mentoring Notes -->
          <div>
            <h4 style="font-size:13px; font-weight:800; color:#a855f7; margin-bottom:8px; text-transform:uppercase;">Mentoring Records</h4>
            ${mentoring.length === 0 ? `
              <div style="padding:10px; color:var(--text-muted); font-size:12px; background:rgba(255,255,255,0.02); border-radius:6px;">No mentoring interventions logged for this student.</div>
            ` : `
              <div style="display:flex; flex-direction:column; gap:8px;">
                ${mentoring.map(m => `
                  <div style="padding:10px 14px; background:rgba(255,255,255,0.03); border:1px solid var(--border-color); border-radius:8px;">
                    <div style="display:flex; justify-content:space-between; font-size:12px; font-weight:700; color:var(--text-primary);">
                      <span>Mentor: ${m.mentor_name}</span>
                      <span style="color:var(--text-muted);">${m.session_date}</span>
                    </div>
                    <div style="font-size:12px; color:var(--text-secondary); margin-top:4px;">${m.notes}</div>
                    ${m.confidential_notes ? `<div style="font-size:11px; color:#f59e0b; margin-top:4px; font-style:italic;">🔒 Confidential: ${m.confidential_notes}</div>` : ''}
                  </div>
                `).join('')}
              </div>
            `}
          </div>

          <div style="display:flex; justify-content:flex-end; margin-top:16px;">
            <button class="btn-sec" onclick="HodApp.closeModal()">Close</button>
          </div>
        </div>
      `);
    } catch (e) {
      this.showToast('Failed to load student details.', 'error');
    }
  },

  // ========================================================================
  // MODULE 5: SUBJECT MANAGEMENT
  // ========================================================================
  async renderSubjects() {
    const res = await API.getHodSubjects();
    const subjects = (res && res.subjects) || [];

    const content = document.getElementById('hod-content-area');
    content.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:20px;">
        
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
          <div>
            <h2 style="font-size:18px; font-weight:900; margin:0; color:var(--text-primary);">Department Curriculum & Subjects</h2>
            <p style="font-size:12px; color:var(--text-muted); margin:2px 0 0;">Semester 3rd Course Matrix • Credit allocations & syllabus completion status</p>
          </div>
          <button class="btn-primary" onclick="HodApp.openAddSubjectModal()" style="padding:8px 16px; font-size:12px; display:inline-flex; align-items:center; gap:6px;">
            <span>➕</span> <span>Add Subject</span>
          </button>
        </div>

        <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(310px, 1fr)); gap:16px;">
          ${subjects.map(s => {
            const prog = s.syllabus_progress || 65;
            return `
              <div class="card" style="padding:18px; display:flex; flex-direction:column; justify-content:space-between; gap:14px;">
                <div>
                  <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                    <div>
                      <span class="badge" style="background:#2563eb; color:#fff; font-size:10px; padding:2px 6px;">${s.code}</span>
                      <h3 style="font-size:15px; font-weight:800; color:var(--text-primary); margin:6px 0 2px;">${s.name}</h3>
                      <div style="font-size:12px; color:#38bdf8; font-weight:600;">Short Code: ${s.short_name} • ${s.credits} Credits</div>
                    </div>
                  </div>

                  <div style="font-size:12px; color:var(--text-secondary); margin-top:10px; display:flex; flex-direction:column; gap:4px;">
                    <div><strong>Assigned Faculty:</strong> <span style="color:var(--text-primary);">${s.assigned_faculty_name || s.faculty_default || 'Unassigned'}</span></div>
                    <div><strong>Weekly Slots:</strong> ${s.weekly_slots || 0} slots allocated</div>
                  </div>

                  <!-- Syllabus Completion Bar -->
                  <div style="margin-top:12px;">
                    <div style="display:flex; justify-content:space-between; font-size:11.5px; margin-bottom:4px;">
                      <span style="color:var(--text-muted);">Syllabus Covered:</span>
                      <span style="font-weight:800; color:#10b981;">${prog}%</span>
                    </div>
                    <div style="height:6px; background:rgba(255,255,255,0.08); border-radius:3px; overflow:hidden;">
                      <div style="height:100%; width:${prog}%; background:linear-gradient(90deg, #2563eb, #10b981); border-radius:3px;"></div>
                    </div>
                  </div>
                </div>

                <div style="border-top:1px solid var(--border-color); padding-top:10px; display:flex; justify-content:flex-end; gap:8px;">
                  <button class="btn-sec" onclick="HodApp.openEditSubjectModal(${s.id}, '${s.name}', '${s.short_name}', ${s.credits}, '${s.assigned_faculty_name || ''}', ${prog})" style="padding:5px 12px; font-size:11.5px;">
                    ✏️ Update / Assign
                  </button>
                </div>
              </div>
            `;
          }).join('')}
        </div>

      </div>
    `;
  },

  openAddSubjectModal() {
    this.openModal(`
      <div style="padding:22px; max-width:480px; width:100%;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
          <h3 style="font-size:16px; font-weight:800; margin:0;">➕ Add Subject to Curriculum</h3>
          <button class="icon-btn" onclick="HodApp.closeModal()" style="width:28px; height:28px;">✕</button>
        </div>

        <form onsubmit="event.preventDefault(); HodApp.submitNewSubject();">
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
            <div class="form-group">
              <label class="form-label">Subject Code *</label>
              <input type="text" id="add-sub-code" class="form-control" placeholder="e.g. CS309" required />
            </div>
            <div class="form-group">
              <label class="form-label">Short Code *</label>
              <input type="text" id="add-sub-short" class="form-control" placeholder="e.g. AI" required />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Full Subject Name *</label>
            <input type="text" id="add-sub-name" class="form-control" placeholder="e.g. Artificial Intelligence" required />
          </div>

          <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
            <div class="form-group">
              <label class="form-label">Credits</label>
              <input type="number" id="add-sub-credits" class="form-control" value="4" min="1" max="6" />
            </div>
            <div class="form-group">
              <label class="form-label">Assigned Faculty Name</label>
              <input type="text" id="add-sub-fac" class="form-control" placeholder="e.g. Prof. N. Wagh" />
            </div>
          </div>

          <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:18px;">
            <button type="button" class="btn-sec" onclick="HodApp.closeModal()">Cancel</button>
            <button type="submit" class="btn-primary" style="padding:8px 18px;">Create Subject</button>
          </div>
        </form>
      </div>
    `);
  },

  async submitNewSubject() {
    const code = document.getElementById('add-sub-code')?.value.trim();
    const short_name = document.getElementById('add-sub-short')?.value.trim();
    const name = document.getElementById('add-sub-name')?.value.trim();
    const credits = document.getElementById('add-sub-credits')?.value;
    const assigned_faculty_name = document.getElementById('add-sub-fac')?.value.trim();

    try {
      const res = await API.createHodSubject({ code, short_name, name, credits, assigned_faculty_name });
      if (res && res.success) {
        this.showToast('Subject created successfully!', 'success');
        this.closeModal();
        await this.renderSubjects();
      } else {
        this.showToast(res?.message || 'Failed to create subject.', 'error');
      }
    } catch (e) {
      this.showToast('Failed to create subject.', 'error');
    }
  },

  openEditSubjectModal(id, name, short_name, credits, faculty, progress) {
    this.openModal(`
      <div style="padding:22px; max-width:480px; width:100%;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
          <h3 style="font-size:16px; font-weight:800; margin:0;">✏️ Update ${name}</h3>
          <button class="icon-btn" onclick="HodApp.closeModal()" style="width:28px; height:28px;">✕</button>
        </div>

        <form onsubmit="event.preventDefault(); HodApp.submitEditSubject(${id});">
          <div class="form-group">
            <label class="form-label">Full Name</label>
            <input type="text" id="edit-sub-name" class="form-control" value="${name}" required />
          </div>

          <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
            <div class="form-group">
              <label class="form-label">Credits</label>
              <input type="number" id="edit-sub-credits" class="form-control" value="${credits}" />
            </div>
            <div class="form-group">
              <label class="form-label">Assigned Faculty</label>
              <input type="text" id="edit-sub-fac" class="form-control" value="${faculty}" />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Syllabus Progress (%)</label>
            <input type="number" id="edit-sub-prog" class="form-control" value="${progress}" min="0" max="100" />
          </div>

          <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:18px;">
            <button type="button" class="btn-sec" onclick="HodApp.closeModal()">Cancel</button>
            <button type="submit" class="btn-primary" style="padding:8px 18px;">Save Subject</button>
          </div>
        </form>
      </div>
    `);
  },

  async submitEditSubject(id) {
    const name = document.getElementById('edit-sub-name')?.value.trim();
    const credits = document.getElementById('edit-sub-credits')?.value;
    const assigned_faculty_name = document.getElementById('edit-sub-fac')?.value.trim();
    const syllabus_progress = document.getElementById('edit-sub-prog')?.value;

    try {
      const res = await API.updateHodSubject(id, { name, credits, assigned_faculty_name, syllabus_progress });
      if (res && res.success) {
        this.showToast('Subject updated successfully!', 'success');
        this.closeModal();
        await this.renderSubjects();
      } else {
        this.showToast(res?.message || 'Update failed.', 'error');
      }
    } catch (e) {
      this.showToast('Failed to update subject.', 'error');
    }
  },

  // ========================================================================
  // MODULE 6: TIMETABLE MANAGEMENT
  // ========================================================================
  async renderTimetable(selectedDay = 'Monday') {
    const res = await API.getHodTimetable({ day: selectedDay });
    const slots = (res && res.timetable) || [];
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    const content = document.getElementById('hod-content-area');
    content.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:20px;">
        
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
          <div>
            <h2 style="font-size:18px; font-weight:900; margin:0; color:var(--text-primary);">Department Timetable Schedule</h2>
            <p style="font-size:12px; color:var(--text-muted); margin:2px 0 0;">Division 3CYBER7 (2026-27) • Classroom & Lab Allocations</p>
          </div>
          <button class="btn-primary" onclick="HodApp.openAddTimetableModal('${selectedDay}')" style="padding:8px 16px; font-size:12px; display:inline-flex; align-items:center; gap:6px;">
            <span>➕</span> <span>Add Class Slot</span>
          </button>
        </div>

        <!-- Day Selector Tabs -->
        <div style="display:flex; gap:8px; overflow-x:auto; padding-bottom:4px;">
          ${days.map(d => `
            <button class="btn-sec ${d === selectedDay ? 'btn-primary' : ''}" onclick="HodApp.renderTimetable('${d}')" style="padding:7px 16px; font-size:12.5px; font-weight:700; white-space:nowrap;">
              ${d}
            </button>
          `).join('')}
        </div>

        <!-- Slots Table -->
        <div class="card" style="padding:0; overflow:hidden;">
          <div style="overflow-x:auto;">
            <table class="table" style="width:100%; border-collapse:collapse; font-size:12.5px;">
              <thead>
                <tr style="border-bottom:1px solid var(--border-color); background:rgba(255,255,255,0.02); text-align:left; color:var(--text-muted);">
                  <th style="padding:12px 14px;">Time Window</th>
                  <th style="padding:12px 14px;">Subject</th>
                  <th style="padding:12px 14px;">Type</th>
                  <th style="padding:12px 14px;">Faculty</th>
                  <th style="padding:12px 14px;">Room</th>
                  <th style="padding:12px 14px;">Batch</th>
                  <th style="padding:12px 14px; text-align:center;">Actions</th>
                </tr>
              </thead>
              <tbody>
                ${slots.length === 0 ? `
                  <tr><td colspan="7" style="padding:24px; text-align:center; color:var(--text-muted);">No classes scheduled on ${selectedDay}.</td></tr>
                ` : slots.map(s => `
                  <tr style="border-bottom:1px solid var(--border-color);">
                    <td style="padding:11px 14px; font-weight:700; color:#38bdf8;">${s.start_time} - ${s.end_time}</td>
                    <td style="padding:11px 14px; font-weight:800; color:var(--text-primary);">${s.subject}</td>
                    <td style="padding:11px 14px;">
                      ${s.is_lab ? '<span class="badge" style="background:#a855f7; color:#fff; font-size:9.5px;">LAB</span>' : '<span class="badge" style="background:#2563eb; color:#fff; font-size:9.5px;">THEORY</span>'}
                    </td>
                    <td style="padding:11px 14px; color:var(--text-secondary);">${s.teacher_name || s.teacher}</td>
                    <td style="padding:11px 14px; font-weight:700;">${s.room}</td>
                    <td style="padding:11px 14px; color:var(--text-muted);">${s.batch}</td>
                    <td style="padding:11px 14px; text-align:center;">
                      <button class="icon-btn" onclick="HodApp.deleteTimetableSlot(${s.id}, '${selectedDay}')" style="width:28px; height:28px; color:#ef4444;" title="Delete Slot">🗑️</button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    `;
  },

  openAddTimetableModal(day) {
    this.openModal(`
      <div style="padding:22px; max-width:520px; width:100%;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
          <h3 style="font-size:16px; font-weight:800; margin:0;">➕ Add Timetable Slot (${day})</h3>
          <button class="icon-btn" onclick="HodApp.closeModal()" style="width:28px; height:28px;">✕</button>
        </div>

        <form onsubmit="event.preventDefault(); HodApp.submitNewTimetableSlot('${day}');">
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
            <div class="form-group">
              <label class="form-label">Start Time *</label>
              <input type="time" id="add-tt-start" class="form-control" value="09:30" required />
            </div>
            <div class="form-group">
              <label class="form-label">End Time *</label>
              <input type="time" id="add-tt-end" class="form-control" value="10:25" required />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Subject *</label>
            <input type="text" id="add-tt-sub" class="form-control" placeholder="e.g. DBMS or NCS Lab" required />
          </div>

          <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
            <div class="form-group">
              <label class="form-label">Faculty Name / Code</label>
              <input type="text" id="add-tt-teacher" class="form-control" placeholder="e.g. NW" />
            </div>
            <div class="form-group">
              <label class="form-label">Room / Lab No *</label>
              <input type="text" id="add-tt-room" class="form-control" placeholder="e.g. NB-202" required />
            </div>
          </div>

          <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
            <div class="form-group">
              <label class="form-label">Batch</label>
              <select id="add-tt-batch" class="form-control">
                <option value="Both">Both (Entire Class)</option>
                <option value="Batch 1">Batch 1</option>
                <option value="Batch 2">Batch 2</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Type</label>
              <select id="add-tt-islab" class="form-control">
                <option value="0">Theory Lecture</option>
                <option value="1">Laboratory Session</option>
              </select>
            </div>
          </div>

          <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:18px;">
            <button type="button" class="btn-sec" onclick="HodApp.closeModal()">Cancel</button>
            <button type="submit" class="btn-primary" style="padding:8px 18px;">Save Slot</button>
          </div>
        </form>
      </div>
    `);
  },

  async submitNewTimetableSlot(day) {
    const start_time = document.getElementById('add-tt-start')?.value;
    const end_time = document.getElementById('add-tt-end')?.value;
    const subject = document.getElementById('add-tt-sub')?.value.trim();
    const teacher = document.getElementById('add-tt-teacher')?.value.trim();
    const room = document.getElementById('add-tt-room')?.value.trim();
    const batch = document.getElementById('add-tt-batch')?.value;
    const is_lab = parseInt(document.getElementById('add-tt-islab')?.value, 10);

    try {
      const res = await API.createHodTimetableEntry({
        day, start_time, end_time, subject, teacher, room, batch, is_lab
      });
      if (res && res.success) {
        this.showToast('Slot scheduled successfully!', 'success');
        this.closeModal();
        await this.renderTimetable(day);
      } else {
        this.showToast(res?.message || 'Conflict detected.', 'error');
      }
    } catch (e) {
      this.showToast('Failed to create timetable slot.', 'error');
    }
  },

  async deleteTimetableSlot(id, day) {
    if (confirm('Delete this timetable slot?')) {
      try {
        const res = await API.deleteHodTimetableEntry(id);
        if (res && res.success) {
          this.showToast('Slot removed.', 'success');
          await this.renderTimetable(day);
        }
      } catch (e) {
        this.showToast('Failed to delete slot.', 'error');
      }
    }
  },

  // ========================================================================
  // MODULE 7: ATTENDANCE MANAGEMENT
  // ========================================================================
  async renderAttendance() {
    const today = getIndianDateString();
    const dateInput = document.getElementById('att-date-picker')?.value || today;

    const res = await API.getHodAttendance({ date: dateInput });
    const manual = (res && res.manualRecords) || [];
    const qr = (res && res.qrRecords) || [];
    const lowAtt = (res && res.lowAttendanceStudents) || [];
    const auditLogs = (res && res.auditLogs) || [];

    const content = document.getElementById('hod-content-area');
    content.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:20px;">
        
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
          <div>
            <h2 style="font-size:18px; font-weight:900; margin:0; color:var(--text-primary);">Department Attendance Management</h2>
            <p style="font-size:12px; color:var(--text-muted); margin:2px 0 0;">Dual QR & Manual Audit • Defaulter tracking (< 75% threshold)</p>
          </div>
          <div style="display:flex; align-items:center; gap:8px;">
            <input type="date" id="att-date-picker" class="form-control" value="${dateInput}" max="${today}" onchange="HodApp.renderAttendance()" style="height:36px; font-size:12px;" />
          </div>
        </div>

        <!-- Attendance Low Threshold Alert Banner -->
        ${lowAtt.length > 0 ? `
          <div class="card" style="padding:16px; background:rgba(239,68,68,0.08); border:1px solid rgba(239,68,68,0.3);">
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
              <span style="font-size:18px;">⚠️</span>
              <h3 style="font-size:14px; font-weight:800; color:#ef4444; margin:0;">
                Attendance Defaulter Alert (${lowAtt.length} Students below 75% Institutional Threshold)
              </h3>
            </div>
            <div style="display:flex; gap:8px; overflow-x:auto; padding-bottom:4px;">
              ${lowAtt.slice(0, 10).map(s => `
                <div style="padding:6px 12px; background:rgba(255,255,255,0.04); border-radius:6px; font-size:11.5px; white-space:nowrap;">
                  <strong>${s.name}</strong> (${s.ug_id}) • <span style="color:#ef4444; font-weight:800;">${Math.round((s.present_count / s.total_sessions) * 100)}%</span>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}

        <!-- Dual Attendance Split -->
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(320px, 1fr)); gap:18px;">
          
          <div class="card" style="padding:18px;">
            <h3 style="font-size:14px; font-weight:800; margin-bottom:12px; display:flex; align-items:center; gap:6px;">
              <span>✍️</span> Faculty Manual Attendance Records (${manual.length})
            </h3>
            ${manual.length === 0 ? `
              <div style="padding:20px; text-align:center; color:var(--text-muted); font-size:12px;">No manual attendance recorded for this date.</div>
            ` : `
              <div style="max-height:300px; overflow-y:auto; display:flex; flex-direction:column; gap:6px;">
                ${manual.map(m => `
                  <div style="padding:8px 12px; background:rgba(255,255,255,0.02); border:1px solid var(--border-color); border-radius:6px; display:flex; justify-content:space-between; align-items:center; font-size:12px;">
                    <div>
                      <strong>${m.student_name}</strong> (${m.ug_id})
                      <div style="font-size:11px; color:var(--text-muted);">${m.subject} • Marked by ${m.marked_by}</div>
                    </div>
                    <span class="badge" style="background:${m.status === 'PRESENT' ? '#10b981' : '#ef4444'}; color:#fff; font-size:10px;">${m.status}</span>
                  </div>
                `).join('')}
              </div>
            `}
          </div>

          <div class="card" style="padding:18px;">
            <h3 style="font-size:14px; font-weight:800; margin-bottom:12px; display:flex; align-items:center; gap:6px;">
              <span>📷</span> QR Verified Scans (${qr.length})
            </h3>
            ${qr.length === 0 ? `
              <div style="padding:20px; text-align:center; color:var(--text-muted); font-size:12px;">No dynamic QR scans recorded for this date.</div>
            ` : `
              <div style="max-height:300px; overflow-y:auto; display:flex; flex-direction:column; gap:6px;">
                ${qr.map(q => `
                  <div style="padding:8px 12px; background:rgba(255,255,255,0.02); border:1px solid var(--border-color); border-radius:6px; display:flex; justify-content:space-between; align-items:center; font-size:12px;">
                    <div>
                      <strong>${q.student_name}</strong> (Roll ${q.roll_number})
                      <div style="font-size:11px; color:var(--text-muted);">${q.subject} • GPS Verified</div>
                    </div>
                    <span class="badge" style="background:#10b981; color:#fff; font-size:10px;">PRESENT</span>
                  </div>
                `).join('')}
              </div>
            `}
          </div>

        </div>

      </div>
    `;
  },

  // ========================================================================
  // MODULE 8: INTERNAL MARKS
  // ========================================================================
  async renderInternalMarks() {
    const res = await API.getHodInternalMarks();
    const summary = (res && res.summary) || [];
    const marks = (res && res.marks) || [];

    const content = document.getElementById('hod-content-area');
    content.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:20px;">
        
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
          <div>
            <h2 style="font-size:18px; font-weight:900; margin:0; color:var(--text-primary);">Internal Marks & Assessment Moderation</h2>
            <p style="font-size:12px; color:var(--text-muted); margin:2px 0 0;">Review faculty-submitted marks • Approval & return workflows</p>
          </div>
        </div>

        <!-- Subject Summary Cards -->
        <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(280px, 1fr)); gap:14px;">
          ${summary.map(s => `
            <div class="card" style="padding:16px;">
              <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                <div>
                  <h3 style="font-size:14.5px; font-weight:800; margin:0; color:var(--text-primary);">${s.subject}</h3>
                  <div style="font-size:11.5px; color:var(--text-muted); margin-top:2px;">${s.exam_name} • ${s.student_count} Records</div>
                </div>
                <span class="badge" style="background:${s.approval_status === 'APPROVED' ? '#10b981' : (s.approval_status === 'REJECTED' ? '#ef4444' : '#f59e0b')}; color:#fff; font-size:10px; padding:2px 6px;">
                  ${s.approval_status}
                </span>
              </div>

              <div style="display:flex; justify-content:space-between; margin-top:14px; font-size:12px; border-top:1px solid var(--border-color); padding-top:10px;">
                <div>Avg: <strong>${s.avg_marks}</strong></div>
                <div>High: <strong style="color:#10b981;">${s.highest_marks}</strong></div>
                <div>Low: <strong style="color:#ef4444;">${s.lowest_marks}</strong></div>
              </div>

              <div style="display:flex; gap:6px; margin-top:12px;">
                <button class="btn-primary" onclick="HodApp.moderateMarks('${s.subject}', '${s.exam_name}', 'APPROVE')" style="flex:1; padding:5px; font-size:11px;">
                  ✓ Approve
                </button>
                <button class="btn-sec" onclick="HodApp.moderateMarks('${s.subject}', '${s.exam_name}', 'RETURN')" style="flex:1; padding:5px; font-size:11px;">
                  ↩ Return
                </button>
              </div>
            </div>
          `).join('')}
        </div>

      </div>
    `;
  },

  async moderateMarks(subject, exam_name, action) {
    const remarks = prompt(`Enter comments/remarks for ${action.toLowerCase()}ing marks for ${subject}:`, action === 'APPROVE' ? 'Approved by HOD' : 'Requires revision');
    if (remarks === null) return;

    try {
      const res = await API.reviewHodInternalMarks({ subject, exam_name, action, remarks });
      if (res && res.success) {
        this.showToast(res.message || 'Marks status updated!', 'success');
        await this.renderInternalMarks();
      } else {
        this.showToast(res?.message || 'Operation failed.', 'error');
      }
    } catch (e) {
      this.showToast('Failed to review internal marks.', 'error');
    }
  },

  // ========================================================================
  // MODULE 9: ASSIGNMENTS
  // ========================================================================
  async renderAssignments() {
    const res = await API.getHodAssignments();
    const assignments = (res && res.assignments) || [];

    const content = document.getElementById('hod-content-area');
    content.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:20px;">
        
        <div>
          <h2 style="font-size:18px; font-weight:900; margin:0; color:var(--text-primary);">Department Assignments & Evaluations</h2>
          <p style="font-size:12px; color:var(--text-muted); margin:2px 0 0;">Monitor faculty-assigned course work, submissions, and grading progress</p>
        </div>

        <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(320px, 1fr)); gap:16px;">
          ${assignments.length === 0 ? `
            <div class="card" style="padding:24px; text-align:center; color:var(--text-muted); grid-column:1/-1;">No assignments created yet.</div>
          ` : assignments.map(a => {
            const total = a.total_submissions || 0;
            const graded = a.evaluated_count || 0;
            const pct = total > 0 ? Math.round((graded / total) * 100) : 0;
            return `
              <div class="card" style="padding:18px;">
                <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                  <div>
                    <span class="badge" style="background:#2563eb; color:#fff; font-size:10px; padding:2px 6px;">${a.subject}</span>
                    <h3 style="font-size:15px; font-weight:800; color:var(--text-primary); margin:6px 0 2px;">${a.title}</h3>
                    <div style="font-size:11.5px; color:var(--text-muted);">Assigned by ${a.faculty_name}</div>
                  </div>
                  <span class="badge" style="background:rgba(255,255,255,0.06); color:var(--text-secondary); font-size:11px;">Due: ${a.due_date}</span>
                </div>

                <div style="margin-top:14px; font-size:12px; border-top:1px solid var(--border-color); padding-top:10px;">
                  <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                    <span style="color:var(--text-muted);">Grading Progress:</span>
                    <strong>${graded} / ${total} Evaluated (${pct}%)</strong>
                  </div>
                  <div style="height:6px; background:rgba(255,255,255,0.08); border-radius:3px; overflow:hidden;">
                    <div style="height:100%; width:${pct}%; background:#10b981; border-radius:3px;"></div>
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>

      </div>
    `;
  },

  // ========================================================================
  // MODULE 10: EXAMINATION MANAGEMENT
  // ========================================================================
  async renderExams() {
    const res = await API.getHodExams();
    const exams = (res && res.exams) || [];

    const content = document.getElementById('hod-content-area');
    content.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:20px;">
        
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
          <div>
            <h2 style="font-size:18px; font-weight:900; margin:0; color:var(--text-primary);">Examination Management & Readiness</h2>
            <p style="font-size:12px; color:var(--text-muted); margin:2px 0 0;">Exam timetables, question paper readiness & seating arrangements</p>
          </div>
          <button class="btn-primary" onclick="HodApp.openAddExamModal()" style="padding:8px 16px; font-size:12px; display:inline-flex; align-items:center; gap:6px;">
            <span>➕</span> <span>Schedule Examination</span>
          </button>
        </div>

        <div class="card" style="padding:0; overflow:hidden;">
          <div style="overflow-x:auto;">
            <table class="table" style="width:100%; border-collapse:collapse; font-size:12.5px;">
              <thead>
                <tr style="border-bottom:1px solid var(--border-color); background:rgba(255,255,255,0.02); text-align:left; color:var(--text-muted);">
                  <th style="padding:12px 14px;">Date & Time</th>
                  <th style="padding:12px 14px;">Exam Name</th>
                  <th style="padding:12px 14px;">Subject</th>
                  <th style="padding:12px 14px;">Room</th>
                  <th style="padding:12px 14px;">Candidates</th>
                  <th style="padding:12px 14px; text-align:center;">Readiness</th>
                  <th style="padding:12px 14px; text-align:center;">Actions</th>
                </tr>
              </thead>
              <tbody>
                ${exams.map(e => `
                  <tr style="border-bottom:1px solid var(--border-color);">
                    <td style="padding:11px 14px; font-weight:700; color:#38bdf8;">
                      ${e.exam_date}<br><span style="font-size:11px; color:var(--text-muted);">${e.start_time} - ${e.end_time}</span>
                    </td>
                    <td style="padding:11px 14px; font-weight:800; color:var(--text-primary);">${e.exam_name}</td>
                    <td style="padding:11px 14px;">${e.subject} <span style="color:var(--text-muted); font-size:11px;">(${e.subject_code || ''})</span></td>
                    <td style="padding:11px 14px; font-weight:700;">${e.room}</td>
                    <td style="padding:11px 14px; color:var(--text-secondary);">${e.total_students || 65}</td>
                    <td style="padding:11px 14px; text-align:center;">
                      <span class="badge" style="background:#10b981; color:#fff; font-size:10px; padding:2px 7px;">${e.readiness_status || 'READY'}</span>
                    </td>
                    <td style="padding:11px 14px; text-align:center;">
                      <button class="icon-btn" onclick="HodApp.deleteExam(${e.id})" style="color:#ef4444; width:28px; height:28px;" title="Delete">🗑️</button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    `;
  },

  openAddExamModal() {
    this.openModal(`
      <div style="padding:22px; max-width:500px; width:100%;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
          <h3 style="font-size:16px; font-weight:800; margin:0;">➕ Schedule Examination</h3>
          <button class="icon-btn" onclick="HodApp.closeModal()" style="width:28px; height:28px;">✕</button>
        </div>

        <form onsubmit="event.preventDefault(); HodApp.submitNewExam();">
          <div class="form-group">
            <label class="form-label">Examination Name *</label>
            <input type="text" id="add-ex-name" class="form-control" value="Mid-Semester Theory Examination 2026" required />
          </div>

          <div style="display:grid; grid-template-columns:2fr 1fr; gap:12px;">
            <div class="form-group">
              <label class="form-label">Subject *</label>
              <input type="text" id="add-ex-sub" class="form-control" placeholder="e.g. Database Management System" required />
            </div>
            <div class="form-group">
              <label class="form-label">Code</label>
              <input type="text" id="add-ex-code" class="form-control" placeholder="CS301" />
            </div>
          </div>

          <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px;">
            <div class="form-group">
              <label class="form-label">Date *</label>
              <input type="date" id="add-ex-date" class="form-control" required />
            </div>
            <div class="form-group">
              <label class="form-label">Start</label>
              <input type="time" id="add-ex-start" class="form-control" value="10:00" required />
            </div>
            <div class="form-group">
              <label class="form-label">End</label>
              <input type="time" id="add-ex-end" class="form-control" value="12:00" required />
            </div>
          </div>

          <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
            <div class="form-group">
              <label class="form-label">Classroom / Hall *</label>
              <input type="text" id="add-ex-room" class="form-control" placeholder="e.g. NB-202" required />
            </div>
            <div class="form-group">
              <label class="form-label">Candidate Count</label>
              <input type="number" id="add-ex-count" class="form-control" value="65" />
            </div>
          </div>

          <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:18px;">
            <button type="button" class="btn-sec" onclick="HodApp.closeModal()">Cancel</button>
            <button type="submit" class="btn-primary" style="padding:8px 18px;">Publish Exam Schedule</button>
          </div>
        </form>
      </div>
    `);
  },

  async submitNewExam() {
    const exam_name = document.getElementById('add-ex-name')?.value.trim();
    const subject = document.getElementById('add-ex-sub')?.value.trim();
    const subject_code = document.getElementById('add-ex-code')?.value.trim();
    const exam_date = document.getElementById('add-ex-date')?.value;
    const start_time = document.getElementById('add-ex-start')?.value;
    const end_time = document.getElementById('add-ex-end')?.value;
    const room = document.getElementById('add-ex-room')?.value.trim();
    const total_students = document.getElementById('add-ex-count')?.value;

    try {
      const res = await API.createHodExam({
        exam_name, subject, subject_code, exam_date, start_time, end_time, room, total_students
      });
      if (res && res.success) {
        this.showToast('Exam scheduled successfully!', 'success');
        this.closeModal();
        await this.renderExams();
      } else {
        this.showToast(res?.message || 'Failed to schedule exam.', 'error');
      }
    } catch (e) {
      this.showToast('Failed to schedule exam.', 'error');
    }
  },

  async deleteExam(id) {
    if (confirm('Are you sure you want to delete this exam schedule?')) {
      try {
        const res = await API.deleteHodExam(id);
        if (res && res.success) {
          this.showToast('Exam schedule deleted.', 'success');
          await this.renderExams();
        }
      } catch (e) {
        this.showToast('Failed to delete exam.', 'error');
      }
    }
  },

  // ========================================================================
  // MODULE 11: FACULTY WORKLOAD
  // ========================================================================
  async renderWorkload() {
    const res = await API.getHodWorkload();
    const workload = (res && res.workload) || [];

    const content = document.getElementById('hod-content-area');
    content.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:20px;">
        
        <div>
          <h2 style="font-size:18px; font-weight:900; margin:0; color:var(--text-primary);">Faculty Teaching Workload Matrix</h2>
          <p style="font-size:12px; color:var(--text-muted); margin:2px 0 0;">Institutional Norm: 16-20 Hours/Week • Real-time load balance audit</p>
        </div>

        <div class="card" style="padding:0; overflow:hidden;">
          <div style="overflow-x:auto;">
            <table class="table" style="width:100%; border-collapse:collapse; font-size:12.5px;">
              <thead>
                <tr style="border-bottom:1px solid var(--border-color); background:rgba(255,255,255,0.02); text-align:left; color:var(--text-muted);">
                  <th style="padding:12px 14px;">Faculty Member</th>
                  <th style="padding:12px 14px;">Designation</th>
                  <th style="padding:12px 14px;">Subjects</th>
                  <th style="padding:12px 14px; text-align:center;">Theory Slots</th>
                  <th style="padding:12px 14px; text-align:center;">Lab Slots</th>
                  <th style="padding:12px 14px; text-align:center;">Weekly Load</th>
                  <th style="padding:12px 14px; text-align:center;">Capacity Status</th>
                </tr>
              </thead>
              <tbody>
                ${workload.map(w => {
                  const hours = w.total_weekly_hours || 0;
                  const limit = w.workload_limit_hours || 20;
                  let badge = '<span class="badge" style="background:#10b981; color:#fff; font-size:10px; padding:2px 7px;">BALANCED</span>';
                  if (w.workload_status === 'OVERLOADED') badge = '<span class="badge" style="background:#ef4444; color:#fff; font-size:10px; padding:2px 7px;">OVERLOADED</span>';
                  else if (w.workload_status === 'UNDERUTILIZED') badge = '<span class="badge" style="background:#f59e0b; color:#fff; font-size:10px; padding:2px 7px;">UNDERUTILIZED</span>';

                  return `
                    <tr style="border-bottom:1px solid var(--border-color);">
                      <td style="padding:11px 14px; font-weight:800; color:var(--text-primary);">${w.name}</td>
                      <td style="padding:11px 14px; color:var(--text-secondary);">${w.designation}</td>
                      <td style="padding:11px 14px; color:#38bdf8;">${w.subjects || '-'}</td>
                      <td style="padding:11px 14px; text-align:center;">${w.theory_slots || 0}</td>
                      <td style="padding:11px 14px; text-align:center;">${w.lab_slots || 0}</td>
                      <td style="padding:11px 14px; text-align:center; font-weight:800;">${hours} / ${limit} hrs</td>
                      <td style="padding:11px 14px; text-align:center;">${badge}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    `;
  },

  // ========================================================================
  // MODULE 12: LEAVE APPROVAL
  // ========================================================================
  async renderLeaves() {
    const res = await API.getHodLeaves();
    const leaves = (res && res.leaves) || [];

    const content = document.getElementById('hod-content-area');
    content.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:20px;">
        
        <div>
          <h2 style="font-size:18px; font-weight:900; margin:0; color:var(--text-primary);">Department Leave Approval Hub</h2>
          <p style="font-size:12px; color:var(--text-muted); margin:2px 0 0;">Faculty & student duty/medical leave authorizations</p>
        </div>

        <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(320px, 1fr)); gap:16px;">
          ${leaves.length === 0 ? `
            <div class="card" style="padding:24px; text-align:center; color:var(--text-muted); grid-column:1/-1;">No leave applications found.</div>
          ` : leaves.map(l => {
            const isPending = l.status === 'PENDING';
            const badgeColor = l.status === 'APPROVED' ? '#10b981' : (l.status === 'REJECTED' ? '#ef4444' : '#f59e0b');
            return `
              <div class="card" style="padding:18px; display:flex; flex-direction:column; justify-content:space-between; gap:12px;">
                <div>
                  <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                    <div>
                      <span class="badge" style="background:#2563eb; color:#fff; font-size:9.5px; padding:2px 6px;">${l.applicant_type}</span>
                      <h3 style="font-size:15px; font-weight:800; color:var(--text-primary); margin:6px 0 2px;">${l.applicant_name}</h3>
                      <div style="font-size:11.5px; color:#38bdf8; font-weight:600;">Type: ${l.leave_type} (${l.total_days} Days)</div>
                    </div>
                    <span class="badge" style="background:${badgeColor}; color:#fff; font-size:10px;">${l.status}</span>
                  </div>

                  <div style="font-size:12px; color:var(--text-secondary); margin-top:8px;">
                    <div><strong>Duration:</strong> ${l.start_date} to ${l.end_date}</div>
                    <div style="margin-top:4px;"><strong>Reason:</strong> ${l.reason}</div>
                    ${l.decision_remarks ? `<div style="margin-top:4px; color:#10b981;"><strong>Remarks:</strong> ${l.decision_remarks}</div>` : ''}
                  </div>
                </div>

                ${isPending ? `
                  <div style="display:flex; gap:8px; border-top:1px solid var(--border-color); padding-top:10px;">
                    <button class="btn-primary" onclick="HodApp.processLeave(${l.id}, 'APPROVED')" style="flex:1; padding:6px; font-size:11.5px;">
                      ✓ Approve
                    </button>
                    <button class="btn-sec" onclick="HodApp.processLeave(${l.id}, 'REJECTED')" style="flex:1; padding:6px; font-size:11.5px; color:#ef4444; border-color:rgba(239,68,68,0.3);">
                      ✕ Reject
                    </button>
                  </div>
                ` : `
                  <div style="font-size:11px; color:var(--text-muted); border-top:1px solid var(--border-color); padding-top:8px;">
                    Decided by ${l.decision_by || 'HOD'} on ${l.decision_at ? new Date(l.decision_at).toLocaleDateString() : 'N/A'}
                  </div>
                `}
              </div>
            `;
          }).join('')}
        </div>

      </div>
    `;
  },

  async processLeave(id, action) {
    const remarks = prompt(`Enter remarks for ${action.toLowerCase()}ing this leave:`, action === 'APPROVED' ? 'Approved by HOD' : 'Institutional exigencies');
    if (remarks === null) return;

    try {
      const res = await API.reviewHodLeave(id, { action, remarks });
      if (res && res.success) {
        this.showToast(res.message || 'Leave updated!', 'success');
        await this.renderLeaves();
      } else {
        this.showToast(res?.message || 'Failed to update leave.', 'error');
      }
    } catch (e) {
      this.showToast('Failed to process leave decision.', 'error');
    }
  },

  // ========================================================================
  // MODULE 13: STUDENT MENTORING
  // ========================================================================
  async renderMentoring() {
    const res = await API.getHodMentoring();
    const records = (res && res.records) || [];

    const content = document.getElementById('hod-content-area');
    content.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:20px;">
        
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
          <div>
            <h2 style="font-size:18px; font-weight:900; margin:0; color:var(--text-primary);">Student Mentoring & Intervention Records</h2>
            <p style="font-size:12px; color:var(--text-muted); margin:2px 0 0;">Track faculty mentoring sessions, student progress & confidential support notes</p>
          </div>
          <button class="btn-primary" onclick="HodApp.openAddMentoringModal()" style="padding:8px 16px; font-size:12px; display:inline-flex; align-items:center; gap:6px;">
            <span>➕</span> <span>Log Mentoring Session</span>
          </button>
        </div>

        <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(320px, 1fr)); gap:16px;">
          ${records.length === 0 ? `
            <div class="card" style="padding:24px; text-align:center; color:var(--text-muted); grid-column:1/-1;">No mentoring records found.</div>
          ` : records.map(m => `
            <div class="card" style="padding:18px; display:flex; flex-direction:column; justify-content:space-between; gap:12px;">
              <div>
                <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                  <div>
                    <h3 style="font-size:15px; font-weight:800; color:var(--text-primary); margin:0;">${m.student_name}</h3>
                    <div style="font-size:11.5px; color:#38bdf8; font-weight:600;">${m.student_ug_id} • ${m.batch}</div>
                  </div>
                  <span class="badge" style="background:#2563eb; color:#fff; font-size:10px;">${m.session_date}</span>
                </div>

                <div style="font-size:12px; color:var(--text-secondary); margin-top:10px; display:flex; flex-direction:column; gap:4px;">
                  <div><strong>Mentor:</strong> ${m.mentor_name}</div>
                  <div><strong>Concerns:</strong> ${m.academic_concerns || 'None'}</div>
                  <div><strong>Notes:</strong> ${m.notes}</div>
                  ${m.action_plan ? `<div><strong>Action Plan:</strong> ${m.action_plan}</div>` : ''}
                  ${m.confidential_notes ? `<div style="color:#f59e0b; margin-top:4px;">🔒 <em>HOD Private Note: ${m.confidential_notes}</em></div>` : ''}
                </div>
              </div>

              <div style="border-top:1px solid var(--border-color); padding-top:8px; font-size:11px; color:var(--text-muted);">
                Status: <span style="color:#10b981; font-weight:700;">${m.status || 'OPEN'}</span>
              </div>
            </div>
          `).join('')}
        </div>

      </div>
    `;
  },

  openAddMentoringModal() {
    this.openModal(`
      <div style="padding:22px; max-width:500px; width:100%;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
          <h3 style="font-size:16px; font-weight:800; margin:0;">➕ Log Student Mentoring Session</h3>
          <button class="icon-btn" onclick="HodApp.closeModal()" style="width:28px; height:28px;">✕</button>
        </div>

        <form onsubmit="event.preventDefault(); HodApp.submitNewMentoring();">
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
            <div class="form-group">
              <label class="form-label">Student UG ID *</label>
              <input type="text" id="add-men-ug" class="form-control" placeholder="e.g. 26UG033181" required />
            </div>
            <div class="form-group">
              <label class="form-label">Student Name *</label>
              <input type="text" id="add-men-name" class="form-control" placeholder="e.g. ARVIND KUMAR" required />
            </div>
          </div>

          <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
            <div class="form-group">
              <label class="form-label">Mentor Name</label>
              <input type="text" id="add-men-mentor" class="form-control" value="${this.currentUser?.name || 'Prof. N. Wagh'}" />
            </div>
            <div class="form-group">
              <label class="form-label">Session Date *</label>
              <input type="date" id="add-men-date" class="form-control" value="${getIndianDateString()}" required />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Academic Concerns / Topics</label>
            <input type="text" id="add-men-concerns" class="form-control" placeholder="e.g. DSA concepts and lab attendance" />
          </div>

          <div class="form-group">
            <label class="form-label">Session Discussion & Notes *</label>
            <textarea id="add-men-notes" class="form-control" rows="2" placeholder="Discussion summary..." required></textarea>
          </div>

          <div class="form-group">
            <label class="form-label">🔒 Confidential HOD Notes (Private)</label>
            <textarea id="add-men-conf" class="form-control" rows="2" placeholder="Only visible to HOD and Mentor..."></textarea>
          </div>

          <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:16px;">
            <button type="button" class="btn-sec" onclick="HodApp.closeModal()">Cancel</button>
            <button type="submit" class="btn-primary" style="padding:8px 18px;">Log Record</button>
          </div>
        </form>
      </div>
    `);
  },

  async submitNewMentoring() {
    const student_ug_id = document.getElementById('add-men-ug')?.value.trim();
    const student_name = document.getElementById('add-men-name')?.value.trim();
    const mentor_name = document.getElementById('add-men-mentor')?.value.trim();
    const session_date = document.getElementById('add-men-date')?.value;
    const academic_concerns = document.getElementById('add-men-concerns')?.value.trim();
    const notes = document.getElementById('add-men-notes')?.value.trim();
    const confidential_notes = document.getElementById('add-men-conf')?.value.trim();

    try {
      const res = await API.createHodMentoringRecord({
        student_ug_id, student_name, mentor_name, session_date, academic_concerns, notes, confidential_notes
      });
      if (res && res.success) {
        this.showToast('Mentoring record logged!', 'success');
        this.closeModal();
        await this.renderMentoring();
      } else {
        this.showToast(res?.message || 'Failed to log record.', 'error');
      }
    } catch (e) {
      this.showToast('Failed to log mentoring record.', 'error');
    }
  },

  // ========================================================================
  // MODULE 14: DEPARTMENT REPORTS
  // ========================================================================
  async renderReports(reportType = 'attendance') {
    const res = await API.getHodReports(reportType);
    const data = (res && res.data) || [];

    const content = document.getElementById('hod-content-area');
    content.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:20px;">
        
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
          <div>
            <h2 style="font-size:18px; font-weight:900; margin:0; color:var(--text-primary);">Department Compliance & Academic Reports</h2>
            <p style="font-size:12px; color:var(--text-muted); margin:2px 0 0;">Statistical reporting across students, faculty workload & evaluations</p>
          </div>
          <a href="/api/hod/reports/export?report_type=${encodeURIComponent(reportType)}&token=${API.getToken()}" download="${reportType}_report.csv" class="btn-primary" style="padding:8px 16px; font-size:12px; text-decoration:none; display:inline-flex; align-items:center; gap:6px;">
            <span>📥</span> <span>Download CSV Export</span>
          </a>
        </div>

        <!-- Report Type Toggle Buttons -->
        <div style="display:flex; gap:8px; overflow-x:auto;">
          <button class="btn-sec ${reportType === 'attendance' ? 'btn-primary' : ''}" onclick="HodApp.renderReports('attendance')" style="padding:7px 16px; font-size:12px;">
            ⏱️ Attendance Summary
          </button>
          <button class="btn-sec ${reportType === 'workload' ? 'btn-primary' : ''}" onclick="HodApp.renderReports('workload')" style="padding:7px 16px; font-size:12px;">
            ⚖️ Faculty Workload
          </button>
          <button class="btn-sec ${reportType === 'performance' ? 'btn-primary' : ''}" onclick="HodApp.renderReports('performance')" style="padding:7px 16px; font-size:12px;">
            📊 Academic Performance
          </button>
        </div>

        <!-- Report Table -->
        <div class="card" style="padding:0; overflow:hidden;">
          <div style="overflow-x:auto;">
            ${reportType === 'attendance' ? `
              <table class="table" style="width:100%; border-collapse:collapse; font-size:12.5px;">
                <thead>
                  <tr style="border-bottom:1px solid var(--border-color); background:rgba(255,255,255,0.02); text-align:left; color:var(--text-muted);">
                    <th style="padding:10px 14px;">Roll</th>
                    <th style="padding:10px 14px;">UG ID</th>
                    <th style="padding:10px 14px;">Name</th>
                    <th style="padding:10px 14px;">Batch</th>
                    <th style="padding:10px 14px; text-align:center;">Present Sessions</th>
                    <th style="padding:10px 14px; text-align:center;">Total Sessions</th>
                    <th style="padding:10px 14px; text-align:center;">Attendance %</th>
                  </tr>
                </thead>
                <tbody>
                  ${data.map(r => `
                    <tr style="border-bottom:1px solid var(--border-color);">
                      <td style="padding:10px 14px; font-weight:800;">${r.roll_number}</td>
                      <td style="padding:10px 14px; font-family:monospace; color:#38bdf8;">${r.ug_id}</td>
                      <td style="padding:10px 14px; font-weight:700;">${r.name}</td>
                      <td style="padding:10px 14px;">${r.batch}</td>
                      <td style="padding:10px 14px; text-align:center;">${r.present_sessions || 0}</td>
                      <td style="padding:10px 14px; text-align:center;">${r.total_sessions || 0}</td>
                      <td style="padding:10px 14px; text-align:center; font-weight:800; color:${(r.attendance_percentage || 88) >= 75 ? '#10b981' : '#ef4444'};">
                        ${r.attendance_percentage || 88}%
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            ` : (reportType === 'workload' ? `
              <table class="table" style="width:100%; border-collapse:collapse; font-size:12.5px;">
                <thead>
                  <tr style="border-bottom:1px solid var(--border-color); background:rgba(255,255,255,0.02); text-align:left; color:var(--text-muted);">
                    <th style="padding:10px 14px;">Faculty ID</th>
                    <th style="padding:10px 14px;">Name</th>
                    <th style="padding:10px 14px;">Designation</th>
                    <th style="padding:10px 14px; text-align:center;">Slots</th>
                    <th style="padding:10px 14px; text-align:center;">Assigned Hours</th>
                    <th style="padding:10px 14px; text-align:center;">Institutional Limit</th>
                  </tr>
                </thead>
                <tbody>
                  ${data.map(r => `
                    <tr style="border-bottom:1px solid var(--border-color);">
                      <td style="padding:10px 14px; font-family:monospace; color:#38bdf8;">${r.teacher_id}</td>
                      <td style="padding:10px 14px; font-weight:700;">${r.name}</td>
                      <td style="padding:10px 14px;">${r.designation}</td>
                      <td style="padding:10px 14px; text-align:center;">${r.weekly_slots || 0}</td>
                      <td style="padding:10px 14px; text-align:center; font-weight:800;">${r.total_hours || 0} hrs</td>
                      <td style="padding:10px 14px; text-align:center;">${r.workload_limit_hours || 20} hrs</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            ` : `
              <table class="table" style="width:100%; border-collapse:collapse; font-size:12.5px;">
                <thead>
                  <tr style="border-bottom:1px solid var(--border-color); background:rgba(255,255,255,0.02); text-align:left; color:var(--text-muted);">
                    <th style="padding:10px 14px;">Subject</th>
                    <th style="padding:10px 14px; text-align:center;">Students Evaluated</th>
                    <th style="padding:10px 14px; text-align:center;">Class Average</th>
                    <th style="padding:10px 14px; text-align:center;">Highest Score</th>
                    <th style="padding:10px 14px; text-align:center;">Lowest Score</th>
                  </tr>
                </thead>
                <tbody>
                  ${data.map(r => `
                    <tr style="border-bottom:1px solid var(--border-color);">
                      <td style="padding:10px 14px; font-weight:800; color:var(--text-primary);">${r.subject}</td>
                      <td style="padding:10px 14px; text-align:center;">${r.student_count || 0}</td>
                      <td style="padding:10px 14px; text-align:center; font-weight:800; color:#38bdf8;">${r.average_marks || 0}</td>
                      <td style="padding:10px 14px; text-align:center; font-weight:800; color:#10b981;">${r.highest_marks || 0}</td>
                      <td style="padding:10px 14px; text-align:center; font-weight:800; color:#ef4444;">${r.lowest_marks || 0}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            `)}
          </div>
        </div>

      </div>
    `;
  },

  // ========================================================================
  // MODULE 15: CENTRAL HOD APPROVALS DASHBOARD
  // ========================================================================
  async renderApprovals(filterStatus = 'PENDING') {
    const res = await API.getHodApprovals({ status: filterStatus === 'ALL' ? '' : filterStatus });
    const approvals = (res && res.approvals) || [];

    const content = document.getElementById('hod-content-area');
    content.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:20px;">
        
        <div>
          <h2 style="font-size:18px; font-weight:900; margin:0; color:var(--text-primary);">Central HOD Approvals Dashboard</h2>
          <p style="font-size:12px; color:var(--text-muted); margin:2px 0 0;">Unified authorization queue for marks, leaves, attendance corrections & timetables</p>
        </div>

        <div style="display:flex; gap:8px;">
          <button class="btn-sec ${filterStatus === 'PENDING' ? 'btn-primary' : ''}" onclick="HodApp.renderApprovals('PENDING')" style="padding:7px 16px; font-size:12px;">
            ⏳ Pending Items (${this.pendingApprovalsCount})
          </button>
          <button class="btn-sec ${filterStatus === 'APPROVED' ? 'btn-primary' : ''}" onclick="HodApp.renderApprovals('APPROVED')" style="padding:7px 16px; font-size:12px;">
            ✓ Approved History
          </button>
          <button class="btn-sec ${filterStatus === 'ALL' ? 'btn-primary' : ''}" onclick="HodApp.renderApprovals('ALL')" style="padding:7px 16px; font-size:12px;">
            All Requests
          </button>
        </div>

        <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(320px, 1fr)); gap:16px;">
          ${approvals.length === 0 ? `
            <div class="card" style="padding:28px; text-align:center; color:var(--text-muted); grid-column:1/-1;">
              ${filterStatus === 'PENDING' ? '✓ No pending approval requests in queue!' : 'No records found for this filter.'}
            </div>
          ` : approvals.map(a => {
            const isPending = a.status === 'PENDING';
            const badgeColor = a.status === 'APPROVED' ? '#10b981' : (a.status === 'REJECTED' ? '#ef4444' : '#f59e0b');
            return `
              <div class="card" style="padding:18px; display:flex; flex-direction:column; justify-content:space-between; gap:12px;">
                <div>
                  <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                    <div>
                      <span class="badge" style="background:#2563eb; color:#fff; font-size:9.5px; padding:2px 6px;">${a.request_type}</span>
                      <h3 style="font-size:14.5px; font-weight:800; color:var(--text-primary); margin:6px 0 2px;">${a.title}</h3>
                      <div style="font-size:11.5px; color:var(--text-muted);">Requester: ${a.requester_name} (${a.requester_role})</div>
                    </div>
                    <span class="badge" style="background:${badgeColor}; color:#fff; font-size:10px;">${a.status}</span>
                  </div>

                  <p style="font-size:12px; color:var(--text-secondary); margin:8px 0 0; line-height:1.4;">${a.description}</p>
                  
                  ${a.decision_remarks ? `
                    <div style="margin-top:6px; font-size:11.5px; color:#10b981;">
                      <strong>Remarks:</strong> ${a.decision_remarks}
                    </div>
                  ` : ''}
                </div>

                ${isPending ? `
                  <div style="display:flex; gap:8px; border-top:1px solid var(--border-color); padding-top:10px;">
                    <button class="btn-primary" onclick="HodApp.processApprovalAction(${a.id}, 'APPROVED')" style="flex:1; padding:6px; font-size:11px;">
                      ✓ Approve
                    </button>
                    <button class="btn-sec" onclick="HodApp.processApprovalAction(${a.id}, 'RETURNED')" style="flex:1; padding:6px; font-size:11px;">
                      ↩ Return
                    </button>
                    <button class="btn-sec" onclick="HodApp.processApprovalAction(${a.id}, 'REJECTED')" style="flex:1; padding:6px; font-size:11px; color:#ef4444; border-color:rgba(239,68,68,0.3);">
                      ✕ Reject
                    </button>
                  </div>
                ` : `
                  <div style="font-size:11px; color:var(--text-muted); border-top:1px solid var(--border-color); padding-top:8px;">
                    Processed by ${a.decision_by || 'HOD'} on ${a.decision_at ? new Date(a.decision_at).toLocaleDateString() : 'N/A'}
                  </div>
                `}
              </div>
            `;
          }).join('')}
        </div>

      </div>
    `;
  },

  async processApprovalAction(id, action) {
    const remarks = prompt(`Enter comments/remarks for ${action.toLowerCase()}ing this request:`, action === 'APPROVED' ? 'Approved by HOD' : 'Action required');
    if (remarks === null) return;

    try {
      const res = await API.processHodApproval(id, { action, remarks });
      if (res && res.success) {
        this.showToast(res.message || 'Request processed!', 'success');
        await this.renderApprovals();
      } else {
        this.showToast(res?.message || 'Failed to process request.', 'error');
      }
    } catch (e) {
      this.showToast('Failed to process approval request.', 'error');
    }
  },

  quickApproveModal(id, title) {
    this.switchSection('approvals');
  },

  quickReviewLeave(id, applicant) {
    this.switchSection('leaves');
  },

  // Modal Dialog Utilities
  openModal(html) {
    this.closeModal();
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop';
    modal.id = 'hod-dynamic-modal';
    modal.onclick = (e) => { if (e.target === modal) this.closeModal(); };
    modal.innerHTML = `
      <div class="modal-card" onclick="event.stopPropagation()">
        ${html}
      </div>
    `;
    document.body.appendChild(modal);
  },

  closeModal() {
    const existing = document.getElementById('hod-dynamic-modal');
    if (existing) existing.remove();
  }
};

window.HodApp = HodApp;
