(function () {
  'use strict';

  function q(id) { return document.getElementById(id); }
  function notify(message, type) { 
    if (window.showToastNotification) window.showToastNotification(message, type); 
    else if (window.showAppToast) window.showAppToast(message, type); 
    else alert(message); 
  }
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
  let posDiscountAmount = 0;
  let posVoucherDiscount = 0;
  let posShippingAmount = 0;

  async function loadCustomers() {
    if (customersCache) return customersCache;
    const sb = window.supabaseModule?.getClient() || window.supabase;
    if (!sb) throw new Error('Supabase client chưa sẵn sàng.');
    const { data, error } = await sb.rpc('admin_list_customers');
    if (error) throw error;
    customersCache = data || [];
    return customersCache;
  }

  function getImgUrl(url) {
    if (!url || url === '') return './logo.png';
    if (url.startsWith('http')) return url;
    return `https://yntgxollwjemyidizhnn.supabase.co/storage/v1/object/public/products/${url}`;
  }

  function renderCart() {
    const tbody = q('pos-cart-body');
    if (!tbody) return;

    if (cartItems.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:32px;color:#666">Giỏ hàng đang trống</td></tr>';
    } else {
      tbody.innerHTML = cartItems.map((item, idx) => {
        const lineTotal = item.quantity * item.price;
        return `
        <tr>
          <td><img src="${getImgUrl(item.image_url)}" alt=""></td>
          <td>
            <div class="item-name">${escapeHtml(item.name)}</div>
            <div class="item-sku">${item.productId ? escapeHtml(item.productId.substring(0,8)) : 'CUSTOM'} | ${escapeHtml(item.unit || 'Kg')}</div>
          </td>
          <td>
            <input type="number" min="0.001" step="0.001" class="form-control" style="width:70px;padding:4px" value="${item.quantity}" onchange="window._updatePosQty(${idx}, this.value)">
          </td>
          <td>
            <input type="number" min="0" step="1" class="form-control" style="width:100px;padding:4px" value="${item.price}" onchange="window._updatePosPrice(${idx}, this.value)">
          </td>
          <td style="font-weight:600;color:#0f172a">${money(lineTotal)}</td>
          <td>
            <button type="button" class="btn-icon text-danger" onclick="window._removePosItem(${idx})"><i class="fa-solid fa-trash"></i></button>
          </td>
        </tr>
      `}).join('');
    }

    calculateTotals();
  }

  window._updatePosQty = (idx, qty) => {
    cartItems[idx].quantity = Number(qty) || 1;
    renderCart();
  };
  window._updatePosPrice = (idx, price) => {
    cartItems[idx].price = Number(price) || 0;
    renderCart();
  };
  window._removePosItem = (idx) => {
    cartItems.splice(idx, 1);
    renderCart();
  };

  function calculateTotals() {
    let subtotal = cartItems.reduce((sum, item) => sum + (item.quantity * item.price), 0);
    
    // Read input values directly
    posDiscountAmount = Number(q('pos-discount-amount').value) || 0;
    posVoucherDiscount = Number(q('pos-voucher-discount').value) || 0;
    posShippingAmount = Number(q('pos-shipping-amount').value) || 0;

    const total = subtotal - posVoucherDiscount - posDiscountAmount + posShippingAmount;

    q('pos-item-count').textContent = cartItems.length;
    q('pos-subtotal').textContent = money(subtotal);
    q('pos-voucher-display').textContent = '-' + money(posVoucherDiscount);
    q('pos-discount-display').textContent = '-' + money(posDiscountAmount);
    q('pos-shipping-display').textContent = money(posShippingAmount);
    q('pos-total').textContent = money(total > 0 ? total : 0);
  }

  function initPosEvents() {
    // 1. Search Logic
    const searchInput = q('pos-search-input');
    const searchResults = q('pos-search-results');
    let searchTimeout = null;

    searchInput.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      const keyword = e.target.value.trim();
      if (keyword.length < 2) {
        searchResults.classList.add('hidden');
        return;
      }
      
      searchTimeout = setTimeout(async () => {
        searchResults.classList.remove('hidden');
        searchResults.innerHTML = '<div style="padding:16px;text-align:center"><i class="fa-solid fa-spinner fa-spin"></i> Đang tìm...</div>';
        try {
          const data = await request(`/api/admin/orders?productSearch=${encodeURIComponent(keyword)}`, { method: 'GET' });
          const products = (data.products || []).slice(0, 15);
          if (!products.length) {
            searchResults.innerHTML = '<div style="padding:16px;text-align:center">Không tìm thấy sản phẩm</div>';
            return;
          }
          searchResults.innerHTML = products.map(p => `
            <div class="pos-search-item" onclick="window._addPosItem('${p.id}', '${escapeHtml(p.name)}', ${p.price}, '${escapeHtml(p.image_url)}')">
              <img src="${getImgUrl(p.image_url)}" alt="">
              <div class="pos-search-item-info">
                <div class="pos-search-item-title">${escapeHtml(p.name)}</div>
                <div class="pos-search-item-price">${money(p.price)}</div>
              </div>
              <button class="btn btn-sm btn-outline-primary"><i class="fa-solid fa-plus"></i></button>
            </div>
          `).join('');
        } catch (err) {
          searchResults.innerHTML = `<div style="padding:16px;text-align:center;color:red">${escapeHtml(err.message)}</div>`;
        }
      }, 500);
    });

    // Hide search results when clicking outside
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.pos-search-box')) {
        searchResults.classList.add('hidden');
      }
    });

    window._addPosItem = (id, name, price, image_url) => {
      if (cartItems.some(i => i.productId === id)) {
        notify('Sản phẩm đã có trong giỏ, vui lòng tăng số lượng', 'warning');
      } else {
        cartItems.push({ productId: id, name, price, quantity: 1, image_url, unit: 'Kg' });
        renderCart();
      }
      searchResults.classList.add('hidden');
      searchInput.value = '';
    };

    // 2. Add Custom Product
    q('pos-add-custom-btn').addEventListener('click', () => {
      const name = q('pos-custom-name').value.trim();
      const price = Number(q('pos-custom-price').value) || 0;
      const qty = Number(q('pos-custom-qty').value) || 1;

      if (!name) return notify('Vui lòng nhập tên sản phẩm', 'warning');
      
      cartItems.push({ productId: null, name, price, quantity: qty, image_url: '', unit: 'Gói/Hộp' });
      renderCart();

      q('pos-custom-name').value = '';
      q('pos-custom-price').value = '';
      q('pos-custom-qty').value = '1';
    });

    // 3. Bind input changes to calculate totals
    ['pos-discount-amount', 'pos-voucher-discount', 'pos-shipping-amount'].forEach(id => {
      q(id).addEventListener('input', calculateTotals);
    });

    // 4. Submit Order
    q('pos-submit-btn').addEventListener('click', async (e) => {
      const customerId = q('pos-customer-select').value;
      if (!customerId) return notify('Vui lòng chọn khách hàng!', 'error');
      if (cartItems.length === 0) return notify('Giỏ hàng trống!', 'error');

      const btn = e.currentTarget;
      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> ĐANG TẠO ĐƠN...';

      try {
        const payload = {
          customerId,
          items: cartItems.map(i => ({
            product_id: i.productId,
            name: i.name,
            price: i.price,
            quantity: i.quantity,
            unit: i.unit
          })),
          voucherCode: q('pos-voucher-code').value.trim(),
          voucherDiscount: posVoucherDiscount,
          discountAmount: posDiscountAmount,
          discountPercent: 0,
          shippingAmount: posShippingAmount,
          deliveryName: q('pos-delivery-name').value.trim(),
          deliveryPhone: q('pos-delivery-phone').value.trim(),
          deliveryAddress: q('pos-delivery-address').value.trim(),
          note: q('pos-note').value.trim()
        };

        await request('/api/admin/orders/create', { method: 'POST', body: JSON.stringify(payload) });
        notify('Đã tạo đơn hàng NHÁP thành công!', 'success');
        
        // Reset form
        cartItems = [];
        q('pos-voucher-code').value = '';
        q('pos-voucher-discount').value = '';
        q('pos-discount-amount').value = '';
        q('pos-shipping-amount').value = '';
        q('pos-note').value = '';
        q('pos-customer-select').value = '';
        renderCart();

        // Switch to Central Orders tab
        document.querySelector('[data-tab="tab-central-orders"]').click();
        if (q('central-orders-refresh')) q('central-orders-refresh').click();

      } catch (err) {
        notify(err.message, 'error');
      } finally {
        btn.disabled = false;
        btn.innerHTML = 'TẠO ĐƠN HÀNG (NHÁP)';
      }
    });

    // Load customers list
    loadCustomers().then(customers => {
      const select = q('pos-customer-select');
      select.innerHTML = '<option value="">-- Chọn Khách Hàng VIP / CUSTOM --</option>' + 
        customers.map(c => `<option value="${c.id}">${escapeHtml(c.name)} (${escapeHtml(c.phone)})</option>`).join('');
    }).catch(e => {
      console.error(e);
      q('pos-customer-select').innerHTML = '<option value="">Lỗi tải danh sách khách hàng</option>';
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initPosEvents); 
  else initPosEvents();

})();
