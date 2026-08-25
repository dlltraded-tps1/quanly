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

    // Sale: chỉ load KH được giao (query trực tiếp vip_accounts với sales_rep_id)
    if (window.currentUserRole === 'sale' && window.currentUserId) {
      const { data, error } = await sb
        .from('vip_accounts')
        .select('id, name, phone, partner_code, company, sales_rep_id, default_shipping_address, default_shipping_name, default_shipping_phone')
        .eq('sales_rep_id', window.currentUserId)
        .eq('is_active', true);
      if (error) throw error;
      customersCache = (data || []).map(c => ({
        ...c,
        address: c.default_shipping_address,
        shipping_address: c.default_shipping_address,
      }));
      return customersCache;
    }

    // Admin: load tất cả qua RPC
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
    ['pos-discount-amount', 'pos-shipping-amount'].forEach(id => {
      q(id).addEventListener('input', calculateTotals);
    });

    // 3.5 Apply Voucher Logic
    q('pos-voucher-apply-btn').addEventListener('click', async () => {
      const code = q('pos-voucher-code').value.trim().toUpperCase();
      q('pos-voucher-code').value = code;
      const discountInput = q('pos-voucher-discount');
      
      if (!code) {
        discountInput.value = '';
        calculateTotals();
        return;
      }
      
      const subtotal = cartItems.reduce((sum, item) => sum + (item.quantity * item.price), 0);
      if (subtotal === 0) return notify('Vui lòng thêm sản phẩm vào giỏ trước khi áp dụng voucher', 'warning');

      try {
        const btn = q('pos-voucher-apply-btn');
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
        
        const sb = window.supabaseModule?.getClient() || window.supabase;
        const { data: voucher, error } = await sb.from('vouchers')
          .select('*')
          .eq('code', code)
          .eq('is_active', true)
          .single();
          
        if (error || !voucher) {
          throw new Error('Mã voucher không hợp lệ hoặc đã hết hạn.');
        }
        
        if (voucher.expires_at && new Date(voucher.expires_at) < new Date()) {
          throw new Error('Mã voucher đã hết hạn.');
        }
        
        if (subtotal < voucher.min_order_value) {
          throw new Error(`Đơn hàng phải từ ${money(voucher.min_order_value)} để áp dụng mã này.`);
        }
        
        if (voucher.max_uses_total > 0 && voucher.current_uses_total >= voucher.max_uses_total) {
          throw new Error('Voucher đã hết lượt sử dụng.');
        }
        
        let discount = 0;
        if (voucher.discount_amount > 0) {
          discount = voucher.discount_amount;
        } else if (voucher.discount_percent > 0) {
          discount = (subtotal * voucher.discount_percent) / 100;
          if (voucher.max_discount_value > 0 && discount > voucher.max_discount_value) {
            discount = voucher.max_discount_value;
          }
        }
        
        if (discount > subtotal) discount = subtotal;
        
        discountInput.value = discount;
        calculateTotals();
        notify(`Áp dụng thành công! Giảm ${money(discount)}`, 'success');
        
      } catch (err) {
        discountInput.value = '';
        calculateTotals();
        notify(err.message, 'error');
      } finally {
        const btn = q('pos-voucher-apply-btn');
        btn.disabled = false;
        btn.innerText = 'Áp dụng';
      }
    });

    // 4. Submit Order - dùng Supabase RPC trực tiếp (không qua backend API)
    q('pos-submit-btn').addEventListener('click', async (e) => {
      const customerId = q('pos-customer-select').value;
      if (!customerId) return notify('Vui lòng chọn khách hàng!', 'error');
      if (cartItems.length === 0) return notify('Giỏ hàng trống!', 'error');

      const btn = e.currentTarget;
      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> ĐANG TẠO ĐƠN...';

      try {
        const sb = window.supabaseModule?.getClient() || window.supabase;
        if (!sb) throw new Error('Supabase client chưa sẵn sàng.');

        // Gọi RPC tạo đơn - đúng signature
        const deliveryAddr = q('pos-delivery-address').value.trim();
        const { data, error } = await sb.rpc('customer_create_order', {
          p_session_token: null,
          p_source: 'admin',
          p_items: cartItems.map(i => ({
            product_id: i.productId,
            name: i.name,
            unit: i.unit || '',
            quantity: i.quantity,
            base_unit_price: i.price
          })),
          p_delivery_type: deliveryAddr ? 'shipping' : 'pickup',
          p_delivery_alias: 'Địa chỉ giao hàng',
          p_delivery_name: q('pos-delivery-name').value.trim() || null,
          p_delivery_phone: q('pos-delivery-phone').value.trim() || null,
          p_delivery_address: deliveryAddr || null,
          p_note: q('pos-note').value.trim() || null,
          p_idempotency_key: `admin-${Date.now()}-${customerId}`,
          p_voucher_code: q('pos-voucher-code').value.trim() || null,
          p_admin_id: window.currentUserId || null,
          p_customer_id: customerId
        });

        if (error) throw error;

        // Sau khi tạo đơn, gán sales_rep_id nếu là sale
        if (window.currentUserRole === 'sale' && window.currentUserId && data?.[0]?.id) {
          await sb.from('orders')
            .update({ sales_rep_id: window.currentUserId })
            .eq('id', data[0].id);
        }

        const orderCode = data?.[0]?.order_code || '';
        notify(`✅ Đã tạo đơn nháp ${orderCode} thành công! Khách hàng vào Mini App xác nhận.`, 'success');
        
        // Reset form
        cartItems = [];
        customersCache = null; // reset cache for fresh load next time
        q('pos-voucher-code').value = '';
        if (q('pos-voucher-discount')) q('pos-voucher-discount').value = '';
        if (q('pos-discount-amount')) q('pos-discount-amount').value = '';
        if (q('pos-shipping-amount')) q('pos-shipping-amount').value = '';
        q('pos-note').value = '';
        q('pos-customer-select').value = '';
        posDiscountAmount = 0;
        posVoucherDiscount = 0;
        posShippingAmount = 0;
        renderCart();

        // Chuyển sang tab đơn hàng
        const ordersTab = document.querySelector('[data-tab="tab-central-orders"]');
        if (ordersTab) ordersTab.click();

      } catch (err) {
        console.error('Create order error:', err);
        notify('❌ Lỗi tạo đơn: ' + (err.message || 'Không xác định'), 'error');
      } finally {
        btn.disabled = false;
        btn.innerHTML = 'TẠO ĐƠN HÀNG (NHÁP)';
      }
    });

    // Load customers - lazy load khi tab được click (để window.currentUserId đã được set)
    function loadAndPopulateCustomers() {
      customersCache = null; // reset để reload mới
      loadCustomers().then(customers => {
        const select = q('pos-customer-select');
        if (!select) return;
        select.innerHTML = '<option value="">-- Chọn Khách Hàng --</option>' + 
          customers.map(c => `<option value="${c.id}">${escapeHtml(c.name)} (${escapeHtml(c.phone || '')})</option>`).join('');
        
        select.onchange = (e) => {
          const cId = e.target.value;
          const cust = customersCache?.find(c => String(c.id) === String(cId));
          if (cust) {
            if (q('pos-delivery-name')) q('pos-delivery-name').value = cust.name || '';
            if (q('pos-delivery-phone')) q('pos-delivery-phone').value = cust.phone || '';
            if (q('pos-delivery-address')) q('pos-delivery-address').value = cust.default_shipping_address || cust.shipping_address || cust.address || '';
          } else {
            if (q('pos-delivery-name')) q('pos-delivery-name').value = '';
            if (q('pos-delivery-phone')) q('pos-delivery-phone').value = '';
            if (q('pos-delivery-address')) q('pos-delivery-address').value = '';
          }
        };
      }).catch(e => {
        console.error('Load customers error:', e);
        const select = q('pos-customer-select');
        if (select) select.innerHTML = '<option value="">Lỗi tải danh sách KH</option>';
      });
    }

    // Load sau khi auth hoàn tất (event từ app.js)
    window.addEventListener('tps1-auth-complete', () => {
      loadAndPopulateCustomers();
    });

    // Load lại mỗi khi tab POS được chọn
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-tab="tab-pos-create-order"]');
      if (btn && window.currentUserId) setTimeout(loadAndPopulateCustomers, 150);
    });

    // 5. Bind the old Create Order button to switch to POS tab
    const oldCreateBtn = q('central-orders-create');
    if (oldCreateBtn) {
      oldCreateBtn.addEventListener('click', () => {
        const posTab = document.querySelector('[data-tab="tab-pos-create-order"]');
        if (posTab) posTab.click();
      });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initPosEvents); 
  else initPosEvents();

})();
