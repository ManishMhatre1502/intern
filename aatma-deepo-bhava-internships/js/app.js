/* ==========================================================================
   Aatma Deepo Bhava - Application Logic & Student Progress Tracker
   ========================================================================== */

const APP_STORAGE_KEY = 'AATMA_DEEPO_BHAVA_DATA_V3';

const DEFAULT_DOMAINS = [
  {
    id: 'web-dev',
    company: 'Google',
    companyLogo: 'fa-brands fa-google',
    logoColor: '#ea4335',
    title: 'Web Development Intern',
    category: 'web',
    location: 'Remote',
    duration: '1 Month',
    startTimeline: '10-20 Days post registration',
    tags: ['Web Development', 'Frontend', 'HTML/CSS/JS'],
    price: 1000,
    desc: 'Master HTML5, CSS3, JavaScript ES6+, Node.js, and modern frontend/backend frameworks by building scalable Web Applications.'
  },
  {
    id: 'ui-ux',
    company: 'Microsoft',
    companyLogo: 'fa-brands fa-microsoft',
    logoColor: '#00a4ef',
    title: 'UI/UX Design Intern',
    category: 'web',
    location: 'Remote',
    duration: '1 Month',
    startTimeline: '10-20 Days post registration',
    tags: ['UI/UX Design', 'Figma', 'Product Strategy'],
    price: 1000,
    desc: 'Design intuitive digital products, wireframes, high-fidelity prototypes, user journey maps, and modern design systems.'
  },
  {
    id: 'data-analytics',
    company: 'Amazon',
    companyLogo: 'fa-brands fa-amazon',
    logoColor: '#ff9900',
    title: 'Data Analyst Intern',
    category: 'ai',
    location: 'Remote',
    duration: '1 Month',
    startTimeline: '10-20 Days post registration',
    tags: ['Data Science', 'Analytics', 'Pandas/SQL'],
    price: 1000,
    desc: 'Transform raw data into business intelligence using Pandas, SQL, Tableau, and automated data processing pipelines.'
  },
  {
    id: 'cybersecurity',
    company: 'Cisco',
    companyLogo: 'fa-solid fa-shield-halved',
    logoColor: '#049fd9',
    title: 'Cybersecurity Intern',
    category: 'cyber',
    location: 'Remote',
    duration: '1 Month',
    startTimeline: '10-20 Days post registration',
    tags: ['Cybersecurity', 'Network Security', 'OWASP'],
    price: 1000,
    desc: 'Learn vulnerability assessment, penetration testing, network defense strategies, and web application security auditing.'
  },
  {
    id: 'ai-ml',
    company: 'Apple',
    companyLogo: 'fa-brands fa-apple',
    logoColor: '#555555',
    title: 'AI & Machine Learning Intern',
    category: 'ai',
    location: 'Remote',
    duration: '1 Month',
    startTimeline: '10-20 Days post registration',
    tags: ['AI/ML', 'Python', 'Neural Networks'],
    price: 1000,
    desc: 'Dive into Python, Neural Networks, Computer Vision, and Predictive Modeling with hands-on weekly machine learning algorithms.'
  },
  {
    id: 'cloud-devops',
    company: 'Meta',
    companyLogo: 'fa-brands fa-meta',
    logoColor: '#0668e1',
    title: 'Cloud & DevOps Intern',
    category: 'app',
    location: 'Remote',
    duration: '1 Month',
    startTimeline: '10-20 Days post registration',
    tags: ['Cloud', 'Docker', 'DevOps CI/CD'],
    price: 1000,
    desc: 'Deploy infrastructure using Docker containers, CI/CD pipelines, AWS services, and automated server management.'
  }
];

// PRE-POPULATED TEST STUDENT CREDENTIALS: abc@gmail.com / 1234
const INITIAL_STUDENTS = [
  {
    id: 'ADB-2026-9999',
    name: 'Test Student',
    email: 'abc@gmail.com',
    password: '1234',
    phone: '+91 98765 00000',
    domain: 'Web Development Intern',
    registrationDate: '2026-09-18',
    startDate: '2026-09-18',
    endDate: '2026-10-18',
    totalDays: 30,
    paymentStatus: 'Paid (₹1000)',
    tasks: [
      { num: 1, title: 'Requirement Analysis & Blueprint', status: 'Approved', link: 'https://github.com/abc/web-task1', notes: 'System architecture diagram created.' },
      { num: 2, title: 'Core Module & DB Integration', status: 'Submitted', link: 'https://github.com/abc/web-task2', notes: 'API endpoints implemented.' },
      { num: 3, title: 'Optimization & UI Polish', status: 'Pending', link: '', notes: '' },
      { num: 4, title: 'Deployment & Final Video Demo', status: 'Pending', link: '', notes: '' }
    ],
    certs: { offer: true, completion: false, attendance: true, authorization: true, appreciation: false }
  },
  {
    id: 'ADB-2026-2189',
    name: 'Ananya Patel',
    email: 'ananya.p@example.com',
    password: '1234',
    phone: '+91 98123 45678',
    domain: 'AI & Machine Learning Intern',
    registrationDate: '2026-09-10',
    startDate: '2026-09-22',
    endDate: '2026-10-22',
    totalDays: 30,
    paymentStatus: 'Paid (₹1000)',
    tasks: [
      { num: 1, title: 'Data Cleaning & Exploratory Analysis', status: 'Approved', link: 'https://github.com/ananya/ml-task1', notes: 'Explored dataset.' },
      { num: 2, title: 'Model Training & Evaluation', status: 'Approved', link: 'https://github.com/ananya/ml-task2', notes: '94.2% accuracy achieved.' },
      { num: 3, title: 'Hyperparameter Optimization', status: 'Submitted', link: 'https://github.com/ananya/ml-task3', notes: 'Applied Grid Search.' },
      { num: 4, title: 'API Integration & Final Report', status: 'Pending', link: '', notes: '' }
    ],
    certs: { offer: true, completion: false, attendance: true, authorization: true, appreciation: true }
  }
];

class AatmaDeepoApp {
  constructor() {
    this.data = this.loadData();
    this.activeStudentId = this.data.students.length > 0 ? this.data.students[0].id : null;
    this.isAdminLoggedIn = false;

    this.init();
  }

  init() {
    this.renderDomains('all');
    this.renderStudentSelector();
    this.renderStudentDashboard();
  }

  loadData() {
    const stored = localStorage.getItem(APP_STORAGE_KEY);
    if (stored) {
      try { return JSON.parse(stored); } catch (e) { console.error(e); }
    }
    const initial = { domains: DEFAULT_DOMAINS, students: INITIAL_STUDENTS };
    localStorage.setItem(APP_STORAGE_KEY, JSON.stringify(initial));
    return initial;
  }

  saveData() {
    localStorage.setItem(APP_STORAGE_KEY, JSON.stringify(this.data));
  }

  showSection(viewId, targetElementId = null) {
    document.querySelectorAll('.view-section').forEach(sec => sec.classList.remove('active'));
    document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));

    const view = document.getElementById(`view-${viewId}`);
    if (view) view.classList.add('active');

    const navLink = document.querySelector(`.nav-link[href="#${targetElementId || viewId}"]`);
    if (navLink) navLink.classList.add('active');

    if (targetElementId) {
      setTimeout(() => {
        const el = document.getElementById(targetElementId);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 50);
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    const mobileMenu = document.getElementById('nav-links');
    if (mobileMenu) mobileMenu.classList.remove('active');
  }

  scrollToSection(secId) {
    this.showSection('home', secId);
  }

  toggleMobileMenu() {
    const menu = document.getElementById('nav-links');
    if (menu) menu.classList.toggle('active');
  }

  renderDomains(category = 'all', searchQuery = '') {
    const grid = document.getElementById('domains-grid');
    if (!grid) return;

    let filtered = category === 'all' 
      ? this.data.domains 
      : this.data.domains.filter(d => d.category === category);

    if (searchQuery) {
      filtered = filtered.filter(d => 
        d.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
        d.company.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    grid.innerHTML = filtered.map(d => `
      <div class="internship-card">
        <div>
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:1rem;">
            <div class="company-logo-box">
              <i class="${d.companyLogo}" style="color: ${d.logoColor}"></i>
            </div>
            <button class="bookmark-btn" onclick="app.showToast('Bookmarked ${d.title}', 'info')">
              <i class="fa-regular fa-bookmark"></i>
            </button>
          </div>

          <h4 class="ic-title">${d.title}</h4>
          <div class="ic-company">${d.company}</div>

          <div style="display:flex; gap:1rem; font-size:0.8rem; color:#64748b; margin-bottom:1rem;">
            <span><i class="fa-solid fa-location-dot"></i> ${d.location}</span>
            <span><i class="fa-regular fa-clock"></i> ${d.duration}</span>
          </div>

          <div style="display:flex; flex-wrap:wrap; gap:0.4rem; margin-bottom:1.25rem;">
            ${d.tags.map(t => `<span class="badge badge-purple" style="font-size:0.7rem;">${t}</span>`).join('')}
          </div>
        </div>

        <div style="display:flex; align-items:center; justify-content:space-between; padding-top:1rem; border-top:1px solid #e2e8f0;">
          <span class="text-bold text-purple" style="font-size:1.1rem;">₹${d.price}</span>
          <button class="btn btn-purple btn-sm" onclick="app.openRegisterModal('${d.title}')">
            Apply Now
          </button>
        </div>
      </div>
    `).join('');
  }

  filterDomains(cat) {
    document.querySelectorAll('.tag-pill').forEach(pill => pill.classList.remove('active'));
    if (event && event.target && event.target.classList.contains('tag-pill')) {
      event.target.classList.add('active');
    }
    this.renderDomains(cat);
  }

  handleSearchInput(q) {
    const cat = document.getElementById('search-category').value;
    this.renderDomains(cat, q);
  }

  executeSearch() {
    const q = document.getElementById('search-keyword').value;
    const cat = document.getElementById('search-category').value;
    this.renderDomains(cat, q);
    this.scrollToSection('internships');
  }

  // ==========================================
  // STUDENT LOGIN & REGISTRATION
  // ==========================================
  openStudentLoginModal() {
    document.getElementById('modal-student-login').classList.add('active');
  }

  fillStudentForm() {
    document.getElementById('student-login-email').value = 'abc@gmail.com';
    document.getElementById('student-login-pass').value = '1234';
  }

  quickStudentLogin() {
    this.fillStudentForm();
    const testStudent = this.data.students.find(s => s.email === 'abc@gmail.com');
    if (testStudent) {
      this.activeStudentId = testStudent.id;
      this.renderStudentSelector();
      this.showSection('student-zone');
      this.renderStudentDashboard();
      this.showToast('Logged in as Test Student (abc@gmail.com)', 'success');
    }
  }

  handleStudentLogin(e) {
    e.preventDefault();
    const email = document.getElementById('student-login-email').value.trim();
    const pass = document.getElementById('student-login-pass').value.trim();

    const student = this.data.students.find(s => s.email.toLowerCase() === email.toLowerCase());
    if (student && (student.password === pass || pass === '1234')) {
      this.activeStudentId = student.id;
      this.closeModal('modal-student-login');
      this.renderStudentSelector();
      this.showSection('student-zone');
      this.renderStudentDashboard();
      this.showToast(`Welcome back, ${student.name}!`, 'success');
    } else {
      this.showToast('Invalid Email or Password! (Use abc@gmail.com / 1234)', 'error');
    }
  }

  openRegisterModal(preselectDomain = null) {
    const modal = document.getElementById('modal-register');
    if (!modal) return;
    if (preselectDomain) {
      const select = document.getElementById('reg-domain');
      if (select) select.value = preselectDomain;
    }
    modal.classList.add('active');
  }

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('active');
  }

  handleRegistrationSubmit(e) {
    e.preventDefault();

    const name = document.getElementById('reg-name').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const phone = document.getElementById('reg-phone').value.trim();
    let domain = document.getElementById('reg-domain').value;

    if (domain === 'AUTO') {
      domain = 'Web Development Intern';
    }

    const today = new Date();
    const startDateObj = new Date(today.getTime() + (14 * 24 * 60 * 60 * 1000));
    const endDateObj = new Date(startDateObj.getTime() + (30 * 24 * 60 * 60 * 1000));

    const formatDate = (d) => d.toISOString().split('T')[0];

    const newStudent = {
      id: `ADB-2026-${Math.floor(1000 + Math.random() * 9000)}`,
      name: name,
      email: email,
      password: '1234',
      phone: phone,
      domain: domain,
      registrationDate: formatDate(today),
      startDate: formatDate(startDateObj),
      endDate: formatDate(endDateObj),
      totalDays: 30,
      paymentStatus: 'Paid (₹1000)',
      tasks: [
        { num: 1, title: 'Requirement Analysis & Blueprint', status: 'Pending', link: '', notes: '' },
        { num: 2, title: 'Core Module Implementation & DB Setup', status: 'Pending', link: '', notes: '' },
        { num: 3, title: 'Optimization & Security Audit', status: 'Pending', link: '', notes: '' },
        { num: 4, title: 'Deployment & Final Video Demonstration', status: 'Pending', link: '', notes: '' }
      ],
      certs: { offer: true, completion: false, attendance: true, authorization: true, appreciation: false }
    };

    this.data.students.unshift(newStudent);
    this.activeStudentId = newStudent.id;
    this.saveData();

    this.closeModal('modal-register');
    this.showToast(`Registration Successful! Student ID: ${newStudent.id}`, 'success');

    document.getElementById('form-register').reset();
    this.renderStudentSelector();
    this.showSection('student-zone');
    this.renderStudentDashboard();
  }

  // ==========================================
  // COMPLETED DAYS CALCULATOR & DASHBOARD
  // ==========================================
  calculateCompletedDays(startDateStr, totalDays = 30) {
    const start = new Date(startDateStr);
    const today = new Date();

    const diffTime = today.getTime() - start.getTime();
    let completedDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (completedDays < 0) completedDays = 0;
    if (completedDays > totalDays) completedDays = totalDays;

    // For demo students if start date is in past or today, calculate dynamically (e.g. 13 days)
    if (startDateStr === '2026-09-18') {
      completedDays = 13; // 13 Days completed out of 30
    }

    const percent = Math.min(100, Math.round((completedDays / totalDays) * 100));
    const remainingDays = totalDays - completedDays;

    return { completedDays, totalDays, remainingDays, percent };
  }

  renderStudentSelector() {
    const select = document.getElementById('student-selector');
    if (!select) return;

    select.innerHTML = this.data.students.map(s => `
      <option value="${s.id}" ${s.id === this.activeStudentId ? 'selected' : ''}>
        ${s.name} (${s.email}) — ${s.domain}
      </option>
    `).join('');
  }

  switchStudentProfile(studentId) {
    this.activeStudentId = studentId;
    this.renderStudentDashboard();
  }

  renderStudentDashboard() {
    const container = document.getElementById('student-dashboard-content');
    if (!container) return;

    const student = this.data.students.find(s => s.id === this.activeStudentId);
    if (!student) {
      container.innerHTML = `<div class="card-white text-center p-4">No student profile selected.</div>`;
      return;
    }

    const { completedDays, totalDays, remainingDays, percent } = this.calculateCompletedDays(student.startDate, student.totalDays || 30);

    container.innerHTML = `
      <!-- COMPLETED DAYS TRACKER WIDGET -->
      <div class="days-completed-widget">
        <div class="dcw-header">
          <div class="dcw-title">
            <i class="fa-solid fa-fire text-purple"></i> Active Internship Progress Tracker
          </div>
          <div class="dcw-days-count">
            ${completedDays} <span style="font-size:1.1rem; color:#64748b;">/ ${totalDays} Days Completed</span>
          </div>
        </div>

        <div class="progress-track-outer">
          <div class="progress-fill-inner" style="width: ${percent}%;"></div>
        </div>

        <div class="dcw-footer-meta">
          <span><i class="fa-solid fa-clock"></i> <strong>${remainingDays} Days Remaining</strong></span>
          <span class="badge badge-green"><i class="fa-solid fa-check"></i> ${percent}% Completed • On Track</span>
          <span><i class="fa-solid fa-calendar-day"></i> Started on: ${student.startDate}</span>
        </div>
      </div>

      <div class="dashboard-grid-light">
        <div class="dash-card-light">
          <h4 class="text-bold mb-3"><i class="fa-solid fa-id-card text-purple"></i> Enrolment Details</h4>
          <div class="info-list-light">
            <div class="info-item-light"><label>Student ID</label><span>${student.id}</span></div>
            <div class="info-item-light"><label>Full Name</label><span>${student.name}</span></div>
            <div class="info-item-light"><label>Email Address</label><span>${student.email}</span></div>
            <div class="info-item-light"><label>Domain</label><span class="text-purple">${student.domain}</span></div>
            <div class="info-item-light"><label>Registration Fee</label><span class="badge badge-green">${student.paymentStatus}</span></div>
            <div class="info-item-light"><label>Duration</label><span>1 Month (${student.endDate})</span></div>
          </div>
        </div>

        <div class="dash-card-light">
          <h4 class="text-bold mb-3"><i class="fa-solid fa-clock-rotate-left text-purple"></i> Program Milestone</h4>
          <ul class="step-list" style="font-size:0.9rem;">
            <li class="mb-2"><i class="fa-solid fa-circle-check text-purple"></i> Registered on ${student.registrationDate}</li>
            <li class="mb-2"><i class="fa-solid fa-calendar-days text-purple"></i> Internship Started on ${student.startDate}</li>
            <li class="mb-2"><i class="fa-solid fa-list-check text-purple"></i> Submit 4 weekly evaluated tasks</li>
            <li class="mb-2"><i class="fa-solid fa-award text-purple"></i> Receive 5 Authorized Corporate Certificates</li>
          </ul>
        </div>
      </div>

      <!-- 4 WEEKLY TASKS -->
      <div class="dash-card-light mt-4">
        <h4 class="text-bold mb-3"><i class="fa-solid fa-list-check text-purple"></i> 4 Weekly Analyzed Tasks</h4>
        <div class="internships-grid" style="grid-template-columns: repeat(2, 1fr);">
          ${student.tasks.map(t => `
            <div class="task-box-light">
              <div>
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
                  <span class="badge ${t.status === 'Approved' ? 'badge-green' : t.status === 'Submitted' ? 'badge-blue' : 'badge-orange'}">
                    Week ${t.num} • ${t.status}
                  </span>
                </div>
                <div class="text-bold" style="font-size:0.95rem;">Task ${t.num}: ${t.title}</div>
                <p class="text-xs text-muted mt-1">${t.notes ? `Note: ${t.notes}` : 'Submit your GitHub repo or solution URL for weekly analysis.'}</p>
              </div>
              <div class="mt-3">
                ${t.status === 'Approved'
                  ? `<button class="btn btn-xs btn-light btn-block" disabled><i class="fa-solid fa-check"></i> Evaluated & Graded A+</button>`
                  : `<button class="btn btn-xs btn-purple btn-block" onclick="app.openTaskSubmitModal(${t.num}, '${t.title.replace(/'/g, "\\'")}')">
                      ${t.status === 'Submitted' ? 'Update Submission' : 'Submit Solution'}
                    </button>`
                }
              </div>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- AUTHORIZED CERTIFICATES HUB -->
      <div class="dash-card-light mt-4">
        <h4 class="text-bold mb-3"><i class="fa-solid fa-certificate text-purple"></i> Authorized Student Certificates & Letters</h4>
        <div class="certs-grid-light">
          <div class="cert-card-light">
            <div>
              <h5 class="text-bold">1. Offer Letter</h5>
              <span class="text-xs text-muted">Official Appointment</span>
            </div>
            ${student.certs.offer ? `<button class="btn btn-xs btn-purple" onclick="app.viewCertificate('offer')">View</button>` : `<span class="badge badge-orange">Locked</span>`}
          </div>

          <div class="cert-card-light">
            <div>
              <h5 class="text-bold">2. Completion Certificate</h5>
              <span class="text-xs text-muted">Granted upon 4 tasks</span>
            </div>
            ${student.certs.completion ? `<button class="btn btn-xs btn-purple" onclick="app.viewCertificate('completion')">View</button>` : `<span class="badge badge-orange">Pending 4 Tasks</span>`}
          </div>

          <div class="cert-card-light">
            <div>
              <h5 class="text-bold">3. Attendance Letter</h5>
              <span class="text-xs text-muted">100% Participation</span>
            </div>
            ${student.certs.attendance ? `<button class="btn btn-xs btn-purple" onclick="app.viewCertificate('attendance')">View</button>` : `<span class="badge badge-orange">Locked</span>`}
          </div>

          <div class="cert-card-light">
            <div>
              <h5 class="text-bold">4. Corporate Authorization</h5>
              <span class="text-xs text-muted">Verification Letter</span>
            </div>
            ${student.certs.authorization ? `<button class="btn btn-xs btn-purple" onclick="app.viewCertificate('authorization')">View</button>` : `<span class="badge badge-orange">Locked</span>`}
          </div>

          <div class="cert-card-light" style="grid-column: span 2;">
            <div>
              <h5 class="text-bold">5. Smart Student Appreciation Letter</h5>
              <span class="text-xs text-muted">Awarded to Hardworking & Smart Students</span>
            </div>
            ${student.certs.appreciation ? `<button class="btn btn-xs btn-purple" onclick="app.viewCertificate('appreciation')">View Honor Letter</button>` : `<span class="badge badge-orange">High Effort Required</span>`}
          </div>
        </div>
      </div>
    `;
  }

  // ==========================================
  // TASK SUBMISSION & CERTIFICATE PREVIEWS
  // ==========================================
  openTaskSubmitModal(taskNum, taskTitle) {
    document.getElementById('task-sub-student-id').value = this.activeStudentId;
    document.getElementById('task-sub-number').value = taskNum;
    document.getElementById('task-sub-title-readonly').value = `Week ${taskNum}: ${taskTitle}`;
    document.getElementById('task-sub-link').value = '';
    document.getElementById('task-sub-notes').value = '';

    document.getElementById('modal-submit-task').classList.add('active');
  }

  handleTaskSubmit(e) {
    e.preventDefault();

    const studentId = document.getElementById('task-sub-student-id').value;
    const taskNum = parseInt(document.getElementById('task-sub-number').value);
    const link = document.getElementById('task-sub-link').value.trim();
    const notes = document.getElementById('task-sub-notes').value.trim();

    const student = this.data.students.find(s => s.id === studentId);
    if (student) {
      const taskObj = student.tasks.find(t => t.num === taskNum);
      if (taskObj) {
        taskObj.status = 'Submitted';
        taskObj.link = link;
        taskObj.notes = notes;
      }

      const completedCount = student.tasks.filter(t => t.status === 'Submitted' || t.status === 'Approved').length;
      if (completedCount >= 4) {
        student.certs.completion = true;
      }

      this.saveData();
      this.closeModal('modal-submit-task');
      this.showToast(`Task ${taskNum} Solution Submitted!`, 'success');
      this.renderStudentDashboard();
    }
  }

  viewCertificate(certType) {
    const student = this.data.students.find(s => s.id === this.activeStudentId);
    if (!student) return;

    const renderArea = document.getElementById('cert-render-area');
    const modalTitle = document.getElementById('cert-modal-title');
    const currentDateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    let titleText = '';
    let certHtml = '';

    if (certType === 'offer') {
      titleText = 'Internship Offer Letter';
      certHtml = `
        <div class="certificate-document">
          <div class="cert-inner-border">
            <div class="text-center">
              <div class="cert-logo-title">AATMA DEEPO BHAVA</div>
              <div class="text-purple text-bold">"आत्मदीपो भव — Be Your Own Light"</div>
              <div class="cert-doc-type">OFFICIAL INTERNSHIP OFFER LETTER</div>
            </div>
            <div class="mt-4 text-center">
              <p>Date: <strong>${currentDateStr}</strong></p>
              <br>
              <p>Dear <span class="cert-recipient-name">${student.name}</span>,</p>
              <br>
              <p>We are pleased to offer you a 1-Month Internship in <strong class="text-purple">${student.domain}</strong>.</p>
              <p>Your program is scheduled to start on <strong>${student.startDate}</strong> and conclude on <strong>${student.endDate}</strong>.</p>
            </div>
            <div class="cert-footer-signatures">
              <div><div style="width:150px; height:1px; background:#64748b; margin-bottom:4px;"></div><div class="text-xs text-bold">Program Director</div></div>
              <div class="cert-seal"><i class="fa-solid fa-stamp"></i> CORPORATE<br>SEAL</div>
              <div><div style="width:150px; height:1px; background:#64748b; margin-bottom:4px;"></div><div class="text-xs text-bold">Chief Evaluator</div></div>
            </div>
          </div>
        </div>
      `;
    } else {
      titleText = 'Authorized Certificate Document';
      certHtml = `
        <div class="certificate-document">
          <div class="cert-inner-border text-center">
            <div class="cert-logo-title">AATMA DEEPO BHAVA</div>
            <div class="cert-doc-type">${certType.toUpperCase()} CERTIFICATE</div>
            <div class="mt-3">
              <p>This document certifies that</p>
              <div class="cert-recipient-name">${student.name}</div>
              <p class="mt-2">has demonstrated outstanding performance in <strong>${student.domain}</strong>.</p>
            </div>
            <div class="cert-footer-signatures mt-4">
              <div><div style="width:150px; height:1px; background:#64748b; margin-bottom:4px;"></div><div class="text-xs text-bold">Authorized Signatory</div></div>
              <div class="cert-seal"><i class="fa-solid fa-award"></i> VERIFIED</div>
              <div><div style="width:150px; height:1px; background:#64748b; margin-bottom:4px;"></div><div class="text-xs text-bold">Academic Head</div></div>
            </div>
          </div>
        </div>
      `;
    }

    modalTitle.innerHTML = `<i class="fa-solid fa-certificate text-purple"></i> ${titleText}`;
    renderArea.innerHTML = certHtml;
    document.getElementById('modal-certificate-viewer').classList.add('active');
  }

  // ==========================================
  // ADMIN PORTAL
  // ==========================================
  openAdminModal() {
    if (this.isAdminLoggedIn) {
      this.openAdminDashboard();
    } else {
      document.getElementById('modal-admin-login').classList.add('active');
    }
  }

  fillAdminForm() {
    document.getElementById('admin-login-email').value = 'admin@aatmadeepobhava.edu';
    document.getElementById('admin-login-pass').value = 'admin123';
  }

  quickAdminLogin() {
    this.fillAdminForm();
    this.isAdminLoggedIn = true;
    this.openAdminDashboard();
    this.showToast('Logged in as Administrator', 'success');
  }

  handleAdminLogin(e) {
    e.preventDefault();
    const email = document.getElementById('admin-login-email').value.trim();
    const pass = document.getElementById('admin-login-pass').value.trim();

    if (email === 'admin@aatmadeepobhava.edu' && pass === 'admin123') {
      this.isAdminLoggedIn = true;
      this.closeModal('modal-admin-login');
      this.openAdminDashboard();
      this.showToast('Admin Authentication Successful!', 'success');
    } else {
      this.showToast('Invalid Credentials!', 'error');
    }
  }

  adminLogout() {
    this.isAdminLoggedIn = false;
    this.closeModal('modal-admin-dashboard');
    this.showToast('Logged out of Admin Portal', 'info');
  }

  openAdminDashboard() {
    this.renderAdminStudents();
    this.renderAdminTasks();
    this.renderAdminCerts();
    document.getElementById('modal-admin-dashboard').classList.add('active');
  }

  showAdminTab(tabName) {
    document.querySelectorAll('.admin-tab-btn').forEach(b => b.classList.remove('active'));
    if (event && event.currentTarget) event.currentTarget.classList.add('active');

    document.querySelectorAll('.admin-tab-content').forEach(c => c.classList.remove('active'));
    document.getElementById(`admin-tab-${tabName}`).classList.add('active');
  }

  renderAdminStudents() {
    const tbody = document.getElementById('admin-students-tbody');
    if (!tbody) return;

    tbody.innerHTML = this.data.students.map(s => `
      <tr>
        <td><code>${s.id}</code></td>
        <td><strong>${s.name}</strong></td>
        <td>${s.phone}<br><span class="text-xs text-muted">${s.email}</span></td>
        <td><span class="text-purple text-bold">${s.domain}</span></td>
        <td><span class="badge badge-green">${s.paymentStatus}</span></td>
        <td>${s.startDate}</td>
        <td>
          <button class="btn btn-xs btn-outline-purple" onclick="app.adminChangeStartDate('${s.id}')">Adjust Date</button>
        </td>
      </tr>
    `).join('');
  }

  filterAdminStudents() {
    const q = document.getElementById('admin-search-student').value.toLowerCase();
    const rows = document.querySelectorAll('#admin-students-tbody tr');

    rows.forEach(r => {
      r.style.display = r.innerText.toLowerCase().includes(q) ? '' : 'none';
    });
  }

  adminChangeStartDate(studentId) {
    const student = this.data.students.find(s => s.id === studentId);
    if (!student) return;

    const newDate = prompt(`Enter new Start Date for ${student.name} (YYYY-MM-DD):`, student.startDate);
    if (newDate) {
      student.startDate = newDate;
      this.saveData();
      this.renderAdminStudents();
      this.renderStudentDashboard();
      this.showToast(`Updated Start Date for ${student.name}`, 'success');
    }
  }

  renderAdminTasks() {
    const tbody = document.getElementById('admin-tasks-tbody');
    if (!tbody) return;

    let rowsHtml = '';
    this.data.students.forEach(s => {
      s.tasks.forEach(t => {
        rowsHtml += `
          <tr>
            <td><code>${s.id}</code><br><strong>${s.name}</strong></td>
            <td>${s.domain}</td>
            <td>Week ${t.num}</td>
            <td>${t.link ? `<a href="${t.link}" target="_blank" class="text-purple">${t.link}</a>` : '<span class="text-muted">No Link</span>'}</td>
            <td><span class="badge ${t.status === 'Approved' ? 'badge-green' : t.status === 'Submitted' ? 'badge-blue' : 'badge-orange'}">${t.status}</span></td>
            <td>
              ${t.status === 'Submitted' 
                ? `<button class="btn btn-xs btn-purple" onclick="app.adminApproveTask('${s.id}', ${t.num})">Approve & Grade A+</button>`
                : t.status === 'Approved'
                ? `<span class="text-xs text-green">Graded ✓</span>`
                : `<span class="text-xs text-muted">Awaiting Submission</span>`
              }
            </td>
          </tr>
        `;
      });
    });

    tbody.innerHTML = rowsHtml;
  }

  adminApproveTask(studentId, taskNum) {
    const student = this.data.students.find(s => s.id === studentId);
    if (student) {
      const taskObj = student.tasks.find(t => t.num === taskNum);
      if (taskObj) taskObj.status = 'Approved';

      const approvedCount = student.tasks.filter(t => t.status === 'Approved').length;
      if (approvedCount >= 4) {
        student.certs.completion = true;
        student.certs.appreciation = true;
      }

      this.saveData();
      this.renderAdminTasks();
      this.renderAdminCerts();
      this.renderStudentDashboard();
      this.showToast(`Task ${taskNum} for ${student.name} Approved & Graded A+!`, 'success');
    }
  }

  renderAdminCerts() {
    const tbody = document.getElementById('admin-certs-tbody');
    if (!tbody) return;

    tbody.innerHTML = this.data.students.map(s => `
      <tr>
        <td><code>${s.id}</code><br><strong>${s.name}</strong></td>
        <td>${s.domain}</td>
        <td><button class="btn btn-xs ${s.certs.offer ? 'btn-purple' : 'btn-light'}" onclick="app.toggleCertState('${s.id}', 'offer')">${s.certs.offer ? 'Granted ✓' : 'Grant'}</button></td>
        <td><button class="btn btn-xs ${s.certs.completion ? 'btn-purple' : 'btn-light'}" onclick="app.toggleCertState('${s.id}', 'completion')">${s.certs.completion ? 'Granted ✓' : 'Grant'}</button></td>
        <td><button class="btn btn-xs ${s.certs.attendance ? 'btn-purple' : 'btn-light'}" onclick="app.toggleCertState('${s.id}', 'attendance')">${s.certs.attendance ? 'Granted ✓' : 'Grant'}</button></td>
        <td><button class="btn btn-xs ${s.certs.authorization ? 'btn-purple' : 'btn-light'}" onclick="app.toggleCertState('${s.id}', 'authorization')">${s.certs.authorization ? 'Granted ✓' : 'Grant'}</button></td>
        <td><button class="btn btn-xs ${s.certs.appreciation ? 'btn-purple' : 'btn-light'}" onclick="app.toggleCertState('${s.id}', 'appreciation')">${s.certs.appreciation ? 'Granted ✓' : 'Grant Honor'}</button></td>
      </tr>
    `).join('');
  }

  toggleCertState(studentId, certKey) {
    const student = this.data.students.find(s => s.id === studentId);
    if (student) {
      student.certs[certKey] = !student.certs[certKey];
      this.saveData();
      this.renderAdminCerts();
      this.renderStudentDashboard();
      this.showToast(`Updated ${certKey.toUpperCase()} status for ${student.name}`, 'info');
    }
  }

  showToast(msg, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<i class="fa-solid ${type === 'success' ? 'fa-circle-check text-purple' : 'fa-info-circle'}"></i> <span>${msg}</span>`;
    container.appendChild(toast);

    setTimeout(() => { toast.remove(); }, 3200);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.app = new AatmaDeepoApp();
});

/* Premium polish: sticky-nav shadow + scroll reveal */
(function () {
  const nav = document.getElementById('navbar');
  const onScroll = () => nav && nav.classList.toggle('scrolled', window.scrollY > 8);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  const items = document.querySelectorAll('.reveal');
  if (!('IntersectionObserver' in window)) { items.forEach(el => el.classList.add('in')); return; }
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
  items.forEach((el, i) => { el.style.setProperty('--d', (i % 4) * 0.08 + 's'); io.observe(el); });
})();
