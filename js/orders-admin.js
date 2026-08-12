/** Quản lý đơn hàng trung tâm qua Website API (không phụ thuộc Google Sheets). */
(function () {
  'use strict';

  const API_BASE_KEY = 'tps1_orders_api_base';
  const TOKEN_KEY = 'tps1_admin_api_token';
  const DEFAULT_API_BASE = 'https://thucphamsomot.vn';
  const STATUS_LABELS = { pending: 'Chờ xác nhận', confirmed: 'Đã xác nhận', preparing: 'Đang chuẩn bị', shipping: 'Đang giao', completed: 'Hoàn thành', canceled: 'Đã hủy' };
  const PAYMENT_LABELS = { pending: 'Chờ xử lý', cod: 'COD', paid: 'Đã thanh toán', failed: 'Thất bại', refunded: 'Đã hoàn tiền' };
  const SOURCE_LABELS = { website: 'Website', miniapp: 'Mini App', admin: 'Admin' };
  let orders = [];
  const openedOrders = new Set();

  function q(id) { return document.getElementById(id); }
  function apiBase() { return (localStorage.getItem(API_BASE_KEY) || DEFAULT_API_BASE).replace(/\/$/, ''); }
  function token() { return sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY) || ''; }
  function escapeHtml(value) { return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;'); }
  function money(value) { return new Intl.NumberFormat('vi-VN').format(Number(value) || 0) + 'đ'; }
  function dateTime(value) { return value ? new Date(value).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'; }
  function notify(message, type) { if (window.showToastNotification) window.showToastNotification(message, type); else if (window.showAppToast) window.showAppToast(message, type); else alert(message); }
  function setAuthVisible(visible) { const box = q('central-orders-auth'); if (box) box.style.display = visible ? '' : 'none'; }

  async function request(path, options) {
    const response = await fetch(`${apiBase()}${path}`, { ...options, headers: { 'Content-Type': 'application/json', 'X-Admin-Token': token(), ...(options?.headers || {}) } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) { const error = new Error(data.error || `HTTP ${response.status}`); error.status = response.status; throw error; }
    return data;
  }

  async function loadOrders() {
    const list = q('central-orders-body');
    if (!list) return;
    list.innerHTML = '<div class="orders-loading"><i class="fa-solid fa-spinner fa-spin"></i><span>Đang tải đơn hàng trung tâm...</span></div>';
    try {
      const data = await request('/api/admin/orders', { method: 'GET' });
      orders = data.orders || [];
      setAuthVisible(false);
      render();
    } catch (error) {
      console.error('Central orders load error:', error);
      if (error.status === 401) setAuthVisible(true);
      list.innerHTML = `<div class="orders-empty orders-empty--error"><i class="fa-solid fa-triangle-exclamation"></i><strong>Không tải được đơn hàng</strong><span>${escapeHtml(error.message)}</span></div>`;
      if (q('central-orders-count')) q('central-orders-count').textContent = 'Không kết nối được API đơn hàng';
    }
  }

  function filteredOrders() {
    const keyword = (q('central-orders-search')?.value || '').trim().toLowerCase();
    const status = q('central-orders-status-filter')?.value || '';
    const payment = q('central-orders-payment-filter')?.value || '';
    return orders.filter(order => {
      const haystack = [order.order_code, order.customer_code, order.customer_name, order.customer_phone, order.customer_company, order.delivery_address].join(' ').toLowerCase();
      return (!keyword || haystack.includes(keyword)) && (!status || order.status === status) && (!payment || order.payment_status === payment);
    });
  }

  function options(labels, current) { return Object.entries(labels).map(([value, label]) => `<option value="${value}" ${current === value ? 'selected' : ''}>${label}</option>`).join(''); }
  function statusBadge(status) { return `<span class="order-admin-badge order-admin-badge--${escapeHtml(status || 'pending')}"><i></i>${escapeHtml(STATUS_LABELS[status] || status || 'Chưa xác định')}</span>`; }

  function itemRows(order) {
    const items = order.order_items || [];
    if (!items.length) return '<div class="order-admin-empty-items">Không có dữ liệu sản phẩm.</div>';
    return items.map((item, index) => `
      <div class="order-admin-item">
        <span class="order-admin-item__number">${index + 1}</span>
        <div class="order-admin-item__product"><strong>${escapeHtml(item.name || 'Sản phẩm')}</strong><small>${item.sku ? `SKU: ${escapeHtml(item.sku)} · ` : ''}Giá gốc ${money(item.base_unit_price)} · CK ${escapeHtml(item.discount_percent || 0)}%</small></div>
        <div class="order-admin-item__qty"><span>Số lượng</span><strong>${escapeHtml(item.quantity)} ${escapeHtml(item.unit || '')}</strong></div>
        <div class="order-admin-item__price"><span>Đơn giá</span><strong>${money(item.unit_price)}</strong></div>
        <div class="order-admin-item__total"><span>Thành tiền</span><strong>${money(item.line_total)}</strong></div>
      </div>`).join('');
  }

  function historyHtml(order) {
    const history = (order.order_history || []).slice().sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    if (!history.length) return '<div class="order-admin-history-empty">Chưa có lịch sử cập nhật.</div>';
    return history.map(entry => `<div class="order-admin-history-item"><span></span><div><strong>${escapeHtml(STATUS_LABELS[entry.to_status] || entry.action || 'Cập nhật')}</strong><small>${dateTime(entry.created_at)}${entry.note ? ` · ${escapeHtml(entry.note)}` : ''}</small></div></div>`).join('');
  }

  function detailHtml(order) {
    return `<div class="order-admin-detail" id="central-order-detail-${order.id}" ${openedOrders.has(String(order.id)) ? '' : 'hidden'}>
      <div class="order-admin-detail__grid">
        <section class="order-admin-products"><div class="order-admin-section-title"><i class="fa-solid fa-basket-shopping"></i><span>Sản phẩm trong đơn</span><b>${escapeHtml(order.item_count || (order.order_items || []).length)} món</b></div><div>${itemRows(order)}</div></section>
        <aside class="order-admin-side-info">
          <section><div class="order-admin-section-title"><i class="fa-solid fa-location-dot"></i><span>Thông tin giao nhận</span></div><dl><div><dt>Người nhận</dt><dd>${escapeHtml(order.delivery_name || order.customer_name)}</dd></div><div><dt>Điện thoại</dt><dd>${escapeHtml(order.delivery_phone || order.customer_phone)}</dd></div><div><dt>Địa chỉ</dt><dd>${escapeHtml(order.delivery_address || 'Nhận tại điểm')}</dd></div><div><dt>Ghi chú</dt><dd>${escapeHtml(order.note || 'Không có')}</dd></div></dl></section>
          <section><div class="order-admin-section-title"><i class="fa-solid fa-receipt"></i><span>Tổng kết đơn</span></div><div class="order-admin-totals"><div><span>Tạm tính</span><strong>${money(order.subtotal)}</strong></div><div><span>Chiết khấu (${escapeHtml(order.discount_percent || 0)}%)</span><strong>-${money(order.discount_amount)}</strong></div><div><span>Tổng thanh toán</span><strong>${money(order.grand_total)}</strong></div></div></section>
        </aside>
      </div>
      <section class="order-admin-history"><div class="order-admin-section-title"><i class="fa-solid fa-clock-rotate-left"></i><span>Lịch sử xử lý</span></div><div class="order-admin-history-list">${historyHtml(order)}</div></section>
    </div>`;
  }

  function orderCard(order) {
    const isOpen = openedOrders.has(String(order.id));
    return `<article class="order-admin-card ${isOpen ? 'is-open' : ''}" data-order-id="${order.id}">
      <div class="order-admin-card__top">
        <div class="order-admin-code"><span class="order-admin-source">${escapeHtml(SOURCE_LABELS[order.source] || order.source || 'Website')}</span><strong>${escapeHtml(order.order_code)}</strong><small><i class="fa-regular fa-calendar"></i>${dateTime(order.created_at)}</small></div>
        ${statusBadge(order.status)}
      </div>
      <div class="order-admin-card__body">
        <div class="order-admin-customer"><span class="order-admin-avatar"><i class="fa-regular fa-user"></i></span><div><span>Khách hàng</span><strong>${escapeHtml(order.customer_name)}</strong><small>${escapeHtml(order.customer_code)} · ${escapeHtml(order.customer_phone)}</small><small>${escapeHtml(order.customer_company || 'Khách hàng cá nhân')}</small></div></div>
        <div class="order-admin-delivery"><span>Giao đến</span><strong><i class="fa-solid fa-location-dot"></i>${escapeHtml(order.delivery_alias || 'Địa chỉ nhận hàng')}</strong><small>${escapeHtml(order.delivery_address || 'Nhận tại điểm')}</small></div>
        <div class="order-admin-value"><span>Giá trị đơn</span><strong>${money(order.grand_total)}</strong><small>${escapeHtml(order.item_count || (order.order_items || []).length)} món · CK ${escapeHtml(order.discount_percent || 0)}%</small></div>
        <label class="order-admin-control"><span>Thanh toán</span><select class="central-payment-select" data-id="${order.id}">${options(PAYMENT_LABELS, order.payment_status)}</select></label>
        <label class="order-admin-control"><span>Trạng thái xử lý</span><select class="central-status-select" data-id="${order.id}" data-current="${escapeHtml(order.status)}">${options(STATUS_LABELS, order.status)}</select></label>
        <button class="order-admin-toggle central-detail-btn" data-id="${order.id}" aria-expanded="${isOpen}"><i class="fa-solid fa-chevron-down"></i><span>${isOpen ? 'Thu gọn' : 'Chi tiết'}</span></button>
      </div>
      ${detailHtml(order)}
    </article>`;
  }

  function render() {
    const list = q('central-orders-body');
    if (!list) return;
    const filtered = filteredOrders();
    if (q('central-orders-count')) q('central-orders-count').textContent = `${orders.length} đơn hàng · đang hiển thị ${filtered.length}`;
    ['pending', 'preparing', 'shipping', 'completed'].forEach(status => { const el = q(`central-stat-${status}`); if (el) el.textContent = orders.filter(order => order.status === status).length; });
    const revenue = orders.filter(order => order.status !== 'canceled').reduce((sum, order) => sum + (Number(order.grand_total) || 0), 0);
    if (q('central-stat-revenue')) q('central-stat-revenue').textContent = money(revenue);
    if (!filtered.length) { list.innerHTML = '<div class="orders-empty"><i class="fa-regular fa-folder-open"></i><strong>Không tìm thấy đơn hàng</strong><span>Hãy thay đổi bộ lọc hoặc từ khóa tìm kiếm.</span></div>'; return; }
    list.innerHTML = filtered.map(orderCard).join('');
    bindRenderedEvents(list);
  }

  function bindRenderedEvents(list) {
    list.querySelectorAll('.central-detail-btn').forEach(button => button.addEventListener('click', () => {
      const id = String(button.dataset.id); const card = button.closest('.order-admin-card'); const detail = q(`central-order-detail-${id}`); const opening = detail?.hasAttribute('hidden');
      if (opening) openedOrders.add(id); else openedOrders.delete(id);
      detail?.toggleAttribute('hidden', !opening); card?.classList.toggle('is-open', opening); button.setAttribute('aria-expanded', String(opening));
      const text = button.querySelector('span'); if (text) text.textContent = opening ? 'Thu gọn' : 'Chi tiết';
    }));
    list.querySelectorAll('.central-status-select').forEach(select => select.addEventListener('change', () => changeStatus(select)));
    list.querySelectorAll('.central-payment-select').forEach(select => select.addEventListener('change', () => changePayment(select)));
  }

  async function changeStatus(select) {
    const order = orders.find(item => String(item.id) === String(select.dataset.id)); if (!order) return;
    const previous = order.status; const next = select.value;
    const note = prompt(`Chuyển ${order.order_code} sang “${STATUS_LABELS[next]}”. Ghi chú (không bắt buộc):`, '') ?? null;
    if (note === null) { select.value = previous; return; }
    select.disabled = true;
    try { await request('/api/admin/orders', { method: 'PATCH', body: JSON.stringify({ orderId: order.id, status: next, note }) }); notify(`Đã chuyển ${order.order_code} sang ${STATUS_LABELS[next]}`, 'success'); openedOrders.add(String(order.id)); await loadOrders(); }
    catch (error) { select.value = previous; notify(error.message, 'error'); }
    finally { select.disabled = false; }
  }

  async function changePayment(select) {
    const order = orders.find(item => String(item.id) === String(select.dataset.id)); if (!order) return;
    const previous = order.payment_status; select.disabled = true;
    try { await request('/api/admin/orders', { method: 'PATCH', body: JSON.stringify({ orderId: order.id, status: order.status, paymentStatus: select.value, note: `Cập nhật thanh toán: ${PAYMENT_LABELS[select.value]}` }) }); notify(`Đã cập nhật thanh toán ${order.order_code}`, 'success'); openedOrders.add(String(order.id)); await loadOrders(); }
    catch (error) { select.value = previous; notify(error.message, 'error'); }
    finally { select.disabled = false; }
  }

  function init() {
    q('central-orders-refresh')?.addEventListener('click', loadOrders);
    q('central-orders-search')?.addEventListener('input', render);
    q('central-orders-status-filter')?.addEventListener('change', render);
    q('central-orders-payment-filter')?.addEventListener('change', render);
    q('central-orders-token-save')?.addEventListener('click', () => { const value = q('central-orders-token')?.value.trim(); if (!value) return; sessionStorage.setItem(TOKEN_KEY, value); loadOrders(); });
    document.querySelector('[data-tab="tab-central-orders"]')?.addEventListener('click', loadOrders);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
