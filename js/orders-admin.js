/** Quản lý đơn hàng trung tâm qua Website API (không phụ thuộc Google Sheets). */
(function () {
  'use strict';

  const API_BASE_KEY = 'tps1_orders_api_base';
  const TOKEN_KEY = 'tps1_admin_api_token';
  const DEFAULT_API_BASE = 'https://thucphamsomot.vn';
  const STATUS_LABELS = { draft: 'Đơn nháp (Chờ khách duyệt)', pending: 'Chờ xác nhận', confirmed: 'Đã xác nhận', preparing: 'Đang chuẩn bị', shipping: 'Đang giao', completed: 'Hoàn thành', canceled: 'Đã hủy' };
  const PAYMENT_LABELS = { pending: 'Chờ xử lý', cod: 'COD', paid: 'Đã thanh toán', failed: 'Thất bại', refunded: 'Đã hoàn tiền' };
  const SOURCE_LABELS = { website: 'Website', miniapp: 'Mini App', zalo_mini_app: 'Zalo Mini App', admin: 'Admin' };
  let orders = [];
  let tiers = [];

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
      tiers = data.tiers || [];
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
        <div class="order-admin-item__product"><strong>${escapeHtml(item.name || 'Sản phẩm')}</strong><small>${item.sku ? `SKU: ${escapeHtml(item.sku)} · ` : ''}Giá gốc ${money(item.base_unit_price)} · CK ${escapeHtml(item.discount_percent || 0)}%</small>${item.item_note || item.pricing_note ? `<em>Quy cách: ${escapeHtml(item.item_note || item.pricing_note)}</em>` : ''}</div>
        <div class="order-admin-item__qty"><span>Số lượng</span><strong>${escapeHtml(item.quantity)} ${escapeHtml(item.unit || '')}</strong></div>
        <div class="order-admin-item__price"><span>Đơn giá</span><strong>${money(item.unit_price)}</strong></div>
        <div class="order-admin-item__total"><span>Thành tiền</span><strong>${money(item.line_total)}</strong></div>
      </div>`).join('');
  }

  function editableItemRow(item, isNew) {
    const key = isNew ? `new-${String(item.id)}` : String(item.id);
    return `<div class="order-line-editor" data-line-key="${escapeHtml(key)}" data-item-id="${isNew ? '' : escapeHtml(item.id)}" data-product-id="${escapeHtml(item.product_id || item.id || '')}" data-product-local-id="${escapeHtml(item.product_local_id || item.localProductId || '')}" data-base-price="${Number(item.base_unit_price ?? item.price) || 0}">
      <div class="order-line-editor__product"><strong>${escapeHtml(item.name || 'Sản phẩm')}</strong><small>${item.sku ? `SKU: ${escapeHtml(item.sku)} · ` : ''}${escapeHtml(item.unit || '')} · Giá gốc ${money(item.base_unit_price ?? item.price)}</small></div>
      <label><span>Số lượng</span><input class="order-line-quantity" type="number" min="0.001" step="0.001" value="${Number(item.quantity || 1)}"></label>
      <label><span>Đơn giá chốt</span><input class="order-final-unit-price" type="number" min="0" step="1" value="${Number(item.unit_price ?? item.price ?? item.base_unit_price) || 0}"></label>
      <label class="order-line-editor__note"><span>Quy cách / ghi chú riêng</span><textarea class="order-line-note" rows="2" placeholder="Ví dụ: cắt lát 3mm, đóng túi 5kg...">${escapeHtml(item.item_note || item.pricing_note || '')}</textarea></label>
      <button type="button" class="order-line-remove" title="Xóa khỏi đơn"><i class="fa-solid fa-trash-can"></i></button>
    </div>`;
  }

  function historyHtml(order) {
    const history = (order.order_history || []).slice().sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    if (!history.length) return '<div class="order-admin-history-empty">Chưa có lịch sử cập nhật.</div>';
    return history.map(entry => `<div class="order-admin-history-item"><span></span><div><strong>${escapeHtml(STATUS_LABELS[entry.to_status] || entry.action || 'Cập nhật')}</strong><small>${dateTime(entry.created_at)}${entry.note ? ` · ${escapeHtml(entry.note)}` : ''}</small></div></div>`).join('');
  }

  function pricingEditorHtml(order) {
    const account = order.customer_account || {};
    const currentTier = account.discount_tier || order.customer_tier || 'VIP0';
    const currentMode = order.pricing_mode || 'tier';
    const locked = ['shipping', 'completed', 'canceled'].includes(order.status) || ['paid', 'refunded'].includes(order.payment_status);
    const tierOptions = (tiers.length ? tiers : [
      { code: 'VIP0', name: 'VIP0 - Không chiết khấu', discount_percent: 0 },
      { code: 'VIP1', name: 'VIP1', discount_percent: 5 },
      { code: 'VIP2', name: 'VIP2', discount_percent: 10 },
      { code: 'VIP3', name: 'VIP3', discount_percent: 15 },
    ]).map(tier => `<option value="${escapeHtml(tier.code)}" data-discount="${Number(tier.discount_percent) || 0}" ${tier.code === currentTier ? 'selected' : ''}>${escapeHtml(tier.name || tier.code)} (${Number(tier.discount_percent) || 0}%)</option>`).join('');
    const editableRows = (order.order_items || []).map(item => editableItemRow(item, false)).join('');
    const hasDocument = order.confirmation_document_status === 'generated' || (order.order_documents || []).some(doc => doc.status === 'generated');
    return `<section class="order-pricing-editor" data-order-id="${order.id}">
      <div class="order-admin-section-title"><i class="fa-solid fa-tags"></i><span>Phân loại khách & chốt đơn giá</span><b class="order-pricing-state ${order.pricing_status === 'finalized' ? 'is-final' : ''}">${order.pricing_status === 'finalized' ? `Đã chốt R${order.price_revision || 1}` : 'Giá tạm tính'}</b></div>
      <div class="order-pricing-body">
        <div class="order-pricing-alert"><i class="fa-solid fa-circle-info"></i><span>${account.verification_status === 'verified' ? 'Khách đã xác thực' : 'Khách đang chờ xác thực'}. Sale vẫn phải kiểm tra và chốt giá cho đơn này.</span></div>
        <div class="order-pricing-grid">
          <label><span>Phân loại khách hàng</span><select class="form-control order-customer-tier">${tierOptions}</select></label>
          <label><span>Chế độ tính giá</span><select class="form-control order-pricing-mode"><option value="tier" ${currentMode === 'tier' ? 'selected' : ''}>Theo hạng khách hàng</option><option value="order_discount" ${currentMode === 'order_discount' ? 'selected' : ''}>Chiết khấu riêng toàn đơn</option><option value="manual_item_price" ${currentMode === 'manual_item_price' ? 'selected' : ''}>Đơn giá thủ công từng sản phẩm</option></select></label>
          <label class="order-discount-field"><span>Chiết khấu riêng (%)</span><input class="form-control order-discount-percent" type="number" min="0" max="100" step="0.01" value="${Number(order.manual_discount_percent || 0)}"></label>
          <label><span>Phí giao hàng</span><input class="form-control order-shipping-amount" type="number" min="0" step="1000" value="${Number(order.shipping_amount || 0)}"></label>
        </div>
        <section class="order-lines-editor">
          <div class="order-lines-editor__head"><div><strong>Danh sách sản phẩm cuối cùng</strong><small>Có thể sửa số lượng, đơn giá, quy cách hoặc xóa dòng.</small></div><b data-final-item-count>${(order.order_items || []).length} sản phẩm</b></div>
          <div class="order-editable-lines">${editableRows}</div>
          <div class="order-product-picker"><div class="order-product-picker__search"><input class="form-control order-product-search" type="search" placeholder="Tìm tên sản phẩm để thêm vào đơn..."><button type="button" class="btn order-product-search-btn"><i class="fa-solid fa-magnifying-glass"></i> Tìm</button></div><div class="order-product-results" hidden></div></div>
        </section>
        <div class="order-pricing-grid order-pricing-notes"><label><span>Ghi chú phân loại khách</span><textarea class="form-control order-verification-note" rows="2" placeholder="Lý do giữ VIP0 hoặc nâng hạng..."></textarea></label><label><span>Ghi chú xác nhận giá</span><textarea class="form-control order-pricing-note" rows="2" placeholder="Lý do điều chỉnh giá...">${escapeHtml(order.pricing_note || '')}</textarea></label></div>
        <div class="order-pricing-preview"><div><span>Giá trị gốc</span><strong data-preview-subtotal>${money(order.subtotal)}</strong></div><div><span>Giảm/điều chỉnh</span><strong data-preview-adjustment>-${money(order.discount_amount)}</strong></div><div><span>Tổng sau xác nhận</span><strong data-preview-total>${money(order.grand_total)}</strong></div></div>
        <div class="order-pricing-actions">${hasDocument ? '<button type="button" class="btn order-download-pdf"><i class="fa-solid fa-file-pdf"></i> Tải PDF xác nhận</button>' : ''}<button type="button" class="btn btn-primary order-finalize-btn" ${locked ? 'disabled' : ''}><i class="fa-solid fa-circle-check"></i> ${order.pricing_status === 'finalized' ? 'Chốt lại & tạo PDF mới' : 'Xác nhận khách & chốt giá'}</button></div>
        ${locked ? '<p class="order-pricing-locked">Đơn đã thanh toán/đang giao/hoàn thành nên không thể chỉnh giá.</p>' : ''}
      </div>
    </section>`;
  }

  function detailHtml(order) {
    return `<div class="order-admin-detail">
      <div class="order-admin-detail__grid">
        <section class="order-admin-products"><div class="order-admin-section-title"><i class="fa-solid fa-basket-shopping"></i><span>Sản phẩm trong đơn</span><b>${escapeHtml(order.item_count || (order.order_items || []).length)} món</b></div><div>${itemRows(order)}</div></section>
        <aside class="order-admin-side-info">
          <section><div class="order-admin-section-title"><i class="fa-solid fa-location-dot"></i><span>Thông tin giao nhận</span></div><dl><div><dt>Người nhận</dt><dd>${escapeHtml(order.delivery_name || order.customer_name)}</dd></div><div><dt>Điện thoại</dt><dd>${escapeHtml(order.delivery_phone || order.customer_phone)}</dd></div><div><dt>Địa chỉ</dt><dd>${escapeHtml(order.delivery_address || 'Nhận tại điểm')}</dd></div><div><dt>Ghi chú</dt><dd>${escapeHtml(order.note || 'Không có')}</dd></div></dl></section>
          <section><div class="order-admin-section-title"><i class="fa-solid fa-receipt"></i><span>Tổng kết đơn</span></div><div class="order-admin-totals"><div><span>Tạm tính</span><strong>${money(order.subtotal)}</strong></div><div><span>Chiết khấu (${escapeHtml(order.discount_percent || 0)}%)</span><strong>-${money(order.discount_amount)}</strong></div><div><span>Tổng thanh toán</span><strong>${money(order.grand_total)}</strong></div></div></section>
        </aside>
      </div>
      ${pricingEditorHtml(order)}
      <section class="order-admin-history"><div class="order-admin-section-title"><i class="fa-solid fa-clock-rotate-left"></i><span>Lịch sử xử lý</span></div><div class="order-admin-history-list">${historyHtml(order)}</div></section>
    </div>`;
  }

  function openOrderModal(orderId) {
    const order = orders.find(item => String(item.id) === String(orderId));
    if (!order) return;
    closeOrderModal();
    const modal = document.createElement('div');
    modal.id = 'central-order-modal';
    modal.className = 'order-admin-modal';
    modal.innerHTML = `
      <button class="order-admin-modal__backdrop" type="button" data-close-order-modal aria-label="Đóng chi tiết đơn hàng"></button>
      <section class="order-admin-modal__panel" role="dialog" aria-modal="true" aria-labelledby="central-order-modal-title">
        <header class="order-admin-modal__header">
          <div><span class="order-admin-source">${escapeHtml(SOURCE_LABELS[order.source] || order.source || 'Website')}</span><h3 id="central-order-modal-title">${escapeHtml(order.order_code)}</h3><p>${dateTime(order.created_at)} · ${escapeHtml(order.customer_name)} · ${escapeHtml(order.customer_phone)}</p></div>
          <div class="order-admin-modal__header-actions">${statusBadge(order.status)}<button type="button" data-close-order-modal aria-label="Đóng"><i class="fa-solid fa-xmark"></i></button></div>
        </header>
        <div class="order-admin-modal__body">${detailHtml(order)}</div>
      </section>`;
    document.body.appendChild(modal);
    document.body.classList.add('order-modal-open');
    modal.querySelectorAll('[data-close-order-modal]').forEach(button => button.addEventListener('click', closeOrderModal));
    bindPricingEditor(modal, order);
    modal.querySelector('.order-admin-modal__header-actions button')?.focus();
  }

  function pricingValues(root, order) {
    const tierSelect = root.querySelector('.order-customer-tier');
    const mode = root.querySelector('.order-pricing-mode')?.value || 'tier';
    const tierDiscount = Number(tierSelect?.selectedOptions?.[0]?.dataset.discount || 0);
    const orderDiscount = Number(root.querySelector('.order-discount-percent')?.value || 0);
    const shipping = Math.max(0, Number(root.querySelector('.order-shipping-amount')?.value || 0));
    let subtotal = 0;
    let merchandise = 0;
    const items = Array.from(root.querySelectorAll('.order-line-editor')).map(row => {
      const input = row.querySelector('.order-final-unit-price');
      const base = Number(row.dataset.basePrice) || 0;
      const quantity = Math.max(0, Number(row.querySelector('.order-line-quantity')?.value || 0));
      let finalUnitPrice = base;
      if (mode === 'tier') finalUnitPrice = Math.round(base * (1 - tierDiscount / 100));
      else if (mode === 'order_discount') finalUnitPrice = Math.round(base * (1 - orderDiscount / 100));
      else finalUnitPrice = Math.max(0, Math.round(Number(input?.value || 0)));
      subtotal += Math.round(base * quantity);
      merchandise += Math.round(finalUnitPrice * quantity);
      if (input && mode !== 'manual_item_price') input.value = String(finalUnitPrice);
      return {
        itemId: row.dataset.itemId || undefined,
        productId: row.dataset.productId || undefined,
        productLocalId: row.dataset.productLocalId || undefined,
        quantity,
        finalUnitPrice,
        note: row.querySelector('.order-line-note')?.value.trim() || '',
      };
    });
    return { tier: tierSelect?.value || 'VIP0', mode, orderDiscount, shipping, subtotal, merchandise, total: merchandise + shipping, items };
  }

  function refreshPricingPreview(root, order) {
    const value = pricingValues(root, order);
    root.querySelector('.order-discount-field').style.display = value.mode === 'order_discount' ? '' : 'none';
    root.querySelectorAll('.order-final-unit-price').forEach(input => { input.disabled = value.mode !== 'manual_item_price'; });
    root.querySelector('[data-final-item-count]').textContent = `${value.items.length} sản phẩm`;
    root.querySelector('[data-preview-subtotal]').textContent = money(value.subtotal);
    root.querySelector('[data-preview-adjustment]').textContent = `${value.subtotal - value.merchandise >= 0 ? '-' : '+'}${money(Math.abs(value.subtotal - value.merchandise))}`;
    root.querySelector('[data-preview-total]').textContent = money(value.total);
  }

  function bindPricingEditor(modal, order) {
    const root = modal.querySelector('.order-pricing-editor');
    if (!root) return;
    const bindLine = row => {
      row.querySelectorAll('input,textarea').forEach(control => control.addEventListener('input', () => refreshPricingPreview(root, order)));
      row.querySelector('.order-line-remove')?.addEventListener('click', () => {
        if (root.querySelectorAll('.order-line-editor').length <= 1) return notify('Đơn cuối cùng phải còn ít nhất một sản phẩm', 'warning');
        row.remove();
        refreshPricingPreview(root, order);
      });
    };
    root.querySelectorAll('select,input').forEach(control => control.addEventListener('input', () => refreshPricingPreview(root, order)));
    root.querySelectorAll('.order-line-editor').forEach(bindLine);
    const searchProducts = async () => {
      const input = root.querySelector('.order-product-search');
      const results = root.querySelector('.order-product-results');
      const keyword = input?.value.trim() || '';
      if (keyword.length < 2) return notify('Nhập ít nhất 2 ký tự để tìm sản phẩm', 'warning');
      results.hidden = false;
      results.innerHTML = '<div class="order-product-results__empty"><i class="fa-solid fa-spinner fa-spin"></i> Đang tìm sản phẩm...</div>';
      try {
        const data = await request(`/api/admin/orders?productSearch=${encodeURIComponent(keyword)}`, { method: 'GET' });
        const products = (data.products || []).slice(0, 12);
        results.innerHTML = products.length ? products.map(product => `<button type="button" class="order-product-result" data-product='${escapeHtml(JSON.stringify(product))}'><span><strong>${escapeHtml(product.name)}</strong><small>${escapeHtml(product.categoryLabel || '')} · ${escapeHtml(product.unit || '')}</small></span><b>${money(product.price)}</b><i class="fa-solid fa-plus"></i></button>`).join('') : '<div class="order-product-results__empty">Không tìm thấy sản phẩm phù hợp.</div>';
        results.querySelectorAll('.order-product-result').forEach(button => button.addEventListener('click', () => {
          const product = JSON.parse(button.dataset.product);
          if (Array.from(root.querySelectorAll('.order-line-editor')).some(row => String(row.dataset.productId) === String(product.id) || (product.localProductId && String(row.dataset.productLocalId) === String(product.localProductId)))) return notify('Sản phẩm này đã có trong đơn', 'warning');
          const holder = document.createElement('div');
          holder.innerHTML = editableItemRow({ ...product, base_unit_price: product.price, unit_price: product.price, quantity: 1 }, true);
          const row = holder.firstElementChild;
          root.querySelector('.order-editable-lines').appendChild(row);
          bindLine(row);
          results.hidden = true;
          input.value = '';
          refreshPricingPreview(root, order);
        }));
      } catch (error) { results.innerHTML = `<div class="order-product-results__empty">${escapeHtml(error.message)}</div>`; }
    };
    root.querySelector('.order-product-search-btn')?.addEventListener('click', searchProducts);
    root.querySelector('.order-product-search')?.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); searchProducts(); } });
    refreshPricingPreview(root, order);
    root.querySelector('.order-finalize-btn')?.addEventListener('click', async buttonEvent => {
      const button = buttonEvent.currentTarget;
      const value = pricingValues(root, order);
      if (!value.items.length || value.items.some(item => item.quantity <= 0)) return notify('Kiểm tra lại số lượng sản phẩm', 'warning');
      if (!confirm(`Xác nhận khách ở hạng ${value.tier} và chốt tổng đơn ${money(value.total)}?`)) return;
      button.disabled = true;
      try {
        const data = await request('/api/admin/orders', {
          method: 'POST',
          body: JSON.stringify({
            orderId: order.id,
            customerTier: value.tier,
            pricingMode: value.mode,
            orderDiscountPercent: value.orderDiscount,
            shippingAmount: value.shipping,
            items: value.items,
            verificationNote: root.querySelector('.order-verification-note')?.value || '',
            pricingNote: root.querySelector('.order-pricing-note')?.value || '',
            actor: 'TPS1 Admin',
          }),
        });
        notify(data.warning || `Đã chốt giá ${order.order_code} và tạo PDF xác nhận`, data.warning ? 'warning' : 'success');
        closeOrderModal();
        await loadOrders();
      } catch (error) { notify(error.message, 'error'); }
      finally { button.disabled = false; }
    });
    root.querySelector('.order-download-pdf')?.addEventListener('click', () => downloadConfirmation(order));
  }

  async function downloadConfirmation(order) {
    try {
      const response = await fetch(`${apiBase()}/api/admin/order-confirmation?orderId=${encodeURIComponent(order.id)}`, { headers: { 'X-Admin-Token': token() } });
      if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(data.error || 'Không tải được PDF'); }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `XAC-NHAN-DON-HANG_${order.order_code}_R${order.price_revision || 1}.pdf`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (error) { notify(error.message, 'error'); }
  }

  function closeOrderModal() {
    q('central-order-modal')?.remove();
    document.body.classList.remove('order-modal-open');
  }

  function orderCard(order) {
    const priceState = order.pricing_status === 'finalized'
      ? `<span class="order-card-price-state is-final"><i class="fa-solid fa-circle-check"></i>Đã chốt R${escapeHtml(order.price_revision || 1)}</span>`
      : '<span class="order-card-price-state"><i class="fa-regular fa-clock"></i>Chờ chốt giá</span>';
    return `<article class="order-admin-card" data-order-id="${order.id}">
      <div class="order-admin-card__top">
        <div class="order-admin-code"><span class="order-admin-source">${escapeHtml(SOURCE_LABELS[order.source] || order.source || 'Website')}</span><strong>${escapeHtml(order.order_code)}</strong><small><i class="fa-regular fa-calendar"></i>${dateTime(order.created_at)}</small></div>
        ${statusBadge(order.status)}
      </div>
      <div class="order-admin-card__body">
        <div class="order-admin-customer"><span class="order-admin-avatar"><i class="fa-regular fa-user"></i></span><div><span>Khách hàng</span><strong>${escapeHtml(order.customer_name)}</strong><small>${escapeHtml(order.customer_code)} · ${escapeHtml(order.customer_phone)}</small><small>${escapeHtml(order.customer_company || 'Khách hàng cá nhân')}</small></div></div>
        <div class="order-admin-delivery"><span>Giao đến</span><strong><i class="fa-solid fa-location-dot"></i>${escapeHtml(order.delivery_alias || 'Địa chỉ nhận hàng')}</strong><small>${escapeHtml(order.delivery_address || 'Nhận tại điểm')}</small></div>
        <div class="order-admin-value"><span>${order.pricing_status === 'finalized' ? 'Giá trị đã chốt' : 'Giá trị tạm tính'}</span><strong>${money(order.grand_total)}</strong><small>${escapeHtml(order.item_count || (order.order_items || []).length)} món · CK ${escapeHtml(order.discount_percent || 0)}%</small>${priceState}</div>
        <label class="order-admin-control"><span>Thanh toán</span><select class="central-payment-select" data-id="${order.id}">${options(PAYMENT_LABELS, order.payment_status)}</select></label>
        <label class="order-admin-control"><span>Trạng thái xử lý</span><select class="central-status-select" data-id="${order.id}" data-current="${escapeHtml(order.status)}">${options(STATUS_LABELS, order.status)}</select></label>
        <button class="order-admin-toggle central-detail-btn" data-id="${order.id}" aria-label="Xem chi tiết ${escapeHtml(order.order_code)}" title="Xem chi tiết"><i class="fa-regular fa-eye"></i><span>Chi tiết</span></button>
      </div>
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
    list.querySelectorAll('.central-detail-btn').forEach(button => button.addEventListener('click', () => openOrderModal(button.dataset.id)));
    list.querySelectorAll('.central-status-select').forEach(select => select.addEventListener('change', () => changeStatus(select)));
    list.querySelectorAll('.central-payment-select').forEach(select => select.addEventListener('change', () => changePayment(select)));
  }

  async function changeStatus(select) {
    const order = orders.find(item => String(item.id) === String(select.dataset.id)); if (!order) return;
    const previous = order.status; const next = select.value;
    const note = prompt(`Chuyển ${order.order_code} sang “${STATUS_LABELS[next]}”. Ghi chú (không bắt buộc):`, '') ?? null;
    if (note === null) { select.value = previous; return; }
    select.disabled = true;
    try { await request('/api/admin/orders', { method: 'PATCH', body: JSON.stringify({ orderId: order.id, status: next, note }) }); notify(`Đã chuyển ${order.order_code} sang ${STATUS_LABELS[next]}`, 'success'); await loadOrders(); }
    catch (error) { select.value = previous; notify(error.message, 'error'); }
    finally { select.disabled = false; }
  }

  async function changePayment(select) {
    const order = orders.find(item => String(item.id) === String(select.dataset.id)); if (!order) return;
    const previous = order.payment_status; select.disabled = true;
    try { await request('/api/admin/orders', { method: 'PATCH', body: JSON.stringify({ orderId: order.id, status: order.status, paymentStatus: select.value, note: `Cập nhật thanh toán: ${PAYMENT_LABELS[select.value]}` }) }); notify(`Đã cập nhật thanh toán ${order.order_code}`, 'success'); await loadOrders(); }
    catch (error) { select.value = previous; notify(error.message, 'error'); }
    finally { select.disabled = false; }
  }

  function init() {
    q('central-orders-refresh')?.addEventListener('click', loadOrders);
    q('central-orders-search')?.addEventListener('input', render);
    q('central-orders-status-filter')?.addEventListener('change', render);
    q('central-orders-payment-filter')?.addEventListener('change', render);
    document.addEventListener('keydown', event => { if (event.key === 'Escape') closeOrderModal(); });
    q('central-orders-token-save')?.addEventListener('click', () => { const value = q('central-orders-token')?.value.trim(); if (!value) return; sessionStorage.setItem(TOKEN_KEY, value); loadOrders(); });
    document.querySelector('[data-tab="tab-central-orders"]')?.addEventListener('click', loadOrders);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
