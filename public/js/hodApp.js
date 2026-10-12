// ==========================================================================
// HOD (HEAD OF DEPARTMENT) WEB PORTAL CONTROLLER (MGI CSE / CYBER SECURITY)
// Complete 15 Modules Production-Ready Architecture
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
  getIndianDate,
  getIndianDateString,
  getIndianDayName,
  currentSection: 'dashboard',
  currentUser: null,
  deptData: null,
  sectionHistory: ['dashboard'],

  async init(user, forceSection = null) {
    this.currentUser = user || API.getUser() || {};
    this.sectionHistory = ['dashboard'];

    // Instantly sync latest HOD profile from backend
    try {
      const profRes = await API.getHodProfile();
      if (profRes && profRes.success && profRes.data) {
        this.deptData = profRes.data;
        this.currentUser = { ...this.currentUser, ...profRes.data };
        API.setUser(this.currentUser);
      }
    } catch (e) {
      console.warn('[HodApp] Profile fetch notice:', e.message);
    }

    let initialSection = 'dashboard';
    if (forceSection) {
      initialSection = forceSection;
    } else {
      const hash = window.location.hash.replace('#hod-', '').replace('#', '').trim();
      const validSections = [
        'dashboard', 'profile', 'faculty', 'students', 'subjects',
        'timetable', 'attendance', 'marks', 'assignments', 'exams',
        'workload', 'leaves', 'mentoring', 'reports', 'approvals'
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
    this.bindSidebarEvents();
    this.initRealtimeSSE();

    await this.loadSectionData(initialSection);
    setTimeout(() => window.App?.updatePWAInstallVisibility(), 50);
  },

  renderLayout() {
    const root = document.getElementById('app-root');
    const user = this.currentUser || {};
    const deptName = user.department || 'Computer Science & Engineering';

    root.innerHTML = `
      <div class="admin-layout hod-layout">
        <!-- Sidebar Navigation -->
        <aside class="admin-sidebar" id="hod-sidebar">
          <div class="sidebar-header">
            <div class="brand-crest" style="background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%);">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#ffffff" stroke-width="2.2">
                <path d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 14v4M12 14v4M16 14v4"/>
              </svg>
            </div>
            <div style="min-width:0; flex:1;">
              <h2 style="font-size:14px; font-weight:800; letter-spacing:0.3px; margin:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">HOD PORTAL</h2>
              <span style="font-size:10.5px; color:#38bdf8; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; display:block;">CSE & Cyber Security</span>
            </div>
          </div>

          <div class="sidebar-menu" id="hod-sidebar-menu">
            <div class="sidebar-group-title">Executive Overview</div>
            <button class="sidebar-item ${this.currentSection === 'dashboard' ? 'active' : ''}" data-section="dashboard">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
              <span>Dashboard</span>
            </button>
            <button class="sidebar-item ${this.currentSection === 'approvals' ? 'active' : ''}" data-section="approvals">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>
              <span>HOD Approvals</span>
              <span id="hod-badge-pending" class="sidebar-badge" style="display:none;">0</span>
            </button>
            <button class="sidebar-item ${this.currentSection === 'profile' ? 'active' : ''}" data-section="profile">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11"/></svg>
              <span>Department Profile</span>
            </button>

            <div class="sidebar-group-title">Faculty & Academics</div>
            <button class="sidebar-item ${this.currentSection === 'faculty' ? 'active' : ''}" data-section="faculty">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              <span>Faculty Management</span>
            </button>
            <button class="sidebar-item ${this.currentSection === 'workload' ? 'active' : ''}" data-section="workload">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
              <span>Faculty Workload</span>
            </button>
            <button class="sidebar-item ${this.currentSection === 'leaves' ? 'active' : ''}" data-section="leaves">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              <span>Leave Approval</span>
            </button>
            <button class="sidebar-item ${this.currentSection === 'subjects' ? 'active' : ''}" data-section="subjects">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
              <span>Subject Management</span>
            </button>
            <button class="sidebar-item ${this.currentSection === 'timetable' ? 'active' : ''}" data-section="timetable">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              <span>Timetable Management</span>
            </button>

            <div class="sidebar-group-title">Students & Performance</div>
            <button class="sidebar-item ${this.currentSection === 'students' ? 'active' : ''}" data-section="students">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>
              <span>Student Management</span>
            </button>
            <button class="sidebar-item ${this.currentSection === 'attendance' ? 'active' : ''}" data-section="attendance">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
              <span>Attendance Hub</span>
            </button>
            <button class="sidebar-item ${this.currentSection === 'marks' ? 'active' : ''}" data-section="marks">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
              <span>Internal Marks</span>
            </button>
            <button class="sidebar-item ${this.currentSection === 'assignments' ? 'active' : ''}" data-section="assignments">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>
              <span>Assignments Hub</span>
            </button>
            <button class="sidebar-item ${this.currentSection === 'exams' ? 'active' : ''}" data-section="exams">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v8"/><path d="M8 12h8"/></svg>
              <span>Exam Management</span>
            </button>
            <button class="sidebar-item ${this.currentSection === 'mentoring' ? 'active' : ''}" data-section="mentoring">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/></svg>
              <span>Student Mentoring</span>
            </button>

            <div class="sidebar-group-title">Analytics & Output</div>
            <button class="sidebar-item ${this.currentSection === 'reports' ? 'active' : ''}" data-section="reports">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
              <span>Department Reports</span>
            </button>
          </div>

          <div class="sidebar-footer" style="padding:14px 16px; margin-top:auto; border-top:1px solid var(--border-color); display:flex; align-items:center; gap:10px;">
            <div style="width:34px; height:34px; border-radius:50%; background:linear-gradient(135deg, #2563eb, #1e40af); color:#fff; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:13px; border:1px solid rgba(255,255,255,0.2);">
              HOD
            </div>
            <div style="flex:1; min-width:0;">
              <div style="font-size:12.5px; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${user.name || 'Dr. A. K. Sharma'}</div>
              <div style="font-size:11px; color:var(--text-muted);">Head of Department</div>
            </div>
            <button onclick="App.logout()" title="Logout" style="background:transparent; border:none; color:#f87171; font-size:16px; cursor:pointer; padding:4px;">⎋</button>
          </div>
        </aside>

        <!-- Main Content Area -->
        <main class="admin-main">
          <header class="admin-topbar">
            <div style="display:flex; align-items:center; gap:12px; min-width:0;">
              <button class="icon-btn" id="hod-sidebar-toggle" style="display:none; width:36px; height:36px; flex-shrink:0;">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
              </button>
              <div style="min-width:0;">
                <h1 class="admin-page-title" id="hod-page-title" style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">Department Dashboard</h1>
                <div style="font-size:11.5px; color:var(--text-muted); display:flex; align-items:center; gap:6px;">
                  <span>${deptName}</span> • <span id="hod-ist-clock">${this.getIndianDayName()}</span>
                </div>
              </div>
            </div>

            <div style="display:flex; align-items:center; gap:8px; flex-shrink:0;">
              <span class="badge" style="background:rgba(56,189,248,0.12); color:#38bdf8; border:1px solid rgba(56,189,248,0.3); font-size:11.5px; font-weight:700; padding:4px 10px; border-radius:var(--radius-full);">
                HOD CSE
              </span>
              <button class="icon-btn" onclick="App.toggleTheme()" title="Toggle Theme" style="width:36px; height:36px;">
                🌓
              </button>
              <button class="btn-sec" onclick="App.logout()" style="padding:6px 12px; font-size:12px; margin:0; display:inline-flex; align-items:center; gap:4px;">
                <span>Sign Out</span>
              </button>
            </div>
          </header>

          <div class="admin-content" id="hod-content">
            <div style="display:flex; justify-content:center; align-items:center; min-height:300px;">
              <div style="width:32px; height:32px; border:3px solid rgba(255,255,255,0.1); border-top-color:#38bdf8; border-radius:50%; animation:spin 0.8s linear infinite;"></div>
            </div>
          </div>
        </main>
      </div>

      <div class="sidebar-backdrop" id="hod-sidebar-backdrop"></div>
    `;

    // Mobile sidebar toggle handlers
    const toggleBtn = document.getElementById('hod-sidebar-toggle');
    const sidebar = document.getElementById('hod-sidebar');
    const backdrop = document.getElementById('hod-sidebar-backdrop');

    if (window.innerWidth <= 960 && toggleBtn) {
      toggleBtn.style.display = 'inline-flex';
    }

    const toggleSidebar = () => {
      sidebar.classList.toggle('open');
      if (backdrop) backdrop.classList.toggle('show');
    };

    if (toggleBtn) toggleBtn.onclick = toggleSidebar;
    if (backdrop) backdrop.onclick = toggleSidebar;

    window.addEventListener('resize', () => {
      if (toggleBtn) {
        toggleBtn.style.display = window.innerWidth <= 960 ? 'inline-flex' : 'none';
      }
      if (window.innerWidth > 960 && sidebar.classList.contains('open')) {
        sidebar.classList.remove('open');
        if (backdrop) backdrop.classList.remove('show');
      }
    });
  },

  bindSidebarEvents() {
    const items = document.querySelectorAll('#hod-sidebar .sidebar-item');
    items.forEach(item => {
      item.onclick = async (e) => {
        e.preventDefault();
        const sec = item.dataset.section;
        if (!sec) return;

        items.forEach(i => i.classList.toggle('active', i === item));
        this.currentSection = sec;
        this.sectionHistory.push(sec);

        try {
          history.replaceState({ role: 'HOD', section: sec }, '', '#hod-' + sec);
        } catch (err) {}

        // Close mobile drawer on item tap
        const sidebar = document.getElementById('hod-sidebar');
        const backdrop = document.getElementById('hod-sidebar-backdrop');
        if (window.innerWidth <= 960 && sidebar) {
          sidebar.classList.remove('open');
          if (backdrop) backdrop.classList.remove('show');
        }

        await this.loadSectionData(sec);
      };
    });
  },

  setPageTitle(title) {
    const el = document.getElementById('hod-page-title');
    if (el) el.textContent = title;
  },

  async loadSectionData(section) {
    const container = document.getElementById('hod-content');
    if (!container) return;

    container.innerHTML = `
      <div style="display:flex; justify-content:center; align-items:center; min-height:300px;">
        <div style="width:32px; height:32px; border:3px solid rgba(255,255,255,0.1); border-top-color:#38bdf8; border-radius:50%; animation:spin 0.8s linear infinite;"></div>
      </div>
    `;

    try {
      switch (section) {
        case 'dashboard':
          this.setPageTitle('Department Dashboard Overview');
          await this.renderDashboardView();
          break;
        case 'profile':
          this.setPageTitle('Department Profile & Establishment');
          await this.renderProfileView();
          break;
        case 'faculty':
          this.setPageTitle('Faculty Members & Teaching Staff');
          await this.renderFacultyView();
          break;
        case 'workload':
          this.setPageTitle('Faculty Workload & Teaching Limits');
          await this.renderWorkloadView();
          break;
        case 'leaves':
          this.setPageTitle('Faculty Leave Management & Approvals');
          await this.renderLeavesView();
          break;
        case 'subjects':
          this.setPageTitle('Department Subjects & Syllabus Progress');
          await this.renderSubjectsView();
          break;
        case 'timetable':
          this.setPageTitle('Department Timetable & Conflict Resolution');
          await this.renderTimetableView();
          break;
        case 'students':
          this.setPageTitle('Student Directory & Academic Records');
          await this.renderStudentsView();
          break;
        case 'attendance':
          this.setPageTitle('Department Attendance Hub & Low Attendance Alerts');
          await this.renderAttendanceView();
          break;
        case 'marks':
          this.setPageTitle('Internal Assessment Marks Verification');
          await this.renderMarksView();
          break;
        case 'assignments':
          this.setPageTitle('Course Assignments & Submission Tracking');
          await this.renderAssignmentsView();
          break;
        case 'exams':
          this.setPageTitle('Examination Management & Scheduling');
          await this.renderExamsView();
          break;
        case 'mentoring':
          this.setPageTitle('Student Mentoring & Intervention Records');
          await this.renderMentoringView();
          break;
        case 'reports':
          this.setPageTitle('Official Department Analytics & Reports');
          await this.renderReportsView();
          break;
        case 'approvals':
          this.setPageTitle('Central HOD Approvals & Governance');
          await this.renderApprovalsView();
          break;
        default:
          this.setPageTitle('Department Dashboard');
          await this.renderDashboardView();
      }
    } catch (err) {
      console.error(`[HodApp] Error loading ${section}:`, err);
      container.innerHTML = `
        <div class="card" style="padding:28px; text-align:center;">
          <div style="font-size:36px; margin-bottom:12px;">⚠️</div>
          <h3 style="font-size:16px; margin-bottom:8px;">Failed to load section data</h3>
          <p style="font-size:13px; color:var(--text-secondary); margin-bottom:16px;">${err.message || 'Please check your connection and retry.'}</p>
          <button class="btn-primary" onclick="HodApp.loadSectionData('${section}')" style="width:auto; padding:8px 20px;">Retry Loading</button>
        </div>
      `;
    }
  },

  initRealtimeSSE() {
    // Listen to real-time events stream if available
    try {
      const token = API.getToken();
      if (!token) return;
      const es = new EventSource(`/api/realtime/events?token=${token}`);
      es.onmessage = (e) => {
        try {
          const payload = JSON.parse(e.data);
          if (payload && (payload.type === 'APPROVAL_UPDATE' || payload.type === 'LEAVE_REQUEST')) {
            window.App?.showToast('New Department Update Received!', 'info');
            if (this.currentSection === 'dashboard' || this.currentSection === 'approvals') {
              this.loadSectionData(this.currentSection);
            }
          }
        } catch (err) {}
      };
      es.onerror = () => { es.close(); };
    } catch (e) {}
  },

  // ========================================================================
  // VIEW 1: DEPARTMENT DASHBOARD OVERVIEW
  // ========================================================================
  async renderDashboardView() {
    const res = await API.getHodDashboard();
    const data = res.data || {};
    const stats = data.stats || {};
    const schedule = data.todaySchedule || [];
    const audit = data.recentAudit || [];
    const charts = data.charts || {};

    const container = document.getElementById('hod-content');

    // Update approvals badge on sidebar
    const badge = document.getElementById('hod-badge-pending');
    if (badge) {
      const pendingCount = (stats.pendingApprovalsCount || 0) + (stats.pendingLeavesCount || 0) + (stats.pendingMarksCount || 0);
      badge.textContent = pendingCount;
      badge.style.display = pendingCount > 0 ? 'inline-block' : 'none';
    }

    container.innerHTML = `
      <!-- Primary KPI Cards Grid (Mobile 1-col, Tablet 2-col, Desktop 4-col) -->
      <div class="admin-stats-grid">
        <div class="stat-card">
          <div class="stat-icon" style="background:rgba(56,189,248,0.15); color:#38bdf8;">🎓</div>
          <div class="stat-info">
            <div class="stat-label">Enrolled Students</div>
            <div class="stat-value">${stats.totalStudents || 66}</div>
            <div class="stat-desc">Division 3CYBER7 • 2 Batches</div>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon" style="background:rgba(16,185,129,0.15); color:#10b981;">👨‍🏫</div>
          <div class="stat-info">
            <div class="stat-label">Department Faculty</div>
            <div class="stat-value">${stats.totalFaculty || 12}</div>
            <div class="stat-desc">${stats.totalWeeklyTeachingHours || 32} Lecture & Lab Hours/Wk</div>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon" style="background:rgba(245,158,11,0.15); color:#f59e0b;">⏱️</div>
          <div class="stat-info">
            <div class="stat-label">Attendance Rate</div>
            <div class="stat-value">${stats.departmentAttendanceRate || '91.8%'}</div>
            <div class="stat-desc">${stats.todayPresent || 0} Present Today • ${stats.todayAbsent || 0} Absent</div>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon" style="background:rgba(239,68,68,0.15); color:#ef4444;">🛡️</div>
          <div class="stat-info">
            <div class="stat-label">Pending Approvals</div>
            <div class="stat-value">${stats.pendingApprovalsCount || 0}</div>
            <div class="stat-desc">${stats.pendingLeavesCount || 0} Leaves • ${stats.pendingMarksCount || 0} Marks</div>
          </div>
        </div>
      </div>

      <!-- Quick Action Buttons Row -->
      <div class="card" style="margin-bottom:24px; padding:16px 20px;">
        <div style="font-size:12px; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:12px;">
          HOD Quick Action Hub
        </div>
        <div style="display:flex; flex-wrap:wrap; gap:10px;">
          <button class="btn-primary" onclick="HodApp.navigate('approvals')" style="width:auto; padding:8px 16px; font-size:12.5px;">
            <span>🛡️</span> Review Pending Approvals (${stats.pendingApprovalsCount || 0})
          </button>
          <button class="btn-sec" onclick="HodApp.navigate('faculty')" style="width:auto; padding:8px 16px; font-size:12.5px;">
            <span>👨‍🏫</span> Faculty Allocation
          </button>
          <button class="btn-sec" onclick="HodApp.navigate('attendance')" style="width:auto; padding:8px 16px; font-size:12.5px;">
            <span>⚠️</span> Low Attendance Alert
          </button>
          <button class="btn-sec" onclick="HodApp.navigate('timetable')" style="width:auto; padding:8px 16px; font-size:12.5px;">
            <span>📅</span> Schedule & Conflicts
          </button>
          <button class="btn-sec" onclick="HodApp.navigate('reports')" style="width:auto; padding:8px 16px; font-size:12.5px;">
            <span>📈</span> Download Reports (CSV)
          </button>
        </div>
      </div>

      <!-- Analytics Visual Charts Grid -->
      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap:20px; margin-bottom:24px;">
        <!-- Chart 1: Attendance Trend Bar Graph (SVG) -->
        <div class="card">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
            <h3 style="font-size:15px; font-weight:800; margin:0;">Weekly Department Attendance Trend</h3>
            <span style="font-size:11.5px; color:#10b981; font-weight:700; background:rgba(16,185,129,0.1); padding:3px 8px; border-radius:12px;">Avg 92%</span>
          </div>
          <div style="height:170px; display:flex; align-items:flex-end; justify-content:space-around; gap:12px; padding:10px 0; border-bottom:1px solid var(--border-color);">
            ${(charts.attendanceTrend || []).map(item => `
              <div style="display:flex; flex-direction:column; align-items:center; flex:1; gap:6px;">
                <span style="font-size:11px; font-weight:700; color:#38bdf8;">${item.rate}%</span>
                <div style="width:100%; max-width:32px; height:${(item.rate / 100) * 120}px; background:linear-gradient(180deg, #38bdf8 0%, #1d4ed8 100%); border-radius:6px 6px 0 0; transition:all 0.3s ease;"></div>
                <span style="font-size:11.5px; color:var(--text-secondary); font-weight:600;">${item.day}</span>
              </div>
            `).join('')}
          </div>
          <div style="font-size:11.5px; color:var(--text-muted); margin-top:10px; display:flex; justify-content:space-between;">
            <span>Threshold Minimum: 75%</span>
            <span>Target: 90%+</span>
          </div>
        </div>

        <!-- Chart 2: Student Academic Performance Grade Distribution -->
        <div class="card">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
            <h3 style="font-size:15px; font-weight:800; margin:0;">Internal Examination Grade Distribution</h3>
            <span style="font-size:11.5px; color:#38bdf8; font-weight:700;">65 Students</span>
          </div>
          <div style="display:flex; flex-direction:column; gap:12px;">
            ${Object.entries(charts.performanceDistribution || { 'A+ / A': 28, 'B+ / B': 24, 'C+ / C': 10, 'D / F': 3 }).map(([grade, count]) => {
              const pct = Math.round((count / 65) * 100);
              const color = grade.includes('A') ? '#10b981' : grade.includes('B') ? '#38bdf8' : grade.includes('C') ? '#f59e0b' : '#ef4444';
              return `
                <div>
                  <div style="display:flex; justify-content:space-between; font-size:12px; font-weight:600; margin-bottom:4px;">
                    <span>Grade ${grade}</span>
                    <span style="color:${color};">${count} Students (${pct}%)</span>
                  </div>
                  <div style="width:100%; height:8px; background:rgba(255,255,255,0.06); border-radius:4px; overflow:hidden;">
                    <div style="width:${pct}%; height:100%; background:${color}; border-radius:4px;"></div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>

      <!-- Two-Column Layout: Today's Classes & Recent Activity -->
      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap:20px;">
        <!-- Today's Schedule -->
        <div class="card">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
            <h3 style="font-size:15px; font-weight:800; margin:0;">Today's Classes (${data.dayName})</h3>
            <button class="btn-sec" onclick="HodApp.navigate('timetable')" style="padding:4px 10px; font-size:11.5px; margin:0;">View Full</button>
          </div>
          ${schedule.length === 0 ? `
            <div style="padding:24px; text-align:center; color:var(--text-muted); font-size:13px;">
              No lectures scheduled for today.
            </div>
          ` : `
            <div style="display:flex; flex-direction:column; gap:10px;">
              ${schedule.map(slot => `
                <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 12px; background:var(--bg-card-hover); border-radius:var(--radius-md); border-left:3px solid ${slot.is_lab ? '#f59e0b' : '#38bdf8'};">
                  <div>
                    <div style="font-size:13px; font-weight:700;">${slot.subject} ${slot.is_lab ? '<span style="font-size:10px; color:#f59e0b; font-weight:700; background:rgba(245,158,11,0.15); padding:2px 6px; border-radius:4px;">LAB</span>' : ''}</div>
                    <div style="font-size:11.5px; color:var(--text-muted);">${slot.teacher || 'Faculty'} • Room: ${slot.room}</div>
                  </div>
                  <div style="font-size:12px; font-weight:700; color:#38bdf8; text-align:right;">
                    ${slot.start_time} - ${slot.end_time}
                    <div style="font-size:10.5px; color:var(--text-muted);">${slot.batch}</div>
                  </div>
                </div>
              `).join('')}
            </div>
          `}
        </div>

        <!-- Recent Audit & Department Activities -->
        <div class="card">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
            <h3 style="font-size:15px; font-weight:800; margin:0;">Recent Department Activities</h3>
            <span style="font-size:11px; color:var(--text-muted);">Audit Trail</span>
          </div>
          ${audit.length === 0 ? `
            <div style="padding:24px; text-align:center; color:var(--text-muted); font-size:13px;">
              No recent departmental audit events recorded.
            </div>
          ` : `
            <div style="display:flex; flex-direction:column; gap:8px;">
              ${audit.map(log => `
                <div style="padding:8px 10px; background:rgba(255,255,255,0.02); border-radius:6px; border-left:2px solid #38bdf8; font-size:12px;">
                  <div style="display:flex; justify-content:space-between; margin-bottom:2px;">
                    <strong style="color:#38bdf8;">${log.action}</strong>
                    <span style="font-size:10.5px; color:var(--text-muted);">${(log.created_at || '').substring(0, 16)}</span>
                  </div>
                  <div style="color:var(--text-secondary); font-size:11.5px;">${log.performed_by_name} (${log.performed_by_role}): ${log.details || ''}</div>
                </div>
              `).join('')}
            </div>
          `}
        </div>
      </div>
    `;
  },

  navigate(section) {
    const item = document.querySelector(`#hod-sidebar [data-section="${section}"]`);
    if (item) item.click();
    else this.loadSectionData(section);
  },

  // ========================================================================
  // VIEW 2: DEPARTMENT PROFILE
  // ========================================================================
  async renderProfileView() {
    const res = await API.getHodProfile();
    const d = res.data || {};
    const stats = d.stats || {};
    const container = document.getElementById('hod-content');

    container.innerHTML = `
      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap:24px;">
        <!-- Left: Department Details & Edit Form -->
        <div class="card">
          <h3 style="font-size:16px; font-weight:800; margin:0 0 16px;">Department Official Profile</h3>
          <form onsubmit="event.preventDefault(); HodApp.handleUpdateProfile();">
            <div class="form-group" style="margin-bottom:12px;">
              <label class="form-label">Department Name</label>
              <input type="text" id="prof-dept-name" class="form-control" value="${d.name || 'Computer Science & Engineering'}" readonly style="opacity:0.8;" />
            </div>

            <div class="form-group" style="margin-bottom:12px;">
              <label class="form-label">Department Code & Established Year</label>
              <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
                <input type="text" class="form-control" value="${d.code || 'CSE'}" readonly style="opacity:0.8;" />
                <input type="text" class="form-control" value="Est. ${d.established_year || 2012}" readonly style="opacity:0.8;" />
              </div>
            </div>

            <div class="form-group" style="margin-bottom:12px;">
              <label class="form-label">Head of Department (HOD) Name *</label>
              <input type="text" id="prof-head-name" class="form-control" value="${d.head_name || 'Dr. A. K. Sharma'}" required />
            </div>

            <div class="form-group" style="margin-bottom:12px;">
              <label class="form-label">HOD Official Email *</label>
              <input type="email" id="prof-head-email" class="form-control" value="${d.head_email || 'hod.cse@mishragroup.ac.in'}" required />
            </div>

            <div class="form-group" style="margin-bottom:12px;">
              <label class="form-label">HOD Contact Phone</label>
              <input type="text" id="prof-head-phone" class="form-control" value="${d.head_phone || '+91 98765 43210'}" />
            </div>

            <div class="form-group" style="margin-bottom:12px;">
              <label class="form-label">Department Office Location</label>
              <input type="text" id="prof-office-loc" class="form-control" value="${d.office_location || 'Building A, 3rd Floor, Cabin 301'}" />
            </div>

            <div class="form-group" style="margin-bottom:12px;">
              <label class="form-label">Department Overview & Description</label>
              <textarea id="prof-dept-desc" class="form-control" rows="3">${d.description || ''}</textarea>
            </div>

            <div class="form-group" style="margin-bottom:16px;">
              <label class="form-label">Department Vision & Mission</label>
              <textarea id="prof-dept-vision" class="form-control" rows="2" placeholder="Department Vision">${d.vision || ''}</textarea>
            </div>

            <button type="submit" class="btn-primary" style="height:44px; font-weight:700;">
              Save Department Changes
            </button>
          </form>
        </div>

        <!-- Right: Department Strength, Courses & Divisions -->
        <div style="display:flex; flex-direction:column; gap:20px;">
          <div class="card">
            <h3 style="font-size:15px; font-weight:800; margin:0 0 14px;">Strength Breakdown</h3>
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px;">
              <div style="padding:12px; background:rgba(56,189,248,0.08); border-radius:var(--radius-md); border:1px solid rgba(56,189,248,0.2);">
                <div style="font-size:11px; color:var(--text-muted);">Total Enrolled</div>
                <div style="font-size:22px; font-weight:800; color:#38bdf8;">${stats.totalStudents || 66}</div>
                <div style="font-size:11px; color:var(--text-secondary);">Batch 1: ${stats.batch1Students || 30} | Batch 2: ${stats.batch2Students || 36}</div>
              </div>

              <div style="padding:12px; background:rgba(16,185,129,0.08); border-radius:var(--radius-md); border:1px solid rgba(16,185,129,0.2);">
                <div style="font-size:11px; color:var(--text-muted);">Faculty Strength</div>
                <div style="font-size:22px; font-weight:800; color:#10b981;">${stats.totalFaculty || 12}</div>
                <div style="font-size:11px; color:var(--text-secondary);">Professors & Lecturers</div>
              </div>
            </div>
          </div>

          <div class="card">
            <h3 style="font-size:15px; font-weight:800; margin:0 0 12px;">Active Programs & Degrees</h3>
            <ul style="margin:0; padding-left:18px; font-size:13px; color:var(--text-secondary); line-height:1.8;">
              ${(stats.activeCourses || []).map(c => `<li><strong>${c}</strong></li>`).join('')}
            </ul>

            <h4 style="font-size:13px; font-weight:700; margin:16px 0 8px;">Active Class Divisions</h4>
            <div style="display:flex; gap:8px; flex-wrap:wrap;">
              ${(stats.activeDivisions || []).map(d => `<span class="badge" style="background:rgba(56,189,248,0.12); color:#38bdf8; padding:4px 10px; font-weight:700;">${d}</span>`).join('')}
            </div>
          </div>
        </div>
      </div>
    `;
  },

  async handleUpdateProfile() {
    const head_name = document.getElementById('prof-head-name').value.trim();
    const head_email = document.getElementById('prof-head-email').value.trim();
    const head_phone = document.getElementById('prof-head-phone').value.trim();
    const office_location = document.getElementById('prof-office-loc').value.trim();
    const description = document.getElementById('prof-dept-desc').value.trim();
    const vision = document.getElementById('prof-dept-vision').value.trim();

    const res = await API.updateHodProfile({
      head_name,
      head_email,
      head_phone,
      office_location,
      description,
      vision
    });

    if (res.success) {
      window.App?.showToast('Department profile updated successfully!', 'success');
      this.renderProfileView();
    } else {
      window.App?.showToast(res.message || 'Failed to update department profile', 'error');
    }
  },

  // ========================================================================
  // VIEW 3: FACULTY MANAGEMENT
  // ========================================================================
  async renderFacultyView() {
    const res = await API.getHodFaculty();
    const faculty = res.faculty || [];
    const container = document.getElementById('hod-content');

    container.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:16px;">
        <div style="display:flex; gap:10px; flex:1; max-width:400px;">
          <input type="text" id="faculty-search-input" class="form-control" placeholder="Search faculty by name, ID or subject..." oninput="HodApp.filterFacultyList()" />
        </div>
        <div style="display:flex; gap:8px;">
          <select id="faculty-designation-filter" class="form-control" style="width:auto;" onchange="HodApp.filterFacultyList()">
            <option value="ALL">All Designations</option>
            <option value="Professor">Professor</option>
            <option value="Assistant Professor">Assistant Professor</option>
            <option value="Associate Professor">Associate Professor</option>
          </select>
        </div>
      </div>

      <!-- Responsive Faculty Cards Grid -->
      <div id="faculty-cards-grid" style="display:grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap:16px;">
        ${faculty.map(f => `
          <div class="card faculty-card" data-name="${(f.name || '').toLowerCase()}" data-id="${(f.teacher_id || '').toLowerCase()}" data-subject="${(f.subjects || '').toLowerCase()}" data-desig="${f.designation}">
            <div style="display:flex; align-items:center; gap:12px; margin-bottom:12px;">
              <div style="width:44px; height:44px; border-radius:50%; background:linear-gradient(135deg, #0ea5e9, #2563eb); color:#fff; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:15px; flex-shrink:0;">
                ${(f.name || 'F').charAt(0)}
              </div>
              <div style="flex:1; min-width:0;">
                <h4 style="font-size:14.5px; font-weight:800; margin:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${f.name}</h4>
                <div style="font-size:11.5px; color:#38bdf8; font-weight:600;">${f.designation || 'Faculty'} • ${f.teacher_id}</div>
              </div>
              <span class="badge" style="background:${f.status === 'ACTIVE' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)'}; color:${f.status === 'ACTIVE' ? '#10b981' : '#ef4444'}; font-size:11px; padding:3px 8px;">
                ${f.status}
              </span>
            </div>

            <div style="font-size:12.5px; line-height:1.6; margin-bottom:12px;">
              <div><strong>Assigned:</strong> ${f.subjects || 'General'}</div>
              <div><strong>Batch:</strong> ${f.batch || 'Both'} | <strong>Workload:</strong> ${f.weeklyWorkloadHours || 0} hrs/week</div>
              <div style="color:var(--text-muted); font-size:11.5px;">📞 ${f.phone || 'N/A'} • ✉️ ${f.email || 'N/A'}</div>
            </div>

            <div style="display:flex; gap:8px; border-top:1px solid var(--border-color); padding-top:10px;">
              <button class="btn-sec" onclick="HodApp.openFacultyModal('${f.id}')" style="flex:1; padding:6px; font-size:12px; margin:0;">
                View Details
              </button>
              <button class="btn-primary" onclick="HodApp.openAssignModal('${f.id}', '${f.name}', '${f.subjects || ''}', '${f.batch || 'Both'}')" style="flex:1; padding:6px; font-size:12px; margin:0;">
                Assign Subjects
              </button>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  },

  filterFacultyList() {
    const search = (document.getElementById('faculty-search-input')?.value || '').toLowerCase().trim();
    const desig = document.getElementById('faculty-designation-filter')?.value || 'ALL';

    document.querySelectorAll('.faculty-card').forEach(card => {
      const name = card.dataset.name || '';
      const id = card.dataset.id || '';
      const sub = card.dataset.subject || '';
      const cardDesig = card.dataset.desig || '';

      const matchSearch = !search || name.includes(search) || id.includes(search) || sub.includes(search);
      const matchDesig = desig === 'ALL' || cardDesig.includes(desig);

      card.style.display = matchSearch && matchDesig ? 'block' : 'none';
    });
  },

  async openFacultyModal(id) {
    const res = await API.getHodFacultyDetails(id);
    const f = res.faculty || {};
    const sched = res.schedule || [];
    const leaves = res.leaves || [];

    const modal = document.createElement('div');
    modal.className = 'modal-backdrop';
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
    modal.innerHTML = `
      <div class="modal-card" style="max-width:540px;" onclick="event.stopPropagation()">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
          <h3 style="font-size:16px; font-weight:800; margin:0;">Faculty Details: ${f.name}</h3>
          <button class="icon-btn" onclick="this.closest('.modal-backdrop').remove()">✕</button>
        </div>

        <div style="font-size:12.5px; line-height:1.6; margin-bottom:14px; background:rgba(255,255,255,0.03); padding:12px; border-radius:8px;">
          <div><strong>Designation:</strong> ${f.designation} (${f.department})</div>
          <div><strong>Subjects:</strong> ${f.subjects || 'None'}</div>
          <div><strong>Batch Scope:</strong> ${f.batch} | <strong>Status:</strong> ${f.status}</div>
          <div><strong>Contact:</strong> ${f.phone || 'N/A'} • ${f.email || 'N/A'}</div>
        </div>

        <h4 style="font-size:13.5px; font-weight:700; margin:0 0 8px;">Weekly Lecture Schedule (${sched.length} Slots)</h4>
        <div style="max-height:160px; overflow-y:auto; margin-bottom:14px;">
          ${sched.length === 0 ? '<p style="font-size:12px; color:var(--text-muted);">No timetable slots allocated.</p>' : `
            <table class="data-table" style="font-size:11.5px; width:100%;">
              <thead><tr><th>Day</th><th>Time</th><th>Subject</th><th>Room</th></tr></thead>
              <tbody>
                ${sched.map(s => `<tr><td>${s.day}</td><td>${s.start_time}</td><td>${s.subject}</td><td>${s.room}</td></tr>`).join('')}
              </tbody>
            </table>
          `}
        </div>

        <h4 style="font-size:13.5px; font-weight:700; margin:0 0 8px;">Leave History (${leaves.length} Requests)</h4>
        <div style="max-height:120px; overflow-y:auto;">
          ${leaves.length === 0 ? '<p style="font-size:12px; color:var(--text-muted);">No leave records.</p>' : `
            <table class="data-table" style="font-size:11.5px; width:100%;">
              <thead><tr><th>Type</th><th>Duration</th><th>Status</th></tr></thead>
              <tbody>
                ${leaves.map(l => `<tr><td>${l.leave_type}</td><td>${l.start_date} (${l.days_count}d)</td><td>${l.status}</td></tr>`).join('')}
              </tbody>
            </table>
          `}
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  },

  openAssignModal(id, name, subjects, batch) {
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop';
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
    modal.innerHTML = `
      <div class="modal-card" style="max-width:440px;" onclick="event.stopPropagation()">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
          <h3 style="font-size:15px; font-weight:800; margin:0;">Assign Subjects: ${name}</h3>
          <button class="icon-btn" onclick="this.closest('.modal-backdrop').remove()">✕</button>
        </div>

        <form onsubmit="event.preventDefault(); HodApp.submitAssignSubjects('${id}');">
          <div class="form-group" style="margin-bottom:12px;">
            <label class="form-label">Subjects (Comma separated)</label>
            <input type="text" id="assign-subj-input" class="form-control" value="${subjects}" placeholder="e.g. DBMS, NCS" required />
          </div>

          <div class="form-group" style="margin-bottom:16px;">
            <label class="form-label">Batch Allocation</label>
            <select id="assign-batch-select" class="form-control">
              <option value="Both" ${batch === 'Both' ? 'selected' : ''}>Both (Batch 1 & Batch 2)</option>
              <option value="Batch 1" ${batch === 'Batch 1' ? 'selected' : ''}>Batch 1</option>
              <option value="Batch 2" ${batch === 'Batch 2' ? 'selected' : ''}>Batch 2</option>
            </select>
          </div>

          <button type="submit" class="btn-primary" style="height:42px;">Save Assignment</button>
        </form>
      </div>
    `;
    document.body.appendChild(modal);
  },

  async submitAssignSubjects(id) {
    const subjects = document.getElementById('assign-subj-input').value.trim();
    const batch = document.getElementById('assign-batch-select').value;

    const res = await API.updateHodFacultyAssignments(id, { subjects, batch });
    if (res.success) {
      window.App?.showToast('Subjects assigned successfully!', 'success');
      document.querySelectorAll('.modal-backdrop').forEach(m => m.remove());
      this.renderFacultyView();
    } else {
      window.App?.showToast(res.message || 'Failed to update assignment', 'error');
    }
  },

  // ========================================================================
  // VIEW 4: FACULTY WORKLOAD
  // ========================================================================
  async renderWorkloadView() {
    const res = await API.getHodWorkload();
    const limit = res.institutionalLimit || 18;
    const workload = res.workload || [];
    const container = document.getElementById('hod-content');

    container.innerHTML = `
      <div class="card" style="margin-bottom:20px; padding:16px 20px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
        <div>
          <h3 style="font-size:15px; font-weight:800; margin:0 0 4px;">Institutional Workload Standards</h3>
          <div style="font-size:12px; color:var(--text-secondary);">Benchmark teaching workload limit: <strong>${limit} hours/week</strong></div>
        </div>
        <button class="btn-sec" onclick="HodApp.exportWorkloadCsv()" style="width:auto; padding:6px 14px; font-size:12px; margin:0;">
          <span>📥</span> Export Workload Report (CSV)
        </button>
      </div>

      <div style="display:flex; flex-direction:column; gap:14px;">
        ${workload.map(item => {
          const isOver = item.totalWeeklyHours > limit;
          const isUnder = item.totalWeeklyHours < 8 && item.totalWeeklyHours > 0;
          const color = isOver ? '#ef4444' : isUnder ? '#f59e0b' : '#10b981';

          return `
            <div class="card" style="padding:16px 20px;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; flex-wrap:wrap; gap:8px;">
                <div>
                  <h4 style="font-size:14.5px; font-weight:800; margin:0;">${item.name} (${item.teacher_id})</h4>
                  <div style="font-size:11.5px; color:var(--text-muted);">${item.designation} • Subjects: ${item.subjectsAssigned.join(', ') || 'None'}</div>
                </div>
                <div style="text-align:right;">
                  <span class="badge" style="background:${isOver ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.15)'}; color:${color}; font-size:11.5px; font-weight:700;">
                    ${item.status} (${item.totalWeeklyHours} / ${limit} hrs)
                  </span>
                </div>
              </div>

              <!-- Progress Bar -->
              <div style="width:100%; height:8px; background:rgba(255,255,255,0.06); border-radius:4px; overflow:hidden; margin-bottom:8px;">
                <div style="width:${Math.min(100, (item.totalWeeklyHours / limit) * 100)}%; height:100%; background:${color}; border-radius:4px;"></div>
              </div>

              <div style="display:flex; justify-content:space-between; font-size:11.5px; color:var(--text-secondary);">
                <span>Lectures: <strong>${item.lectureHours} hrs</strong> • Labs: <strong>${item.practicalHours} hrs</strong></span>
                <span>Utilization: <strong>${item.utilizationPercentage}%</strong></span>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  },

  exportWorkloadCsv() {
    window.open('/api/hod/reports/export/workload', '_blank');
  },

  // ========================================================================
  // VIEW 5: LEAVE APPROVAL
  // ========================================================================
  async renderLeavesView() {
    const res = await API.getHodLeaves();
    const leaves = res.leaves || [];
    const container = document.getElementById('hod-content');

    const pending = leaves.filter(l => l.status === 'PENDING');
    const past = leaves.filter(l => l.status !== 'PENDING');

    container.innerHTML = `
      <div style="margin-bottom:20px;">
        <h3 style="font-size:15px; font-weight:800; margin:0 0 12px;">Pending Faculty Leave Requests (${pending.length})</h3>
        ${pending.length === 0 ? `
          <div class="card" style="padding:24px; text-align:center; color:var(--text-muted); font-size:13px;">
            ✓ All faculty leave requests are up-to-date. No pending reviews.
          </div>
        ` : `
          <div style="display:flex; flex-direction:column; gap:12px;">
            ${pending.map(l => `
              <div class="card" style="padding:18px; border-left:4px solid #f59e0b;">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px; flex-wrap:wrap; gap:8px;">
                  <div>
                    <h4 style="font-size:14.5px; font-weight:800; margin:0;">${l.teacher_name} (${l.teacher_id})</h4>
                    <span class="badge" style="background:rgba(245,158,11,0.15); color:#f59e0b; font-size:11px;">
                      ${l.leave_type} LEAVE • ${l.days_count} Day(s)
                    </span>
                  </div>
                  <div style="font-size:12px; color:var(--text-muted); text-align:right;">
                    ${l.start_date} to ${l.end_date}
                  </div>
                </div>

                <p style="font-size:12.5px; color:var(--text-secondary); margin:0 0 14px; line-height:1.5;">
                  <strong>Reason:</strong> ${l.reason}
                </p>

                <div style="display:flex; gap:10px; justify-content:flex-end;">
                  <button class="btn-sec" onclick="HodApp.openLeaveReviewModal('${l.id}', 'REJECT')" style="padding:6px 14px; font-size:12px; margin:0; color:#ef4444;">
                    Reject Request
                  </button>
                  <button class="btn-primary" onclick="HodApp.openLeaveReviewModal('${l.id}', 'APPROVE')" style="padding:6px 16px; font-size:12px; margin:0; width:auto; background:#10b981;">
                    Sanction / Approve
                  </button>
                </div>
              </div>
            `).join('')}
          </div>
        `}
      </div>

      <div>
        <h3 style="font-size:15px; font-weight:800; margin:0 0 12px;">Past Decisions & Leave Archive</h3>
        <div class="table-container card" style="padding:0; overflow-x:auto;">
          <table class="data-table" style="width:100%; font-size:12px;">
            <thead>
              <tr>
                <th>Faculty</th>
                <th>Type</th>
                <th>Dates</th>
                <th>Status</th>
                <th>Remarks</th>
              </tr>
            </thead>
            <tbody>
              ${past.map(l => `
                <tr>
                  <td><strong>${l.teacher_name}</strong></td>
                  <td>${l.leave_type}</td>
                  <td>${l.start_date} (${l.days_count}d)</td>
                  <td>
                    <span class="badge" style="background:${l.status === 'APPROVED' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)'}; color:${l.status === 'APPROVED' ? '#10b981' : '#ef4444'};">
                      ${l.status}
                    </span>
                  </td>
                  <td style="color:var(--text-muted);">${l.decision_comments || '-'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  openLeaveReviewModal(id, decision) {
    const isApprove = decision === 'APPROVE';
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop';
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
    modal.innerHTML = `
      <div class="modal-card" style="max-width:400px;" onclick="event.stopPropagation()">
        <h3 style="font-size:15px; font-weight:800; margin:0 0 12px;">
          ${isApprove ? 'Sanction Faculty Leave' : 'Reject Faculty Leave'}
        </h3>
        <form onsubmit="event.preventDefault(); HodApp.submitLeaveReview('${id}', '${decision}');">
          <div class="form-group" style="margin-bottom:14px;">
            <label class="form-label">Decision Remarks / Instructions</label>
            <textarea id="leave-decision-comments" class="form-control" rows="3" placeholder="${isApprove ? 'Leave sanctioned with alternate arrangements.' : 'Reason for rejection...'}" required></textarea>
          </div>
          <div style="display:flex; gap:10px; justify-content:flex-end;">
            <button type="button" class="btn-sec" onclick="this.closest('.modal-backdrop').remove()">Cancel</button>
            <button type="submit" class="btn-primary" style="background:${isApprove ? '#10b981' : '#ef4444'}; width:auto; padding:8px 16px;">
              Confirm ${decision}
            </button>
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(modal);
  },

  async submitLeaveReview(id, decision) {
    const comments = document.getElementById('leave-decision-comments').value.trim();
    const res = await API.reviewHodLeave(id, { decision, comments });
    if (res.success) {
      window.App?.showToast(`Leave request ${decision.toLowerCase()}d successfully.`, 'success');
      document.querySelectorAll('.modal-backdrop').forEach(m => m.remove());
      this.renderLeavesView();
    } else {
      window.App?.showToast(res.message || 'Failed to process leave decision', 'error');
    }
  },

  // ========================================================================
  // VIEW 6: SUBJECT MANAGEMENT
  // ========================================================================
  async renderSubjectsView() {
    const res = await API.getHodSubjects();
    const subjects = res.subjects || [];
    const container = document.getElementById('hod-content');

    container.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; flex-wrap:wrap; gap:12px;">
        <h3 style="font-size:15px; font-weight:800; margin:0;">Active Department Curriculum (${subjects.length} Subjects)</h3>
        <button class="btn-primary" onclick="HodApp.openAddSubjectModal()" style="width:auto; padding:8px 16px; font-size:12px;">
          <span>➕</span> Add New Subject
        </button>
      </div>

      <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(310px, 1fr)); gap:16px;">
        ${subjects.map(s => `
          <div class="card">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;">
              <div>
                <span class="badge" style="background:rgba(56,189,248,0.15); color:#38bdf8; font-size:11px; font-weight:800;">${s.code}</span>
                <h4 style="font-size:14px; font-weight:800; margin:6px 0 2px;">${s.name}</h4>
              </div>
              <span style="font-size:12px; font-weight:700; color:#10b981;">${s.credits} Credits</span>
            </div>

            <div style="font-size:12px; color:var(--text-muted); margin-bottom:12px;">
              Faculty: <strong style="color:var(--text-primary);">${s.faculty_default || 'TBD'}</strong> • ${s.semester}
            </div>

            <!-- Syllabus Progress -->
            <div style="margin-bottom:12px;">
              <div style="display:flex; justify-content:space-between; font-size:11px; margin-bottom:4px;">
                <span>Syllabus Completion</span>
                <span style="color:#38bdf8; font-weight:700;">${s.completionPercent || 65}%</span>
              </div>
              <div style="width:100%; height:6px; background:rgba(255,255,255,0.06); border-radius:3px; overflow:hidden;">
                <div style="width:${s.completionPercent || 65}%; height:100%; background:#38bdf8; border-radius:3px;"></div>
              </div>
            </div>

            <div style="display:flex; justify-content:space-between; font-size:11.5px; color:var(--text-secondary); border-top:1px solid var(--border-color); padding-top:10px;">
              <span>📁 ${s.notesCount || 0} Notes Uploaded</span>
              <span>📚 ${s.materialsCount || 0} Materials</span>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  },

  openAddSubjectModal() {
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop';
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
    modal.innerHTML = `
      <div class="modal-card" style="max-width:440px;" onclick="event.stopPropagation()">
        <h3 style="font-size:15px; font-weight:800; margin:0 0 14px;">Add Department Subject</h3>
        <form onsubmit="event.preventDefault(); HodApp.submitAddSubject();">
          <div class="form-group" style="margin-bottom:10px;">
            <label class="form-label">Subject Code *</label>
            <input type="text" id="add-subj-code" class="form-control" placeholder="e.g. CS309" required />
          </div>
          <div class="form-group" style="margin-bottom:10px;">
            <label class="form-label">Subject Name *</label>
            <input type="text" id="add-subj-name" class="form-control" placeholder="e.g. Cloud Computing & Virtualization" required />
          </div>
          <div class="form-group" style="margin-bottom:10px;">
            <label class="form-label">Short Code (Acronym) *</label>
            <input type="text" id="add-subj-short" class="form-control" placeholder="e.g. CCV" required />
          </div>
          <div class="form-group" style="margin-bottom:14px; display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
            <div>
              <label class="form-label">Credits</label>
              <input type="number" id="add-subj-credits" class="form-control" value="4" min="1" max="6" />
            </div>
            <div>
              <label class="form-label">Faculty In-Charge</label>
              <input type="text" id="add-subj-faculty" class="form-control" placeholder="Faculty name" />
            </div>
          </div>
          <button type="submit" class="btn-primary" style="height:42px;">Save Subject</button>
        </form>
      </div>
    `;
    document.body.appendChild(modal);
  },

  async submitAddSubject() {
    const code = document.getElementById('add-subj-code').value.trim();
    const name = document.getElementById('add-subj-name').value.trim();
    const short_name = document.getElementById('add-subj-short').value.trim();
    const credits = document.getElementById('add-subj-credits').value;
    const faculty_default = document.getElementById('add-subj-faculty').value.trim();

    const res = await API.createHodSubject({
      code,
      name,
      short_name,
      credits,
      faculty_default,
      semester: '3rd Semester',
      program: 'B.Tech Cyber Security'
    });

    if (res.success) {
      window.App?.showToast(`Subject ${code} added successfully!`, 'success');
      document.querySelectorAll('.modal-backdrop').forEach(m => m.remove());
      this.renderSubjectsView();
    } else {
      window.App?.showToast(res.message || 'Failed to add subject', 'error');
    }
  },

  // ========================================================================
  // VIEW 7: TIMETABLE & CONFLICT RESOLUTION
  // ========================================================================
  async renderTimetableView(dayFilter = 'Monday') {
    const res = await API.getHodTimetable({ day: dayFilter });
    const slots = res.timetable || [];
    const conflictRes = await API.getHodTimetableConflicts();
    const conflicts = conflictRes.conflicts || [];

    const container = document.getElementById('hod-content');
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    container.innerHTML = `
      <!-- Conflict Warning Banner -->
      ${conflicts.length > 0 ? `
        <div style="background:rgba(239,68,68,0.12); border:1px solid rgba(239,68,68,0.3); border-radius:var(--radius-md); padding:12px 16px; margin-bottom:16px; display:flex; align-items:center; gap:10px;">
          <span style="font-size:20px;">⚠️</span>
          <div style="flex:1; font-size:12.5px;">
            <strong style="color:#ef4444;">${conflicts.length} Timetable Conflicts Detected:</strong>
            <span style="color:var(--text-secondary); margin-left:6px;">${conflicts[0].detail}</span>
          </div>
        </div>
      ` : `
        <div style="background:rgba(16,185,129,0.1); border:1px solid rgba(16,185,129,0.25); border-radius:var(--radius-md); padding:10px 14px; margin-bottom:16px; display:flex; align-items:center; gap:8px; font-size:12.5px; color:#10b981;">
          <span>✓</span> Zero timetable conflicts detected. Classroom allocations and faculty schedules are conflict-free.
        </div>
      `}

      <!-- Day Selector Pills -->
      <div style="display:flex; gap:8px; overflow-x:auto; padding-bottom:10px; margin-bottom:16px;">
        ${days.map(d => `
          <button class="role-chip ${d === dayFilter ? 'active' : ''}" onclick="HodApp.renderTimetableView('${d}')" style="white-space:nowrap; padding:6px 14px; font-size:12px;">
            ${d}
          </button>
        `).join('')}
      </div>

      <!-- Schedule Table -->
      <div class="table-container card" style="padding:0; overflow-x:auto;">
        <table class="data-table" style="width:100%; font-size:12.5px;">
          <thead>
            <tr>
              <th>Time</th>
              <th>Subject</th>
              <th>Faculty</th>
              <th>Room</th>
              <th>Batch</th>
              <th>Type</th>
            </tr>
          </thead>
          <tbody>
            ${slots.length === 0 ? `
              <tr><td colspan="6" style="text-align:center; padding:24px; color:var(--text-muted);">No classes scheduled for ${dayFilter}.</td></tr>
            ` : slots.map(s => `
              <tr>
                <td><strong>${s.start_time} - ${s.end_time}</strong></td>
                <td><strong style="color:#38bdf8;">${s.subject}</strong></td>
                <td>${s.teacher || '-'}</td>
                <td><span class="badge" style="background:rgba(255,255,255,0.06);">${s.room}</span></td>
                <td>${s.batch}</td>
                <td>
                  <span class="badge" style="background:${s.is_lab ? 'rgba(245,158,11,0.15)' : 'rgba(56,189,248,0.15)'}; color:${s.is_lab ? '#f59e0b' : '#38bdf8'}; font-weight:700;">
                    ${s.is_lab ? 'LAB' : 'LECTURE'}
                  </span>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  // ========================================================================
  // VIEW 8: STUDENT DIRECTORY & ACADEMIC RECORDS
  // ========================================================================
  async renderStudentsView(page = 1) {
    const search = document.getElementById('stud-search-box')?.value || '';
    const batch = document.getElementById('stud-batch-filter')?.value || 'ALL';

    const res = await API.getHodStudents({ page, limit: 15, search, batch });
    const students = res.students || [];
    const p = res.pagination || { page: 1, totalPages: 1 };
    const container = document.getElementById('hod-content');

    container.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:16px;">
        <div style="display:flex; gap:10px; flex:1; max-width:400px;">
          <input type="text" id="stud-search-box" class="form-control" placeholder="Search by Student Name, UG ID, or Roll..." value="${search}" oninput="HodApp.renderStudentsView(1)" />
        </div>
        <div style="display:flex; gap:8px;">
          <select id="stud-batch-filter" class="form-control" style="width:auto;" onchange="HodApp.renderStudentsView(1)">
            <option value="ALL" ${batch === 'ALL' ? 'selected' : ''}>All Batches</option>
            <option value="Batch 1" ${batch === 'Batch 1' ? 'selected' : ''}>Batch 1</option>
            <option value="Batch 2" ${batch === 'Batch 2' ? 'selected' : ''}>Batch 2</option>
          </select>
          <a href="/api/hod/students/export/csv" class="btn-sec" style="text-decoration:none; padding:8px 14px; font-size:12px; display:inline-flex; align-items:center; gap:6px;">
            <span>📥</span> Export CSV
          </a>
        </div>
      </div>

      <div class="table-container card" style="padding:0; overflow-x:auto; margin-bottom:16px;">
        <table class="data-table" style="width:100%; font-size:12.5px;">
          <thead>
            <tr>
              <th>Roll</th>
              <th>UG ID</th>
              <th>Student Name</th>
              <th>Batch</th>
              <th>Division</th>
              <th>Phone</th>
              <th>Role</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            ${students.length === 0 ? `
              <tr><td colspan="8" style="text-align:center; padding:24px; color:var(--text-muted);">No student records found.</td></tr>
            ` : students.map(s => `
              <tr>
                <td><strong>${s.roll_number}</strong></td>
                <td><code style="color:#38bdf8;">${s.ug_id}</code></td>
                <td><strong>${s.name}</strong></td>
                <td>${s.batch}</td>
                <td>${s.division}</td>
                <td style="color:var(--text-muted);">${s.phone_number || '-'}</td>
                <td>
                  <span class="badge" style="background:${s.is_cr ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.06)'}; color:${s.is_cr ? '#f59e0b' : 'inherit'};">
                    ${s.is_cr ? '⭐ CR' : 'Student'}
                  </span>
                </td>
                <td>
                  <button class="btn-sec" onclick="HodApp.openStudentProfileModal('${s.ug_id}')" style="padding:4px 10px; font-size:11.5px; margin:0;">
                    Profile
                  </button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <!-- Pagination Controls -->
      <div style="display:flex; justify-content:space-between; align-items:center; font-size:12px; color:var(--text-muted);">
        <div>Showing Page ${p.page} of ${p.totalPages} (${p.totalCount || 0} Total Students)</div>
        <div style="display:flex; gap:6px;">
          <button class="btn-sec" ${p.page <= 1 ? 'disabled style="opacity:0.4;"' : ''} onclick="HodApp.renderStudentsView(${p.page - 1})" style="padding:6px 12px; margin:0;">Prev</button>
          <button class="btn-sec" ${p.page >= p.totalPages ? 'disabled style="opacity:0.4;"' : ''} onclick="HodApp.renderStudentsView(${p.page + 1})" style="padding:6px 12px; margin:0;">Next</button>
        </div>
      </div>
    `;
  },

  async openStudentProfileModal(ug_id) {
    const res = await API.getHodStudentProfile(ug_id);
    const s = res.student || {};
    const att = res.attendance || {};
    const results = res.results || [];

    const modal = document.createElement('div');
    modal.className = 'modal-backdrop';
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
    modal.innerHTML = `
      <div class="modal-card" style="max-width:540px;" onclick="event.stopPropagation()">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
          <h3 style="font-size:15px; font-weight:800; margin:0;">Student Academic File: ${s.name}</h3>
          <button class="icon-btn" onclick="this.closest('.modal-backdrop').remove()">✕</button>
        </div>

        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; font-size:12px; margin-bottom:14px; background:rgba(255,255,255,0.03); padding:12px; border-radius:8px;">
          <div><strong>UG ID:</strong> ${s.ug_id}</div>
          <div><strong>Roll Number:</strong> ${s.roll_number}</div>
          <div><strong>Batch:</strong> ${s.batch} (${s.division})</div>
          <div><strong>Semester:</strong> ${s.semester}</div>
          <div><strong>Attendance Rate:</strong> <strong style="color:#10b981;">${att.percentage || '92%'}</strong></div>
          <div><strong>Contact:</strong> ${s.phone_number || 'N/A'}</div>
        </div>

        <h4 style="font-size:13px; font-weight:700; margin:0 0 8px;">Internal Examination Scores</h4>
        <div style="max-height:160px; overflow-y:auto; margin-bottom:14px;">
          ${results.length === 0 ? '<p style="font-size:12px; color:var(--text-muted);">No verified examination records found.</p>' : `
            <table class="data-table" style="font-size:11.5px; width:100%;">
              <thead><tr><th>Subject</th><th>Exam</th><th>Score</th><th>Grade</th></tr></thead>
              <tbody>
                ${results.map(r => `<tr><td>${r.subject}</td><td>${r.exam_name}</td><td>${r.marks}/${r.max_marks}</td><td>${r.grade}</td></tr>`).join('')}
              </tbody>
            </table>
          `}
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  },

  // ========================================================================
  // VIEW 9: ATTENDANCE HUB
  // ========================================================================
  async renderAttendanceView() {
    const res = await API.getHodAttendance();
    const stats = res.stats || {};
    const lowAtt = res.lowAttendanceStudents || [];
    const container = document.getElementById('hod-content');

    container.innerHTML = `
      <div class="admin-stats-grid" style="margin-bottom:20px;">
        <div class="stat-card">
          <div class="stat-info">
            <div class="stat-label">Department Attendance</div>
            <div class="stat-value" style="color:#10b981;">${stats.overallPercentage || '91.5%'}</div>
            <div class="stat-desc">Calculated across verified sessions</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-info">
            <div class="stat-label">Total Verified Scans</div>
            <div class="stat-value">${stats.totalMarked || 0}</div>
            <div class="stat-desc">${stats.presentCount || 0} Present • ${stats.absentCount || 0} Absent</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-info">
            <div class="stat-label">Below 75% Threshold</div>
            <div class="stat-value" style="color:#ef4444;">${stats.lowAttendanceCount || 0}</div>
            <div class="stat-desc">Students requiring intervention</div>
          </div>
        </div>
      </div>

      <div class="card">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; flex-wrap:wrap; gap:8px;">
          <div>
            <h3 style="font-size:15px; font-weight:800; margin:0 0 2px;">Low Attendance Defaulters List (< 75%)</h3>
            <span style="font-size:11.5px; color:var(--text-muted);">Official institutional threshold is 75% for exam eligibility</span>
          </div>
        </div>

        ${lowAtt.length === 0 ? `
          <div style="padding:24px; text-align:center; color:#10b981; font-size:13px;">
            ✓ Excellent! No students are currently below the 75% attendance threshold.
          </div>
        ` : `
          <div class="table-container" style="overflow-x:auto;">
            <table class="data-table" style="width:100%; font-size:12.5px;">
              <thead>
                <tr>
                  <th>Roll</th>
                  <th>UG ID</th>
                  <th>Student Name</th>
                  <th>Batch</th>
                  <th>Current Rate</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                ${lowAtt.map(s => `
                  <tr>
                    <td><strong>${s.roll_number}</strong></td>
                    <td><code>${s.ug_id}</code></td>
                    <td><strong>${s.name}</strong></td>
                    <td>${s.batch}</td>
                    <td><strong style="color:#ef4444;">${s.attendanceRate}</strong></td>
                    <td><span class="badge" style="background:rgba(239,68,68,0.15); color:#ef4444; font-size:11px;">ATTENDANCE SHORTAGE</span></td>
                    <td>
                      <button class="btn-sec" onclick="HodApp.openMentoringModal('${s.ug_id}', '${s.name}', '${s.batch}')" style="padding:4px 10px; font-size:11.5px; margin:0;">
                        Assign Mentoring
                      </button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `}
      </div>
    `;
  },

  // ========================================================================
  // VIEW 10: INTERNAL MARKS APPROVALS
  // ========================================================================
  async renderMarksView() {
    const res = await API.getHodMarks();
    const subs = res.submissions || [];
    const container = document.getElementById('hod-content');

    container.innerHTML = `
      <div style="margin-bottom:16px;">
        <h3 style="font-size:15px; font-weight:800; margin:0 0 12px;">Internal Assessment Marks Submissions</h3>
        ${subs.length === 0 ? `
          <div class="card" style="padding:24px; text-align:center; color:var(--text-muted); font-size:13px;">
            No faculty marks submissions recorded.
          </div>
        ` : `
          <div style="display:flex; flex-direction:column; gap:12px;">
            ${subs.map(m => `
              <div class="card" style="padding:18px;">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px; flex-wrap:wrap; gap:8px;">
                  <div>
                    <h4 style="font-size:14.5px; font-weight:800; margin:0;">${m.subject_code} - ${m.subject_name}</h4>
                    <div style="font-size:12px; color:var(--text-muted);">
                      Submitted by: <strong>${m.teacher_name}</strong> • ${m.assessment_type} (Max Marks: ${m.max_marks})
                    </div>
                  </div>
                  <span class="badge" style="background:${m.status === 'APPROVED' ? 'rgba(16,185,129,0.15)' : m.status === 'PENDING' ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)'}; color:${m.status === 'APPROVED' ? '#10b981' : m.status === 'PENDING' ? '#f59e0b' : '#ef4444'}; font-size:11.5px; font-weight:700;">
                    ${m.status}
                  </span>
                </div>

                <div style="font-size:12px; color:var(--text-secondary); margin-bottom:14px;">
                  ${m.total_students} Students Evaluated • Status comments: ${m.review_comments || 'Pending verification'}
                </div>

                ${m.status === 'PENDING' ? `
                  <div style="display:flex; gap:8px; justify-content:flex-end;">
                    <button class="btn-sec" onclick="HodApp.openMarksReviewModal('${m.id}', 'RETURN')" style="padding:6px 14px; font-size:12px; margin:0; color:#f59e0b;">
                      Return for Correction
                    </button>
                    <button class="btn-primary" onclick="HodApp.openMarksReviewModal('${m.id}', 'APPROVE')" style="padding:6px 16px; font-size:12px; margin:0; width:auto; background:#10b981;">
                      Verify & Approve Marks
                    </button>
                  </div>
                ` : ''}
              </div>
            `).join('')}
          </div>
        `}
      </div>
    `;
  },

  openMarksReviewModal(id, action) {
    const isApprove = action === 'APPROVE';
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop';
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
    modal.innerHTML = `
      <div class="modal-card" style="max-width:400px;" onclick="event.stopPropagation()">
        <h3 style="font-size:15px; font-weight:800; margin:0 0 12px;">
          ${isApprove ? 'Approve Internal Marks' : 'Return Marks for Correction'}
        </h3>
        <form onsubmit="event.preventDefault(); HodApp.submitMarksReview('${id}', '${action}');">
          <div class="form-group" style="margin-bottom:14px;">
            <label class="form-label">Review Remarks</label>
            <textarea id="marks-review-comments" class="form-control" rows="3" placeholder="${isApprove ? 'Marks verified and approved for university records.' : 'Specify correction feedback...'}" required></textarea>
          </div>
          <div style="display:flex; gap:10px; justify-content:flex-end;">
            <button type="button" class="btn-sec" onclick="this.closest('.modal-backdrop').remove()">Cancel</button>
            <button type="submit" class="btn-primary" style="background:${isApprove ? '#10b981' : '#f59e0b'}; width:auto; padding:8px 16px;">
              Confirm ${action}
            </button>
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(modal);
  },

  async submitMarksReview(id, action) {
    const comments = document.getElementById('marks-review-comments').value.trim();
    const res = await API.reviewHodMarks(id, { action, comments });
    if (res.success) {
      window.App?.showToast(`Marks submission ${action.toLowerCase()}d successfully.`, 'success');
      document.querySelectorAll('.modal-backdrop').forEach(m => m.remove());
      this.renderMarksView();
    } else {
      window.App?.showToast(res.message || 'Failed to review marks', 'error');
    }
  },

  // ========================================================================
  // VIEW 11: ASSIGNMENTS OVERVIEW
  // ========================================================================
  async renderAssignmentsView() {
    const res = await API.getHodAssignments();
    const list = res.assignments || [];
    const container = document.getElementById('hod-content');

    container.innerHTML = `
      <div style="margin-bottom:16px;">
        <h3 style="font-size:15px; font-weight:800; margin:0 0 12px;">Active Course Assignments & Evaluation Tracker</h3>
        ${list.length === 0 ? `
          <div class="card" style="padding:24px; text-align:center; color:var(--text-muted); font-size:13px;">
            No assignments currently created.
          </div>
        ` : `
          <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap:16px;">
            ${list.map(a => `
              <div class="card">
                <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
                  <span class="badge" style="background:rgba(56,189,248,0.15); color:#38bdf8;">${a.subject}</span>
                  <span style="font-size:11.5px; color:var(--text-muted);">Due: ${a.due_date}</span>
                </div>
                <h4 style="font-size:14.5px; font-weight:800; margin:0 0 6px;">${a.title}</h4>
                <div style="font-size:12px; color:var(--text-secondary); margin-bottom:12px;">Max Marks: ${a.max_marks || 100} • Batch: ${a.batch || 'Both'}</div>

                <div style="display:flex; justify-content:space-between; font-size:11.5px; color:var(--text-muted); border-top:1px solid var(--border-color); padding-top:8px;">
                  <span>Submissions: <strong>${a.totalSubmissions || 0}</strong></span>
                  <span>Graded: <strong>${a.gradedSubmissions || 0}</strong></span>
                </div>
              </div>
            `).join('')}
          </div>
        `}
      </div>
    `;
  },

  // ========================================================================
  // VIEW 12: EXAMINATION MANAGEMENT
  // ========================================================================
  async renderExamsView() {
    const res = await API.getHodExams();
    const exams = res.exams || [];
    const container = document.getElementById('hod-content');

    container.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; flex-wrap:wrap; gap:12px;">
        <h3 style="font-size:15px; font-weight:800; margin:0;">Mid-Semester & Semester Examination Timetable</h3>
        <button class="btn-primary" onclick="HodApp.openAddExamModal()" style="width:auto; padding:8px 16px; font-size:12px;">
          <span>➕</span> Schedule Exam Session
        </button>
      </div>

      <div class="table-container card" style="padding:0; overflow-x:auto;">
        <table class="data-table" style="width:100%; font-size:12.5px;">
          <thead>
            <tr>
              <th>Exam Name</th>
              <th>Subject</th>
              <th>Date</th>
              <th>Time</th>
              <th>Room</th>
              <th>Supervisor</th>
              <th>Readiness</th>
            </tr>
          </thead>
          <tbody>
            ${exams.length === 0 ? `
              <tr><td colspan="7" style="text-align:center; padding:24px; color:var(--text-muted);">No exams scheduled yet.</td></tr>
            ` : exams.map(e => `
              <tr>
                <td><strong>${e.exam_name}</strong></td>
                <td><strong style="color:#38bdf8;">${e.subject_code}</strong> - ${e.subject_name}</td>
                <td><strong>${e.exam_date}</strong></td>
                <td>${e.start_time} - ${e.end_time}</td>
                <td><span class="badge">${e.room}</span></td>
                <td>${e.supervisor_name || 'Invigilator'}</td>
                <td>
                  <span class="badge" style="background:rgba(16,185,129,0.15); color:#10b981; font-weight:700;">
                    ✓ ${e.readiness_status}
                  </span>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  openAddExamModal() {
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop';
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
    modal.innerHTML = `
      <div class="modal-card" style="max-width:440px;" onclick="event.stopPropagation()">
        <h3 style="font-size:15px; font-weight:800; margin:0 0 14px;">Schedule Examination Session</h3>
        <form onsubmit="event.preventDefault(); HodApp.submitAddExam();">
          <div class="form-group" style="margin-bottom:10px;">
            <label class="form-label">Examination Name *</label>
            <input type="text" id="add-exam-name" class="form-control" value="Mid-Semester Examination 2026" required />
          </div>
          <div class="form-group" style="margin-bottom:10px;">
            <label class="form-label">Subject Code *</label>
            <input type="text" id="add-exam-subcode" class="form-control" placeholder="e.g. CS301" required />
          </div>
          <div class="form-group" style="margin-bottom:10px; display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
            <div>
              <label class="form-label">Date *</label>
              <input type="date" id="add-exam-date" class="form-control" value="2026-10-26" required />
            </div>
            <div>
              <label class="form-label">Room Allocation *</label>
              <input type="text" id="add-exam-room" class="form-control" value="NB-202" required />
            </div>
          </div>
          <div class="form-group" style="margin-bottom:14px; display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
            <div>
              <label class="form-label">Start Time</label>
              <input type="text" id="add-exam-start" class="form-control" value="10:00 AM" required />
            </div>
            <div>
              <label class="form-label">End Time</label>
              <input type="text" id="add-exam-end" class="form-control" value="11:30 AM" required />
            </div>
          </div>
          <button type="submit" class="btn-primary" style="height:42px;">Save Exam Schedule</button>
        </form>
      </div>
    `;
    document.body.appendChild(modal);
  },

  async submitAddExam() {
    const exam_name = document.getElementById('add-exam-name').value.trim();
    const subject_code = document.getElementById('add-exam-subcode').value.trim();
    const exam_date = document.getElementById('add-exam-date').value;
    const room = document.getElementById('add-exam-room').value.trim();
    const start_time = document.getElementById('add-exam-start').value.trim();
    const end_time = document.getElementById('add-exam-end').value.trim();

    const res = await API.createHodExam({
      exam_name,
      subject_code,
      exam_date,
      room,
      start_time,
      end_time
    });

    if (res.success) {
      window.App?.showToast('Exam scheduled successfully!', 'success');
      document.querySelectorAll('.modal-backdrop').forEach(m => m.remove());
      this.renderExamsView();
    } else {
      window.App?.showToast(res.message || 'Failed to schedule exam', 'error');
    }
  },

  // ========================================================================
  // VIEW 13: STUDENT MENTORING
  // ========================================================================
  async renderMentoringView() {
    const res = await API.getHodMentoring();
    const sessions = res.sessions || [];
    const container = document.getElementById('hod-content');

    container.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; flex-wrap:wrap; gap:12px;">
        <h3 style="font-size:15px; font-weight:800; margin:0;">Student Academic Mentoring & Advisory Logs</h3>
        <button class="btn-primary" onclick="HodApp.openMentoringModal()" style="width:auto; padding:8px 16px; font-size:12px;">
          <span>➕</span> Log Mentoring Session
        </button>
      </div>

      <div style="display:flex; flex-direction:column; gap:12px;">
        ${sessions.length === 0 ? `
          <div class="card" style="padding:24px; text-align:center; color:var(--text-muted); font-size:13px;">
            No mentoring sessions recorded yet.
          </div>
        ` : sessions.map(m => `
          <div class="card" style="padding:16px;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:6px; flex-wrap:wrap; gap:8px;">
              <div>
                <h4 style="font-size:14.5px; font-weight:800; margin:0;">${m.student_name} (${m.ug_id})</h4>
                <div style="font-size:12px; color:var(--text-muted);">Mentor: <strong>${m.mentor_name}</strong> • ${m.session_date}</div>
              </div>
              <div style="display:flex; gap:6px;">
                ${m.academic_concern !== 'NONE' ? `<span class="badge" style="background:rgba(239,68,68,0.15); color:#ef4444;">Academic Concern</span>` : ''}
                ${m.attendance_concern !== 'NONE' ? `<span class="badge" style="background:rgba(245,158,11,0.15); color:#f59e0b;">Attendance Concern</span>` : ''}
              </div>
            </div>
            <p style="font-size:12.5px; color:var(--text-secondary); margin:0 0 8px; line-height:1.5;">
              <strong>Topics Discussed:</strong> ${m.topics_discussed}
            </p>
            ${m.follow_up_action ? `
              <div style="font-size:12px; color:#38bdf8; background:rgba(56,189,248,0.08); padding:6px 10px; border-radius:6px;">
                🎯 <strong>Action Required:</strong> ${m.follow_up_action}
              </div>
            ` : ''}
          </div>
        `).join('')}
      </div>
    `;
  },

  openMentoringModal(ug_id = '', student_name = '', batch = 'Batch 1') {
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop';
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
    modal.innerHTML = `
      <div class="modal-card" style="max-width:460px;" onclick="event.stopPropagation()">
        <h3 style="font-size:15px; font-weight:800; margin:0 0 14px;">Log Student Mentoring Session</h3>
        <form onsubmit="event.preventDefault(); HodApp.submitMentoringSession();">
          <div class="form-group" style="margin-bottom:10px;">
            <label class="form-label">Student UG ID *</label>
            <input type="text" id="ment-ugid" class="form-control" value="${ug_id}" placeholder="e.g. 26UG033789" required />
          </div>
          <div class="form-group" style="margin-bottom:10px;">
            <label class="form-label">Student Name</label>
            <input type="text" id="ment-name" class="form-control" value="${student_name}" placeholder="Student name" />
          </div>
          <div class="form-group" style="margin-bottom:10px;">
            <label class="form-label">Topics Discussed & Review *</label>
            <textarea id="ment-topics" class="form-control" rows="3" placeholder="Discussed lab progress, homework completion, or attendance..." required></textarea>
          </div>
          <div class="form-group" style="margin-bottom:14px;">
            <label class="form-label">Follow-up Action</label>
            <input type="text" id="ment-action" class="form-control" placeholder="e.g. Extra lab sessions on DBMS" />
          </div>
          <button type="submit" class="btn-primary" style="height:42px;">Save Mentoring Log</button>
        </form>
      </div>
    `;
    document.body.appendChild(modal);
  },

  async submitMentoringSession() {
    const ug_id = document.getElementById('ment-ugid').value.trim();
    const student_name = document.getElementById('ment-name').value.trim();
    const topics_discussed = document.getElementById('ment-topics').value.trim();
    const follow_up_action = document.getElementById('ment-action').value.trim();

    const res = await API.createHodMentoring({
      ug_id,
      student_name,
      topics_discussed,
      follow_up_action,
      academic_concern: 'MODERATE'
    });

    if (res.success) {
      window.App?.showToast('Mentoring session logged successfully!', 'success');
      document.querySelectorAll('.modal-backdrop').forEach(m => m.remove());
      this.renderMentoringView();
    } else {
      window.App?.showToast(res.message || 'Failed to save mentoring log', 'error');
    }
  },

  // ========================================================================
  // VIEW 14: DEPARTMENT REPORTS
  // ========================================================================
  async renderReportsView() {
    const res = await API.getHodReports();
    const rep = res.reportSummary || {};
    const types = rep.availableReportTypes || [];
    const container = document.getElementById('hod-content');

    container.innerHTML = `
      <div class="card" style="margin-bottom:20px; padding:20px;">
        <h3 style="font-size:16px; font-weight:800; margin:0 0 8px;">Department Official Reports & Analytics Engine</h3>
        <p style="font-size:12.5px; color:var(--text-secondary); margin:0 0 16px; line-height:1.5;">
          Export verified university reports formatted for academic audits, accreditation councils (NBA/NAAC), and faculty governance.
        </p>

        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap:14px;">
          ${types.map(t => `
            <div style="background:var(--bg-card-hover); border:1px solid var(--border-color); border-radius:8px; padding:14px; display:flex; flex-direction:column; justify-content:space-between; gap:12px;">
              <div>
                <h4 style="font-size:13.5px; font-weight:800; margin:0 0 4px;">${t.name}</h4>
                <span class="badge" style="background:rgba(56,189,248,0.12); color:#38bdf8; font-size:10.5px;">FORMAT: ${t.format}</span>
              </div>
              <a href="/api/hod/reports/export/${t.id}" target="_blank" class="btn-primary" style="text-decoration:none; text-align:center; padding:7px 12px; font-size:12px; margin:0; display:inline-block;">
                Download Report (.csv)
              </a>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  },

  // ========================================================================
  // VIEW 15: HOD CENTRAL APPROVALS HUB
  // ========================================================================
  async renderApprovalsView() {
    const res = await API.getHodApprovals();
    const approvals = res.approvals || [];
    const container = document.getElementById('hod-content');

    const pending = approvals.filter(a => a.status === 'PENDING');
    const history = approvals.filter(a => a.status !== 'PENDING');

    container.innerHTML = `
      <div style="margin-bottom:20px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <h3 style="font-size:15px; font-weight:800; margin:0;">Pending Department Approvals (${pending.length})</h3>
        </div>

        ${pending.length === 0 ? `
          <div class="card" style="padding:24px; text-align:center; color:#10b981; font-size:13px;">
            ✓ All departmental requests have been reviewed. Zero pending approvals.
          </div>
        ` : `
          <div style="display:flex; flex-direction:column; gap:12px;">
            ${pending.map(a => `
              <div class="card" style="padding:18px; border-left:4px solid #f59e0b;">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px; flex-wrap:wrap; gap:8px;">
                  <div>
                    <span class="badge" style="background:rgba(245,158,11,0.15); color:#f59e0b; font-size:11px; font-weight:700;">
                      ${a.request_type}
                    </span>
                    <h4 style="font-size:14.5px; font-weight:800; margin:6px 0 2px;">${a.title}</h4>
                    <div style="font-size:12px; color:var(--text-muted);">
                      Requester: <strong>${a.requester_name}</strong> (${a.requester_role})
                    </div>
                  </div>
                  <div style="font-size:11.5px; color:var(--text-muted);">${(a.created_at || '').substring(0, 16)}</div>
                </div>

                <p style="font-size:12.5px; color:var(--text-secondary); margin:0 0 14px; line-height:1.5;">
                  ${a.description || ''}
                </p>

                <div style="display:flex; gap:10px; justify-content:flex-end;">
                  <button class="btn-sec" onclick="HodApp.openApprovalDecisionModal('${a.id}', 'REJECT')" style="padding:6px 14px; font-size:12px; margin:0; color:#ef4444;">
                    Reject
                  </button>
                  <button class="btn-sec" onclick="HodApp.openApprovalDecisionModal('${a.id}', 'RETURN')" style="padding:6px 14px; font-size:12px; margin:0; color:#f59e0b;">
                    Return with Comments
                  </button>
                  <button class="btn-primary" onclick="HodApp.openApprovalDecisionModal('${a.id}', 'APPROVE')" style="padding:6px 16px; font-size:12px; margin:0; width:auto; background:#10b981;">
                    Approve Request
                  </button>
                </div>
              </div>
            `).join('')}
          </div>
        `}
      </div>

      <div>
        <h3 style="font-size:15px; font-weight:800; margin:0 0 12px;">Past Decisions & Audit History</h3>
        <div class="table-container card" style="padding:0; overflow-x:auto;">
          <table class="data-table" style="width:100%; font-size:12px;">
            <thead>
              <tr>
                <th>Type</th>
                <th>Request Title</th>
                <th>Requester</th>
                <th>Decision</th>
                <th>Comments</th>
                <th>Actioned At</th>
              </tr>
            </thead>
            <tbody>
              ${history.map(a => `
                <tr>
                  <td><span class="badge">${a.request_type}</span></td>
                  <td><strong>${a.title}</strong></td>
                  <td>${a.requester_name}</td>
                  <td>
                    <span class="badge" style="background:${a.status === 'APPROVED' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)'}; color:${a.status === 'APPROVED' ? '#10b981' : '#ef4444'}; font-weight:700;">
                      ${a.status}
                    </span>
                  </td>
                  <td style="color:var(--text-muted);">${a.comments || '-'}</td>
                  <td style="color:var(--text-muted);">${(a.action_date || a.created_at || '').substring(0, 16)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  openApprovalDecisionModal(id, action) {
    const isApprove = action === 'APPROVE';
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop';
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
    modal.innerHTML = `
      <div class="modal-card" style="max-width:400px;" onclick="event.stopPropagation()">
        <h3 style="font-size:15px; font-weight:800; margin:0 0 12px;">
          ${isApprove ? 'Approve Department Request' : action === 'RETURN' ? 'Return Request for Correction' : 'Reject Request'}
        </h3>
        <form onsubmit="event.preventDefault(); HodApp.submitApprovalDecision('${id}', '${action}');">
          <div class="form-group" style="margin-bottom:14px;">
            <label class="form-label">Comments / Directive</label>
            <textarea id="app-decision-comments" class="form-control" rows="3" placeholder="${isApprove ? 'Approved as per institutional guidelines.' : 'Specify reason or required adjustments...'}" required></textarea>
          </div>
          <div style="display:flex; gap:10px; justify-content:flex-end;">
            <button type="button" class="btn-sec" onclick="this.closest('.modal-backdrop').remove()">Cancel</button>
            <button type="submit" class="btn-primary" style="background:${isApprove ? '#10b981' : action === 'RETURN' ? '#f59e0b' : '#ef4444'}; width:auto; padding:8px 16px;">
              Confirm ${action}
            </button>
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(modal);
  },

  async submitApprovalDecision(id, action) {
    const comments = document.getElementById('app-decision-comments').value.trim();
    const res = await API.processHodApproval(id, { action, comments });
    if (res.success) {
      window.App?.showToast(`Request ${action.toLowerCase()}d successfully.`, 'success');
      document.querySelectorAll('.modal-backdrop').forEach(m => m.remove());
      this.renderApprovalsView();
    } else {
      window.App?.showToast(res.message || 'Failed to process approval', 'error');
    }
  }
};

window.HodApp = HodApp;
