/** Quản lý đơn hàng trung tâm qua Website API (không phụ thuộc Google Sheets). */
(function () {
  'use strict';

  const API_BASE_KEY = 'tps1_orders_api_base';
  const TOKEN_KEY = 'tps1_admin_api_token';
  const DEFAULT_API_BASE = 'https://thucphamsomot.vn';
  const STATUS_LABELS = {
    pending: 'Chờ xác nhận',
    confirmed: 'Đã xác nhận',
    preparing: 'Đang chuẩn bị',
    shipping: 'Đang giao',
    completed: 'Hoàn thành',
    canceled: 'Đã hủy',
  };
  const PAYMENT_LABELS = {
    pending: 'Chờ xử lý',
    cod: 'COD',
    paid: 'Đã thanh toán',
    failed: 'Thất bại',
    refunded: 'Đã hoàn tiền',
  };

  let orders = [];

  function q(id) { return document.getElementById(id); }
  function apiBase() {
    return (localStorage.getItem(API_BASE_KEY) || DEFAULT_API_BASE).replace(/\/$/, '');
  }
  function token() {
    return sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY) || '';
  }
  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
  function money(value) {
    return new Intl.NumberFormat('vi-VN').format(Number(value) || 0) + ' đ';
  }
  function dateTime(value) {
    return value ? new Date(value).toLocaleString('vi-VN') : '—';
  }
  function notify(message, type) {
    if (window.showToastNotification) window.showToastNotification(message, type);
    else if (window.showAppToast) window.showAppToast(message, type);
    else alert(message);
  }
  function setAuthVisible(visible) {
    const box = q('central-orders-auth');
    if (box) box.style.display = visible ? '' : 'none';
  }

  async function request(path, options) {
    const response = await fetch(`${apiBase()}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Token': token(),
        ...(options?.headers || {}),
      },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) {
      const error = new Error(data.error || `HTTP ${response.status}`);
      error.status = response.status;
      throw error;
    }
    return data;
  }

  async function loadOrders() {
    const tbody = q('central-orders-body');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:24px"><i class="fa-solid fa-spinner fa-spin"></i> Đang tải đơn trung tâm...</td></tr>';
    try {
      const data = await request('/api/admin/orders', { method: 'GET' });
      orders = data.orders || [];
      setAuthVisible(false);
      render();
    } catch (error) {
      console.error('Central orders load error:', error);
      if (error.status === 401) setAuthVisible(true);
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:24px;color:#dc2626">${escapeHtml(error.message)}</td></tr>`;
      const count = q('central-orders-count');
      if (count) count.textContent = 'Không kết nối được API đơn hàng';
    }
  }

  function filteredOrders() {
    const keyword = (q('central-orders-search')?.value || '').trim().toLowerCase();
    const status = q('central-orders-status-filter')?.value || '';
    return orders.filter(order => {
      const haystack = [
        order.order_code,
        order.customer_code,
        order.customer_name,
        order.customer_phone,
        order.customer_company,
        order.delivery_address,
      ].join(' ').toLowerCase();
      return (!keyword || haystack.includes(keyword)) && (!status || order.status === status);
    });
  }

  function statusOptions(current) {
    return Object.entries(STATUS_LABELS)
      .map(([value, label]) => `<option value="${value}" ${current === value ? 'selected' : ''}>${label}</option>`)
      .join('');
  }
  function paymentOptions(current) {
    return Object.entries(PAYMENT_LABELS)
      .map(([value, label]) => `<option value="${value}" ${current === value ? 'selected' : ''}>${label}</option>`)
      .join('');
  }

  function detailHtml(order) {
    const items = (order.order_items || []).map(item => `
      <tr>
        <td>${escapeHtml(item.name)}<div style="font-size:11px;color:var(--text-muted)">Giá gốc: ${money(item.base_unit_price)} · giảm ${escapeHtml(item.discount_percent)}%</div></td>
        <td>${escapeHtml(item.quantity)} ${escapeHtml(item.unit)}</td>
        <td class="text-right">${money(item.unit_price)}</td>
        <td class="text-right"><strong>${money(item.line_total)}</strong></td>
      </tr>
    `).join('');
    const history = (order.order_history || [])
      .slice()
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .map(entry => `<li><strong>${dateTime(entry.created_at)}</strong> — ${escapeHtml(STATUS_LABELS[entry.to_status] || entry.action)}${entry.note ? `: ${escapeHtml(entry.note)}` : ''}</li>`)
      .join('');
    return `
      <tr id="central-order-detail-${order.id}" class="central-order-detail" style="display:none;background:#f8fafc">
        <td colspan="7" style="padding:16px">
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px;margin-bottom:12px">
            <div><strong>Người nhận:</strong> ${escapeHtml(order.delivery_name)} — ${escapeHtml(order.delivery_phone)}<br><strong>Địa chỉ:</strong> ${escapeHtml(order.delivery_address || 'Nhận tại điểm')}<br><strong>Ghi chú:</strong> ${escapeHtml(order.note || 'Không có')}</div>
            <div><strong>Nguồn:</strong> ${escapeHtml(order.source)}<br><strong>Nhóm:</strong> ${escapeHtml(order.customer_tier)} — giảm ${escapeHtml(order.discount_percent)}%<br><strong>Tạm tính:</strong> ${money(order.subtotal)} — <strong>Giảm:</strong> ${money(order.discount_amount)}</div>
          </div>
          <div class="table-responsive">
            <table class="data-table"><thead><tr><th>Sản phẩm</th><th>Số lượng</th><th>Đơn giá</th><th>Thành tiền</th></tr></thead><tbody>${items || '<tr><td colspan="4">Không có sản phẩm</td></tr>'}</tbody></table>
          </div>
          <div style="margin-top:12px"><strong>Lịch sử:</strong><ul style="margin:6px 0 0;padding-left:20px;font-size:12px">${history || '<li>Chưa có lịch sử</li>'}</ul></div>
        </td>
      </tr>
    `;
  }

  function render() {
    const tbody = q('central-orders-body');
    if (!tbody) return;
    const filtered = filteredOrders();
    const count = q('central-orders-count');
    if (count) count.textContent = `${orders.length} đơn hàng — đang hiển thị ${filtered.length}`;

    ['pending', 'preparing', 'shipping', 'completed'].forEach(status => {
      const el = q(`central-stat-${status}`);
      if (el) el.textContent = orders.filter(order => order.status === status).length;
    });

    if (!filtered.length) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--text-muted)">Không có đơn phù hợp.</td></tr>';
      return;
    }

    tbody.innerHTML = filtered.map(order => `
      <tr>
        <td><strong>${escapeHtml(order.order_code)}</strong><div style="font-size:11px;color:var(--text-muted)">${dateTime(order.created_at)}</div></td>
        <td><strong>${escapeHtml(order.customer_name)}</strong><div style="font-size:11px;color:var(--text-muted)">${escapeHtml(order.customer_code)} · ${escapeHtml(order.customer_phone)}<br>${escapeHtml(order.customer_company || '')}</div></td>
        <td><div style="max-width:240px;font-size:12px">${escapeHtml(order.delivery_alias || '')}<br>${escapeHtml(order.delivery_address || 'Nhận tại điểm')}</div></td>
        <td><strong style="color:var(--emerald-600)">${money(order.grand_total)}</strong><div style="font-size:11px;color:var(--text-muted)">${escapeHtml(order.item_count)} món</div></td>
        <td><select class="form-control central-payment-select" data-id="${order.id}" style="min-width:130px">${paymentOptions(order.payment_status)}</select></td>
        <td><select class="form-control central-status-select" data-id="${order.id}" data-current="${order.status}" style="min-width:150px">${statusOptions(order.status)}</select></td>
        <td><button class="btn btn-secondary btn-xs central-detail-btn" data-id="${order.id}"><i class="fa-solid fa-eye"></i></button></td>
      </tr>
      ${detailHtml(order)}
    `).join('');

    tbody.querySelectorAll('.central-detail-btn').forEach(button => {
      button.addEventListener('click', () => {
        const detail = q(`central-order-detail-${button.dataset.id}`);
        if (detail) detail.style.display = detail.style.display === 'none' ? '' : 'none';
      });
    });
    tbody.querySelectorAll('.central-status-select').forEach(select => {
      select.addEventListener('change', () => changeStatus(select));
    });
    tbody.querySelectorAll('.central-payment-select').forEach(select => {
      select.addEventListener('change', () => changePayment(select));
    });
  }

  async function changeStatus(select) {
    const order = orders.find(item => item.id === select.dataset.id);
    if (!order) return;
    const previous = order.status;
    const next = select.value;
    const note = prompt(`Chuyển ${order.order_code} sang “${STATUS_LABELS[next]}”. Ghi chú (không bắt buộc):`, '') ?? null;
    if (note === null) {
      select.value = previous;
      return;
    }
    select.disabled = true;
    try {
      await request('/api/admin/orders', {
        method: 'PATCH',
        body: JSON.stringify({ orderId: order.id, status: next, note }),
      });
      notify(`Đã chuyển ${order.order_code} sang ${STATUS_LABELS[next]}`, 'success');
      await loadOrders();
    } catch (error) {
      select.value = previous;
      notify(error.message, 'error');
    } finally {
      select.disabled = false;
    }
  }

  async function changePayment(select) {
    const order = orders.find(item => item.id === select.dataset.id);
    if (!order) return;
    const previous = order.payment_status;
    select.disabled = true;
    try {
      await request('/api/admin/orders', {
        method: 'PATCH',
        body: JSON.stringify({
          orderId: order.id,
          status: order.status,
          paymentStatus: select.value,
          note: `Cập nhật thanh toán: ${PAYMENT_LABELS[select.value]}`,
        }),
      });
      notify(`Đã cập nhật thanh toán ${order.order_code}`, 'success');
      await loadOrders();
    } catch (error) {
      select.value = previous;
      notify(error.message, 'error');
    } finally {
      select.disabled = false;
    }
  }

  function init() {
    q('central-orders-refresh')?.addEventListener('click', loadOrders);
    q('central-orders-search')?.addEventListener('input', render);
    q('central-orders-status-filter')?.addEventListener('change', render);
    q('central-orders-token-save')?.addEventListener('click', () => {
      const value = q('central-orders-token')?.value.trim();
      if (!value) return;
      sessionStorage.setItem(TOKEN_KEY, value);
      loadOrders();
    });
    document.querySelector('[data-tab="tab-central-orders"]')?.addEventListener('click', loadOrders);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
