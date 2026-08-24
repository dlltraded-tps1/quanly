(function () {
  'use strict';

  function q(id) { return document.getElementById(id); }
  function notify(message, type) { if (window.showToastNotification) window.showToastNotification(message, type); else if (window.showAppToast) window.showAppToast(message, type); else alert(message); }
  function money(value) { return new Intl.NumberFormat('vi-VN').format(Number(value) || 0) + 'đ'; }
  function escapeHtml(value) { return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;'); }

  let currentCustomerId = null;
  let contractPrices = [];
  let allProducts = [];

  window.vipManageContractPrices = async function(customerId, customerName) {
    currentCustomerId = customerId;
    if (q('contract-prices-modal')) q('contract-prices-modal').remove();

    const modal = document.createElement('div');
    modal.id = 'contract-prices-modal';
    modal.className = 'order-admin-modal';
    modal.innerHTML = `
      <button class="order-admin-modal__backdrop" type="button"></button>
      <section class="order-admin-modal__panel" style="max-width:700px">
        <header class="order-admin-modal__header">
          <h2 style="font-size:16px;margin:0"><i class="fa-solid fa-file-contract"></i> Bảng Giá Hợp Đồng: ${escapeHtml(customerName)}</h2>
          <button type="button" class="order-admin-modal__close"><i class="fa-solid fa-xmark"></i></button>
        </header>
        <div class="order-admin-modal__body" style="padding:16px;display:flex;flex-direction:column;gap:16px;">
          
          <div class="form-group">
            <label style="font-weight:bold;font-size:13px;display:block;margin-bottom:4px">Thêm Sản Phẩm Khuyến Mãi Hợp Đồng</label>
            <div style="display:flex;gap:8px;">
              <input id="contract-search-input" type="search" class="form-control" placeholder="Tên sản phẩm...">
              <button id="contract-search-btn" class="btn btn-primary btn-sm"><i class="fa-solid fa-magnifying-glass"></i></button>
            </div>
            <div id="contract-search-results" style="margin-top:8px;max-height:200px;overflow-y:auto;background:#f9fafb;border-radius:8px"></div>
          </div>

          <div class="form-group">
            <label style="font-weight:bold;font-size:13px;display:block;margin-bottom:4px">Các sản phẩm trong hợp đồng</label>
            <div id="contract-items-list" style="background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:8px;min-height:100px;max-height:400px;overflow-y:auto;">
              <div style="text-align:center;padding:16px;color:#666"><i class="fa-solid fa-spinner fa-spin"></i> Đang tải...</div>
            </div>
          </div>

        </div>
      </section>
    `;
    document.body.appendChild(modal);
    modal.querySelector('.order-admin-modal__backdrop').addEventListener('click', () => modal.remove());
    modal.querySelector('.order-admin-modal__close').addEventListener('click', () => modal.remove());

    const searchInput = q('contract-search-input');
    const searchBtn = q('contract-search-btn');
    
    searchBtn.addEventListener('click', searchProducts);
    searchInput.addEventListener('keydown', e => { if (e.key === 'Enter') searchProducts(); });

    await loadContractPrices();
  };

  async function loadContractPrices() {
    const list = q('contract-items-list');
    if (!list) return;
    try {
      const sb = window.supabaseModule?.getClient() || window.supabase;
      const { data, error } = await sb
        .from('customer_contract_prices')
        .select('*, products(name, sku, unit, price_retail, price_wholesale)')
        .eq('customer_id', currentCustomerId);
      if (error) throw error;
      contractPrices = data || [];
      renderContractPrices();
    } catch (err) {
      list.innerHTML = `<div style="padding:16px;color:red;text-align:center">${escapeHtml(err.message)}</div>`;
    }
  }

  function renderContractPrices() {
    const list = q('contract-items-list');
    if (!list) return;
    if (!contractPrices.length) {
      list.innerHTML = '<div style="padding:16px;text-align:center;color:#666">Chưa có sản phẩm nào trong hợp đồng.</div>';
      return;
    }
    list.innerHTML = contractPrices.map((item, idx) => `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:12px;border-bottom:1px solid #eee;">
        <div style="flex:1">
          <div style="font-weight:bold;font-size:13px">${escapeHtml(item.products?.name)}</div>
          <div style="font-size:11px;color:#666">Giá gốc: ${money(item.products?.price_retail || item.products?.price_wholesale)}</div>
        </div>
        <div style="display:flex;align-items:center;gap:12px;">
          <div>
            <label style="font-size:11px;color:#666;display:block">Giá hợp đồng (VND)</label>
            <div style="display:flex;gap:4px">
              <input type="number" class="form-control" style="width:100px;padding:4px" value="${item.price}" id="contract-price-${idx}">
              <button class="btn btn-sm btn-primary" onclick="window._updateContractPrice('${item.product_id}', ${idx})">Lưu</button>
            </div>
          </div>
          <button class="btn btn-sm btn-danger" style="margin-top:16px" onclick="window._deleteContractPrice('${item.product_id}')"><i class="fa-solid fa-trash"></i></button>
        </div>
      </div>
    `).join('');
  }

  window._updateContractPrice = async (productId, idx) => {
    const input = q(`contract-price-${idx}`);
    const newPrice = Number(input.value);
    if (newPrice < 0) return notify('Giá không hợp lệ', 'warning');
    const sb = window.supabaseModule?.getClient() || window.supabase;
    const { error } = await sb
      .from('customer_contract_prices')
      .update({ price: newPrice, updated_at: new Date().toISOString() })
      .eq('customer_id', currentCustomerId)
      .eq('product_id', productId);
    if (error) {
      notify('Lỗi: ' + error.message, 'error');
    } else {
      notify('Đã cập nhật giá hợp đồng', 'success');
      loadContractPrices();
    }
  };

  window._deleteContractPrice = async (productId) => {
    if (!confirm('Xoá sản phẩm này khỏi hợp đồng?')) return;
    const sb = window.supabaseModule?.getClient() || window.supabase;
    const { error } = await sb
      .from('customer_contract_prices')
      .delete()
      .eq('customer_id', currentCustomerId)
      .eq('product_id', productId);
    if (error) {
      notify('Lỗi: ' + error.message, 'error');
    } else {
      notify('Đã xoá thành công', 'success');
      loadContractPrices();
    }
  };

  async function searchProducts() {
    const input = q('contract-search-input');
    const results = q('contract-search-results');
    const keyword = input.value.trim();
    if (keyword.length < 2) return notify('Nhập ít nhất 2 ký tự', 'warning');
    results.innerHTML = '<div style="padding:12px;text-align:center"><i class="fa-solid fa-spinner fa-spin"></i> Đang tìm...</div>';
    
    try {
      const sb = window.supabaseModule?.getClient() || window.supabase;
      const { data, error } = await sb
        .from('products')
        .select('id, name, price_retail, price_wholesale')
        .ilike('name', \`%\${keyword}%\`)
        .eq('active', true)
        .limit(15);
      
      if (error) throw error;
      const products = data || [];
      if (!products.length) {
        results.innerHTML = '<div style="padding:12px;text-align:center">Không tìm thấy</div>';
        return;
      }
      results.innerHTML = products.map(p => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;border-bottom:1px solid #eee">
          <div>
            <div style="font-size:13px;font-weight:600">${escapeHtml(p.name)}</div>
            <div style="font-size:11px;color:#666">${money(p.price_retail || p.price_wholesale)}</div>
          </div>
          <button class="btn btn-sm btn-outline-primary" onclick="window._addContractPrice('${p.id}', ${p.price_retail || p.price_wholesale || 0})">Thêm vào HĐ</button>
        </div>
      `).join('');
    } catch (err) {
      results.innerHTML = `<div style="padding:12px;text-align:center;color:red">${escapeHtml(err.message)}</div>`;
    }
  }

  window._addContractPrice = async (productId, defaultPrice) => {
    if (contractPrices.some(c => c.product_id === productId)) {
      return notify('Sản phẩm đã có trong bảng giá hợp đồng', 'warning');
    }
    const price = prompt('Nhập giá hợp đồng cho sản phẩm này (VND):', defaultPrice);
    if (price === null) return;
    const numPrice = Number(price);
    if (isNaN(numPrice) || numPrice < 0) return notify('Giá không hợp lệ', 'warning');
    
    const sb = window.supabaseModule?.getClient() || window.supabase;
    const { error } = await sb
      .from('customer_contract_prices')
      .insert({
        customer_id: currentCustomerId,
        product_id: productId,
        price: numPrice
      });
      
    if (error) {
      notify('Lỗi thêm sản phẩm: ' + error.message, 'error');
    } else {
      notify('Đã thêm vào hợp đồng', 'success');
      q('contract-search-results').innerHTML = '';
      q('contract-search-input').value = '';
      loadContractPrices();
    }
  };

})();
