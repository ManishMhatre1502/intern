/* ==========================================================================
   Aatma Deepo Bhava - Application Logic & Student Progress Tracker
   ========================================================================== */

const APP_STORAGE_KEY = 'AATMA_DEEPO_BHAVA_DATA_V4';
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

const DEFAULT_DOMAINS = [
  {
    id: 'web-dev',
    company: 'Aatma Deepo Bhava',
    companyLogo: 'fa-solid fa-graduation-cap',
    logoColor: '#ffffff',
    title: 'Web Development Intern',
    image: 'assets/internship-web-development-photo.jpg',
    category: 'web',
    location: 'Online',
    duration: '1 Month',
    startTimeline: '10-20 Days post registration',
    tags: ['Web Development', 'Frontend', 'HTML/CSS/JS'],
    price: 1000,
    desc: 'Master HTML5, CSS3, JavaScript ES6+, Node.js, and modern frontend/backend frameworks by building scalable Web Applications.'
  },
  {
    id: 'ui-ux',
    company: 'Aatma Deepo Bhava',
    companyLogo: 'fa-solid fa-graduation-cap',
    logoColor: '#ffffff',
    title: 'UI/UX Design Intern',
    image: 'assets/internship-ui-ux-photo.jpg',
    category: 'web',
    location: 'Online',
    duration: '1 Month',
    startTimeline: '10-20 Days post registration',
    tags: ['UI/UX Design', 'Figma', 'Product Strategy'],
    price: 1000,
    desc: 'Design intuitive digital products, wireframes, high-fidelity prototypes, user journey maps, and modern design systems.'
  },
  {
    id: 'data-analytics',
    company: 'Aatma Deepo Bhava',
    companyLogo: 'fa-solid fa-graduation-cap',
    logoColor: '#ffffff',
    title: 'Data Analyst Intern',
    image: 'assets/internship-data-analytics-photo.jpg',
    category: 'ai',
    location: 'Online',
    duration: '1 Month',
    startTimeline: '10-20 Days post registration',
    tags: ['Data Science', 'Analytics', 'Pandas/SQL'],
    price: 1000,
    desc: 'Transform raw data into business intelligence using Pandas, SQL, Tableau, and automated data processing pipelines.'
  },
  {
    id: 'cybersecurity',
    company: 'Aatma Deepo Bhava',
    companyLogo: 'fa-solid fa-graduation-cap',
    logoColor: '#ffffff',
    title: 'Cybersecurity Intern',
    image: 'assets/internship-cybersecurity-photo.jpg',
    category: 'cyber',
    location: 'Online',
    duration: '1 Month',
    startTimeline: '10-20 Days post registration',
    tags: ['Cybersecurity', 'Network Security', 'OWASP'],
    price: 1000,
    desc: 'Learn vulnerability assessment, penetration testing, network defense strategies, and web application security auditing.'
  },
  {
    id: 'ai-ml',
    company: 'Aatma Deepo Bhava',
    companyLogo: 'fa-solid fa-graduation-cap',
    logoColor: '#ffffff',
    title: 'AI & Machine Learning Intern',
    image: 'assets/internship-ai-ml-photo.jpg',
    category: 'ai',
    location: 'Online',
    duration: '1 Month',
    startTimeline: '10-20 Days post registration',
    tags: ['AI/ML', 'Python', 'Neural Networks'],
    price: 1000,
    desc: 'Dive into Python, Neural Networks, Computer Vision, and Predictive Modeling with hands-on weekly machine learning algorithms.'
  },
  {
    id: 'other-courses',
    company: 'Aatma Deepo Bhava',
    companyLogo: 'fa-solid fa-graduation-cap',
    logoColor: '#ffffff',
    title: 'Other Courses',
    image: 'assets/internship-other-courses-photo.jpg',
    category: 'others',
    location: 'Online',
    duration: '1 Month',
    startTimeline: '10-20 Days post registration',
    tags: ['Explore Courses', 'Career Skills', 'More Programs'],
    price: 1000,
    desc: 'Explore additional course and internship options designed to build practical skills and support your career goals.'
  }
];

class AatmaDeepoApp {
  constructor() {
    this.data = this.loadData();
    this.activeStudentId = null;
    this.isAdminLoggedIn = false;
    this.currentUser = null;
    this.adminAccounts = [];
    this.adminEnrollments = [];
    this.adminTaskSubmissions = [];
    this.authReturnFocus = null;

    this.init();
  }

  async init() {
    this.renderDomains('all');
    this.renderStudentSelector();
    this.renderStudentDashboard();

    const authGate = document.getElementById('auth-gate');
    authGate?.addEventListener('click', event => this.handleAuthBackdropClick(event));
    document.addEventListener('keydown', event => this.handleAuthKeydown(event));

    try {
      const response = await fetch('/api/auth/session', { credentials: 'same-origin' });
      const payload = await response.json();
      if (payload.user) await this.enterAuthenticatedSite(payload.user);
    } catch {
      this.showToast('The sign-in service is temporarily unavailable.', 'error');
    }
  }

  loadData() {
    // Remove the previous demo database, which stored demo passwords in browser storage.
    try { localStorage.removeItem('AATMA_DEEPO_BHAVA_DATA_V3'); } catch { /* Auth itself is server-backed. */ }
    return { domains: DEFAULT_DOMAINS, students: [] };
  }

  saveData() {
    if (this.currentUser?.role === 'user') {
      localStorage.setItem(`${APP_STORAGE_KEY}_${this.currentUser.id}`, JSON.stringify(this.data.students));
    }
  }

  showAuthMessage(message = '', type = 'error') {
    const status = document.getElementById('auth-message');
    if (!status) return;
    status.textContent = message;
    status.className = message ? `auth-message is-${type}` : 'auth-message';
  }

  showAuthMode(mode) {
    const gate = document.getElementById('auth-gate');
    if (!gate) return;

    if (gate.hidden) this.authReturnFocus = document.activeElement;

    const register = mode === 'register';
    const admin = mode === 'admin';
    document.getElementById('auth-user-panel').hidden = admin;
    document.getElementById('auth-admin-panel').hidden = !admin;
    document.getElementById('auth-login-form').hidden = register;
    document.getElementById('auth-register-form').hidden = !register;
    document.getElementById('auth-login-tab').classList.toggle('active', !register && !admin);
    document.getElementById('auth-register-tab').classList.toggle('active', register);
    document.getElementById('auth-login-tab').setAttribute('aria-selected', String(!register && !admin));
    document.getElementById('auth-register-tab').setAttribute('aria-selected', String(register));
    document.getElementById('auth-title').textContent = admin ? 'Admin Login' : register ? 'Start your journey' : 'Welcome back';
    document.getElementById('auth-description').textContent = admin
      ? 'Sign in with your site owner configured credentials.'
      : register ? 'Create your account and start building real-world experience.' : 'Sign in to explore your internship opportunities.';

    gate.hidden = false;
    gate.setAttribute('aria-hidden', 'false');
    document.body.classList.add('auth-modal-open');
    const mobileMenu = document.getElementById('nav-links');
    mobileMenu?.classList.remove('active');
    const menuToggle = document.querySelector('.mobile-toggle');
    menuToggle?.setAttribute('aria-expanded', 'false');
    menuToggle?.setAttribute('aria-label', 'Open menu');
    this.showAuthMessage('');

    const firstFieldId = admin ? 'auth-admin-username' : register ? 'auth-register-name' : 'auth-login-email';
    window.requestAnimationFrame(() => document.getElementById(firstFieldId)?.focus());
  }

  closeAuthModal({ restoreFocus = true } = {}) {
    const gate = document.getElementById('auth-gate');
    if (!gate) return;

    const wasOpen = !gate.hidden;
    gate.hidden = true;
    gate.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('auth-modal-open');
    this.showAuthMessage('');

    const returnFocus = this.authReturnFocus;
    this.authReturnFocus = null;
    if (restoreFocus && wasOpen && returnFocus?.isConnected) returnFocus.focus();
  }

  handleAuthBackdropClick(event) {
    if (event.target === event.currentTarget) this.closeAuthModal();
  }

  handleAuthKeydown(event) {
    const gate = document.getElementById('auth-gate');
    if (!gate || gate.hidden) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      this.closeAuthModal();
      return;
    }
    if (event.key !== 'Tab') return;

    const focusable = Array.from(gate.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'))
      .filter(element => !element.closest('[hidden]') && element.getClientRects().length > 0);
    if (!focusable.length) {
      event.preventDefault();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && (document.activeElement === first || !gate.contains(document.activeElement))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (document.activeElement === last || !gate.contains(document.activeElement))) {
      event.preventDefault();
      first.focus();
    }
  }

  async postAuth(path, values) {
    let response;
    try {
      response = await fetch(path, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values)
      });
    } catch {
      throw new Error('Cannot reach the secure login server. Start the website with “npm start” and open its server URL.');
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      throw new Error('The login API is unavailable at this address. Start the website with “npm start” and open http://localhost:3000.');
    }

    let payload;
    try {
      payload = await response.json();
    } catch {
      throw new Error('The login server returned an invalid response. Please restart it and try again.');
    }
    if (!response.ok) throw new Error(payload.error || `Request failed (${response.status}). Please try again.`);
    return payload;
  }

  async enterAuthenticatedSite(user) {
    this.currentUser = user;
    this.isAdminLoggedIn = user.role === 'admin';
    if (user.role === 'user') {
      try { this.data.students = JSON.parse(localStorage.getItem(`${APP_STORAGE_KEY}_${user.id}`) || '[]'); }
      catch { this.data.students = []; }
      this.activeStudentId = this.data.students[0]?.id || null;
    } else {
      this.data.students = [];
      this.activeStudentId = null;
    }
    this.closeAuthModal({ restoreFocus: false });
    document.body.classList.add('authenticated');
    this.renderStudentSelector();
    this.renderStudentDashboard();
    this.showSection('home');
    if (this.isAdminLoggedIn) await this.openAdminDashboard();
  }

  async handleUserLogin(e) {
    e.preventDefault();
    const form = e.currentTarget;
    const submit = form.querySelector('[type="submit"]');
    submit.disabled = true;
    try {
      const payload = await this.postAuth('/api/auth/login', {
        email: document.getElementById('auth-login-email').value,
        password: document.getElementById('auth-login-password').value
      });
      this.showAuthMessage('');
      await this.enterAuthenticatedSite(payload.user);
    } catch (error) {
      this.showAuthMessage(error.message);
    } finally {
      submit.disabled = false;
    }
  }

  async handleUserRegistration(e) {
    e.preventDefault();
    const password = document.getElementById('auth-register-password').value;
    const confirmation = document.getElementById('auth-register-confirm').value;
    if (password !== confirmation) return this.showAuthMessage('The passwords do not match.');
    const form = e.currentTarget;
    const submit = form.querySelector('[type="submit"]');
    submit.disabled = true;
    try {
      const payload = await this.postAuth('/api/auth/register', {
        name: document.getElementById('auth-register-name').value,
        email: document.getElementById('auth-register-email').value,
        mobile: document.getElementById('auth-register-mobile').value,
        password
      });
      form.reset();
      this.showAuthMessage('');
      await this.enterAuthenticatedSite(payload.user);
    } catch (error) {
      this.showAuthMessage(error.message);
    } finally {
      submit.disabled = false;
    }
  }

  async handleAdminLogin(e) {
    e.preventDefault();
    const form = e.currentTarget;
    const submit = form.querySelector('[type="submit"]');
    submit.disabled = true;
    try {
      const payload = await this.postAuth('/api/auth/admin-login', {
        username: document.getElementById('auth-admin-username').value,
        password: document.getElementById('auth-admin-password').value
      });
      form.reset();
      this.showAuthMessage('');
      await this.enterAuthenticatedSite(payload.user);
    } catch (error) {
      this.showAuthMessage(error.message);
    } finally {
      submit.disabled = false;
    }
  }

  async logout() {
    try { await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' }); }
    finally {
      this.currentUser = null;
      this.isAdminLoggedIn = false;
      this.adminAccounts = [];
      this.data.students = [];
      this.activeStudentId = null;
      this.closeAuthModal({ restoreFocus: false });
      document.body.classList.remove('authenticated');
      const adminModal = document.getElementById('modal-admin-dashboard');
      if (adminModal) adminModal.classList.remove('active');
      const adminHost = document.getElementById('admin-dashboard-host');
      if (adminHost) adminHost.replaceChildren();
      this.showAuthMessage('');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  showSection(viewId, targetElementId = null) {
    if (viewId === 'student-zone' && !this.currentUser) {
      this.showToast('Log in or register to open your student portal.', 'info');
      return;
    }
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
    const menuToggle = document.querySelector('.mobile-toggle');
    menuToggle?.setAttribute('aria-expanded', 'false');
    menuToggle?.setAttribute('aria-label', 'Open menu');
  }

  scrollToSection(secId) {
    this.showSection('home', secId);
  }

  toggleMobileMenu() {
    const menu = document.getElementById('nav-links');
    if (!menu) return;
    const expanded = menu.classList.toggle('active');
    const toggle = document.querySelector('.mobile-toggle');
    toggle?.setAttribute('aria-expanded', String(expanded));
    toggle?.setAttribute('aria-label', expanded ? 'Close menu' : 'Open menu');
  }

  renderDomains(category = 'all', searchQuery = '') {
    const grid = document.getElementById('domains-grid');
    if (!grid) return;

    const query = searchQuery.trim().toLowerCase();
    const filtered = this.data.domains.filter(domain => {
      const matchesCategory = category === 'all' || domain.category === category;
      const matchesQuery = !query || domain.title.toLowerCase().includes(query) || domain.company.toLowerCase().includes(query) || domain.tags.some(tag => tag.toLowerCase().includes(query));
      return matchesCategory && matchesQuery;
    });

    grid.innerHTML = filtered.length ? filtered.map(domain => `
      <article class="internship-card">
        <div class="internship-card-image">
          <img src="${domain.image || DEFAULT_DOMAINS.find(item => item.id === domain.id)?.image || ''}" alt="${domain.title} internship illustration" loading="lazy">
          <span class="internship-image-label">Featured opportunity</span>
        </div>
        <div class="internship-card-content">
          <div class="internship-card-top">
            <div class="company-logo-box"><i class="fa-solid fa-graduation-cap" aria-hidden="true"></i></div>
            <button class="bookmark-btn" aria-label="Bookmark ${domain.title}" onclick="app.showToast('Bookmarked ${domain.title}', 'info')"><i class="fa-regular fa-bookmark" aria-hidden="true"></i></button>
          </div>
          <h3 class="ic-title">${domain.title}</h3>
          <div class="ic-company">${domain.company}</div>
          <div class="internship-meta"><span><i class="fa-solid fa-location-dot" aria-hidden="true"></i> ${domain.location}</span><span><i class="fa-regular fa-clock" aria-hidden="true"></i> ${domain.duration}</span></div>
          <div class="internship-tags">${domain.tags.map(tag => `<span class="badge badge-purple">${tag}</span>`).join('')}</div>
        </div>
        <div class="internship-card-footer"><span class="internship-price">₹${domain.price}</span><button class="btn btn-purple btn-sm" onclick="app.applyForInternship('${domain.title}')">Apply Now</button></div>
      </article>
    `).join('') : '<p class="catalog-empty">No internships match your search. Try another keyword or category.</p>';
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
  // INTERNSHIP REGISTRATION
  // ==========================================
  applyForInternship(preselectDomain = null) {
    if (!this.currentUser) {
      this.showToast('Log in or register to apply for an internship.', 'info');
      return;
    }
    return this.openRegisterModal(preselectDomain);
  }

  openRegisterModal(preselectDomain = null) {
    if (!this.currentUser) {
      this.showAuthMode('register');
      return;
    }
    if (this.currentUser.role !== 'user') return this.showToast('Student accounts can apply for internships.', 'info');
    const modal = document.getElementById('modal-register');
    if (!modal) return;
    document.getElementById('reg-name').value = this.currentUser.name;
    document.getElementById('reg-email').value = this.currentUser.email;
    document.getElementById('reg-phone').value = this.currentUser.mobile;
    const select = document.getElementById('reg-domain');
    const courseInput = document.getElementById('reg-course');
    if (select) select.value = preselectDomain || 'AUTO';
    if (courseInput) courseInput.value = '';
    this.updateRegistrationDomainFields();
    modal.classList.add('active');
  }

  updateRegistrationDomainFields() {
    const domainGroup = document.getElementById('reg-domain-group');
    const courseGroup = document.getElementById('reg-course-group');
    const domainSelect = document.getElementById('reg-domain');
    const courseInput = document.getElementById('reg-course');
    const otherCourse = domainSelect && domainSelect.value === 'Other Courses';
    if (domainGroup) domainGroup.style.display = otherCourse ? 'none' : '';
    if (courseGroup) courseGroup.style.display = otherCourse ? '' : 'none';
    if (domainSelect) domainSelect.required = !otherCourse;
    if (courseInput) {
      courseInput.required = Boolean(otherCourse);
      courseInput.disabled = !otherCourse;
    }
  }

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('active');
  }

  async completeRazorpayCheckout(checkout, enrollmentId) {
    if (typeof window.Razorpay !== 'function') throw new Error('Secure checkout did not load. Check your connection and try again.');
    return new Promise(resolve => {
      let settled = false;
      const finish = result => {
        if (settled) return;
        settled = true;
        resolve(result);
      };
      const checkoutWindow = new window.Razorpay({
        key: checkout.keyId,
        amount: checkout.amount,
        currency: checkout.currency,
        name: checkout.name,
        description: checkout.description,
        order_id: checkout.orderId,
        prefill: checkout.prefill,
        theme: { color: '#245dcc' },
        handler: async response => {
          try {
            const confirmation = await this.postAuth('/api/payments/verify', {
              enrollmentId,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_signature: response.razorpay_signature
            });
            finish({ confirmation });
          } catch (error) {
            finish({ error: error.message });
          }
        },
        modal: { ondismiss: () => finish({ cancelled: true }) }
      });
      checkoutWindow.on('payment.failed', () => finish({ error: 'Payment was not completed. Your enrollment remains pending; you can try again.' }));
      checkoutWindow.open();
    });
  }

  async handleRegistrationSubmit(e) {
    e.preventDefault();
    const form = e.currentTarget;
    const submit = form.querySelector('[type="submit"]');
    submit.disabled = true;

    let domain = document.getElementById('reg-domain').value;
    if (domain === 'Other Courses') {
      domain = `Other Courses — ${document.getElementById('reg-course').value.trim()}`;
    } else if (domain === 'AUTO') {
      domain = 'Web Development Intern';
    }

    let enrollment;
    let confirmation;
    try {
      const order = await this.postAuth('/api/internships/enroll', { title: domain });
      const result = await this.completeRazorpayCheckout(order.checkout, order.enrollment.id);
      if (result.cancelled) {
        this.showToast('Payment was cancelled. No paid enrollment or offer letter has been issued.', 'info');
        submit.disabled = false;
        return;
      }
      if (result.error) throw new Error(result.error);
      confirmation = result.confirmation;
      enrollment = confirmation.enrollment;
    } catch (error) {
      this.showToast(error.message, 'error');
      submit.disabled = false;
      return;
    }

    const newStudent = {
      id: enrollment.id,
      name: this.currentUser?.name || document.getElementById('reg-name').value.trim(),
      email: this.currentUser?.email || document.getElementById('reg-email').value.trim(),
      phone: this.currentUser?.mobile || document.getElementById('reg-phone').value.trim(),
      domain: enrollment.title,
      registrationDate: enrollment.enrolledAt.slice(0, 10),
      startDate: enrollment.startDate,
      endDate: enrollment.endDate,
      totalDays: 30,
      paymentStatus: 'Paid (INR 1,000)',
      tasks: [
        { num: 1, title: 'Week 1 task', status: 'Pending', link: '', notes: '' },
        { num: 2, title: 'Week 2 task', status: 'Pending', link: '', notes: '' },
        { num: 3, title: 'Week 3 task', status: 'Pending', link: '', notes: '' },
        { num: 4, title: 'Week 4 task', status: 'Pending', link: '', notes: '' }
      ],
      certs: {
        offer: confirmation.offerLetterSent === true,
        completion: enrollment.completionCertificateSent === true,
        attendance: false,
        authorization: false,
        appreciation: enrollment.appreciationLetterSent === true
      }
    };

    this.data.students.unshift(newStudent);
    this.activeStudentId = newStudent.id;
    this.saveData();

    this.closeModal('modal-register');
    this.showToast(`Payment confirmed! Enrollment ID: ${newStudent.id}`, 'success');
    if (confirmation.offerLetterPending) {
      this.showToast('Your offer letter is pending email setup. The administrator can resend it.', 'info');
    }

    document.getElementById('form-register').reset();
    submit.disabled = false;
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
      container.innerHTML = this.currentUser?.role === 'user'
        ? `<div class="card-white text-center p-4"><h3>Welcome, ${escapeHtml(this.currentUser.name)}.</h3><p class="text-muted mt-2">Your account is ready. Apply to an internship to start your student progress dashboard.</p><button class="btn btn-purple mt-3" onclick="app.openRegisterModal()">Explore internships</button></div>`
        : `<div class="card-white text-center p-4">No internship profile is available yet.</div>`;
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

    // Keep the viewer protected even if called directly from the browser console.
    if (!student.certs?.[certType]) {
      this.showToast('This document is locked until you complete the internship requirements.', 'info');
      return;
    }

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
    if (this.isAdminLoggedIn) this.openAdminDashboard();
    else this.showAuthMode('admin');
  }

  adminLogout() { return this.logout(); }

  async openAdminDashboard() {
    const response = await fetch('/api/admin/dashboard', { credentials: 'same-origin', cache: 'no-store' });
    if (!response.ok) {
      this.isAdminLoggedIn = false;
      return this.logout();
    }
    const host = document.getElementById('admin-dashboard-host');
    if (!host) return;
    host.innerHTML = await response.text();
    try {
      await this.refreshAdminDashboardData();
    } catch {
      this.showToast('Could not load admin workflow data. Please retry.', 'error');
      return;
    }
    document.getElementById('modal-admin-dashboard').classList.add('active');
  }

  async refreshAdminDashboardData() {
    const response = await fetch('/api/admin/dashboard-data', { credentials: 'same-origin', cache: 'no-store' });
    if (!response.ok) throw new Error('Could not load admin data.');
    const payload = await response.json();
    this.adminSummary = payload.summary || { totalStudents: 0, internshipStudents: 0, notStarted: 0 };
    this.adminAccounts = payload.students || [];
    this.adminEnrollments = payload.enrollments || [];
    this.adminTaskSubmissions = payload.taskSubmissions || [];
    this.renderAdminStudents();
    this.renderAdminTasks();
    this.renderAdminCerts();
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

    const summary = this.adminSummary || { totalStudents: 0, internshipStudents: 0, notStarted: 0 };
    document.getElementById('admin-total-students').textContent = summary.totalStudents;
    document.getElementById('admin-internship-students').textContent = summary.internshipStudents;
    document.getElementById('admin-not-started').textContent = summary.notStarted;

    tbody.innerHTML = this.adminAccounts.length ? this.adminAccounts.map(student => {
      const paidEnrollments = student.internships.filter(item => item.paymentStatus === 'Paid');
      const approved = paidEnrollments.reduce((sum, item) => sum + item.approvedWeeks.length, 0);
      const total = paidEnrollments.length * 4;
      const progress = paidEnrollments.length ? `${approved}/${total} weekly tasks approved` : 'No paid enrollment';
      const offerSent = paidEnrollments.length > 0 && paidEnrollments.every(item => item.offerLetterSent);
      return `
        <tr class="admin-student-row" tabindex="0" role="button" onclick="app.showAdminStudentDetails('${escapeHtml(student.id)}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();app.showAdminStudentDetails('${escapeHtml(student.id)}')}">
          <td><strong>${escapeHtml(student.name)}</strong><small>${escapeHtml(student.id)}</small></td>
          <td>${escapeHtml(student.email)}</td>
          <td>${escapeHtml(student.mobile)}</td>
          <td>${new Date(student.createdAt).toLocaleDateString()}</td>
          <td><span class="admin-status ${approved ? 'is-active' : 'is-pending'}">${escapeHtml(progress)}</span></td>
          <td><span class="admin-status ${offerSent ? 'is-active' : 'is-pending'}">${offerSent ? 'Sent' : 'Pending'}</span></td>
          <td><button class="admin-detail-link" type="button" onclick="event.stopPropagation();app.showAdminStudentDetails('${escapeHtml(student.id)}')">View details</button></td>
        </tr>`;
    }).join('') : '<tr><td colspan="7" class="text-muted">No students have registered yet.</td></tr>';
  }

  showAdminStudentDetails(studentId) {
    const student = this.adminAccounts.find(account => account.id === studentId);
    const panel = document.getElementById('admin-student-details');
    if (!student || !panel) return;
    const internships = student.internships.length ? student.internships.map(internship => `
      <div class="admin-enrollment-detail">
        <div><strong>${escapeHtml(internship.title)}</strong><span class="admin-status ${internship.status === 'In Progress' ? 'is-active' : 'is-pending'}">${escapeHtml(internship.status)}</span></div>
        <p>Enrolled ${new Date(internship.enrolledAt).toLocaleDateString()} · Starts ${new Date(`${internship.startDate}T00:00:00`).toLocaleDateString()} · Ends ${new Date(`${internship.endDate}T00:00:00`).toLocaleDateString()}</p>
        <p>${escapeHtml(internship.paymentStatus)}</p>
      </div>
    `).join('') : '<p class="text-muted">This student has not enrolled in an internship yet.</p>';
    panel.innerHTML = `
      <div class="admin-detail-heading"><div><span>Student details</span><h4>${escapeHtml(student.name)}</h4></div><button type="button" class="admin-detail-close" aria-label="Close student details" onclick="document.getElementById('admin-student-details').hidden=true">×</button></div>
      <dl class="admin-student-facts"><div><dt>Email</dt><dd>${escapeHtml(student.email)}</dd></div><div><dt>Mobile</dt><dd>${escapeHtml(student.mobile)}</dd></div><div><dt>Registered</dt><dd>${new Date(student.createdAt).toLocaleDateString()}</dd></div></dl>
      <h5>Internship status and details</h5>${internships}
    `;
    panel.hidden = false;
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
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
    const submissions = this.adminTaskSubmissions || [];
    tbody.innerHTML = submissions.length ? submissions.map(task => {
      const safeId = escapeHtml(task.id);
      const statusClass = task.status === 'Approved' ? 'is-active' : task.status === 'Needs changes' ? 'is-review' : 'is-pending';
      return `
        <tr>
          <td><strong>${escapeHtml(task.studentEmail)}</strong><small>${escapeHtml(task.enrollmentId)}</small></td>
          <td>${escapeHtml(task.domain)}</td>
          <td><span class="admin-status is-blue">Week ${Number(task.week)}</span></td>
          <td><a href="${escapeHtml(task.submissionUrl)}" target="_blank" rel="noopener noreferrer">Open submission</a></td>
          <td>${new Date(task.submittedAt).toLocaleString()}</td>
          <td><span class="admin-status ${statusClass}">${escapeHtml(task.status)}</span></td>
          <td><input class="form-control admin-task-feedback" id="admin-feedback-${safeId}" value="${escapeHtml(task.feedback)}" maxlength="2000" aria-label="Feedback for week ${Number(task.week)}"></td>
          <td><button class="admin-action-button is-primary" type="button" onclick="app.adminReviewTask('${safeId}','Approved')">Approve</button><button class="admin-action-button" type="button" onclick="app.adminReviewTask('${safeId}','Needs changes')">Request changes</button></td>
        </tr>`;
    }).join('') : '<tr><td colspan="8" class="text-muted">No weekly submissions have arrived yet. Configure the Google Forms webhook to receive submissions.</td></tr>';
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
    const enrollments = this.adminEnrollments || [];
    tbody.innerHTML = enrollments.length ? enrollments.map(enrollment => {
      const id = escapeHtml(enrollment.id);
      const eligible = enrollment.paymentStatus === 'Paid' && enrollment.approvedWeeks.length === 4;
      const weeks = enrollment.paymentStatus === 'Paid' ? `${enrollment.approvedWeeks.length}/4 approved` : 'Payment pending';
      const offerState = enrollment.offerLetterSent ? '<span class="admin-status is-active">Sent</span>' : '<span class="admin-status is-pending">Not sent</span>';
      const completionState = enrollment.completionCertificateSent ? '<span class="admin-status is-active">Issued</span>' :
        eligible ? `<button class="admin-action-button is-primary" type="button" onclick="app.adminIssueDocument('${id}','completion-certificate')">Issue Internship Certificate</button>` :
        '<span class="admin-status is-pending">Awaiting 4 approvals</span>';
      const appreciationState = enrollment.appreciationLetterSent ? '<span class="admin-status is-active">Granted</span>' :
        eligible ? `<button class="admin-action-button is-success" type="button" onclick="app.adminIssueDocument('${id}','appreciation-letter')">Grant Appreciation Letter</button>` :
        '<span class="admin-status is-pending">Awaiting 4 approvals</span>';
      const offerAction = enrollment.offerLetterSent ? '' : enrollment.paymentStatus === 'Paid'
        ? `<button class="admin-action-button" type="button" onclick="app.adminIssueDocument('${id}','offer-letter')">Send / retry offer</button>`
        : '<span class="admin-status is-pending">After payment</span>';
      return `
        <tr>
          <td><strong>${escapeHtml(enrollment.studentName)}</strong><small>${escapeHtml(enrollment.studentEmail)}</small></td>
          <td>${escapeHtml(enrollment.title)}<small>${escapeHtml(enrollment.id)}</small></td>
          <td><span class="admin-status ${eligible ? 'is-active' : 'is-pending'}">${escapeHtml(weeks)}</span></td>
          <td>${offerState}</td>
          <td>${completionState}</td>
          <td>${appreciationState}</td>
          <td>${offerAction || '<span class="text-muted">Documents sent</span>'}</td>
        </tr>`;
    }).join('') : '<tr><td colspan="7" class="text-muted">No internship enrollments are available yet.</td></tr>';
  }

  async adminReviewTask(submissionId, status) {
    const feedback = document.getElementById(`admin-feedback-${submissionId}`)?.value || '';
    try {
      const response = await fetch(`/api/admin/task-submissions/${encodeURIComponent(submissionId)}/review`, {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, feedback })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Could not update task review.');
      await this.refreshAdminDashboardData();
      this.showToast(`Week marked: ${status}.`, 'success');
    } catch (error) {
      this.showToast(error.message, 'error');
    }
  }

  async adminIssueDocument(enrollmentId, documentType) {
    try {
      const response = await fetch(`/api/admin/enrollments/${encodeURIComponent(enrollmentId)}/${documentType}`, {
        method: 'POST',
        credentials: 'same-origin'
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Could not send the document.');
      await this.refreshAdminDashboardData();
      this.showToast(payload.alreadySent ? 'This document was already sent.' : 'Document email sent.', 'success');
    } catch (error) {
      this.showToast(error.message, 'error');
    }
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
