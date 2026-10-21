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
  pendingLeavesCount: 0,
  refreshTimer: null,

  async init(user, forceSection = null) {
    this.currentUser = user || API.getUser();
    this.sectionHistory = ['dashboard'];

    // Instantly sync latest profile from backend without letting dept.name overwrite user.name
    try {
      const profRes = await API.getHodProfile();
      if (profRes && profRes.success && profRes.profile) {
        const p = profRes.profile;
        const headName = p.head_name || p.headOfDept || (this.currentUser?.name && !this.currentUser.name.includes('Engineering') ? this.currentUser.name : 'Prof. (Dr.) A. K. Sharma');
        const deptName = p.department || p.dept_name || (p.name && p.name.includes('Engineering') ? p.name : 'Computer Science & Engineering');
        this.currentUser = {
          ...this.currentUser,
          ...p,
          name: headName,
          head_name: headName,
          department: deptName
        };
        API.setUser(this.currentUser);
      }
    } catch (e) {}

    let initialSection = 'dashboard';
    if (forceSection) {
      initialSection = forceSection;
    } else {
      const hash = window.location.hash.replace('#hod-', '').replace('#', '').trim();
      const validSections = [
        'dashboard', 'profile', 'faculty', 'students', 'id-cards', 'subjects',
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
    await this.refreshPendingCounters();
    await this.switchSection(initialSection, null, false);
    this.initRealtimeSync();
  },

  // Layout with responsive sidebar, topbar, mobile drawer, and main content area
  renderLayout() {
    const root = document.getElementById('app-root');
    const user = this.currentUser || {};
    const name = user.head_name || (user.name && !user.name.includes('Engineering') ? user.name : 'Prof. (Dr.) A. K. Sharma');
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
            <button class="sidebar-item ${this.currentSection === 'id-cards' ? 'active' : ''}" data-section="id-cards" onclick="HodApp.switchSection('id-cards', event)">
              <span style="font-size:15px; width:22px; text-align:center; flex-shrink:0;">🪪</span>
              <span style="font-size:12.5px; font-weight:600;">Student ID Cards</span>
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
            <button class="sidebar-item ${this.currentSection === 'leaves' ? 'active' : ''}" data-section="leaves" onclick="HodApp.switchSection('leaves', event)" style="position:relative; display:flex; align-items:center; width:100%;">
              <span style="font-size:15px; width:22px; text-align:center; flex-shrink:0;">✉️</span>
              <span style="flex:1; font-size:12.5px; font-weight:600; text-align:left;">Leave Approvals</span>
              <span id="hod-nav-leaves-badge" class="badge" style="background:#f59e0b; color:#fff; font-size:10px; padding:2px 6px; border-radius:10px; margin-left:auto; display:${this.pendingLeavesCount > 0 ? 'inline-block' : 'none'};">
                ${this.pendingLeavesCount || 0}
              </span>
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
                ${this.pendingApprovalsCount || 0}
              </span>
            </button>
          </div>

          <!-- Sidebar Footer Controls -->
          <div class="sidebar-footer" style="padding:12px 16px; border-top:1px solid var(--border-color); display:flex; align-items:center; justify-content:space-between;">
            <button class="btn-sec" onclick="HodApp.toggleTheme()" style="padding:6px 10px; font-size:11.5px; display:inline-flex; align-items:center; gap:5px; border-radius:8px;">
              <span>🌓</span> <span>Theme</span>
            </button>
            <button class="btn-sec" onclick="HodApp.logout()" style="padding:6px 10px; font-size:11.5px; color:#ef4444; border-color:rgba(239,68,68,0.3); display:inline-flex; align-items:center; gap:5px; border-radius:8px; cursor:pointer;" title="Logout from HOD Portal">
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
            <div style="display:flex; align-items:center; gap:8px;">
              <span class="server-status-pill" style="font-size:11.5px; padding:4px 10px; display:inline-flex; align-items:center; gap:6px;">
                <span>🏛️</span> <span class="hide-mobile">CSE Department Active</span>
              </span>

              <button class="icon-btn" onclick="HodApp.switchSection('approvals')" style="position:relative; width:36px; height:36px; border-radius:10px; background:rgba(255,255,255,0.06); border:1px solid var(--border-color); cursor:pointer; display:inline-flex; align-items:center; justify-content:center;" title="View Pending Approvals">
                <span>⚡</span>
                <span id="hod-top-pending-badge" style="position:absolute; top:-4px; right:-4px; background:#ef4444; color:#fff; font-size:10px; font-weight:800; width:18px; height:18px; border-radius:50%; display:${this.pendingApprovalsCount > 0 ? 'flex' : 'none'}; align-items:center; justify-content:center; border:2px solid var(--bg-main);">
                  ${this.pendingApprovalsCount || 0}
                </span>
              </button>

              <button class="btn-sec hide-mobile" onclick="HodApp.switchSection('profile')" style="padding:6px 12px; font-size:12px; display:inline-flex; align-items:center; gap:6px; border-radius:8px;">
                <span>👤</span> <span>Profile</span>
              </button>

              <button class="btn-sec" onclick="HodApp.logout()" style="padding:6px 11px; font-size:12px; color:#ef4444; border-color:rgba(239,68,68,0.35); background:rgba(239,68,68,0.08); display:inline-flex; align-items:center; gap:5px; border-radius:8px; cursor:pointer;" title="Logout from HOD Portal">
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

    // Update Topbar Title & Breadcrumb Subtitle
    const titleEl = document.getElementById('hod-page-title');
    const breadcrumbEl = document.getElementById('hod-page-breadcrumb');
    const titles = {
      'dashboard': {
        title: 'Department Dashboard',
        subtitle: 'Overview • Division 3CYBER7 • Academic Year 2026-27'
      },
      'profile': {
        title: 'Department Profile & Governance',
        subtitle: 'CSE Dept Information, Contact & Administration'
      },
      'faculty': {
        title: 'Faculty Management',
        subtitle: 'Teaching Appointments, Workload & Department Staff'
      },
      'students': {
        title: 'Student Management & Roster',
        subtitle: 'Division 3CYBER7 Enrolled Students & Academic Records'
      },
      'id-cards': {
        title: 'Student ID Card Management System',
        subtitle: 'Official Credentials • Batch Issuance, Review & Print'
      },
      'subjects': {
        title: 'Subject & Curriculum Management',
        subtitle: '3rd Semester Course Allocations & Syllabus Progress'
      },
      'timetable': {
        title: 'Timetable & Class Schedules',
        subtitle: 'Weekly Schedule Matrix, Classrooms & Lab Sessions'
      },
      'attendance': {
        title: 'Attendance Monitoring & Audit',
        subtitle: 'Daily QR & Manual Attendance • Defaulter Tracking'
      },
      'internal-marks': {
        title: 'Internal Assessment & Marks Verification',
        subtitle: 'Faculty Submissions, Score Moderation & Status'
      },
      'assignments': {
        title: 'Department Assignments',
        subtitle: 'Course Work, Submissions & Evaluation Tracking'
      },
      'exams': {
        title: 'Examination Management',
        subtitle: 'Schedules, Seating Allocations & Readiness'
      },
      'workload': {
        title: 'Faculty Workload Matrix',
        subtitle: 'Weekly Teaching Slots, Load Distribution & Norms'
      },
      'leaves': {
        title: 'Leave Approvals Queue',
        subtitle: 'Faculty Duty/Casual Leaves & Student Medical Applications'
      },
      'mentoring': {
        title: 'Student Mentoring & Interventions',
        subtitle: 'Academic Counseling Sessions & Progress Notes'
      },
      'reports': {
        title: 'Department Reports & Compliance',
        subtitle: 'Institutional CSV Exports & Audit Summaries'
      },
      'approvals': {
        title: 'Central HOD Approvals Dashboard',
        subtitle: 'Unified Queue for Marks, Leaves, Timetable & Attendance'
      }
    };

    const meta = titles[section] || { title: 'Department Management', subtitle: 'Overview' };
    if (titleEl) titleEl.textContent = meta.title;
    if (breadcrumbEl) breadcrumbEl.textContent = meta.subtitle;

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
        case 'id-cards':
          await this.renderIdCards();
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

  updatePendingBadges(approvalsCount, leavesCount) {
    if (approvalsCount !== undefined) {
      this.pendingApprovalsCount = Number(approvalsCount) || 0;
      this.pendingApprovalsOnlyCount = this.pendingApprovalsCount;
    }
    if (leavesCount !== undefined) {
      this.pendingLeavesCount = Number(leavesCount) || 0;
      this.pendingLeavesOnlyCount = this.pendingLeavesCount;
    }

    const navAppBadge = document.getElementById('hod-nav-pending-badge');
    const topAppBadge = document.getElementById('hod-top-pending-badge');
    if (navAppBadge) {
      navAppBadge.textContent = this.pendingApprovalsCount;
      navAppBadge.style.display = this.pendingApprovalsCount > 0 ? 'inline-block' : 'none';
    }
    if (topAppBadge) {
      topAppBadge.textContent = this.pendingApprovalsCount;
      topAppBadge.style.display = this.pendingApprovalsCount > 0 ? 'flex' : 'none';
    }

    const navLeaveBadge = document.getElementById('hod-nav-leaves-badge');
    if (navLeaveBadge) {
      navLeaveBadge.textContent = this.pendingLeavesCount;
      navLeaveBadge.style.display = this.pendingLeavesCount > 0 ? 'inline-block' : 'none';
    }
  },

  updatePendingBadge(count) {
    // Specifically updates approvals badge ONLY to guarantee counts are never conflated
    this.updatePendingBadges(count, undefined);
  },

  async refreshPendingCounters() {
    try {
      try { localStorage.removeItem('mgi_cache_hod_dashboard'); } catch (e) {}
      const [appRes, leaveRes] = await Promise.all([
        API.getHodApprovals({ status: 'PENDING' }),
        API.getHodLeaves({ status: 'PENDING' })
      ]);
      const pendingApprovals = (appRes && Array.isArray(appRes.approvals)) 
        ? appRes.approvals.filter(a => a.status === 'PENDING') 
        : [];
      const pendingLeaves = (leaveRes && Array.isArray(leaveRes.leaves)) 
        ? leaveRes.leaves.filter(l => l.status === 'PENDING') 
        : [];
      const approvalsCount = (appRes && appRes.pendingCount !== undefined) ? appRes.pendingCount : pendingApprovals.length;
      const leavesCount = (leaveRes && leaveRes.pendingCount !== undefined) ? leaveRes.pendingCount : pendingLeaves.length;
      this.updatePendingBadges(approvalsCount, leavesCount);
      return { total: approvalsCount, pendingApprovalsCount: approvalsCount, pendingLeavesCount: leavesCount };
    } catch (e) {
      console.warn('[HodApp] refreshPendingCounters error:', e);
      return { total: this.pendingApprovalsCount, pendingApprovalsCount: this.pendingApprovalsCount, pendingLeavesCount: this.pendingLeavesCount || 0 };
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
      if (this.refreshTimer) {
        clearInterval(this.refreshTimer);
        this.refreshTimer = null;
      }
      try {
        if (typeof API.logout === 'function') {
          API.logout();
        } else {
          API.setToken(null);
          API.setUser(null);
        }
      } catch (e) {}

      try {
        localStorage.removeItem('pu_auth_token');
        localStorage.removeItem('pu_user');
        localStorage.removeItem('mgi_cache_hod_dashboard');
        localStorage.removeItem('mgi_cache_hod_timetable');
      } catch (e) {}

      this.currentUser = null;

      try {
        history.replaceState(null, '', window.location.pathname);
        window.location.hash = '';
      } catch (e) {}

      if (window.App && typeof window.App.logout === 'function') {
        window.App.logout();
      } else if (window.App && typeof window.App.showAuth === 'function') {
        if (window.App.showToast) window.App.showToast('Logged out successfully.', 'info');
        window.App.showAuth();
      } else {
        window.location.href = window.location.pathname;
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
    // Auto-refresh pending queue status and badges every 30 seconds
    this.refreshTimer = setInterval(async () => {
      try {
        await this.refreshPendingCounters();
      } catch (e) {}
    }, 30000);
  },

  getSortMinutes(timeStr) {
    if (!timeStr) return 0;
    const parts = String(timeStr).trim().split(':');
    let h = parseInt(parts[0], 10);
    const m = parseInt(parts[1] || '0', 10);
    if (isNaN(h)) return 0;
    if (h < 8) h += 12; // College starts at 9:30 AM; times < 8 (e.g. 01:15, 02:30) are PM
    return h * 60 + (isNaN(m) ? 0 : m);
  },

  formatTime12H(timeStr) {
    if (!timeStr) return '';
    const clean = String(timeStr).trim();
    if (clean.toUpperCase().includes('AM') || clean.toUpperCase().includes('PM')) {
      return clean;
    }
    const parts = clean.split(':');
    let h = parseInt(parts[0], 10);
    const m = String(parseInt(parts[1] || '0', 10)).padStart(2, '0');
    if (isNaN(h)) return clean;
    const isPM = (h < 8 || h >= 12);
    let displayH = h;
    if (h > 12) displayH = h - 12;
    else if (h === 0) displayH = 12;
    return `${String(displayH).padStart(2, '0')}:${m} ${isPM ? 'PM' : 'AM'}`;
  },

  formatTimeRange(start, end) {
    if (!start || !end) return '';
    return `${this.formatTime12H(start)} - ${this.formatTime12H(end)}`;
  },

  isCurrentSlot(startTime, endTime, day) {
    try {
      const today = getIndianDayName();
      if (day && day !== today) return false;
      const now = getIndianDate();
      const curMinutes = now.getHours() * 60 + now.getMinutes();
      const startMin = this.getSortMinutes(startTime);
      const endMin = this.getSortMinutes(endTime);
      return curMinutes >= startMin && curMinutes <= endMin;
    } catch (e) {
      return false;
    }
  },

  // ========================================================================
  // MODULE 1: DEPARTMENT DASHBOARD
  // ========================================================================
  async renderDashboard() {
    try { localStorage.removeItem('mgi_cache_hod_dashboard'); } catch (e) {}
    let res;
    try {
      res = await API.getHodDashboard();
    } catch (e) {
      console.warn('[HodApp] Could not fetch live dashboard, using verified local data:', e);
    }

    if (!res || !res.success) {
      res = (typeof API.getHodDashboard === 'function')
        ? await API.getHodDashboard()
        : { success: true, stats: {} };
    }

    const s = res.stats || {};
    const lectures = res.todayLectures || [];
    const pendingApprovals = (res.pendingApprovals || []).filter(a => a.status === 'PENDING');
    const pendingLeaves = (res.pendingLeaves || []).filter(l => l.status === 'PENDING');
    const workload = res.facultyWorkload || [];
    const exams = res.upcomingExams || [];

    const effectivePendingApprovalsCount = (s.pendingApprovalsCount !== undefined) ? s.pendingApprovalsCount : pendingApprovals.length;
    const effectivePendingLeavesCount = (s.pendingLeavesCount !== undefined) ? s.pendingLeavesCount : pendingLeaves.length;

    this.updatePendingBadges(effectivePendingApprovalsCount, effectivePendingLeavesCount);

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
            <h2 style="font-size:20px; font-weight:900; color:var(--text-primary); margin:0;">Welcome, ${this.currentUser?.head_name || (this.currentUser?.name && !this.currentUser.name.includes('Engineering') ? this.currentUser.name : 'Head of Department')}</h2>
            <p style="font-size:12.5px; color:var(--text-secondary); margin:4px 0 0;">Department Operations, Faculty Workload & Governance Hub</p>
          </div>
          
          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            <button class="btn-primary" onclick="HodApp.switchSection('approvals')" style="padding:8px 14px; font-size:12px; display:inline-flex; align-items:center; gap:6px;">
              <span>⚡</span> <span>HOD Approvals (${effectivePendingApprovalsCount})</span>
            </button>
            <button class="btn-sec" onclick="HodApp.switchSection('leaves')" style="padding:8px 14px; font-size:12px; display:inline-flex; align-items:center; gap:6px; background:rgba(245,158,11,0.12); border-color:rgba(245,158,11,0.3); color:#f59e0b;">
              <span>✉️</span> <span>Leave Requests (${effectivePendingLeavesCount})</span>
            </button>
            <button class="btn-sec" onclick="HodApp.switchSection('reports')" style="padding:8px 14px; font-size:12px; display:inline-flex; align-items:center; gap:6px;">
              <span>📄</span> <span>Reports</span>
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
            <div style="font-size:24px; font-weight:900; color:${effectivePendingApprovalsCount > 0 ? '#ef4444' : '#10b981'}; margin:8px 0 2px;">
              ${effectivePendingApprovalsCount}
            </div>
            <div style="font-size:11px; color:var(--text-secondary);">Marks & Timetable changes</div>
          </div>

          <div class="card stat-card" style="padding:16px;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start;">
              <span style="font-size:11.5px; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Pending Leaves</span>
              <span style="font-size:20px;">✉️</span>
            </div>
            <div style="font-size:24px; font-weight:900; color:${effectivePendingLeavesCount > 0 ? '#f59e0b' : '#10b981'}; margin:8px 0 2px;">
              ${effectivePendingLeavesCount}
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
                ${[...lectures].sort((a, b) => this.getSortMinutes(a.start_time) - this.getSortMinutes(b.start_time)).map(l => {
                  const isLive = this.isCurrentSlot(l.start_time, l.end_time, res.todayDay);
                  return `
                  <div style="padding:10px 14px; background:${isLive ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.03)'}; border:1px solid ${isLive ? 'rgba(16,185,129,0.35)' : 'var(--border-color)'}; border-radius:8px; display:flex; justify-content:space-between; align-items:center; gap:12px;">
                    <div>
                      <div style="font-size:13px; font-weight:700; color:var(--text-primary); display:flex; align-items:center; gap:6px;">
                        <span>${l.subject}</span>
                        ${l.is_lab ? '<span class="badge" style="background:#a855f7; color:#fff; font-size:9.5px; padding:1px 5px;">LAB</span>' : ''}
                        ${l.override_type ? '<span class="badge" style="background:#f59e0b; color:#fff; font-size:9.5px; padding:1px 5px;">ROOM CHANGE</span>' : ''}
                        ${isLive ? '<span class="badge" style="background:#10b981; color:#fff; font-size:9px; padding:2px 6px; font-weight:800;">● LIVE NOW</span>' : ''}
                      </div>
                      <div style="font-size:11.5px; color:var(--text-muted); margin-top:2px;">
                        <span>${l.effective_teacher || l.teacher}</span> • <span>Room ${l.effective_room || l.room}</span> • <span>${l.batch}</span>
                      </div>
                    </div>
                    <div style="text-align:right;">
                      <span class="badge" style="background:rgba(56,189,248,0.15); color:#38bdf8; font-size:11px; padding:3px 8px; border-radius:6px; font-weight:700; white-space:nowrap;">
                        ${this.formatTimeRange(l.start_time, l.end_time)}
                      </span>
                    </div>
                  </div>
                `;}).join('')}
              </div>
            `}
          </div>

          <!-- Pending Approvals & Leave Requests -->
          <div class="card" style="padding:20px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; flex-wrap:wrap; gap:8px;">
              <div>
                <h3 style="font-size:15px; font-weight:800; margin:0; display:flex; align-items:center; gap:8px;">
                  <span>⚡</span> Pending Action Items (${effectivePendingApprovalsCount + effectivePendingLeavesCount})
                </h3>
                <span style="font-size:11.5px; color:var(--text-muted);">${effectivePendingApprovalsCount} Approvals • ${effectivePendingLeavesCount} Leaves</span>
              </div>
              <div style="display:flex; gap:6px;">
                <button class="btn-sec" onclick="HodApp.switchSection('approvals')" style="padding:4px 10px; font-size:11px;">Approvals (${effectivePendingApprovalsCount})</button>
                <button class="btn-sec" onclick="HodApp.switchSection('leaves')" style="padding:4px 10px; font-size:11px;">Leaves (${effectivePendingLeavesCount})</button>
              </div>
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
              <span class="badge" style="background:#2563eb; color:#fff; font-size:10px; padding:3px 8px; border-radius:4px; font-weight:700;">DEPT CODE: ${p.code || 'CSE'}</span>
              <div style="font-size:15px; font-weight:800; color:var(--text-primary); margin-top:4px;">Academic Governance & Department Setup</div>
              <p style="font-size:12px; color:var(--text-muted); margin:2px 0 0;">Established Year: ${p.established_year || 2012} • Mishra Group Institute</p>
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

            <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; margin-top:20px; border-top:1px solid var(--border-color); padding-top:16px; flex-wrap:wrap;">
              <button type="button" class="btn-sec" onclick="HodApp.logout()" style="color:#ef4444; border-color:rgba(239,68,68,0.3); padding:9px 18px; font-size:12.5px; font-weight:700;">
                <span>🚪 Logout HOD Session</span>
              </button>
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
        this.currentUser = { ...this.currentUser, name: head_name, head_name: head_name };
        API.setUser(this.currentUser);
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
        
        <!-- Action Toolbar -->
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
          <div style="display:flex; align-items:center; gap:8px;">
            <span class="badge" style="background:rgba(56,189,248,0.15); color:#38bdf8; font-size:12px; padding:6px 12px; border-radius:8px; font-weight:700;">
              👨‍🏫 ${faculty.length} Active Faculty Members
            </span>
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
  // ========================================================================
  // MODULE 4: STUDENT MANAGEMENT (PROFILE CARDS & DEDICATED DETAILS VIEW)
  // ========================================================================
  getStudentAvatarHtml(photoUrl, name, size = 52) {
    const initials = (name || 'S')
      .split(' ')
      .map(w => w[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase();
    if (photoUrl) {
      const src = (window.API && API.getFileUrl) ? API.getFileUrl(photoUrl) : photoUrl;
      return `<img src="${src}" alt="${name || 'Student'}" class="student-card-avatar" style="width:${size}px; height:${size}px;" onerror="this.onerror=null; this.parentElement.innerHTML='<div style=\\\'width:${size}px; height:${size}px; border-radius:50%; background:linear-gradient(135deg,#1d4ed8,#0ea5e9); color:#fff; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:${Math.round(size*0.36)}px; border:2px solid rgba(56,189,248,0.4); flex-shrink:0;\\\'>${initials}</div>';" />`;
    }
    return `<div style="width:${size}px; height:${size}px; border-radius:50%; background:linear-gradient(135deg,#1d4ed8,#0ea5e9); color:#fff; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:${Math.round(size*0.36)}px; border:2px solid rgba(56,189,248,0.4); flex-shrink:0;">${initials}</div>`;
  },

  async renderStudents(page = 1) {
    if (!this.studentState) {
      this.studentState = { page: 1, searchVal: '', batchVal: 'All', viewMode: 'cards' };
    }

    const searchInput = document.getElementById('student-search-input');
    const batchSelect = document.getElementById('student-batch-filter');
    if (searchInput) this.studentState.searchVal = searchInput.value;
    if (batchSelect) this.studentState.batchVal = batchSelect.value;
    this.studentState.page = page || 1;

    const res = await API.getHodStudents({
      page: this.studentState.page,
      limit: 24,
      search: this.studentState.searchVal,
      batch: this.studentState.batchVal
    });

    const students = (res && res.students) || [];
    const p = (res && res.pagination) || { page: this.studentState.page, totalPages: 1, total: students.length };
    const viewMode = this.studentState.viewMode || 'cards';

    const content = document.getElementById('hod-content-area');
    content.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:20px;">
        
        <!-- Action Toolbar -->
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
          <div style="display:flex; align-items:center; gap:8px;">
            <span class="badge" style="background:rgba(56,189,248,0.15); color:#38bdf8; font-size:12px; padding:6px 12px; border-radius:8px; font-weight:700;">
              🎓 ${p.total} Enrolled Students (Division 3CYBER7)
            </span>
          </div>
          <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
            <!-- View Switcher -->
            <div class="view-switcher-group">
              <button class="view-switcher-btn ${viewMode === 'cards' ? 'active' : ''}" onclick="HodApp.setStudentViewMode('cards')">
                <span>🎴</span> <span>Cards</span>
              </button>
              <button class="view-switcher-btn ${viewMode === 'table' ? 'active' : ''}" onclick="HodApp.setStudentViewMode('table')">
                <span>📋</span> <span>Table</span>
              </button>
            </div>

            <a href="/api/hod/students/export?token=${API.getToken()}" download="students_roster.csv" class="btn-sec" style="padding:8px 14px; font-size:12px; text-decoration:none; display:inline-flex; align-items:center; gap:6px; border-radius:8px;">
              <span>📥</span> <span>Export CSV Roster</span>
            </a>
          </div>
        </div>

        <!-- Filter bar -->
        <div class="card" style="padding:14px; display:flex; gap:12px; flex-wrap:wrap; align-items:center;">
          <div style="flex:1; min-width:240px;">
            <input type="text" id="student-search-input" class="form-control" placeholder="Search by student name, roll number, or UG ID..." value="${this.studentState.searchVal || ''}" onkeydown="if(event.key==='Enter') HodApp.renderStudents(1)" style="height:38px; font-size:12.5px;" />
          </div>
          <div style="min-width:140px;">
            <select id="student-batch-filter" class="form-control" onchange="HodApp.renderStudents(1)" style="height:38px; font-size:12.5px;">
              <option value="All" ${this.studentState.batchVal === 'All' ? 'selected' : ''}>All Batches</option>
              <option value="Batch 1" ${this.studentState.batchVal === 'Batch 1' ? 'selected' : ''}>Batch 1 (1-30)</option>
              <option value="Batch 2" ${this.studentState.batchVal === 'Batch 2' ? 'selected' : ''}>Batch 2 (31+)</option>
            </select>
          </div>
          <button class="btn-primary" onclick="HodApp.renderStudents(1)" style="padding:8px 16px; font-size:12px;">Search</button>
        </div>

        ${students.length === 0 ? `
          <div class="card" style="padding:40px 20px; text-align:center; color:var(--text-muted);">
            <div style="font-size:32px; margin-bottom:8px;">🔍</div>
            <h4 style="font-size:15px; font-weight:700; color:var(--text-primary); margin-bottom:4px;">No matching students found</h4>
            <p style="font-size:12.5px; margin:0;">Try adjusting your search criteria or batch filter.</p>
          </div>
        ` : (viewMode === 'cards' ? `
          <!-- Student Profile Cards Grid -->
          <div class="student-card-grid">
            ${students.map(s => {
              const att = s.attendance_percentage != null ? s.attendance_percentage : 88;
              const attColor = att >= 75 ? '#10b981' : (att >= 60 ? '#f59e0b' : '#ef4444');
              const attBg = att >= 75 ? 'rgba(16,185,129,0.15)' : (att >= 60 ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)');
              const photoHtml = this.getStudentAvatarHtml(s.profile_photo_url, s.name, 48);

              return `
                <div class="student-profile-card">
                  <div>
                    <div class="student-card-header">
                      <div style="flex-shrink:0;">
                        ${photoHtml}
                      </div>
                      <div class="student-card-info">
                        <div style="display:flex; justify-content:space-between; align-items:center; gap:6px;">
                          <span class="badge" style="background:rgba(56,189,248,0.15); color:#38bdf8; font-size:10px; font-weight:800; padding:2px 7px;">
                            ROLL #${s.roll_number != null ? s.roll_number : 'N/A'}
                          </span>
                          <span class="badge" style="background:rgba(16,185,129,0.12); color:#10b981; font-size:10px; padding:2px 7px;">
                            ${s.status || 'Active'}
                          </span>
                        </div>
                        <h4 class="student-card-name" title="${s.name || ''}">${s.name || 'Not available'}</h4>
                        <span class="student-card-ug">${s.ug_id || 'Not available'}</span>
                        <div class="student-card-meta-chips">
                          <span class="student-card-meta-chip">${s.batch || 'Batch'}</span>
                          <span class="student-card-meta-chip">${s.division || '3CYBER7'}</span>
                          ${s.is_cr ? '<span class="badge" style="background:#f59e0b; color:#fff; font-size:9.5px; padding:1px 5px;">CR</span>' : ''}
                        </div>
                      </div>
                    </div>

                    <div class="student-card-details-grid" style="margin-top:12px;">
                      <div class="student-card-detail-item">
                        <span class="student-card-detail-label">Department</span>
                        <span class="student-card-detail-val" title="${s.department || 'Computer Science & Engineering'}">${s.department || 'Computer Science & Engineering'}</span>
                      </div>
                      <div class="student-card-detail-item">
                        <span class="student-card-detail-label">Semester</span>
                        <span class="student-card-detail-val">${s.semester || '3rd Semester'}</span>
                      </div>
                      <div class="student-card-detail-item">
                        <span class="student-card-detail-label">Section</span>
                        <span class="student-card-detail-val">${s.division || '3CYBER7'}</span>
                      </div>
                      <div class="student-card-detail-item">
                        <span class="student-card-detail-label">Batch</span>
                        <span class="student-card-detail-val">${s.batch || 'Not available'}</span>
                      </div>
                    </div>
                  </div>

                  <div class="student-card-footer">
                    <div style="display:flex; align-items:center; gap:6px;">
                      <span style="font-size:11px; color:var(--text-muted);">Attendance:</span>
                      <span class="badge" style="background:${attBg}; color:${attColor}; font-weight:800; font-size:11px; padding:2px 7px;">
                        ${att}%
                      </span>
                    </div>
                    <button class="btn-primary" onclick="HodApp.openStudentDetails('${s.ug_id}')" style="padding:6px 14px; font-size:11.5px; border-radius:6px; margin:0; display:inline-flex; align-items:center; gap:5px;">
                      <span>📄</span> <span>More Details</span>
                    </button>
                  </div>
                </div>
              `;
            }).join('')}
          </div>

          <!-- Pagination Row for Cards View -->
          <div class="card" style="padding:14px; display:flex; justify-content:space-between; align-items:center; font-size:12px; color:var(--text-muted);">
            <div>Showing page ${p.page} of ${p.totalPages || 1} (${p.total} total)</div>
            <div style="display:flex; gap:6px;">
              <button class="btn-sec" onclick="HodApp.renderStudents(${Math.max(1, p.page - 1)})" ${p.page <= 1 ? 'disabled' : ''} style="padding:4px 10px; font-size:11px;">Prev</button>
              <button class="btn-sec" onclick="HodApp.renderStudents(${p.page + 1})" ${p.page >= p.totalPages ? 'disabled' : ''} style="padding:4px 10px; font-size:11px;">Next</button>
            </div>
          </div>
        ` : `
          <!-- Students Data Table -->
          <div class="card" style="padding:0; overflow:hidden;">
            <div style="overflow-x:auto;">
              <table class="table" style="width:100%; border-collapse:collapse; font-size:12.5px;">
                <thead>
                  <tr style="border-bottom:1px solid var(--border-color); background:rgba(255,255,255,0.02); text-align:left; color:var(--text-muted);">
                    <th style="padding:12px 14px; width:70px;">Roll</th>
                    <th style="padding:12px 14px;">UG ID</th>
                    <th style="padding:12px 14px;">Student Name</th>
                    <th style="padding:12px 14px;">Department</th>
                    <th style="padding:12px 14px;">Batch</th>
                    <th style="padding:12px 14px;">Phone</th>
                    <th style="padding:12px 14px; text-align:center;">Attendance</th>
                    <th style="padding:12px 14px; text-align:center;">Action</th>
                  </tr>
                </thead>
                <tbody>
                  ${students.map(s => {
                    const att = s.attendance_percentage != null ? s.attendance_percentage : 88;
                    const attColor = att >= 75 ? '#10b981' : '#ef4444';
                    const photoHtml = this.getStudentAvatarHtml(s.profile_photo_url, s.name, 28);
                    return `
                      <tr style="border-bottom:1px solid var(--border-color);">
                        <td style="padding:11px 14px; font-weight:800; color:var(--text-primary);">${s.roll_number != null ? s.roll_number : 'N/A'}</td>
                        <td style="padding:11px 14px; font-family:monospace; color:#38bdf8;">${s.ug_id || 'Not available'}</td>
                        <td style="padding:11px 14px; font-weight:700; color:var(--text-primary);">
                          <div style="display:flex; align-items:center; gap:8px;">
                            ${photoHtml}
                            <div>
                              ${s.name || 'Not available'}
                              ${s.is_cr ? '<span class="badge" style="background:#f59e0b; color:#fff; font-size:9.5px; margin-left:4px;">CR</span>' : ''}
                            </div>
                          </div>
                        </td>
                        <td style="padding:11px 14px; color:var(--text-secondary); font-size:11.5px;">${s.department || 'Computer Science & Engineering'}</td>
                        <td style="padding:11px 14px; color:var(--text-secondary);">${s.batch || 'Not available'}</td>
                        <td style="padding:11px 14px; color:var(--text-muted);">${s.phone_number || 'Not available'}</td>
                        <td style="padding:11px 14px; text-align:center;">
                          <span class="badge" style="background:${attColor}; color:#fff; font-size:10px; padding:2px 7px;">${att}%</span>
                        </td>
                        <td style="padding:11px 14px; text-align:center;">
                          <button class="btn-sec" onclick="HodApp.openStudentDetails('${s.ug_id}')" style="padding:4px 10px; font-size:11px;">More Details</button>
                        </td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>

            <!-- Pagination Row for Table View -->
            <div style="padding:14px; border-top:1px solid var(--border-color); display:flex; justify-content:space-between; align-items:center; font-size:12px; color:var(--text-muted);">
              <div>Showing page ${p.page} of ${p.totalPages || 1} (${p.total} total)</div>
              <div style="display:flex; gap:6px;">
                <button class="btn-sec" onclick="HodApp.renderStudents(${Math.max(1, p.page - 1)})" ${p.page <= 1 ? 'disabled' : ''} style="padding:4px 10px; font-size:11px;">Prev</button>
                <button class="btn-sec" onclick="HodApp.renderStudents(${p.page + 1})" ${p.page >= p.totalPages ? 'disabled' : ''} style="padding:4px 10px; font-size:11px;">Next</button>
              </div>
            </div>
          </div>
        `)}

      </div>
    `;
  },

  setStudentViewMode(mode) {
    if (!this.studentState) this.studentState = {};
    this.studentState.viewMode = mode;
    this.renderStudents(this.studentState.page || 1);
  },

  async openStudentDetails(ugId) {
    const content = document.getElementById('hod-content-area');
    if (!content) return;

    content.innerHTML = `
      <div style="padding:40px; text-align:center;">
        <div class="spinner" style="margin:0 auto 12px;"></div>
        <div style="color:var(--text-muted); font-size:13px;">Loading student complete department record...</div>
      </div>
    `;

    try {
      const res = await API.getHodStudentById(ugId);
      const s = (res && res.student) || {};
      const results = (res && res.results) || [];
      const attendanceManual = (res && res.attendanceManual) || [];
      const attendanceScans = (res && res.attendanceScans) || [];
      const mentoring = (res && res.mentoring) || [];
      const submissions = (res && res.submissions) || [];
      const leaves = (res && res.leaves) || [];

      const photoHtml = this.getStudentAvatarHtml(s.profile_photo_url, s.name, 72);

      // Total attendance statistics
      const totalSessions = (attendanceManual.length + attendanceScans.length);
      const totalPresent = attendanceManual.filter(a => a.status === 'PRESENT').length + attendanceScans.filter(a => a.status === 'PRESENT').length;
      const attPercent = totalSessions > 0 ? Math.round((totalPresent / totalSessions) * 100) : (s.attendance_percentage != null ? s.attendance_percentage : 'Not available');

      content.innerHTML = `
        <div class="student-details-page">
          <!-- Top Navigation Header -->
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
            <button class="btn-sec" onclick="HodApp.renderStudents(HodApp.studentState ? HodApp.studentState.page : 1)" style="padding:8px 16px; font-size:12.5px; display:inline-flex; align-items:center; gap:8px;">
              <span>←</span> <span>Back to Student List</span>
            </button>
            <div style="display:flex; align-items:center; gap:8px;">
              <span class="badge" style="background:rgba(56,189,248,0.15); color:#38bdf8; font-size:11.5px; font-weight:700;">
                HOD Department Record: CSE
              </span>
            </div>
          </div>

          <!-- Student Hero Profile Card -->
          <div class="student-details-hero">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:18px;">
              <div style="display:flex; align-items:center; gap:18px; flex-wrap:wrap;">
                <div>${photoHtml}</div>
                <div>
                  <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                    <span class="badge" style="background:#2563eb; color:#fff; font-size:11px; font-weight:800;">
                      ROLL #${s.roll_number != null ? s.roll_number : 'Not available'}
                    </span>
                    <span class="badge" style="background:rgba(16,185,129,0.15); color:#10b981; font-size:11px; font-weight:700;">
                      ${s.status || 'Active'}
                    </span>
                    ${s.is_cr ? '<span class="badge" style="background:#f59e0b; color:#fff; font-size:11px; font-weight:700;">Class Representative (CR)</span>' : ''}
                  </div>
                  <h2 style="font-size:22px; font-weight:800; color:var(--text-primary); margin:8px 0 3px;">${s.name || 'Not available'}</h2>
                  <div style="font-size:13px; color:var(--text-secondary); display:flex; gap:12px; flex-wrap:wrap;">
                    <span>Enrollment / UG ID: <code style="color:#38bdf8; font-weight:700;">${s.ug_id || 'Not available'}</code></span>
                    <span>•</span>
                    <span>Department: <strong>${s.department || 'Computer Science & Engineering'}</strong></span>
                    <span>•</span>
                    <span>Batch: <strong>${s.batch || 'Not available'}</strong></span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Complete Academic Information Grid -->
            <div class="student-details-grid">
              <div class="student-details-item">
                <span class="student-details-item-label">Department</span>
                <span class="student-details-item-val">${s.department || 'Computer Science & Engineering'}</span>
              </div>
              <div class="student-details-item">
                <span class="student-details-item-label">Academic Program</span>
                <span class="student-details-item-val">${s.program || 'B.Tech Cyber Security'}</span>
              </div>
              <div class="student-details-item">
                <span class="student-details-item-label">Current Semester</span>
                <span class="student-details-item-val">${s.semester || '3rd Semester'} (${s.year || '2nd Year'})</span>
              </div>
              <div class="student-details-item">
                <span class="student-details-item-label">Academic Year</span>
                <span class="student-details-item-val">${s.academic_year || '2026-27'}</span>
              </div>
              <div class="student-details-item">
                <span class="student-details-item-label">Section / Division</span>
                <span class="student-details-item-val">${s.division || '3CYBER7'}</span>
              </div>
              <div class="student-details-item">
                <span class="student-details-item-label">Assigned Batch</span>
                <span class="student-details-item-val">${s.batch || 'Not available'}</span>
              </div>
              <div class="student-details-item">
                <span class="student-details-item-label">Contact Phone</span>
                <span class="student-details-item-val">${s.phone_number || 'Not available'}</span>
              </div>
              <div class="student-details-item">
                <span class="student-details-item-label">CR Appointment</span>
                <span class="student-details-item-val">${s.is_cr ? ('Yes (' + (s.cr_batches || 'Both') + ')') : 'No'}</span>
              </div>
              <div class="student-details-item">
                <span class="student-details-item-label">Academic Status</span>
                <span class="student-details-item-val" style="color:#10b981;">Good Standing (${s.status || 'Active'})</span>
              </div>
            </div>
          </div>

          <!-- Attendance Records Card (Combining Manual & QR Verified Scans) -->
          <div class="card" style="padding:22px;">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; margin-bottom:14px;">
              <div>
                <h3 style="font-size:15px; font-weight:800; margin:0; display:flex; align-items:center; gap:8px;">
                  <span>📊</span> Department Attendance Profile & Log
                </h3>
                <p style="font-size:12px; color:var(--text-secondary); margin:2px 0 0;">
                  Consolidated tracking across Dynamic QR scans and Manual roll calls
                </p>
              </div>
              <div style="display:flex; gap:10px; align-items:center;">
                <span class="badge" style="background:${attPercent !== 'Not available' && attPercent >= 75 ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)'}; color:${attPercent !== 'Not available' && attPercent >= 75 ? '#10b981' : '#f59e0b'}; font-size:12px; font-weight:800; padding:4px 10px;">
                  Overall: ${attPercent !== 'Not available' ? attPercent + '%' : 'Not available'}
                </span>
                <span class="badge" style="background:rgba(255,255,255,0.05); font-size:11.5px;">
                  ${totalSessions > 0 ? `${totalPresent} / ${totalSessions} Sessions` : 'No logs recorded'}
                </span>
              </div>
            </div>

            <div style="max-height:220px; overflow-y:auto; border:1px solid var(--border-color); border-radius:8px;">
              <table class="table" style="font-size:12px; width:100%; margin:0;">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Subject</th>
                    <th>Method</th>
                    <th>Status</th>
                    <th>Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  ${(attendanceManual.length === 0 && attendanceScans.length === 0) ? `
                    <tr><td colspan="5" style="text-align:center; color:var(--text-muted); padding:20px;">Not available</td></tr>
                  ` : [
                    ...attendanceManual.map(a => ({ ...a, type: 'Manual' })),
                    ...attendanceScans.map(a => ({ ...a, type: 'QR Scan' }))
                  ].slice(0, 30).map(a => `
                    <tr>
                      <td><strong>${a.date || 'Not available'}</strong></td>
                      <td>${a.subject || 'Not available'}</td>
                      <td><span class="badge" style="background:rgba(255,255,255,0.05); font-size:10px;">${a.type}</span></td>
                      <td>
                        <span class="badge" style="background:${a.status === 'PRESENT' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)'}; color:${a.status === 'PRESENT' ? '#10b981' : '#ef4444'}; font-size:10.5px; font-weight:700;">
                          ${a.status || 'Not available'}
                        </span>
                      </td>
                      <td style="color:var(--text-secondary);">${a.remarks || '-'}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>

          <!-- Academic Marks & Internal Assessments Card -->
          <div class="card" style="padding:22px;">
            <h3 style="font-size:15px; font-weight:800; margin:0 0 14px; display:flex; align-items:center; gap:8px;">
              <span>📝</span> Internal Assessment & Examination Marks
            </h3>

            <div style="max-height:220px; overflow-y:auto; border:1px solid var(--border-color); border-radius:8px;">
              <table class="table" style="font-size:12px; width:100%; margin:0;">
                <thead>
                  <tr>
                    <th>Subject</th>
                    <th>Exam Name</th>
                    <th>Semester</th>
                    <th>Marks</th>
                    <th>Max Marks</th>
                    <th>Grade</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  ${results.length === 0 ? `
                    <tr><td colspan="7" style="text-align:center; color:var(--text-muted); padding:20px;">Not available</td></tr>
                  ` : results.map(r => `
                    <tr>
                      <td><strong>${r.subject || 'Not available'}</strong></td>
                      <td>${r.exam_name || 'Not available'}</td>
                      <td>${r.semester || '3rd Semester'}</td>
                      <td><strong style="color:#10b981; font-size:13px;">${r.marks != null ? r.marks : 'Not available'}</strong></td>
                      <td>${r.max_marks != null ? r.max_marks : 100}</td>
                      <td><span class="badge" style="background:rgba(56,189,248,0.15); color:#38bdf8; font-weight:800;">${r.grade || 'Not available'}</span></td>
                      <td><span class="badge" style="background:rgba(16,185,129,0.1); color:#10b981; font-size:10.5px;">${r.status || 'APPROVED'}</span></td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>

          <!-- Assignment Submissions Card -->
          <div class="card" style="padding:22px;">
            <h3 style="font-size:15px; font-weight:800; margin:0 0 14px; display:flex; align-items:center; gap:8px;">
              <span>📚</span> Assignment Submissions & Coursework
            </h3>

            <div style="max-height:220px; overflow-y:auto; border:1px solid var(--border-color); border-radius:8px;">
              <table class="table" style="font-size:12px; width:100%; margin:0;">
                <thead>
                  <tr>
                    <th>Assignment Title</th>
                    <th>Subject</th>
                    <th>Submitted At</th>
                    <th>Marks</th>
                    <th>Status</th>
                    <th>Feedback</th>
                  </tr>
                </thead>
                <tbody>
                  ${submissions.length === 0 ? `
                    <tr><td colspan="6" style="text-align:center; color:var(--text-muted); padding:20px;">Not available</td></tr>
                  ` : submissions.map(sub => `
                    <tr>
                      <td><strong>${sub.assignment_title || 'Not available'}</strong></td>
                      <td>${sub.assignment_subject || 'Not available'}</td>
                      <td style="color:var(--text-muted); font-size:11px;">${sub.submitted_at || 'Not available'}</td>
                      <td><strong>${sub.marks_obtained != null ? sub.marks_obtained : '-'}</strong> / ${sub.max_marks || 100}</td>
                      <td><span class="badge" style="background:rgba(56,189,248,0.15); color:#38bdf8; font-size:10.5px;">${sub.status || 'SUBMITTED'}</span></td>
                      <td style="color:var(--text-secondary);">${sub.feedback || '-'}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>

          <!-- Mentoring Records Card -->
          <div class="card" style="padding:22px;">
            <h3 style="font-size:15px; font-weight:800; margin:0 0 14px; display:flex; align-items:center; gap:8px;">
              <span>🤝</span> Student Mentoring & Follow-ups
            </h3>

            ${mentoring.length === 0 ? `
              <div style="padding:20px; text-align:center; color:var(--text-muted); font-size:12.5px; background:rgba(255,255,255,0.02); border-radius:8px;">
                Not available
              </div>
            ` : `
              <div style="display:flex; flex-direction:column; gap:10px;">
                ${mentoring.map(m => `
                  <div style="padding:14px; background:rgba(255,255,255,0.02); border:1px solid var(--border-color); border-radius:8px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                      <span style="font-size:13px; font-weight:700; color:var(--text-primary);">Mentor: ${m.mentor_name || 'Not available'}</span>
                      <span class="badge" style="background:rgba(168,85,247,0.15); color:#c084fc; font-size:11px;">${m.session_date || 'Not available'}</span>
                    </div>
                    <div style="font-size:12px; color:var(--text-secondary); margin-bottom:4px;">
                      <strong>Academic Concerns:</strong> ${m.academic_concerns || 'None reported'}
                    </div>
                    <div style="font-size:12px; color:var(--text-primary);">
                      <strong>Session Notes:</strong> ${m.notes || 'Not available'}
                    </div>
                    ${m.action_plan ? `<div style="font-size:11.5px; color:#38bdf8; margin-top:4px;"><strong>Action Plan:</strong> ${m.action_plan}</div>` : ''}
                    ${m.confidential_notes ? `<div style="font-size:11.5px; color:#f59e0b; margin-top:4px;"><strong>🔒 Confidential (HOD Eyes Only):</strong> ${m.confidential_notes}</div>` : ''}
                  </div>
                `).join('')}
              </div>
            `}
          </div>

          <!-- Student Leave Requests Card -->
          <div class="card" style="padding:22px;">
            <h3 style="font-size:15px; font-weight:800; margin:0 0 14px; display:flex; align-items:center; gap:8px;">
              <span>🏖️</span> Student Leave Requests
            </h3>

            ${leaves.length === 0 ? `
              <div style="padding:20px; text-align:center; color:var(--text-muted); font-size:12.5px; background:rgba(255,255,255,0.02); border-radius:8px;">
                Not available
              </div>
            ` : `
              <div style="display:flex; flex-direction:column; gap:10px;">
                ${leaves.map(l => `
                  <div style="padding:14px; background:rgba(255,255,255,0.02); border:1px solid var(--border-color); border-radius:8px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
                    <div>
                      <div style="font-size:13px; font-weight:700; color:var(--text-primary);">${l.leave_type || 'Leave'} (${l.total_days || 1} Days)</div>
                      <div style="font-size:12px; color:var(--text-secondary); margin-top:2px;">
                        ${l.start_date} to ${l.end_date} • <em>Reason: ${l.reason || 'None stated'}</em>
                      </div>
                    </div>
                    <span class="badge" style="background:${l.status === 'APPROVED' ? 'rgba(16,185,129,0.15)' : (l.status === 'REJECTED' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)')}; color:${l.status === 'APPROVED' ? '#10b981' : (l.status === 'REJECTED' ? '#ef4444' : '#f59e0b')}; font-weight:800; font-size:11px;">
                      ${l.status || 'PENDING'}
                    </span>
                  </div>
                `).join('')}
              </div>
            `}
          </div>

          <!-- Bottom Back Button -->
          <div style="display:flex; justify-content:flex-start; margin-top:10px;">
            <button class="btn-sec" onclick="HodApp.renderStudents(HodApp.studentState ? HodApp.studentState.page : 1)" style="padding:10px 20px; font-size:13px; display:inline-flex; align-items:center; gap:8px;">
              <span>←</span> <span>Back to Student List</span>
            </button>
          </div>
        </div>
      `;
    } catch (e) {
      console.error('[HOD] openStudentDetails error:', e);
      this.showToast('Failed to load student complete record.', 'error');
    }
  },

  // Backward-compatibility alias
  async viewStudentProfile(ugId) {
    return this.openStudentDetails(ugId);
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
          <div style="display:flex; align-items:center; gap:8px;">
            <span class="badge" style="background:rgba(168,85,247,0.15); color:#c084fc; font-size:12px; padding:6px 12px; border-radius:8px; font-weight:700;">
              📚 ${subjects.length} Semester Courses Offered
            </span>
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
  currentTimetableSlots: [],

  async renderTimetable(selectedDay = null) {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const currentIndianDay = getIndianDayName();
    const dayToUse = selectedDay || ((currentIndianDay && currentIndianDay !== 'Sunday' && days.includes(currentIndianDay)) ? currentIndianDay : 'Monday');

    const res = await API.getHodTimetable({ day: dayToUse });
    let rawSlots = (res && res.timetable) || [];
    this.currentTimetableSlots = rawSlots;

    // Strict chronological sort: college day starts at 09:30 AM
    const slots = [...rawSlots].sort((a, b) => this.getSortMinutes(a.start_time) - this.getSortMinutes(b.start_time));

    const totalSlots = slots.length;
    const theoryCount = slots.filter(s => !s.is_lab && !String(s.subject).toUpperCase().includes('LIBRARY')).length;
    const labCount = slots.filter(s => s.is_lab).length;
    const libCount = slots.filter(s => String(s.subject).toUpperCase().includes('LIBRARY')).length;

    const content = document.getElementById('hod-content-area');
    content.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:20px;">
        
        <!-- Action & Navigation Bar -->
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
          <!-- Day Selector Tabs -->
          <div style="display:flex; gap:6px; overflow-x:auto; background:rgba(255,255,255,0.03); padding:5px; border-radius:12px; border:1px solid var(--border-color);">
            ${days.map(d => {
              const isToday = d === currentIndianDay;
              const isActive = d === dayToUse;
              return `
                <button class="pill-tab ${isActive ? 'active' : ''}" onclick="HodApp.renderTimetable('${d}')" style="display:inline-flex; align-items:center; gap:6px; padding:7px 14px; font-weight:700; border-radius:8px;">
                  <span>${d}</span>
                  ${isToday ? `<span class="badge" style="background:#10b981; color:#fff; font-size:8.5px; padding:1px 5px; border-radius:10px; font-weight:800;">TODAY</span>` : ''}
                </button>
              `;
            }).join('')}
          </div>

          <div style="display:flex; align-items:center; gap:8px;">
            <button class="btn-sec" onclick="HodApp.renderTimetable('${dayToUse}')" style="padding:8px 12px; font-size:12px; display:inline-flex; align-items:center; gap:5px; border-radius:8px;" title="Reload Timetable">
              <span>🔄</span> <span>Refresh</span>
            </button>
            <button class="btn-primary" onclick="HodApp.openAddTimetableModal('${dayToUse}')" style="padding:8px 16px; font-size:12px; display:inline-flex; align-items:center; gap:6px; border-radius:8px; box-shadow:0 4px 14px rgba(37,99,235,0.3);">
              <span>➕</span> <span>Add Class Slot</span>
            </button>
          </div>
        </div>

        <!-- Schedule Overview & Working Hours Summary Card -->
        <div class="card" style="padding:16px 20px; background:linear-gradient(135deg, rgba(30,41,59,0.7) 0%, rgba(15,23,42,0.85) 100%); border:1px solid rgba(56,189,248,0.2); border-radius:12px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:16px;">
          <div>
            <div style="display:flex; align-items:center; gap:8px;">
              <span class="badge" style="background:rgba(56,189,248,0.15); color:#38bdf8; font-size:11px; font-weight:800; padding:3px 8px; border-radius:6px;">
                TIMETABLE MATRIX
              </span>
              <span style="font-size:12.5px; font-weight:700; color:var(--text-secondary);">${dayToUse}'s Academic Schedule</span>
            </div>
            <div style="font-size:18px; font-weight:900; color:var(--text-primary); margin-top:4px;">
              College Working Hours: <span style="color:#38bdf8;">09:30 AM</span> to <span style="color:#38bdf8;">04:20 PM</span>
            </div>
          </div>

          <!-- Quick Metrics Chips -->
          <div style="display:flex; gap:10px; flex-wrap:wrap;">
            <div style="padding:6px 12px; background:rgba(255,255,255,0.04); border:1px solid var(--border-color); border-radius:8px; text-align:center;">
              <div style="font-size:11px; color:var(--text-muted); font-weight:600;">TOTAL SLOTS</div>
              <div style="font-size:16px; font-weight:800; color:var(--text-primary);">${totalSlots}</div>
            </div>
            <div style="padding:6px 12px; background:rgba(37,99,235,0.08); border:1px solid rgba(59,130,246,0.3); border-radius:8px; text-align:center;">
              <div style="font-size:11px; color:#60a5fa; font-weight:600;">THEORY</div>
              <div style="font-size:16px; font-weight:800; color:#60a5fa;">${theoryCount}</div>
            </div>
            <div style="padding:6px 12px; background:rgba(168,85,247,0.08); border:1px solid rgba(168,85,247,0.3); border-radius:8px; text-align:center;">
              <div style="font-size:11px; color:#c084fc; font-weight:600;">PRACTICAL LABS</div>
              <div style="font-size:16px; font-weight:800; color:#c084fc;">${labCount}</div>
            </div>
            ${libCount > 0 ? `
              <div style="padding:6px 12px; background:rgba(245,158,11,0.08); border:1px solid rgba(245,158,11,0.3); border-radius:8px; text-align:center;">
                <div style="font-size:11px; color:#fbbf24; font-weight:600;">LIBRARY</div>
                <div style="font-size:16px; font-weight:800; color:#fbbf24;">${libCount}</div>
              </div>
            ` : ''}
          </div>
        </div>

        <!-- Master Timetable Grid / Table -->
        <div class="card" style="padding:0; overflow:hidden; border-radius:12px; border:1px solid var(--border-color);">
          <div style="overflow-x:auto;">
            <table class="table" style="width:100%; border-collapse:collapse; font-size:12.5px;">
              <thead>
                <tr style="border-bottom:1px solid var(--border-color); background:rgba(255,255,255,0.03); text-align:left; color:var(--text-muted); font-size:11.5px; text-transform:uppercase; letter-spacing:0.5px;">
                  <th style="padding:13px 16px;">Period & Timing Window</th>
                  <th style="padding:13px 16px;">Subject & Course</th>
                  <th style="padding:13px 16px;">Type</th>
                  <th style="padding:13px 16px;">Faculty Appointment</th>
                  <th style="padding:13px 16px;">Classroom / Lab</th>
                  <th style="padding:13px 16px;">Student Batch</th>
                  <th style="padding:13px 16px; text-align:center;">Actions</th>
                </tr>
              </thead>
              <tbody>
                ${slots.length === 0 ? `
                  <tr><td colspan="7" style="padding:36px; text-align:center; color:var(--text-muted); font-size:13px;">No classes scheduled on ${dayToUse}. Click <strong>Add Class Slot</strong> to configure periods.</td></tr>
                ` : (() => {
                  let html = '';
                  let lunchInserted = false;
                  let recessInserted = false;

                  slots.forEach((s, idx) => {
                    const startMin = HodApp.getSortMinutes(s.start_time);
                    const isLive = HodApp.isCurrentSlot(s.start_time, s.end_time, dayToUse);

                    // Insert Institutional Lunch Break Banner between morning periods (11:20) and afternoon (12:20)
                    if (!lunchInserted && startMin >= 740) { // 12:20 PM is 740 min
                      html += `
                        <tr style="background:linear-gradient(90deg, rgba(245,158,11,0.09) 0%, rgba(245,158,11,0.02) 100%); border-top:1px dashed rgba(245,158,11,0.3); border-bottom:1px dashed rgba(245,158,11,0.3);">
                          <td colspan="7" style="padding:10px 18px;">
                            <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px;">
                              <div style="display:flex; align-items:center; gap:8px;">
                                <span style="font-size:16px;">🍱</span>
                                <span style="font-weight:800; color:#f59e0b; font-size:12.5px;">INSTITUTIONAL LUNCH & REFRESHMENT BREAK</span>
                                <span style="font-size:11.5px; color:var(--text-secondary); font-weight:600;">(Central Canteen & Student Common Rooms)</span>
                              </div>
                              <span class="badge" style="background:rgba(245,158,11,0.2); color:#f59e0b; font-weight:800; font-size:11px; padding:3px 10px; border-radius:6px;">
                                11:20 AM – 12:20 PM • 60 Mins
                              </span>
                            </div>
                          </td>
                        </tr>
                      `;
                      lunchInserted = true;
                    }

                    // Insert Short Recess & Lab Transit Banner before late afternoon labs (02:10 - 02:30)
                    if (!recessInserted && startMin >= 870) { // 02:30 PM is 870 min
                      html += `
                        <tr style="background:linear-gradient(90deg, rgba(16,185,129,0.09) 0%, rgba(16,185,129,0.02) 100%); border-top:1px dashed rgba(16,185,129,0.3); border-bottom:1px dashed rgba(16,185,129,0.3);">
                          <td colspan="7" style="padding:8px 18px;">
                            <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px;">
                              <div style="display:flex; align-items:center; gap:8px;">
                                <span style="font-size:15px;">☕</span>
                                <span style="font-weight:800; color:#10b981; font-size:12px;">SHORT RECESS & LABORATORY TRANSIT</span>
                              </div>
                              <span class="badge" style="background:rgba(16,185,129,0.2); color:#10b981; font-weight:800; font-size:10.5px; padding:2px 8px; border-radius:6px;">
                                02:10 PM – 02:30 PM • 20 Mins
                              </span>
                            </div>
                          </td>
                        </tr>
                      `;
                      recessInserted = true;
                    }

                    // Assign standard period label
                    let periodLabel = `Period ${idx + 1}`;
                    if (startMin <= 580) periodLabel = 'Period 1';
                    else if (startMin <= 630) periodLabel = 'Period 2';
                    else if (startMin >= 730 && startMin <= 750) periodLabel = s.is_lab ? 'Lab Session (P3-P4)' : 'Period 3';
                    else if (startMin >= 790 && startMin <= 800) periodLabel = 'Period 4';
                    else if (startMin >= 860) periodLabel = s.is_lab ? 'Lab Session (P5-P6)' : 'Period 5';

                    const isLibrary = String(s.subject).toUpperCase().includes('LIBRARY');
                    const hasRoomOverride = Boolean(s.override_type || (s.effective_room && s.effective_room !== s.room));

                    html += `
                      <tr style="border-bottom:1px solid var(--border-color); background:${isLive ? 'rgba(16,185,129,0.05)' : 'transparent'};">
                        
                        <!-- Timing & Period Window -->
                        <td style="padding:14px 16px;">
                          <div style="display:flex; flex-direction:column; gap:4px;">
                            <div style="display:flex; align-items:center; gap:6px;">
                              <span class="badge" style="background:rgba(56,189,248,0.15); color:#38bdf8; font-size:10px; font-weight:800; padding:2px 6px; border-radius:4px;">
                                ${periodLabel}
                              </span>
                              ${isLive ? `<span class="badge" style="background:#10b981; color:#fff; font-size:9px; font-weight:800; padding:2px 6px; border-radius:4px;">● LIVE</span>` : ''}
                            </div>
                            <div style="font-weight:800; color:var(--text-primary); font-size:13px; letter-spacing:0.2px;">
                              ${HodApp.formatTimeRange(s.start_time, s.end_time)}
                            </div>
                          </div>
                        </td>

                        <!-- Subject -->
                        <td style="padding:14px 16px;">
                          <div style="font-weight:800; color:var(--text-primary); font-size:14px;">${s.subject}</div>
                          <div style="font-size:11px; color:var(--text-muted); margin-top:2px;">Division 3CYBER7 • B.Tech CSE</div>
                        </td>

                        <!-- Type Badge -->
                        <td style="padding:14px 16px;">
                          ${s.is_lab ? `
                            <span class="badge" style="background:rgba(168,85,247,0.15); color:#c084fc; border:1px solid rgba(168,85,247,0.3); font-size:10px; font-weight:800; padding:3px 8px; border-radius:6px;">
                              🔬 LAB SESSION
                            </span>
                          ` : (isLibrary ? `
                            <span class="badge" style="background:rgba(245,158,11,0.15); color:#fbbf24; border:1px solid rgba(245,158,11,0.3); font-size:10px; font-weight:800; padding:3px 8px; border-radius:6px;">
                              📖 LIBRARY
                            </span>
                          ` : `
                            <span class="badge" style="background:rgba(37,99,235,0.15); color:#60a5fa; border:1px solid rgba(59,130,246,0.3); font-size:10px; font-weight:800; padding:3px 8px; border-radius:6px;">
                              📘 THEORY
                            </span>
                          `)}
                        </td>

                        <!-- Faculty Appointment -->
                        <td style="padding:14px 16px;">
                          <div style="display:flex; align-items:center; gap:8px;">
                            <div style="width:26px; height:26px; border-radius:50%; background:rgba(255,255,255,0.06); display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:800; color:var(--text-secondary); flex-shrink:0;">
                              👨‍🏫
                            </div>
                            <div>
                              <div style="font-weight:700; color:var(--text-primary); font-size:12.5px;">
                                ${s.effective_teacher || s.teacher_name || s.teacher || 'Department Faculty'}
                              </div>
                              ${s.new_teacher ? `<span class="badge" style="background:#f59e0b; color:#fff; font-size:8.5px; padding:1px 4px; font-weight:700;">Substitute</span>` : ''}
                            </div>
                          </div>
                        </td>

                        <!-- Classroom / Lab Room -->
                        <td style="padding:14px 16px;">
                          <div style="display:flex; align-items:center; gap:6px;">
                            <span style="font-size:14px;">📍</span>
                            <span style="font-weight:800; color:var(--text-primary); font-size:13px;">${s.effective_room || s.room}</span>
                          </div>
                          ${hasRoomOverride ? `
                            <div style="margin-top:2px;">
                              <span class="badge" style="background:rgba(239,68,68,0.15); color:#ef4444; border:1px solid rgba(239,68,68,0.3); font-size:9.5px; font-weight:800; padding:1px 5px;">
                                SHIFTED (Orig: ${s.room})
                              </span>
                            </div>
                          ` : ''}
                        </td>

                        <!-- Batch -->
                        <td style="padding:14px 16px;">
                          ${s.batch === 'Both' ? `
                            <span class="badge" style="background:rgba(255,255,255,0.05); color:var(--text-secondary); font-size:11px; padding:3px 8px; border-radius:6px; font-weight:600;">
                              Both (Entire Class)
                            </span>
                          ` : `
                            <span class="badge" style="background:rgba(14,165,233,0.15); color:#38bdf8; font-size:11px; font-weight:800; padding:3px 8px; border-radius:6px;">
                              ${s.batch}
                            </span>
                          `}
                        </td>

                        <!-- Action Buttons -->
                        <td style="padding:14px 16px; text-align:center;">
                          <div style="display:inline-flex; align-items:center; gap:6px;">
                            <button class="icon-btn" onclick="HodApp.openEditTimetableModal(${s.id}, '${dayToUse}')" style="width:30px; height:30px; border-radius:6px; background:rgba(255,255,255,0.04); border:1px solid var(--border-color); color:var(--text-primary); cursor:pointer;" title="Edit Slot Details">
                              ✏️
                            </button>
                            <button class="icon-btn" onclick="HodApp.openRoomOverrideModal(${s.id}, '${dayToUse}')" style="width:30px; height:30px; border-radius:6px; background:rgba(245,158,11,0.1); border:1px solid rgba(245,158,11,0.3); color:#f59e0b; cursor:pointer;" title="Temporary Room Relocation">
                              🔄
                            </button>
                            <button class="icon-btn" onclick="HodApp.deleteTimetableSlot(${s.id}, '${dayToUse}')" style="width:30px; height:30px; border-radius:6px; background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.3); color:#ef4444; cursor:pointer;" title="Delete Slot">
                              🗑️
                            </button>
                          </div>
                        </td>

                      </tr>
                    `;
                  });

                  return html;
                })()}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    `;
  },

  // Helper to prefill standard period preset
  setPeriodPreset(prefix, preset) {
    const startInput = document.getElementById(`${prefix}-tt-start`);
    const endInput = document.getElementById(`${prefix}-tt-end`);
    const isLabInput = document.getElementById(`${prefix}-tt-islab`);
    if (!startInput || !endInput) return;

    if (preset === 1) {
      startInput.value = '09:30';
      endInput.value = '10:25';
      if (isLabInput) isLabInput.value = '0';
    } else if (preset === 2) {
      startInput.value = '10:25';
      endInput.value = '11:20';
      if (isLabInput) isLabInput.value = '0';
    } else if (preset === 3) {
      startInput.value = '12:20';
      endInput.value = '01:15';
      if (isLabInput) isLabInput.value = '0';
    } else if (preset === 4) {
      startInput.value = '01:15';
      endInput.value = '02:10';
      if (isLabInput) isLabInput.value = '0';
    } else if (preset === 'lab') {
      startInput.value = '02:30';
      endInput.value = '04:20';
      if (isLabInput) isLabInput.value = '1';
    } else if (preset === 'mlab') {
      startInput.value = '12:20';
      endInput.value = '02:10';
      if (isLabInput) isLabInput.value = '1';
    }
  },

  openAddTimetableModal(day) {
    this.openModal(`
      <div style="padding:22px; max-width:560px; width:100%;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
          <div>
            <h3 style="font-size:16px; font-weight:800; margin:0;">➕ Add Timetable Slot (${day})</h3>
            <span style="font-size:11.5px; color:var(--text-muted);">Standard schedule begins at 09:30 AM</span>
          </div>
          <button class="icon-btn" onclick="HodApp.closeModal()" style="width:28px; height:28px; cursor:pointer;">✕</button>
        </div>

        <!-- Quick Preset Period Selection Bar -->
        <div style="margin-bottom:14px; background:rgba(255,255,255,0.03); padding:8px 10px; border-radius:8px; border:1px solid var(--border-color);">
          <div style="font-size:11px; font-weight:700; color:var(--text-muted); margin-bottom:6px;">QUICK PERIOD PRESETS:</div>
          <div style="display:flex; gap:6px; flex-wrap:wrap;">
            <button type="button" class="btn-sec" onclick="HodApp.setPeriodPreset('add', 1)" style="padding:3px 8px; font-size:11px;">P1 (09:30-10:25)</button>
            <button type="button" class="btn-sec" onclick="HodApp.setPeriodPreset('add', 2)" style="padding:3px 8px; font-size:11px;">P2 (10:25-11:20)</button>
            <button type="button" class="btn-sec" onclick="HodApp.setPeriodPreset('add', 3)" style="padding:3px 8px; font-size:11px;">P3 (12:20-01:15)</button>
            <button type="button" class="btn-sec" onclick="HodApp.setPeriodPreset('add', 4)" style="padding:3px 8px; font-size:11px;">P4 (01:15-02:10)</button>
            <button type="button" class="btn-sec" onclick="HodApp.setPeriodPreset('add', 'lab')" style="padding:3px 8px; font-size:11px; color:#c084fc;">Lab (02:30-04:20)</button>
          </div>
        </div>

        <form onsubmit="event.preventDefault(); HodApp.submitNewTimetableSlot('${day}');">
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
            <div class="form-group">
              <label class="form-label">Start Time *</label>
              <input type="text" id="add-tt-start" class="form-control" value="09:30" placeholder="e.g. 09:30" required />
            </div>
            <div class="form-group">
              <label class="form-label">End Time *</label>
              <input type="text" id="add-tt-end" class="form-control" value="10:25" placeholder="e.g. 10:25" required />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Subject *</label>
            <input type="text" id="add-tt-sub" class="form-control" placeholder="e.g. DBMS, COMA, DM or DBMS Lab" required />
          </div>

          <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
            <div class="form-group">
              <label class="form-label">Faculty Name / Code</label>
              <input type="text" id="add-tt-teacher" class="form-control" placeholder="e.g. NW, SPB, RAP" />
            </div>
            <div class="form-group">
              <label class="form-label">Room / Lab No *</label>
              <input type="text" id="add-tt-room" class="form-control" placeholder="e.g. NB-204 or L-311" required />
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
    const start_time = document.getElementById('add-tt-start')?.value?.trim();
    const end_time = document.getElementById('add-tt-end')?.value?.trim();
    const subject = document.getElementById('add-tt-sub')?.value?.trim();
    const teacher = document.getElementById('add-tt-teacher')?.value?.trim();
    const room = document.getElementById('add-tt-room')?.value?.trim();
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

  openEditTimetableModal(id, day) {
    const slot = (this.currentTimetableSlots || []).find(s => s.id == id);
    if (!slot) {
      this.showToast('Slot details not found.', 'error');
      return;
    }

    this.openModal(`
      <div style="padding:22px; max-width:560px; width:100%;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
          <div>
            <h3 style="font-size:16px; font-weight:800; margin:0;">✏️ Edit Class Slot (${slot.subject})</h3>
            <span style="font-size:11.5px; color:var(--text-muted);">${day} • Division 3CYBER7</span>
          </div>
          <button class="icon-btn" onclick="HodApp.closeModal()" style="width:28px; height:28px; cursor:pointer;">✕</button>
        </div>

        <!-- Quick Preset Period Selection Bar -->
        <div style="margin-bottom:14px; background:rgba(255,255,255,0.03); padding:8px 10px; border-radius:8px; border:1px solid var(--border-color);">
          <div style="font-size:11px; font-weight:700; color:var(--text-muted); margin-bottom:6px;">QUICK PERIOD PRESETS:</div>
          <div style="display:flex; gap:6px; flex-wrap:wrap;">
            <button type="button" class="btn-sec" onclick="HodApp.setPeriodPreset('edit', 1)" style="padding:3px 8px; font-size:11px;">P1 (09:30-10:25)</button>
            <button type="button" class="btn-sec" onclick="HodApp.setPeriodPreset('edit', 2)" style="padding:3px 8px; font-size:11px;">P2 (10:25-11:20)</button>
            <button type="button" class="btn-sec" onclick="HodApp.setPeriodPreset('edit', 3)" style="padding:3px 8px; font-size:11px;">P3 (12:20-01:15)</button>
            <button type="button" class="btn-sec" onclick="HodApp.setPeriodPreset('edit', 4)" style="padding:3px 8px; font-size:11px;">P4 (01:15-02:10)</button>
            <button type="button" class="btn-sec" onclick="HodApp.setPeriodPreset('edit', 'lab')" style="padding:3px 8px; font-size:11px; color:#c084fc;">Lab (02:30-04:20)</button>
          </div>
        </div>

        <form onsubmit="event.preventDefault(); HodApp.submitEditTimetableSlot(${id}, '${day}');">
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
            <div class="form-group">
              <label class="form-label">Start Time *</label>
              <input type="text" id="edit-tt-start" class="form-control" value="${slot.start_time}" required />
            </div>
            <div class="form-group">
              <label class="form-label">End Time *</label>
              <input type="text" id="edit-tt-end" class="form-control" value="${slot.end_time}" required />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Subject *</label>
            <input type="text" id="edit-tt-sub" class="form-control" value="${slot.subject}" required />
          </div>

          <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
            <div class="form-group">
              <label class="form-label">Faculty Name / Code</label>
              <input type="text" id="edit-tt-teacher" class="form-control" value="${slot.teacher || ''}" />
            </div>
            <div class="form-group">
              <label class="form-label">Room / Lab No *</label>
              <input type="text" id="edit-tt-room" class="form-control" value="${slot.room}" required />
            </div>
          </div>

          <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
            <div class="form-group">
              <label class="form-label">Batch</label>
              <select id="edit-tt-batch" class="form-control">
                <option value="Both" ${slot.batch === 'Both' ? 'selected' : ''}>Both (Entire Class)</option>
                <option value="Batch 1" ${slot.batch === 'Batch 1' ? 'selected' : ''}>Batch 1</option>
                <option value="Batch 2" ${slot.batch === 'Batch 2' ? 'selected' : ''}>Batch 2</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Type</label>
              <select id="edit-tt-islab" class="form-control">
                <option value="0" ${!slot.is_lab ? 'selected' : ''}>Theory Lecture</option>
                <option value="1" ${slot.is_lab ? 'selected' : ''}>Laboratory Session</option>
              </select>
            </div>
          </div>

          <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:18px;">
            <button type="button" class="btn-sec" onclick="HodApp.closeModal()">Cancel</button>
            <button type="submit" class="btn-primary" style="padding:8px 18px;">Update Slot</button>
          </div>
        </form>
      </div>
    `);
  },

  async submitEditTimetableSlot(id, day) {
    const start_time = document.getElementById('edit-tt-start')?.value?.trim();
    const end_time = document.getElementById('edit-tt-end')?.value?.trim();
    const subject = document.getElementById('edit-tt-sub')?.value?.trim();
    const teacher = document.getElementById('edit-tt-teacher')?.value?.trim();
    const room = document.getElementById('edit-tt-room')?.value?.trim();
    const batch = document.getElementById('edit-tt-batch')?.value;
    const is_lab = parseInt(document.getElementById('edit-tt-islab')?.value, 10);

    try {
      const res = await API.updateHodTimetableEntry(id, {
        start_time, end_time, subject, teacher, room, batch, is_lab
      });
      if (res && res.success) {
        this.showToast('Class slot updated successfully!', 'success');
        this.closeModal();
        await this.renderTimetable(day);
      } else {
        this.showToast(res?.message || 'Update failed.', 'error');
      }
    } catch (e) {
      this.showToast('Failed to update slot.', 'error');
    }
  },

  openRoomOverrideModal(id, day) {
    const slot = (this.currentTimetableSlots || []).find(s => s.id == id);
    if (!slot) {
      this.showToast('Slot not found.', 'error');
      return;
    }

    const todayStr = getIndianDateString();

    this.openModal(`
      <div style="padding:22px; max-width:520px; width:100%;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
          <div>
            <h3 style="font-size:16px; font-weight:800; margin:0; display:flex; align-items:center; gap:6px;">
              <span>🔄</span> Class Relocation / Room Change
            </h3>
            <span style="font-size:11.5px; color:var(--text-muted);">Assign an alternate room or substitute faculty</span>
          </div>
          <button class="icon-btn" onclick="HodApp.closeModal()" style="width:28px; height:28px; cursor:pointer;">✕</button>
        </div>

        <div style="padding:12px; background:rgba(255,255,255,0.03); border:1px solid var(--border-color); border-radius:8px; margin-bottom:14px;">
          <div style="font-size:13px; font-weight:800; color:var(--text-primary);">${slot.subject} (${HodApp.formatTimeRange(slot.start_time, slot.end_time)})</div>
          <div style="font-size:11.5px; color:var(--text-muted); margin-top:2px;">
            Scheduled Room: <strong>${slot.room}</strong> • Faculty: <strong>${slot.teacher || 'Unassigned'}</strong> • Batch: ${slot.batch}
          </div>
        </div>

        <form onsubmit="event.preventDefault(); HodApp.submitRoomOverride(${id}, '${day}');">
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
            <div class="form-group">
              <label class="form-label">Override Date *</label>
              <input type="date" id="ro-date" class="form-control" value="${todayStr}" required />
            </div>
            <div class="form-group">
              <label class="form-label">New Room / Lab *</label>
              <input type="text" id="ro-new-room" class="form-control" placeholder="e.g. NB-205, L-310" required />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Substitute Faculty (Optional)</label>
            <input type="text" id="ro-new-teacher" class="form-control" placeholder="Leave empty to keep ${slot.teacher || 'current'}" />
          </div>

          <div class="form-group">
            <label class="form-label">Relocation Reason / Administrative Notes *</label>
            <input type="text" id="ro-reason" class="form-control" placeholder="e.g. Projector maintenance, Air conditioning repair" required />
          </div>

          <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:18px;">
            <button type="button" class="btn-sec" onclick="HodApp.closeModal()">Cancel</button>
            <button type="submit" class="btn-primary" style="padding:8px 18px; background:#f59e0b; border-color:#f59e0b; color:#fff;">
              Apply Room Change
            </button>
          </div>
        </form>
      </div>
    `);
  },

  async submitRoomOverride(id, day) {
    const date = document.getElementById('ro-date')?.value;
    const new_room = document.getElementById('ro-new-room')?.value?.trim();
    const new_teacher = document.getElementById('ro-new-teacher')?.value?.trim() || null;
    const reason = document.getElementById('ro-reason')?.value?.trim();

    if (!new_room || !reason) {
      this.showToast('Please provide new room and reason.', 'error');
      return;
    }

    try {
      const res = await API.createTimetableRoomChange({
        timetable_id: id,
        date,
        new_room,
        new_teacher,
        reason
      });

      if (res && res.success) {
        this.showToast('Classroom relocation recorded successfully!', 'success');
        this.closeModal();
        await this.renderTimetable(day);
      } else {
        this.showToast(res?.message || 'Failed to apply relocation.', 'error');
      }
    } catch (e) {
      this.showToast('Error applying room change override.', 'error');
    }
  },

  async deleteTimetableSlot(id, day) {
    if (confirm('Are you sure you want to delete this timetable slot?')) {
      try {
        const res = await API.deleteHodTimetableEntry(id);
        if (res && res.success) {
          this.showToast('Slot removed successfully.', 'success');
          await this.renderTimetable(day);
        } else {
          this.showToast(res?.message || 'Failed to remove slot.', 'error');
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
          <div style="display:flex; align-items:center; gap:8px;">
            <span class="badge" style="background:rgba(16,185,129,0.15); color:#10b981; font-size:12px; padding:6px 12px; border-radius:8px; font-weight:700;">
              ⏱️ Institutional Audit Threshold: 75%
            </span>
          </div>
          <div style="display:flex; align-items:center; gap:8px;">
            <label style="font-size:12px; color:var(--text-muted); font-weight:600;">Date:</label>
            <input type="date" id="att-date-picker" class="form-control" value="${dateInput}" max="${today}" onchange="HodApp.renderAttendance()" style="height:36px; font-size:12px; width:auto;" />
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
          <span class="badge" style="background:rgba(56,189,248,0.15); color:#38bdf8; font-size:12px; padding:6px 12px; border-radius:8px; font-weight:700;">
            📝 ${summary.length} Subjects Submitted for Internal Moderation
          </span>
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

  moderateMarks(subject, exam_name, action) {
    const isApprove = action === 'APPROVE';
    const color = isApprove ? '#10b981' : '#f59e0b';
    const icon = isApprove ? '✓' : '↩';
    const defaultRemark = isApprove ? 'Approved by Head of Department' : 'Marks require moderation & faculty review';

    this.openModal(`
      <div style="padding:20px; max-width:440px; width:100%; box-sizing:border-box;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
          <h3 style="margin:0; font-size:16px; font-weight:800; display:flex; align-items:center; gap:8px;">
            <span style="color:${color}; font-size:18px;">${icon}</span>
            <span>Confirm Marks ${action}</span>
          </h3>
          <button onclick="HodApp.closeModal()" style="background:none; border:none; font-size:18px; color:var(--text-muted); cursor:pointer;">✕</button>
        </div>
        <p style="font-size:12.5px; color:var(--text-secondary); margin:0 0 14px; line-height:1.4;">
          Action for <strong>${subject}</strong> (${exam_name || 'Mid-Sem'}):
        </p>
        <div class="form-group" style="margin-bottom:16px;">
          <label class="form-label">Moderation Remarks</label>
          <input type="text" id="hod-marks-remarks-input" class="form-control" value="${defaultRemark}" placeholder="Enter remarks..." />
        </div>
        <div style="display:flex; justify-content:flex-end; gap:8px;">
          <button class="btn-sec" onclick="HodApp.closeModal()" style="padding:8px 14px; font-size:12px;">Cancel</button>
          <button class="btn-primary" id="hod-confirm-marks-btn" onclick="HodApp.submitModerateMarks('${subject}', '${exam_name}', '${action}')" style="background:${color}; border-color:${color}; padding:8px 16px; font-size:12px; font-weight:700;">
            ${icon} Confirm ${action}
          </button>
        </div>
      </div>
    `);
    setTimeout(() => {
      document.getElementById('hod-marks-remarks-input')?.focus();
    }, 100);
  },

  async submitModerateMarks(subject, exam_name, action) {
    const input = document.getElementById('hod-marks-remarks-input');
    const remarks = input ? input.value.trim() : (action === 'APPROVE' ? 'Approved by HOD' : 'Requires revision');
    const btn = document.getElementById('hod-confirm-marks-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Processing...'; }

    try {
      const res = await API.reviewHodInternalMarks({ subject, exam_name, action, remarks });
      this.closeModal();
      if (res && res.success) {
        this.showToast(res.message || 'Marks status updated successfully!', 'success');
        await this.refreshPendingCounters();
        await this.renderInternalMarks();
      } else {
        this.showToast(res?.message || 'Operation failed.', 'error');
      }
    } catch (e) {
      this.closeModal();
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
        
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
          <span class="badge" style="background:rgba(14,165,233,0.15); color:#38bdf8; font-size:12px; padding:6px 12px; border-radius:8px; font-weight:700;">
            📑 ${assignments.length} Course Assignments Tracked
          </span>
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
          <span class="badge" style="background:rgba(16,185,129,0.15); color:#10b981; font-size:12px; padding:6px 12px; border-radius:8px; font-weight:700;">
            🎯 ${exams.length} Scheduled Department Examinations
          </span>
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
        
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
          <span class="badge" style="background:rgba(245,158,11,0.15); color:#f59e0b; font-size:12px; padding:6px 12px; border-radius:8px; font-weight:700;">
            ⚖️ Institutional Workload Norm: 16–20 Hours / Week (${workload.length} Faculty Members)
          </span>
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
    const pendingLeaves = leaves.filter(l => l.status === 'PENDING');
    const pendingLeavesCount = (res && res.pendingCount !== undefined) ? res.pendingCount : pendingLeaves.length;
    this.updatePendingBadges(undefined, pendingLeavesCount);

    const content = document.getElementById('hod-content-area');
    content.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:20px;">
        
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
          <span class="badge" style="background:rgba(245,158,11,0.15); color:#f59e0b; font-size:12px; padding:6px 12px; border-radius:8px; font-weight:700;">
            ✉️ ${pendingLeaves.length} Pending Leave Applications (${leaves.length} Total)
          </span>
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

  processLeave(id, action) {
    const isApprove = action === 'APPROVED';
    const color = isApprove ? '#10b981' : '#ef4444';
    const icon = isApprove ? '✓' : '✕';
    const defaultRemark = isApprove ? 'Approved by Head of Department' : 'Institutional exigencies / duty requirements';

    this.openModal(`
      <div style="padding:20px; max-width:440px; width:100%; box-sizing:border-box;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
          <h3 style="margin:0; font-size:16px; font-weight:800; display:flex; align-items:center; gap:8px;">
            <span style="color:${color}; font-size:18px;">${icon}</span>
            <span>Confirm ${action} Leave</span>
          </h3>
          <button onclick="HodApp.closeModal()" style="background:none; border:none; font-size:18px; color:var(--text-muted); cursor:pointer;">✕</button>
        </div>
        <p style="font-size:12.5px; color:var(--text-secondary); margin:0 0 14px; line-height:1.4;">
          Are you sure you want to mark this leave application as <strong>${action}</strong>? Enter remarks below:
        </p>
        <div class="form-group" style="margin-bottom:16px;">
          <label class="form-label">Official Remarks</label>
          <input type="text" id="hod-leave-remarks-input" class="form-control" value="${defaultRemark}" placeholder="Enter remarks..." />
        </div>
        <div style="display:flex; justify-content:flex-end; gap:8px;">
          <button class="btn-sec" onclick="HodApp.closeModal()" style="padding:8px 14px; font-size:12px;">Cancel</button>
          <button class="btn-primary" id="hod-confirm-leave-btn" onclick="HodApp.submitLeaveDecision(${id}, '${action}')" style="background:${color}; border-color:${color}; padding:8px 16px; font-size:12px; font-weight:700;">
            ${icon} Confirm ${action}
          </button>
        </div>
      </div>
    `);
    setTimeout(() => {
      document.getElementById('hod-leave-remarks-input')?.focus();
    }, 100);
  },

  async submitLeaveDecision(id, action) {
    const input = document.getElementById('hod-leave-remarks-input');
    const remarks = input ? input.value.trim() : (action === 'APPROVED' ? 'Approved by HOD' : 'Institutional exigencies');
    const btn = document.getElementById('hod-confirm-leave-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Processing...'; }

    try {
      const res = await API.reviewHodLeave(id, { action, remarks });
      this.closeModal();
      if (res && res.success) {
        this.showToast(res.message || `Leave application ${action.toLowerCase()} successfully!`, 'success');
        await this.refreshPendingCounters();
        await this.renderLeaves();
      } else {
        this.showToast(res?.message || 'Failed to update leave.', 'error');
      }
    } catch (e) {
      this.closeModal();
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
          <span class="badge" style="background:rgba(56,189,248,0.15); color:#38bdf8; font-size:12px; padding:6px 12px; border-radius:8px; font-weight:700;">
            🤝 ${records.length} Counseling & Mentoring Sessions Logged
          </span>
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
          <!-- Report Type Toggle Buttons -->
          <div style="display:flex; gap:6px; overflow-x:auto; background:rgba(255,255,255,0.03); padding:4px; border-radius:10px; border:1px solid var(--border-color);">
            <button class="pill-tab ${reportType === 'attendance' ? 'active' : ''}" onclick="HodApp.renderReports('attendance')">
              ⏱️ Attendance Summary
            </button>
            <button class="pill-tab ${reportType === 'workload' ? 'active' : ''}" onclick="HodApp.renderReports('workload')">
              ⚖️ Faculty Workload
            </button>
            <button class="pill-tab ${reportType === 'performance' ? 'active' : ''}" onclick="HodApp.renderReports('performance')">
              📊 Academic Performance
            </button>
          </div>
          <a href="/api/hod/reports/export?report_type=${encodeURIComponent(reportType)}&token=${API.getToken()}" download="${reportType}_report.csv" class="btn-primary" style="padding:8px 16px; font-size:12px; text-decoration:none; display:inline-flex; align-items:center; gap:6px;">
            <span>📥</span> <span>Download CSV Export</span>
          </a>
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

    // Calculate current pending approvals count
    let pendingCount = (filterStatus === 'PENDING') 
      ? approvals.length 
      : ((res && res.pendingCount !== undefined) ? res.pendingCount : this.pendingApprovalsCount);
    if (filterStatus !== 'PENDING' && (res?.pendingCount === undefined)) {
      try {
        const pRes = await API.getHodApprovals({ status: 'PENDING' });
        if (pRes && Array.isArray(pRes.approvals)) {
          pendingCount = pRes.approvals.length;
        }
      } catch (e) {}
    }
    this.updatePendingBadges(pendingCount, undefined);

    const content = document.getElementById('hod-content-area');
    content.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:20px;">
        
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
          <div style="display:flex; gap:6px; overflow-x:auto; background:rgba(255,255,255,0.03); padding:4px; border-radius:10px; border:1px solid var(--border-color);">
            <button class="pill-tab ${filterStatus === 'PENDING' ? 'active' : ''}" onclick="HodApp.renderApprovals('PENDING')">
              ⏳ Pending Items (${pendingCount || 0})
            </button>
            <button class="pill-tab ${filterStatus === 'APPROVED' ? 'active' : ''}" onclick="HodApp.renderApprovals('APPROVED')">
              ✓ Approved History
            </button>
            <button class="pill-tab ${filterStatus === 'ALL' ? 'active' : ''}" onclick="HodApp.renderApprovals('ALL')">
              All Requests
            </button>
          </div>
          <div style="font-size:12px; color:var(--text-muted); font-weight:600;">
            Queue: <span style="color:#38bdf8;">${approvals.length} request${approvals.length === 1 ? '' : 's'}</span>
          </div>
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

  processApprovalAction(id, action) {
    const isApprove = action === 'APPROVED';
    const isReject = action === 'REJECTED';
    const color = isApprove ? '#10b981' : (isReject ? '#ef4444' : '#f59e0b');
    const icon = isApprove ? '✓' : (isReject ? '✕' : '↩');
    const defaultRemark = isApprove ? 'Approved by Head of Department' : (isReject ? 'Rejected by HOD' : 'Revision required');

    this.openModal(`
      <div style="padding:20px; max-width:440px; width:100%; box-sizing:border-box;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
          <h3 style="margin:0; font-size:16px; font-weight:800; display:flex; align-items:center; gap:8px;">
            <span style="color:${color}; font-size:18px;">${icon}</span>
            <span>Confirm ${action}</span>
          </h3>
          <button onclick="HodApp.closeModal()" style="background:none; border:none; font-size:18px; color:var(--text-muted); cursor:pointer;">✕</button>
        </div>
        <p style="font-size:12.5px; color:var(--text-secondary); margin:0 0 14px; line-height:1.4;">
          Are you sure you want to mark this request as <strong>${action}</strong>? Enter remarks below:
        </p>
        <div class="form-group" style="margin-bottom:16px;">
          <label class="form-label">Official Remarks / Comments</label>
          <input type="text" id="hod-approval-remarks-input" class="form-control" value="${defaultRemark}" placeholder="Enter remarks..." />
        </div>
        <div style="display:flex; justify-content:flex-end; gap:8px;">
          <button class="btn-sec" onclick="HodApp.closeModal()" style="padding:8px 14px; font-size:12px;">Cancel</button>
          <button class="btn-primary" id="hod-confirm-approval-btn" onclick="HodApp.submitApprovalAction(${id}, '${action}')" style="background:${color}; border-color:${color}; padding:8px 16px; font-size:12px; font-weight:700;">
            ${icon} Confirm ${action}
          </button>
        </div>
      </div>
    `);
    setTimeout(() => {
      document.getElementById('hod-approval-remarks-input')?.focus();
    }, 100);
  },

  async submitApprovalAction(id, action) {
    const input = document.getElementById('hod-approval-remarks-input');
    const remarks = input ? input.value.trim() : (action === 'APPROVED' ? 'Approved by HOD' : 'Action taken by HOD');
    const btn = document.getElementById('hod-confirm-approval-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Processing...'; }

    try {
      const res = await API.processHodApproval(id, { action, remarks });
      this.closeModal();
      if (res && res.success) {
        this.showToast(res.message || `Request ${action.toLowerCase()} successfully!`, 'success');
        await this.refreshPendingCounters();
        await this.renderApprovals();
      } else {
        this.showToast(res?.message || 'Failed to process request.', 'error');
      }
    } catch (e) {
      this.closeModal();
      this.showToast('Failed to process approval request.', 'error');
    }
  },

  quickApproveModal(id, title) {
    this.switchSection('approvals');
  },

  quickReviewLeave(id, applicant) {
    this.switchSection('leaves');
  },

  // ==================== STUDENT ID CARD MANAGEMENT (HOD MODULE) ====================
  async renderIdCards() {
    if (!this.idCardState) {
      this.idCardState = { batch: 'All', status: 'ALL', search: '' };
    }

    const searchInput = document.getElementById('hod-id-search-input');
    const batchSelect = document.getElementById('hod-id-batch-select');
    const statusSelect = document.getElementById('hod-id-status-select');
    if (searchInput) this.idCardState.search = searchInput.value;
    if (batchSelect) this.idCardState.batch = batchSelect.value;
    if (statusSelect) this.idCardState.status = statusSelect.value;

    const res = await API.getIdCards({
      batch: this.idCardState.batch,
      status: this.idCardState.status,
      search: this.idCardState.search
    });

    const students = (res && res.students) || [];
    const stats = (res && res.stats) || {
      totalStudents: students.length,
      totalGenerated: students.filter(s => s.is_generated).length,
      totalActive: students.filter(s => s.card && s.card.status === 'ACTIVE').length,
      totalFlagged: students.filter(s => s.card && s.card.flagged_for_review).length,
      totalNotGenerated: students.filter(s => !s.is_generated).length
    };

    const content = document.getElementById('hod-content-area');
    content.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:20px;">
        
        <!-- Header Banner & Stats -->
        <div class="card glass-card" style="padding:20px; background:linear-gradient(135deg, rgba(14, 165, 233, 0.08) 0%, rgba(99, 102, 241, 0.08) 100%); border:1px solid rgba(56, 189, 248, 0.25);">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:16px;">
            <div>
              <div style="display:flex; align-items:center; gap:8px;">
                <span style="font-size:24px;">🪪</span>
                <h3 style="font-size:18px; font-weight:800; margin:0;">Student ID Card Management System</h3>
              </div>
              <p style="font-size:12.5px; color:var(--text-secondary); margin:4px 0 0;">
                Official Digital & Physical Identity Verification • Division 3CYBER7 (B.Tech Cyber Security)
              </p>
            </div>

            <!-- Bulk Operation Action Buttons -->
            <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
              <button class="btn-primary" onclick="HodApp.bulkGenerateIdCards('All')" style="padding:8px 16px; font-size:12px; display:inline-flex; align-items:center; gap:6px; border-radius:8px; font-weight:700;">
                <span>⚡</span> <span>Bulk Issue All (65 Students)</span>
              </button>
              <button class="btn-sec" onclick="HodApp.bulkGenerateIdCards('Batch 1')" style="padding:8px 14px; font-size:12px; display:inline-flex; align-items:center; gap:6px; border-radius:8px;">
                <span>⚡</span> <span>Issue Batch 1</span>
              </button>
              <button class="btn-sec" onclick="HodApp.bulkGenerateIdCards('Batch 2')" style="padding:8px 14px; font-size:12px; display:inline-flex; align-items:center; gap:6px; border-radius:8px;">
                <span>⚡</span> <span>Issue Batch 2</span>
              </button>
              <button class="btn-sec" onclick="IdCardSystem.printBatchSheet(HodApp.idCardState.batch || 'All')" style="padding:8px 14px; font-size:12px; display:inline-flex; align-items:center; gap:6px; border-radius:8px; color:#38bdf8; border-color:rgba(56,189,248,0.4);" title="Print A4 sheet with 8 student ID cards">
                <span>🖨️</span> <span>Batch Print Sheet</span>
              </button>
            </div>
          </div>

          <!-- Quick Metrics Bar -->
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(130px, 1fr)); gap:12px; margin-top:18px;">
            <div style="background:var(--bg-card); padding:12px 14px; border-radius:var(--radius-md); border:1px solid var(--border-color);">
              <span style="font-size:11px; color:var(--text-muted); font-weight:700; text-transform:uppercase;">Total Enrolled</span>
              <div style="font-size:22px; font-weight:900; color:var(--text-primary); margin-top:2px;">${stats.totalStudents}</div>
            </div>
            <div style="background:var(--bg-card); padding:12px 14px; border-radius:var(--radius-md); border:1px solid var(--border-color);">
              <span style="font-size:11px; color:#22c55e; font-weight:700; text-transform:uppercase;">Active Cards</span>
              <div style="font-size:22px; font-weight:900; color:#22c55e; margin-top:2px;">${stats.totalActive}</div>
            </div>
            <div style="background:var(--bg-card); padding:12px 14px; border-radius:var(--radius-md); border:1px solid var(--border-color);">
              <span style="font-size:11px; color:#f59e0b; font-weight:700; text-transform:uppercase;">Flagged / Incomplete</span>
              <div style="font-size:22px; font-weight:900; color:#f59e0b; margin-top:2px;">${stats.totalFlagged}</div>
            </div>
            <div style="background:var(--bg-card); padding:12px 14px; border-radius:var(--radius-md); border:1px solid var(--border-color);">
              <span style="font-size:11px; color:var(--text-muted); font-weight:700; text-transform:uppercase;">Not Yet Issued</span>
              <div style="font-size:22px; font-weight:900; color:var(--text-muted); margin-top:2px;">${stats.totalNotGenerated}</div>
            </div>
          </div>
        </div>

        <!-- Filter & Search Toolbar -->
        <div class="card" style="padding:14px; display:flex; gap:12px; flex-wrap:wrap; align-items:center;">
          <div style="flex:1; min-width:220px;">
            <input type="text" id="hod-id-search-input" class="form-control" placeholder="Search by name, roll number, or UG ID..." value="${this.idCardState.search || ''}" onkeydown="if(event.key==='Enter') HodApp.renderIdCards()" style="height:38px; font-size:12.5px;" />
          </div>
          <div style="min-width:140px;">
            <select id="hod-id-batch-select" class="form-control" onchange="HodApp.renderIdCards()" style="height:38px; font-size:12.5px;">
              <option value="All" ${this.idCardState.batch === 'All' ? 'selected' : ''}>All Batches (65)</option>
              <option value="Batch 1" ${this.idCardState.batch === 'Batch 1' ? 'selected' : ''}>Batch 1 (Roll 1-30)</option>
              <option value="Batch 2" ${this.idCardState.batch === 'Batch 2' ? 'selected' : ''}>Batch 2 (Roll 31-66)</option>
            </select>
          </div>
          <div style="min-width:140px;">
            <select id="hod-id-status-select" class="form-control" onchange="HodApp.renderIdCards()" style="height:38px; font-size:12.5px;">
              <option value="ALL" ${this.idCardState.status === 'ALL' ? 'selected' : ''}>All Statuses</option>
              <option value="ACTIVE" ${this.idCardState.status === 'ACTIVE' ? 'selected' : ''}>Active Cards Only</option>
              <option value="FLAGGED" ${this.idCardState.status === 'FLAGGED' ? 'selected' : ''}>Flagged for Review</option>
              <option value="NOT_GENERATED" ${this.idCardState.status === 'NOT_GENERATED' ? 'selected' : ''}>Not Yet Issued</option>
            </select>
          </div>
          <button class="btn-primary" onclick="HodApp.renderIdCards()" style="padding:8px 16px; font-size:12px;">Search</button>
        </div>

        <!-- Student Cards Grid -->
        ${students.length === 0 ? `
          <div class="card" style="padding:40px; text-align:center; color:var(--text-muted);">
            <div style="font-size:36px; margin-bottom:10px;">🔍</div>
            <h4 style="font-size:15px; font-weight:700; margin:0 0 6px;">No student records found</h4>
            <p style="font-size:12.5px; margin:0;">Try adjusting your search criteria or batch filter.</p>
          </div>
        ` : `
          <div class="id-card-roster-grid">
            ${students.map(s => {
              const hasCard = s.is_generated && s.card;
              const cardStatus = hasCard ? s.card.status : 'NOT_ISSUED';
              const isFlagged = hasCard && s.card.flagged_for_review;
              const reasons = (hasCard && s.card.review_reasons) || [];
              const photo = IdCardSystem.getPhotoUrl(s.profile_photo_url);

              return `
                <div class="id-card-roster-item">
                  <div style="display:flex; align-items:flex-start; gap:12px;">
                    <div style="width:48px; height:58px; border-radius:6px; overflow:hidden; border:2px solid ${hasCard ? '#38bdf8' : 'var(--border-color)'}; background:#1e293b; flex-shrink:0;">
                      <img src="${photo}" alt="${s.name}" style="width:100%; height:100%; object-fit:cover;" onerror="this.src='${IdCardSystem.getDefaultAvatarSvg()}';" />
                    </div>
                    
                    <div style="flex:1; min-width:0;">
                      <div style="display:flex; justify-content:space-between; align-items:center; gap:6px;">
                        <span style="font-size:11px; font-weight:800; color:#38bdf8;">ROLL #${String(s.roll_number).padStart(2, '0')}</span>
                        <span class="id-card-status-badge ${cardStatus === 'ACTIVE' ? 'id-card-status-active' : (isFlagged ? 'id-card-status-flagged' : 'id-card-status-pending')}">
                          ${cardStatus === 'ACTIVE' ? '● ACTIVE' : (isFlagged ? '⚠ REVIEW' : '○ NOT ISSUED')}
                        </span>
                      </div>
                      <h4 style="font-size:13.5px; font-weight:800; margin:3px 0 2px; color:var(--text-primary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${s.name}">${s.name}</h4>
                      <div style="font-size:11px; color:var(--text-muted); font-family:monospace;">${s.ug_id} • ${s.batch}</div>
                    </div>
                  </div>

                  <!-- Flagged notice if any -->
                  ${isFlagged && reasons.length > 0 ? `
                    <div style="background:rgba(245,158,11,0.1); border:1px solid rgba(245,158,11,0.25); border-radius:6px; padding:6px 10px; font-size:11px; color:#f59e0b;">
                      <strong>⚠️ Flagged for Review:</strong> ${reasons.join(', ')}
                    </div>
                  ` : ''}

                  <!-- Card Metadata details if issued -->
                  ${hasCard ? `
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px; padding:8px 10px; background:rgba(255,255,255,0.02); border-radius:6px; border:1px solid var(--border-color); font-size:11px;">
                      <div><span style="color:var(--text-muted);">Card #:</span> <strong style="color:var(--text-primary); font-family:monospace; font-size:10px;">${s.card.card_number}</strong></div>
                      <div><span style="color:var(--text-muted);">Validity:</span> <strong style="color:var(--text-primary); font-size:10px;">${s.card.valid_until}</strong></div>
                    </div>
                  ` : `
                    <div style="padding:8px 10px; background:rgba(255,255,255,0.02); border-radius:6px; border:1px dashed var(--border-color); font-size:11px; color:var(--text-muted); text-align:center;">
                      No institutional ID card issued yet.
                    </div>
                  `}

                  <!-- Action Buttons -->
                  <div style="display:flex; align-items:center; gap:8px; margin-top:auto; padding-top:8px; border-top:1px solid var(--border-color); flex-wrap:wrap;">
                    ${hasCard ? `
                      <button class="btn-primary" onclick="IdCardSystem.openPreviewModal('${s.ug_id}')" style="padding:6px 12px; font-size:11px; flex:1; display:inline-flex; align-items:center; justify-content:center; gap:4px;">
                        <span>👁️</span> <span>Preview</span>
                      </button>
                      <button class="btn-sec" onclick="IdCardSystem.printSingleCard('${s.ug_id}')" style="padding:6px 10px; font-size:11px; display:inline-flex; align-items:center; gap:4px;" title="Print Single ID Card">
                        <span>🖨️</span>
                      </button>
                      <button class="btn-sec" onclick="HodApp.generateSingleIdCard('${s.ug_id}')" style="padding:6px 10px; font-size:11px; display:inline-flex; align-items:center; gap:4px;" title="Refresh / Re-issue Card">
                        <span>🔄</span>
                      </button>
                      <button class="btn-sec" onclick="HodApp.toggleCardStatus(${s.card.id}, '${s.card.status}')" style="padding:6px 10px; font-size:11px; color:${s.card.status === 'ACTIVE' ? '#ef4444' : '#22c55e'};" title="${s.card.status === 'ACTIVE' ? 'Suspend Card' : 'Activate Card'}">
                        <span>${s.card.status === 'ACTIVE' ? '🚫' : '✓'}</span>
                      </button>
                    ` : `
                      <button class="btn-primary" onclick="HodApp.generateSingleIdCard('${s.ug_id}')" style="padding:6px 14px; font-size:11.5px; width:100%; display:inline-flex; align-items:center; justify-content:center; gap:6px;">
                        <span>⚡</span> <span>Issue ID Card</span>
                      </button>
                    `}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `}
      </div>
    `;
  },

  async bulkGenerateIdCards(batch = 'All') {
    if (!confirm(`Are you sure you want to run bulk ID card generation for ${batch}? Existing active cards will be safely reused without duplication.`)) {
      return;
    }

    try {
      this.showToast(`Starting safe bulk ID card generation for ${batch}...`, 'info');
      const res = await API.bulkGenerateIdCards({ batch, force_regenerate: false });
      if (res && res.success) {
        this.showToast(`Bulk issue complete! Generated/Updated: ${res.generatedCount}, Reused: ${res.reusedCount}, Flagged: ${res.flaggedCount}`, 'success');
        await this.renderIdCards();
      } else {
        this.showToast(res?.message || 'Bulk card generation failed.', 'error');
      }
    } catch (e) {
      console.error('[HodApp bulkGenerateIdCards Error]:', e);
      this.showToast('Bulk generation encountered an error.', 'error');
    }
  },

  async generateSingleIdCard(ug_id) {
    try {
      this.showToast(`Generating ID card for ${ug_id}...`, 'info');
      const res = await API.generateSingleIdCard({ ug_id, force_regenerate: true });
      if (res && res.success) {
        this.showToast(`ID card successfully generated for ${ug_id}!`, 'success');
        await this.renderIdCards();
      } else {
        this.showToast(res?.message || 'Failed to generate ID card.', 'error');
      }
    } catch (e) {
      console.error('[HodApp generateSingleIdCard Error]:', e);
      this.showToast('Error generating ID card.', 'error');
    }
  },

  async toggleCardStatus(cardId, currentStatus) {
    const newStatus = currentStatus === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    if (!confirm(`Are you sure you want to change card status to ${newStatus}?`)) return;

    try {
      const res = await API.updateIdCardStatus(cardId, { status: newStatus });
      if (res && res.success) {
        this.showToast(`Card status updated to ${newStatus}.`, 'success');
        await this.renderIdCards();
      } else {
        this.showToast(res?.message || 'Failed to update status.', 'error');
      }
    } catch (e) {
      this.showToast('Error updating status.', 'error');
    }
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
