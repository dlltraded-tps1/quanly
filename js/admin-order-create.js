(function () {
  'use strict';

  function q(id) { return document.getElementById(id); }
  function notify(message, type) { if (window.showToastNotification) window.showToastNotification(message, type); else if (window.showAppToast) window.showAppToast(message, type); else alert(message); }
  function apiBase() { return (localStorage.getItem('tps1_orders_api_base') || 'https://thucphamsomot.vn').replace(/\/$/, ''); }
  function token() { return sessionStorage.getItem('tps1_admin_api_token') || localStorage.getItem('tps1_admin_api_token') || ''; }
  function money(value) { return new Intl.NumberFormat('vi-VN').format(Number(value) || 0) + 'đ'; }
  function escapeHtml(value) { return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;'); }

  async function request(path, options) {
    const response = await fetch(`${apiBase()}${path}`, { ...options, headers: { 'Content-Type': 'application/json', 'X-Admin-Token': token(), ...(options?.headers || {}) } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) { const error = new Error(data.error || `HTTP ${response.status}`); error.status = response.status; throw error; }
    return data;
  }

  let customersCache = null;
  let cartItems = [];

  async function loadCustomers() {
    if (customersCache) return customersCache;
    const sb = window.supabaseModule?.getClient() || window.supabase;
    if (!sb) throw new Error('Supabase client chưa sẵn sàng.');
    const { data, error } = await sb.rpc('admin_list_customers');
    if (error) throw error;
    customersCache = data || [];
    return customersCache;
  }

  function renderCart() {
    const list = q('create-order-cart');
    if (!list) return;
    if (cartItems.length === 0) {
      list.innerHTML = '<div style="padding:16px;text-align:center;color:#666">Giỏ hàng trống</div>';
      return;
    }
    list.innerHTML = cartItems.map((item, idx) => `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #eee;">
        <div style="flex:1">
          <div style="font-weight:bold;font-size:13px">${escapeHtml(item.name)}</div>
          <div style="font-size:12px;color:#666">${money(item.price)}</div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          <input type="number" min="0.001" step="0.001" class="form-control" style="width:70px;padding:4px" value="${item.quantity}" data-idx="${idx}" onchange="window._updateCartQty(${idx}, this.value)">
          <button type="button" class="btn btn-sm btn-danger" onclick="window._removeCartItem(${idx})"><i class="fa-solid fa-trash"></i></button>
        </div>
      </div>
    `).join('');
  }

  window._updateCartQty = (idx, qty) => {
    cartItems[idx].quantity = Number(qty);
    renderCart();
  };
  window._removeCartItem = (idx) => {
    cartItems.splice(idx, 1);
    renderCart();
  };

  async function handleCreateOrderModal() {
    if (q('create-order-modal')) q('create-order-modal').remove();
    cartItems = [];
    
    const modal = document.createElement('div');
    modal.id = 'create-order-modal';
    modal.className = 'order-admin-modal';
    modal.innerHTML = `
      <button class="order-admin-modal__backdrop" type="button"></button>
      <section class="order-admin-modal__panel" style="max-width:600px">
        <header class="order-admin-modal__header">
          <h2 style="font-size:16px;margin:0"><i class="fa-solid fa-cart-plus"></i> Tạo đơn hàng mới cho khách</h2>
          <button type="button" class="order-admin-modal__close"><i class="fa-solid fa-xmark"></i></button>
        </header>
        <div class="order-admin-modal__body" style="padding:16px;display:flex;flex-direction:column;gap:16px;">
          
          <div class="form-group">
            <label style="font-weight:bold;font-size:13px;display:block;margin-bottom:4px">Chọn khách hàng</label>
            <select id="create-order-customer" class="form-control">
              <option value="">Đang tải danh sách khách hàng...</option>
            </select>
          </div>

          <div class="form-group">
            <label style="font-weight:bold;font-size:13px;display:block;margin-bottom:4px">Thêm sản phẩm</label>
            <div style="display:flex;gap:8px;">
              <input id="create-order-search" type="search" class="form-control" placeholder="Tên sản phẩm...">
              <button id="create-order-search-btn" class="btn btn-primary btn-sm"><i class="fa-solid fa-magnifying-glass"></i></button>
            </div>
            <div id="create-order-search-results" style="margin-top:8px;max-height:200px;overflow-y:auto;background:#f9fafb;border-radius:8px"></div>
          </div>

          <div class="form-group">
            <label style="font-weight:bold;font-size:13px;display:block;margin-bottom:4px">Giỏ hàng</label>
            <div id="create-order-cart" style="background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:8px;min-height:100px"></div>
          </div>

          <button id="create-order-submit-btn" class="btn btn-primary" style="width:100%;margin-top:16px">Tạo Đơn Nháp</button>
        </div>
      </section>
    `;
    document.body.appendChild(modal);

    modal.querySelector('.order-admin-modal__backdrop').addEventListener('click', () => modal.remove());
    modal.querySelector('.order-admin-modal__close').addEventListener('click', () => modal.remove());

    // Load customers
    try {
      const customers = await loadCustomers();
      const select = q('create-order-customer');
      select.innerHTML = '<option value="">-- Chọn khách hàng --</option>' + customers.map(c => `<option value="${c.id}">${escapeHtml(c.name)} (${escapeHtml(c.phone)})</option>`).join('');
    } catch (e) {
      q('create-order-customer').innerHTML = '<option value="">Lỗi tải khách hàng</option>';
    }

    renderCart();

    // Search
    const searchBtn = q('create-order-search-btn');
    const searchInput = q('create-order-search');
    const searchResults = q('create-order-search-results');

    const doSearch = async () => {
      const keyword = searchInput.value.trim();
      if (keyword.length < 2) return notify('Nhập ít nhất 2 ký tự', 'warning');
      searchResults.innerHTML = '<div style="padding:12px;text-align:center"><i class="fa-solid fa-spinner fa-spin"></i> Đang tìm...</div>';
      try {
        const data = await request(`/api/admin/orders?productSearch=${encodeURIComponent(keyword)}`, { method: 'GET' });
        const products = (data.products || []).slice(0, 10);
        if (!products.length) {
          searchResults.innerHTML = '<div style="padding:12px;text-align:center">Không tìm thấy</div>';
          return;
        }
        searchResults.innerHTML = products.map(p => `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;border-bottom:1px solid #eee">
            <div>
              <div style="font-size:13px;font-weight:600">${escapeHtml(p.name)}</div>
              <div style="font-size:11px;color:#666">${money(p.price)}</div>
            </div>
            <button class="btn btn-sm btn-outline-primary" onclick="window._addCartItem('${p.id}', '${escapeHtml(p.name)}', ${p.price})">Thêm</button>
          </div>
        `).join('');
      } catch (e) {
        searchResults.innerHTML = `<div style="padding:12px;text-align:center;color:red">${escapeHtml(e.message)}</div>`;
      }
    };

    window._addCartItem = (id, name, price) => {
      if (cartItems.some(i => i.productId === id)) return notify('Sản phẩm đã có', 'warning');
      cartItems.push({ productId: id, name, price, quantity: 1 });
      renderCart();
      searchResults.innerHTML = '';
      searchInput.value = '';
    };

    searchBtn.addEventListener('click', doSearch);
    searchInput.addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });

    // Submit
    q('create-order-submit-btn').addEventListener('click', async (e) => {
      const customerId = q('create-order-customer').value;
      if (!customerId) return notify('Vui lòng chọn khách hàng', 'warning');
      if (cartItems.length === 0) return notify('Giỏ hàng trống', 'warning');

      const btn = e.currentTarget;
      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang tạo...';

      try {
        await request('/api/admin/orders/create', {
          method: 'POST',
          body: JSON.stringify({
            customerId,
            items: cartItems
          })
        });
        notify('Đã tạo đơn hàng thành công!', 'success');
        modal.remove();
        if (q('central-orders-refresh')) q('central-orders-refresh').click();
      } catch (err) {
        notify(err.message, 'error');
        btn.disabled = false;
        btn.innerHTML = 'Tạo Đơn Nháp';
      }
    });
  }

  // Bind to button in index.html
  function initCreateOrder() {
    q('central-orders-create')?.addEventListener('click', handleCreateOrderModal);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initCreateOrder); else initCreateOrder();

})();
