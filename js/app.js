// APP CORE STATE & NAVIGATION: THỰC PHẨM SỐ MỘT

// 1. Khởi tạo State Toàn cục
let state = {
  leads: [],
  products: [],
  quotes: [],
  syncSettings: {
    sheetUrl: 'https://docs.google.com/spreadsheets/d/100vzbwgIwaJrqtAOaknwMxxILTMiGEhuVt8QX7J2Dpo',
    syncInterval: 300000, // 5 phút
    lastSync: null,
    status: 'idle'
  }
};
window.state = state;

const SYSTEM_PASSWORD = '19871988';
let currentActiveTab = 'tab-dashboard';

const LEAD_STATUS_ORDER = ['new', 'contacting', 'quoting', 'quoted', 'won', 'unqualified', 'canceled'];
const LEAD_STATUS_META = {
  new: { label: 'Mới', badge: 'badge-blue', kanban: { border: 'border-blue', count: 'bg-blue' } },
  contacting: { label: 'Đã liên hệ', badge: 'badge-amber', kanban: { border: 'border-amber', count: 'bg-amber' } },
  quoting: { label: 'Đang báo giá', badge: 'badge-purple', kanban: { border: 'border-purple', count: 'bg-purple' } },
  quoted: { label: 'Đã báo giá', badge: 'badge-pink', kanban: { border: 'border-pink', count: 'bg-pink' } },
  won: { label: 'Đã chốt đơn', badge: 'badge-emerald', kanban: { border: 'border-emerald', count: 'bg-emerald' } },
  unqualified: { label: 'Không tiềm năng', badge: 'badge-rose', kanban: { border: 'border-rose', count: 'bg-rose' } },
  canceled: { label: 'Hủy', badge: 'badge-slate', kanban: { border: 'border-slate', count: 'bg-slate' } }
};

function stripStatusText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeLeadStatus(status) {
  const normalized = stripStatusText(status);
  if (!normalized) return 'new';

  if (['new', 'moi', 'moi nhan', 'tiep nhan'].includes(normalized)) return 'new';
  if (['contacting', 'da lien he', 'lien he', 'lien lac', 'da lien lac', 'contact'].includes(normalized)) return 'contacting';
  if (['quoting', 'dang bao gia', 'thuong luong', 'negotiating', 'dang cham bao gia'].includes(normalized)) return 'quoting';
  if (['quoted', 'da bao gia', 'da gui bao gia', 'bao gia'].includes(normalized)) return 'quoted';
  if (['won', 'da chot don', 'chot don'].includes(normalized)) return 'won';
  if (['unqualified', 'khong tiem nang', 'lost', 'that bai', 'khong phu hop'].includes(normalized)) return 'unqualified';
  if (['canceled', 'cancelled', 'huy', 'huy bo', 'huy don'].includes(normalized)) return 'canceled';
  return 'new';
}

function getLeadStatusLabel(status) {
  const key = normalizeLeadStatus(status);
  return (LEAD_STATUS_META[key] && LEAD_STATUS_META[key].label) || key;
}

function getLeadStatusBadgeClass(status) {
  const key = normalizeLeadStatus(status);
  return (LEAD_STATUS_META[key] && LEAD_STATUS_META[key].badge) || 'badge-blue';
}

function getLeadStatusKanbanClasses(status) {
  const key = normalizeLeadStatus(status);
  return (LEAD_STATUS_META[key] && LEAD_STATUS_META[key].kanban) || LEAD_STATUS_META.new.kanban;
}

window.normalizeLeadStatus = normalizeLeadStatus;
window.getLeadStatusLabel = getLeadStatusLabel;
window.getLeadStatusBadgeClass = getLeadStatusBadgeClass;
window.getLeadStatusKanbanClasses = getLeadStatusKanbanClasses;
window.LEAD_STATUS_ORDER = LEAD_STATUS_ORDER;

// 2. Khởi tạo khi tải trang
document.addEventListener('DOMContentLoaded', () => {
  initAppState();
  setupAuthListeners();
  setupNavigationListeners();
  setupModalAndDrawerListeners();
  checkAuthentication();
  
  // Khởi chạy các module con nếu đã đăng nhập
  if (isAuthenticated()) {
    bootstrapModules();
  }
  
  // Khởi tạo Popup/Banner cài đặt PWA
  initPwaInstallPrompt();
});

// 3. Khởi tạo State & LocalStorage
function initAppState() {
  // Tải dữ liệu từ LocalStorage
  const storedLeads = localStorage.getItem('tps1_leads');
  const storedProducts = localStorage.getItem('tps1_products');
  const storedQuotes = localStorage.getItem('tps1_quotes');
  const storedSettings = localStorage.getItem('tps1_settings');

  if (storedLeads) {
    state.leads = JSON.parse(storedLeads);
  } else {
    state.leads = DEFAULT_LEADS;
    localStorage.setItem('tps1_leads', JSON.stringify(state.leads));
  }

  if (storedProducts) {
    state.products = JSON.parse(storedProducts);
  } else {
    state.products = DEFAULT_PRODUCTS;
    localStorage.setItem('tps1_products', JSON.stringify(state.products));
  }

  state.leads = state.leads.map(lead => ({
    ...lead,
    status: normalizeLeadStatus(lead.status),
    notes: Array.isArray(lead.notes) ? lead.notes : [],
    quotes: Array.isArray(lead.quotes) ? lead.quotes : []
  }));
  localStorage.setItem('tps1_leads', JSON.stringify(state.leads));

  if (storedQuotes) {
    state.quotes = JSON.parse(storedQuotes);
  } else {
    state.quotes = DEFAULT_QUOTES;
    localStorage.setItem('tps1_quotes', JSON.stringify(state.quotes));
  }

  state.quotes = state.quotes.map(q => ({
    status: 'draft',
    result: null,
    subtotal: 0,
    discountAmount: 0,
    totalBeforeVat: 0,
    vatRate: 0,
    vatAmount: 0,
    grandTotal: 0,
    balance: 0,
    updatedAt: q.createdAt || new Date().toISOString(),
    sentAt: null,
    closedAt: null,
    history: [],
    quoteCode: q.quoteCode || null,
    ...q
  }));
  state.quotes = state.quotes.filter(q => !q.deletedAt && !q.deleted_at);
  localStorage.setItem('tps1_quotes', JSON.stringify(state.quotes));

  if (storedSettings) {
    state.syncSettings = JSON.parse(storedSettings);
  } else {
    localStorage.setItem('tps1_settings', JSON.stringify(state.syncSettings));
  }
}

function saveState(key) {
  if (key === 'leads' || !key) localStorage.setItem('tps1_leads', JSON.stringify(state.leads));
  if (key === 'quotes' || !key) localStorage.setItem('tps1_quotes', JSON.stringify(state.quotes));
  if (key === 'products' || !key) localStorage.setItem('tps1_products', JSON.stringify(state.products));
  if (key === 'settings' || !key) localStorage.setItem('tps1_settings', JSON.stringify(state.syncSettings));
}

// 4. Xử lý Đăng nhập & Bảo mật (Auth Gate)
function checkAuthentication() {
  const lockScreen = document.getElementById('lock-screen');
  const dashboard = document.getElementById('dashboard');

  if (isAuthenticated()) {
    lockScreen.classList.add('hidden');
    dashboard.classList.remove('hidden');
    bootstrapModules();
  } else {
    lockScreen.classList.remove('hidden');
    dashboard.classList.add('hidden');
  }
}

function isAuthenticated() {
  return sessionStorage.getItem('tps1_authenticated') === 'true' || 
         localStorage.getItem('tps1_remember_auth') === 'true';
}

function setupAuthListeners() {
  const unlockBtn = document.getElementById('unlock-btn');
  const passwordInput = document.getElementById('password-input');
  const toggleVisibility = document.getElementById('toggle-password-visibility');
  const errorMsg = document.getElementById('login-error-msg');
  const rememberMe = document.getElementById('remember-me-checkbox');

  // Toggle ẩn hiện mật khẩu
  toggleVisibility.addEventListener('click', () => {
    const icon = toggleVisibility.querySelector('i');
    if (passwordInput.type === 'password') {
      passwordInput.type = 'text';
      icon.classList.remove('fa-eye');
      icon.classList.add('fa-eye-slash');
    } else {
      passwordInput.type = 'password';
      icon.classList.remove('fa-eye-slash');
      icon.classList.add('fa-eye');
    }
  });

  // Mở khóa bằng nút
  unlockBtn.addEventListener('click', performLogin);

  // Mở khóa bằng nút Enter
  passwordInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      performLogin();
    }
  });

  function performLogin() {
    const password = passwordInput.value.trim();
    if (password === SYSTEM_PASSWORD) {
      errorMsg.classList.add('hidden');
      sessionStorage.setItem('tps1_authenticated', 'true');
      if (rememberMe.checked) {
        localStorage.setItem('tps1_remember_auth', 'true');
      }
      passwordInput.value = '';
      checkAuthentication();
      window.dispatchEvent(new Event('tps1-authenticated'));
    } else {
      errorMsg.classList.remove('hidden');
      passwordInput.focus();
    }
  }

  // Đăng xuất (Hiển thị modal xác nhận)
  const logoutModal = document.getElementById('logout-confirm-modal');
  const logoutCancelBtn = document.getElementById('logout-cancel-btn');
  const logoutConfirmBtn = document.getElementById('logout-confirm-btn');
  const logoutOverlay = document.getElementById('logout-modal-overlay');

  window.performLogout = function() {
    console.log("performLogout: Yêu cầu đăng xuất nhận được, hiển thị modal");
    if (logoutModal) {
      logoutModal.classList.remove('hidden');
    }
  };

  const closeLogoutModal = () => {
    if (logoutModal) logoutModal.classList.add('hidden');
  };

  if (logoutCancelBtn) logoutCancelBtn.addEventListener('click', closeLogoutModal);
  if (logoutOverlay) logoutOverlay.addEventListener('click', closeLogoutModal);

  if (logoutConfirmBtn) {
    logoutConfirmBtn.addEventListener('click', () => {
      console.log("performLogout: Xác nhận đăng xuất từ modal, đang xóa session");
      sessionStorage.removeItem('tps1_authenticated');
      localStorage.removeItem('tps1_remember_auth');
      closeLogoutModal();
      checkAuthentication();
    });
  }

  // Click direct link fallback
  const logoutLink = document.querySelector('#logout-btn a');
  if (logoutLink) {
    logoutLink.addEventListener('click', (e) => {
      console.log("logout-link: Click trực tiếp vào thẻ a");
      e.preventDefault();
      e.stopPropagation();
      window.performLogout();
    });
  }
}

// 5. Xử lý Chuyển đổi Tab (Tab Navigation) & Mobile Sidebar
function setupNavigationListeners() {
  const sidebarNav = document.querySelector('.sidebar-nav');
  const navItems = document.querySelectorAll('.sidebar-nav .nav-item');
  const tabPanels = document.querySelectorAll('.tab-panel');
  const pageTitle = document.getElementById('page-title');
  const sidebar = document.querySelector('.sidebar');
  const mobileToggle = document.getElementById('mobile-toggle-sidebar');
  const addLeadModal = document.getElementById('add-lead-modal');
  const logoutModal = document.getElementById('logout-confirm-modal');
  const drawerOverlay = document.getElementById('drawer-overlay');
  const leadDrawer = document.getElementById('lead-drawer');

  function syncMobileSidebarState() {
    document.body.classList.toggle('sidebar-open', sidebar.classList.contains('open'));
  }

  function closeTransientUi() {
    if (leadDrawer) leadDrawer.classList.remove('open');
    if (drawerOverlay) drawerOverlay.classList.add('hidden');
    if (addLeadModal) addLeadModal.classList.add('hidden');
    if (logoutModal) logoutModal.classList.add('hidden');
  }

  function activateTab(targetTab, item) {
    currentActiveTab = targetTab;

    // Update Active Navigation Item
    navItems.forEach(i => i.classList.remove('active'));
    if (item) item.classList.add('active');

    // Show/Hide Panels
    tabPanels.forEach(panel => {
      if (panel.id === targetTab) {
        panel.classList.add('active');
      } else {
        panel.classList.remove('active');
      }
    });

    // Update Title
    const titleSpan = item ? item.querySelector('span') : null;
    if (pageTitle) {
      pageTitle.innerText = titleSpan ? titleSpan.innerText : 'Dashboard';
    }

    // Đóng các overlay/modals đang mở để không chặn tương tác.
    closeTransientUi();

    // Đóng sidebar trên thiết bị di động
    sidebar.classList.remove('open');
    syncMobileSidebarState();

    // Refresh tab con sau khi UI đã chuyển xong
    requestAnimationFrame(() => triggerTabRefresh(targetTab));
  }

  sidebarNav.addEventListener('click', (e) => {
    const item = e.target.closest('.nav-item');
    if (!item || !sidebarNav.contains(item)) return;

    e.preventDefault();
    e.stopPropagation();

    if (item.classList.contains('logout-item')) {
      console.log("nav-item-logout: Click vào li chứa nút đăng xuất");
      closeTransientUi();
      syncMobileSidebarState();
      window.performLogout();
      return;
    }

    const targetTab = item.getAttribute('data-tab');
    if (!targetTab) return;

    activateTab(targetTab, item);
  });

  // Toggle sidebar trên mobile
  mobileToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    sidebar.classList.toggle('open');
    syncMobileSidebarState();
  });

  // Đóng sidebar khi click ra ngoài
  document.addEventListener('click', (e) => {
    if (sidebar.classList.contains('open') && !sidebar.contains(e.target) && e.target !== mobileToggle) {
      sidebar.classList.remove('open');
      syncMobileSidebarState();
    }
  });
}

// Gọi hàm refresh cho từng tab cụ thể
function triggerTabRefresh(tabId) {
  try {
    if (tabId === 'tab-dashboard') {
      try { calculateKPIs(); } catch (e) { console.error("Lỗi calculateKPIs:", e); }
      try { renderRecentLeads(); } catch (e) { console.error("Lỗi renderRecentLeads:", e); }
      try {
        if (window.chartsModule && typeof window.chartsModule.updateCharts === 'function') {
          window.chartsModule.updateCharts();
        }
      } catch (e) { console.error("Lỗi updateCharts:", e); }
    } else if (tabId === 'tab-kanban') {
      try {
        if (window.kanbanModule && typeof window.kanbanModule.renderKanban === 'function') {
          window.kanbanModule.renderKanban();
        }
      } catch (e) { console.error("Lỗi renderKanban:", e); }
    } else if (tabId === 'tab-leads') {
      try {
        if (window.kanbanModule && typeof window.kanbanModule.renderLeadsList === 'function') {
          window.kanbanModule.renderLeadsList();
        }
      } catch (e) { console.error("Lỗi renderLeadsList:", e); }
    } else if (tabId === 'tab-quote') {
      try {
        if (window.quoteModule && typeof window.quoteModule.initQuoteBuilder === 'function') {
          window.quoteModule.initQuoteBuilder();
        }
      } catch (e) { console.error("Lỗi initQuoteBuilder:", e); }
    } else if (tabId === 'tab-quote-management') {
      try {
        if (window.quoteModule && typeof window.quoteModule.renderSavedQuotesList === 'function') {
          window.quoteModule.renderSavedQuotesList();
        }
      } catch (e) { console.error("Lỗi renderSavedQuotesList:", e); }
    } else if (tabId === 'tab-settings') {
      try {
        if (window.sheetsModule && typeof window.sheetsModule.initSettingsView === 'function') {
          window.sheetsModule.initSettingsView();
        }
      } catch (e) { console.error("Lỗi initSettingsView:", e); }
    }
  } catch (err) {
    console.error("Lỗi trong triggerTabRefresh:", err);
  }
}

// 6. Khởi chạy toàn bộ module
function bootstrapModules() {
  try { calculateKPIs(); } catch (e) { console.error("Lỗi calculateKPIs bootstrap:", e); }
  try { renderRecentLeads(); } catch (e) { console.error("Lỗi renderRecentLeads bootstrap:", e); }
  
  try {
    if (window.kanbanModule && typeof window.kanbanModule.renderKanban === 'function') {
      window.kanbanModule.renderKanban();
    }
  } catch (e) { console.error("Lỗi renderKanban bootstrap:", e); }
  
  try {
    if (window.chartsModule && typeof window.chartsModule.initCharts === 'function') {
      window.chartsModule.initCharts();
    }
  } catch (e) { console.error("Lỗi initCharts bootstrap:", e); }

  try {
    if (window.sheetsModule && typeof window.sheetsModule.startAutoSync === 'function') {
      window.sheetsModule.startAutoSync();
    }
  } catch (e) { console.error("Lỗi startAutoSync bootstrap:", e); }
}

// 7. Tính toán các chỉ số KPI & Doanh thu
function calculateKPIs() {
  const leads = state.leads;
  const quotes = state.quotes;

  const totalLeads = leads.length;
  const activeLeads = leads.filter(l => ['contacting', 'quoting', 'quoted'].includes(normalizeLeadStatus(l.status))).length;
  const wonLeads = leads.filter(l => normalizeLeadStatus(l.status) === 'won').length;
  const conversionRate = totalLeads > 0 ? Math.round((wonLeads / totalLeads) * 100) : 0;

  document.getElementById('kpi-total-leads').innerText = totalLeads;
  document.getElementById('kpi-active-leads').innerText = activeLeads;
  document.getElementById('kpi-won-leads').innerText = wonLeads;
  document.getElementById('kpi-conversion-rate').innerText = conversionRate + '%';

  // Tính toán doanh số dòng tiền
  let expectedRevenue = 0; // Won + Negotiating + Quoted
  let wonRevenue = 0; // Won
  let pipelineRevenue = 0; // Negotiating + Quoted

  // Tính tổng số tiền từ quotes
  quotes.forEach(quote => {
    const lead = leads.find(l => l.id === quote.leadId);
    if (!lead) return;

    // Tính tổng tiền đơn hàng (Đảm bảo an toàn nếu items bị rỗng)
    const items = quote.items || [];
    let quoteSubtotal = items.reduce((sum, item) => sum + (item.price * item.qty), 0);
    let quoteDiscountAmt = (quoteSubtotal * (quote.discount || 0)) / 100;
    let quoteGrandTotal = quoteSubtotal - quoteDiscountAmt + (quote.shipping || 0);

    const leadStatus = normalizeLeadStatus(lead.status);
    if (leadStatus === 'won') {
      wonRevenue += quoteGrandTotal;
      expectedRevenue += quoteGrandTotal;
    } else if (['quoting', 'quoted'].includes(leadStatus)) {
      pipelineRevenue += quoteGrandTotal;
      expectedRevenue += quoteGrandTotal;
    }
  });

  document.getElementById('fin-expected-rev').innerText = formatCurrency(expectedRevenue);
  document.getElementById('fin-won-rev').innerText = formatCurrency(wonRevenue);
  document.getElementById('fin-pipeline-rev').innerText = formatCurrency(pipelineRevenue);
}

// 8. Render danh sách Leads mới cập nhật cần phản hồi gấp (< 15 phút)
function renderRecentLeads() {
  const container = document.getElementById('recent-leads-list');
  const badge = document.getElementById('fresh-leads-badge');
  container.innerHTML = '';

  // Sắp xếp leads: mới nhất lên đầu
  const sortedLeads = [...state.leads].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  let urgentCount = 0;

  sortedLeads.slice(0, 5).forEach(lead => {
    const row = document.createElement('tr');
    
    // Kiểm tra cảnh báo phản hồi dưới 15 phút (cho các lead trạng thái "Mới" - 'new')
    let timeCellContent = '';
    const minutesSinceCreated = Math.floor((Date.now() - new Date(lead.createdAt)) / (1000 * 60));
    
    if (normalizeLeadStatus(lead.status) === 'new') {
      if (minutesSinceCreated < 15) {
        urgentCount++;
        timeCellContent = `<span class="time-warning"><i class="fa-solid fa-triangle-exclamation"></i> ${minutesSinceCreated} phút trước (Gọi ngay)</span>`;
      } else {
        timeCellContent = `<span>${formatDateRelative(lead.createdAt)}</span>`;
      }
    } else {
      timeCellContent = `<span>${formatDateRelative(lead.createdAt)}</span>`;
    }

    const categoryText = {
      wholesale_restaurant: 'Sỉ - Nhà hàng',
      wholesale_agency: 'Sỉ - Đại lý',
      retail_vip: 'Lẻ - VIP',
      retail_regular: 'Lẻ - Thường'
    }[lead.category] || 'Chưa phân loại';

    const statusKey = normalizeLeadStatus(lead.status);
    const statusBadge = `<span class="badge ${getLeadStatusBadgeClass(statusKey)}">${getLeadStatusLabel(statusKey)}</span>`;

    row.innerHTML = `
      <td data-label="Khách hàng"><strong>${lead.name}</strong></td>
      <td data-label="SĐT">${lead.phone}</td>
      <td data-label="Kênh Nguồn"><i class="fa-solid fa-share-nodes text-secondary"></i> ${lead.source}</td>
      <td data-label="Nhóm Khách">${categoryText}</td>
      <td data-label="Quy Trình">${statusBadge}</td>
      <td data-label="Thời gian">${timeCellContent}</td>
      <td>
        <button class="btn btn-secondary btn-xs" onclick="openLeadDrawer('${lead.id}')">
          <i class="fa-solid fa-pen-to-square"></i> Chi tiết
        </button>
      </td>
    `;
    container.appendChild(row);
  });

  // Cập nhật badge cảnh báo cuộc gọi gấp
  if (urgentCount > 0) {
    badge.innerText = `${urgentCount} Lead mới cần chốt gấp (< 15p)`;
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }
}

// 9. Xử lý Modal & Drawer liên quan đến Lead
function setupModalAndDrawerListeners() {
  const addLeadBtn = document.getElementById('add-lead-btn');
  const addLeadModal = document.getElementById('add-lead-modal');
  const modalCloseBtn = document.getElementById('modal-close-btn');
  const formCancelBtn = document.getElementById('form-cancel-btn');
  const addLeadForm = document.getElementById('add-lead-form');
  
  const drawerCloseBtn = document.getElementById('drawer-close-btn');
  const drawerOverlay = document.getElementById('drawer-overlay');

  // Mở modal tạo lead mới
  addLeadBtn.addEventListener('click', () => {
    addLeadModal.classList.remove('hidden');
  });

  // Đóng modal
  const closeModal = () => addLeadModal.classList.add('hidden');
  modalCloseBtn.addEventListener('click', closeModal);
  formCancelBtn.addEventListener('click', closeModal);

  // Submit form tạo lead mới
  addLeadForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const newLead = {
      id: 'lead_' + Date.now(),
      name: document.getElementById('form-name').value.trim(),
      phone: document.getElementById('form-phone').value.trim(),
      email: document.getElementById('form-email').value.trim(),
      source: document.getElementById('form-source').value,
      status: document.getElementById('form-status').value,
      priority: document.getElementById('form-priority').value,
      category: document.getElementById('form-category').value,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      notes: []
    };

    const initialNoteText = document.getElementById('form-note').value.trim();
    if (initialNoteText) {
      newLead.notes.push({
        timestamp: new Date().toISOString(),
        author: "Hệ thống",
        text: initialNoteText
      });
    }

    state.leads.push(newLead);
    saveState('leads');

    // Đồng bộ thời gian thực lên Google Sheets
    if (window.sheetsModule && typeof window.sheetsModule.syncWriteGoogleSheets === 'function') {
      window.sheetsModule.syncWriteGoogleSheets('add', newLead);
    }
    
    // Đóng form và làm sạch ô nhập
    addLeadForm.reset();
    closeModal();
    
    // Refresh giao diện hiện tại
    triggerTabRefresh(currentActiveTab);
    calculateKPIs();
    renderRecentLeads();
    
    // Thông báo chốt nhanh dưới 15 phút
    if (newLead.status === 'new') {
      showToastNotification(`Có lead mới từ ${newLead.source}! Vui lòng phản hồi sớm nhất.`);
    }
  });

  // Đóng Drawer chi tiết
  const closeDrawer = () => {
    document.getElementById('lead-drawer').classList.remove('open');
    drawerOverlay.classList.add('hidden');
  };
  drawerCloseBtn.addEventListener('click', closeDrawer);
  drawerOverlay.addEventListener('click', closeDrawer);
}

// Hàm mở Drawer chi tiết Lead (Được gọi toàn cục)
window.openLeadDrawer = function(leadId) {
  const lead = state.leads.find(l => l.id === leadId);
  if (!lead) return;

  const contentContainer = document.getElementById('drawer-lead-content');
  const drawerOverlay = document.getElementById('drawer-overlay');
  
  // Format Category
  const categoryOptions = `
    <option value="wholesale_restaurant" ${lead.category === 'wholesale_restaurant' ? 'selected' : ''}>Sỉ - Nhà hàng</option>
    <option value="wholesale_agency" ${lead.category === 'wholesale_agency' ? 'selected' : ''}>Sỉ - Đại lý</option>
    <option value="retail_vip" ${lead.category === 'retail_vip' ? 'selected' : ''}>Lẻ - VIP</option>
    <option value="retail_regular" ${lead.category === 'retail_regular' ? 'selected' : ''}>Lẻ - Thường</option>
  `;

  // Format Status
  const statusOptions = `
    <option value="new" ${normalizeLeadStatus(lead.status) === 'new' ? 'selected' : ''}>Mới</option>
    <option value="contacting" ${normalizeLeadStatus(lead.status) === 'contacting' ? 'selected' : ''}>Đã liên hệ</option>
    <option value="quoting" ${normalizeLeadStatus(lead.status) === 'quoting' ? 'selected' : ''}>Đang báo giá</option>
    <option value="quoted" ${normalizeLeadStatus(lead.status) === 'quoted' ? 'selected' : ''}>Đã báo giá</option>
    <option value="won" ${normalizeLeadStatus(lead.status) === 'won' ? 'selected' : ''}>Đã chốt đơn</option>
    <option value="unqualified" ${normalizeLeadStatus(lead.status) === 'unqualified' ? 'selected' : ''}>Không tiềm năng</option>
    <option value="canceled" ${normalizeLeadStatus(lead.status) === 'canceled' ? 'selected' : ''}>Hủy</option>
  `;

  // Format Priority
  const priorityOptions = `
    <option value="low" ${lead.priority === 'low' ? 'selected' : ''}>Thấp</option>
    <option value="medium" ${lead.priority === 'medium' ? 'selected' : ''}>Trung bình</option>
    <option value="high" ${lead.priority === 'high' ? 'selected' : ''}>Cao</option>
  `;

  // Render Timeline Notes
  let notesHtml = '';
  if (lead.notes && lead.notes.length > 0) {
    // Sắp xếp note mới nhất lên đầu
    const sortedNotes = [...lead.notes].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    sortedNotes.forEach(note => {
      notesHtml += `
        <div class="timeline-note-item">
          <div class="note-meta">
            <strong>${note.author}</strong>
            <span>${formatDateFull(note.timestamp)}</span>
          </div>
          <p class="note-text">${note.text}</p>
        </div>
      `;
    });
  } else {
    notesHtml = '<p style="color: var(--text-muted); font-style: italic; font-size:12.5px;">Chưa có ghi chú lịch sử trao đổi.</p>';
  }

  // Thiết lập khảo sát báo giá bổ sung từ form Website
  let surveyHtml = '';
  if (lead.company || lead.facilityType || lead.interestedIn || lead.purchaseScale || lead.deliveryFrequency || lead.deliveryArea || lead.needBy || lead.message || lead.selectedItems || lead.role || lead.formType || lead.channel) {
    surveyHtml = `
      <!-- Khảo sát báo giá bổ sung từ Website -->
      <div class="detail-sec">
        <h4>Thông Tin Khảo Sát Báo Giá (Website)</h4>
        <div class="detail-grid">
          ${lead.role ? `<div class="detail-item"><span class="label">Vai trò</span><span class="val">${lead.role}</span></div>` : ''}
          ${lead.formType ? `<div class="detail-item"><span class="label">Loại form</span><span class="val">${lead.formType}</span></div>` : ''}
          ${lead.channel ? `<div class="detail-item"><span class="label">Kênh liên hệ</span><span class="val">${lead.channel}</span></div>` : ''}
          ${lead.company ? `<div class="detail-item"><span class="label">Công ty / Đơn vị</span><span class="val">${lead.company}</span></div>` : ''}
          ${lead.facilityType ? `<div class="detail-item mt-10"><span class="label">Loại hình đơn vị</span><span class="val">${lead.facilityType}</span></div>` : ''}
          ${lead.interestedIn ? `<div class="detail-item mt-10"><span class="label">Mặt hàng quan tâm</span><span class="val">${lead.interestedIn}</span></div>` : ''}
          ${lead.purchaseScale ? `<div class="detail-item mt-10"><span class="label">Quy mô nhu cầu</span><span class="val">${lead.purchaseScale}</span></div>` : ''}
          ${lead.deliveryFrequency ? `<div class="detail-item mt-10"><span class="label">Tần suất giao</span><span class="val">${lead.deliveryFrequency}</span></div>` : ''}
          ${lead.deliveryArea ? `<div class="detail-item mt-10"><span class="label">Khu vực giao</span><span class="val">${lead.deliveryArea}</span></div>` : ''}
          ${lead.needBy ? `<div class="detail-item mt-10"><span class="label">Thời gian cần hàng</span><span class="val">${lead.needBy}</span></div>` : ''}
          ${lead.selectedItems ? `<div class="detail-item mt-10" style="grid-column: 1 / -1;"><span class="label">Sản phẩm đã chọn trên web</span><span class="val" style="white-space: pre-wrap; font-family: monospace; background: rgba(16, 185, 129, 0.05); padding: 8px; border: 1px solid rgba(16, 185, 129, 0.15); border-radius: 4px; display: block; margin-top: 4px; color: #10B981;">${lead.selectedItems} ${lead.selectedCount ? `(${lead.selectedCount} mặt hàng)` : ''}</span></div>` : ''}
          ${lead.message ? `<div class="detail-item mt-10" style="grid-column: 1 / -1;"><span class="label">Lời nhắn / Nhu cầu chi tiết</span><span class="val" style="white-space: pre-wrap; display: block; margin-top: 4px; line-height: 1.4; color: #E2E8F0;">${lead.message}</span></div>` : ''}
        </div>
      </div>
    `;
  }

  // Khung nội dung Drawer
  contentContainer.innerHTML = `
    <!-- Thông tin liên hệ cơ bản -->
    <div class="detail-sec">
      <h4>Thông Tin Khách Hàng</h4>
      <div class="detail-grid">
        <div class="detail-item">
          <span class="label">Họ và Tên</span>
          <span class="val">${lead.name}</span>
        </div>
        <div class="detail-item">
          <span class="label">Số Điện Thoại</span>
          <span class="val"><a href="tel:${lead.phone}">${lead.phone}</a></span>
        </div>
        <div class="detail-item mt-10">
          <span class="label">Email</span>
          <span class="val">${lead.email || 'Chưa cung cấp'}</span>
        </div>
        <div class="detail-item mt-10">
          <span class="label">Kênh Nguồn</span>
          <span class="val">${lead.source}</span>
        </div>
      </div>
    </div>

    <!-- Phân loại & Quy trình cập nhật -->
    <div class="detail-sec">
      <h4>Phân Loại & Quy Trình</h4>
      <div class="form-group">
        <label for="drawer-category">Nhóm Khách Hàng</label>
        <select id="drawer-category" class="form-control" onchange="updateLeadField('${lead.id}', 'category', this.value)">
          ${categoryOptions}
        </select>
      </div>
      <div class="form-row">
        <div class="form-group flex-1">
          <label for="drawer-status">Bước quy trình</label>
          <select id="drawer-status" class="form-control" onchange="updateLeadField('${lead.id}', 'status', this.value)">
            ${statusOptions}
          </select>
        </div>
        <div class="form-group flex-1">
          <label for="drawer-priority">Mức ưu tiên</label>
          <select id="drawer-priority" class="form-control" onchange="updateLeadField('${lead.id}', 'priority', this.value)">
            ${priorityOptions}
          </select>
        </div>
      </div>
    </div>

    ${surveyHtml}

    <!-- Lịch sử ghi chú & Cuộc gọi -->
    <div class="detail-sec" style="border-bottom:none;">
      <h4>Nhật Ký Chăm Sóc Khách</h4>
      
      <!-- Thêm ghi chú mới -->
      <div class="add-note-box">
        <textarea id="drawer-new-note" class="form-control" rows="2" placeholder="Ghi chú nội dung cuộc gọi/tin nhắn chăm sóc..."></textarea>
        <button class="btn btn-primary btn-sm" onclick="addLeadNote('${lead.id}')">
          <i class="fa-solid fa-paper-plane"></i> Ghi chú lịch sử
        </button>
      </div>

      <div class="notes-timeline-container">
        ${notesHtml}
      </div>
    </div>
  `;

  // Mở Drawer trượt ra
  document.getElementById('lead-drawer').classList.add('open');
  drawerOverlay.classList.remove('hidden');
};

// Hàm mở Modal Xác nhận cập nhật quy trình
window.showConfirmStatusModal = function(newStatus, onConfirm, onCancel) {
  const modal = document.getElementById('status-confirm-modal');
  const overlay = document.getElementById('status-confirm-modal-overlay');
  const targetText = document.getElementById('status-confirm-target');
  const btnOk = document.getElementById('status-confirm-ok-btn');
  const btnCancel = document.getElementById('status-confirm-cancel-btn');

  targetText.innerText = getLeadStatusLabel(newStatus);
  modal.classList.remove('hidden');

  const cleanup = () => {
    modal.classList.add('hidden');
    btnOk.removeEventListener('click', handleOk);
    btnCancel.removeEventListener('click', handleCancel);
    overlay.removeEventListener('click', handleCancel);
  };

  const handleOk = () => {
    cleanup();
    if (onConfirm) onConfirm();
  };

  const handleCancel = () => {
    cleanup();
    if (onCancel) onCancel();
  };

  btnOk.addEventListener('click', handleOk);
  btnCancel.addEventListener('click', handleCancel);
  overlay.addEventListener('click', handleCancel);
};

// Hàm cập nhật nhanh thuộc tính Lead từ Drawer
window.updateLeadField = function(leadId, field, value, options = {}) {
  const leadIndex = state.leads.findIndex(l => l.id === leadId);
  if (leadIndex === -1) return;

  const previousValue = state.leads[leadIndex][field];
  const normalizedValue = field === 'status' ? normalizeLeadStatus(value) : value;

  // Nếu cập nhật trạng thái, cần hiển thị xác nhận
  if (field === 'status' && !options.skipConfirm) {
    window.showConfirmStatusModal(normalizedValue, 
      () => {
        // Xác nhận
        executeLeadFieldUpdate(leadId, field, normalizedValue, previousValue, options);
      }, 
      () => {
        // Hủy bỏ: khôi phục giá trị cũ trên dropdown nếu đang mở drawer
        const selectEl = document.getElementById('drawer-status');
        if (selectEl) {
          selectEl.value = previousValue;
        }
      }
    );
    return;
  }

  executeLeadFieldUpdate(leadId, field, normalizedValue, previousValue, options);
};

function executeLeadFieldUpdate(leadId, field, normalizedValue, previousValue, options) {
  const leadIndex = state.leads.findIndex(l => l.id === leadId);
  if (leadIndex === -1) return;

  state.leads[leadIndex][field] = normalizedValue;
  state.leads[leadIndex].updatedAt = new Date().toISOString();
  saveState('leads');
  
  // Log note tự động về việc đổi trạng thái
  let logText = "";
  if (field === 'status') {
    logText = `Đã cập nhật quy trình sang: <strong>${getLeadStatusLabel(normalizedValue)}</strong>`;
    
    // Đồng bộ trạng thái lên Google Sheets
    if (window.sheetsModule && typeof window.sheetsModule.syncWriteGoogleSheets === 'function') {
      window.sheetsModule.syncWriteGoogleSheets('update_status', { phone: state.leads[leadIndex].phone, status: normalizedValue });
    }

    // Đồng bộ trạng thái sang các báo giá liên quan
    const relatedQuotes = state.quotes.filter(q => q.leadId === leadId);
    if (relatedQuotes.length > 0) {
      const now = new Date().toISOString();
      const quoteStatusMap = {
        quoted: 'quoted',
        quoting: 'negotiating',
        won: 'won',
        unqualified: 'lost',
        canceled: 'lost'
      };
      relatedQuotes.forEach(quote => {
        const previousQuoteStatus = quote.status || 'draft';
        const nextQuoteStatus = quoteStatusMap[normalizedValue] || previousQuoteStatus;
        if (nextQuoteStatus !== previousQuoteStatus) {
          quote.status = nextQuoteStatus;
          quote.updatedAt = now;
          quote.history = Array.isArray(quote.history) ? quote.history : [];
          quote.history.push({
            at: now,
            action: 'lead_status_change',
            from: previousQuoteStatus,
            to: nextQuoteStatus,
            note: logText || ''
          });
          if (nextQuoteStatus === 'quoted' && !quote.sentAt) quote.sentAt = now;
          if (nextQuoteStatus === 'won' || nextQuoteStatus === 'lost') {
            quote.closedAt = now;
            quote.result = nextQuoteStatus;
          } else if (previousQuoteStatus === 'won' || previousQuoteStatus === 'lost') {
            quote.result = '';
          }
        }
      });
      saveState('quotes');
      if (window.quoteModule && typeof window.quoteModule.renderSavedQuotesList === 'function') {
        window.quoteModule.renderSavedQuotesList();
      }
    }

    if (window.supabaseModule && typeof window.supabaseModule.syncLeadStatus === 'function') {
      const leadSnapshot = state.leads[leadIndex];
      window.supabaseModule.syncLeadStatus(leadSnapshot, previousValue || 'draft', normalizedValue, logText)
        .catch(err => console.error('Lỗi syncLeadStatus Supabase:', err));
    }
  } else if (field === 'category') {
    const catLabels = { wholesale_restaurant: 'Sỉ - Nhà hàng', wholesale_agency: 'Sỉ - Đại lý', retail_vip: 'Lẻ - VIP', retail_regular: 'Lẻ - Thường' };
    logText = `Đã đổi phân loại sang: <strong>${catLabels[value]}</strong>`;
  } else if (field === 'priority') {
    const priLabels = { low: 'Thấp', medium: 'Trung bình', high: 'Cao' };
    logText = `Đã đổi mức ưu tiên sang: <strong>${priLabels[value]}</strong>`;
  }

  if (logText) {
    state.leads[leadIndex].notes.push({
      timestamp: new Date().toISOString(),
      author: "Hệ thống",
      text: logText
    });
    saveState('leads');
  }

  // Refresh tab con khi cập nhật
  triggerTabRefresh(currentActiveTab);
  calculateKPIs();
  renderRecentLeads();

  // Đóng mở lại để cập nhật Timeline Notes
  if (!options.skipDrawer) {
    openLeadDrawer(leadId);
  }
};

// Hàm thêm ghi chú mới từ Drawer
window.addLeadNote = function(leadId) {
  const textarea = document.getElementById('drawer-new-note');
  const text = textarea.value.trim();
  if (!text) return;

  const leadIndex = state.leads.findIndex(l => l.id === leadId);
  if (leadIndex === -1) return;

  state.leads[leadIndex].notes.push({
    timestamp: new Date().toISOString(),
    author: "Kinh doanh",
    text: text
  });
  state.leads[leadIndex].updatedAt = new Date().toISOString();
  
  saveState('leads');
  textarea.value = '';
  
  // Reload drawer timeline
  openLeadDrawer(leadId);
};

// 10. Các hàm Tiện ích (Helper Functions)
function formatCurrency(amount) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount).replace('₫', 'đ');
}

function formatDateFull(isoString) {
  const date = new Date(isoString);
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')} - ${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
}

function formatDateRelative(isoString) {
  const timeMs = new Date(isoString).getTime();
  const diffMs = Date.now() - timeMs;
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'Vừa xong';
  if (diffMins < 60) return `${diffMins} phút trước`;
  if (diffHours < 24) return `${diffHours} giờ trước`;
  if (diffDays < 7) return `${diffDays} ngày trước`;
  
  const d = new Date(isoString);
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
}

// Xuất thông báo Toast nổi
function showToastNotification(message) {
  // Tạo container nếu chưa có
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.style.position = 'fixed';
    container.style.bottom = '20px';
    container.style.right = '20px';
    container.style.zIndex = '9999';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '10px';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.style.background = '#142018';
  toast.style.border = '1px solid #10B981';
  toast.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.25)';
  toast.style.borderRadius = '8px';
  toast.style.padding = '12px 20px';
  toast.style.color = '#F8FAFC';
  toast.style.fontSize = '13px';
  toast.style.fontWeight = '500';
  toast.style.display = 'flex';
  toast.style.alignItems = 'center';
  toast.style.gap = '10px';
  toast.style.animation = 'slideIn 0.3s ease forwards';

  toast.innerHTML = `<i class="fa-solid fa-bell" style="color:#10B981"></i> <span>${message}</span>`;
  container.appendChild(toast);

  // Thêm CSS animation ngầm
  const style = document.createElement('style');
  style.innerHTML = `
    @keyframes slideIn {
      from { transform: translateY(20px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
  `;
  document.head.appendChild(style);

  // Xóa sau 4 giây
  setTimeout(() => {
    toast.style.animation = 'slideOut 0.3s ease forwards';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// 11. XỬ LÝ PWA INSTALL BANNER / POPUP
function initPwaInstallPrompt() {
  const pwaBanner = document.getElementById('pwa-install-banner');
  const installBtn = document.getElementById('pwa-install-btn');
  const dismissBtn = document.getElementById('pwa-dismiss-btn');
  const bannerDesc = document.getElementById('pwa-banner-desc');
  const lockScreen = document.getElementById('lock-screen');
  
  if (!pwaBanner) return;

  let deferredPrompt = null;
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  const onIndexPage = window.location.pathname === '/' || /\/index\.html$/i.test(window.location.pathname);
  const isMobile = window.matchMedia('(max-width: 768px)').matches || /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  const isLockScreenVisible = !!lockScreen && !lockScreen.classList.contains('hidden');
  const canShowPwaBanner = onIndexPage && isMobile && isLockScreenVisible && !isStandalone;
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  let bannerVisible = false;

  // HÀM HIỂN THỊ BANNER
  function showPwaBanner(type) {
    if (!canShowPwaBanner) return;
    bannerVisible = true;
    if (installBtn) {
      installBtn.disabled = false;
    }
    pwaBanner.classList.remove('hidden');
    pwaBanner.classList.remove('ios-style');
    
    if (type === 'ios') {
      pwaBanner.classList.add('ios-style');
      if (bannerDesc) {
        bannerDesc.innerHTML = 'Để tải ứng dụng về iPhone: Nhấn nút chia sẻ <i class="fa-solid fa-share-from-square"></i> ở dưới Safari và chọn <b>"Thêm vào màn hình chính"</b> <i class="fa-regular fa-square-plus"></i>.';
      }
    }
    
    // Tạo hiệu ứng trượt mượt mà lên
    setTimeout(() => {
      pwaBanner.classList.add('show');
    }, 100);
  }

  // HÀM ẨN BANNER
  function hidePwaBanner() {
    bannerVisible = false;
    pwaBanner.classList.remove('show');
    setTimeout(() => {
      pwaBanner.classList.add('hidden');
    }, 400); // Khớp thời gian transition CSS
  }

  window.addEventListener('tps1-authenticated', hidePwaBanner);

  // Hiện banner ngay trên màn hình khóa mobile ở index, không đợi prompt event mới lộ.
  if (canShowPwaBanner) {
    if (isIOS) {
      showPwaBanner('ios');
    } else {
      showPwaBanner('android');
    }
  }

  // 1. DÀNH CHO ANDROID / CHROME / WINDOWS / MAC
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (installBtn) {
      installBtn.disabled = false;
    }
    if (canShowPwaBanner && !bannerVisible && !isIOS) {
      showPwaBanner('android');
    }
  });

  // Sự kiện nút Cài đặt click
  if (installBtn) {
    installBtn.textContent = isIOS ? 'Hướng dẫn' : 'Cài đặt';
    installBtn.disabled = false;
    installBtn.addEventListener('click', async () => {
      if (!deferredPrompt) {
        if (isIOS) {
          showToastNotification('Trên iPhone: bấm nút Chia sẻ của Safari rồi chọn "Thêm vào màn hình chính".');
        } else {
          showToastNotification('Trình duyệt chưa sẵn sàng cài ứng dụng. Chờ thêm 1-2 giây rồi bấm lại.');
        }
        return;
      }
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log(`PWA install prompt outcome: ${outcome}`);
      deferredPrompt = null;
      hidePwaBanner();
    });
  }

  // Lắng nghe khi cài đặt thành công
  window.addEventListener('appinstalled', () => {
    console.log('TPS1 PWA installed successfully.');
    hidePwaBanner();
  });

  // Sự kiện nút Đóng banner click
  if (dismissBtn) {
    dismissBtn.addEventListener('click', () => {
      hidePwaBanner();
    });
  }
}
