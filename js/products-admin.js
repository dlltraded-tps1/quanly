/**
 * TPS1 - Products Admin Module
 * Quản lý sản phẩm trực tiếp từ Supabase
 * Tab "Quản Lý Sản Phẩm" trong hệ thống nội bộ
 */
(function () {
  'use strict';

  // ─── State ────────────────────────────────────────────────────────────────
  let allProducts = [];
  let filteredProducts = [];
  let currentPage = 1;
  const PAGE_SIZE = 25;
  let searchTerm = '';
  let categoryFilter = '';
  let activeFilter = '';   // '' | 'active' | 'inactive'
  let categories = [];
  let rawClient = null;

  // ─── Supabase raw client (for admin ops like image upload) ────────────────
  function getRawClient() {
    if (rawClient) return rawClient;
    const cfg = window.supabaseModule?.getConfig?.();
    if (!cfg?.url || !cfg?.anonKey) return null;
    if (window.supabase && typeof window.supabase.createClient === 'function') {
      rawClient = window.supabase.createClient(cfg.url, cfg.anonKey);
    }
    return rawClient;
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────
  const fmt = (n) =>
    new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n || 0);

  function toast(msg, type = 'info') {
    if (typeof window.showToastNotification === 'function') {
      window.showToastNotification(msg);
    } else {
      console.log('[ProductAdmin]', msg);
    }
  }

  // ─── Load products from Supabase ──────────────────────────────────────────
  async function loadProducts() {
    const tbody = document.getElementById('prod-admin-tbody');
    if (tbody) tbody.innerHTML = '<tr><td colspan="8" class="text-center" style="padding:24px;color:var(--text-muted)">⏳ Đang tải sản phẩm từ Supabase...</td></tr>';

    try {
      const client = getRawClient();
      if (!client) {
        toast('Supabase chưa sẵn sàng. Hãy kiểm tra cấu hình trong tab Cài Đặt.', 'error');
        return;
      }

      let allFetchedData = [];
      let start = 0;
      const step = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await client
          .from('products')
          .select('*')
          .order('category', { ascending: true })
          .order('name', { ascending: true })
          .range(start, start + step - 1);

        if (error) throw error;
        
        if (data && data.length > 0) {
          allFetchedData = allFetchedData.concat(data);
          start += step;
          if (data.length < step) {
            hasMore = false; // Last page
          }
        } else {
          hasMore = false;
        }
      }

      allProducts = allFetchedData || [];
      categories = [...new Set(allProducts.map(p => p.category).filter(Boolean))].sort();

      // Update stats
      const totalEl = document.getElementById('prod-admin-stat-total');
      const activeEl = document.getElementById('prod-admin-stat-active');
      const catEl = document.getElementById('prod-admin-stat-cats');
      if (totalEl) totalEl.textContent = allProducts.length;
      if (activeEl) activeEl.textContent = allProducts.filter(p => p.active !== false).length;
      if (catEl) catEl.textContent = categories.length;

      // Rebuild category filter
      renderCategoryFilter();
      applyFilters();
      toast(`Đã tải ${allProducts.length} sản phẩm`);
    } catch (err) {
      console.error('[ProductAdmin] Load error:', err);
      toast('Lỗi tải sản phẩm: ' + err.message, 'error');
    }
  }

  function renderCategoryFilter() {
    const sel = document.getElementById('prod-admin-cat-filter');
    if (!sel) return;
    const currentVal = sel.value;
    sel.innerHTML = '<option value="">-- Tất cả danh mục --</option>';
    categories.forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat;
      opt.textContent = cat;
      sel.appendChild(opt);
    });
    sel.value = currentVal;
  }

  // ─── Filter & paginate ────────────────────────────────────────────────────
  function applyFilters() {
    const term = searchTerm.toLowerCase();
    filteredProducts = allProducts.filter(p => {
      const matchSearch = !term || (p.name || '').toLowerCase().includes(term) || (p.local_product_id || '').toLowerCase().includes(term);
      const matchCat = !categoryFilter || p.category === categoryFilter;
      const matchActive = !activeFilter ||
        (activeFilter === 'active' && p.active !== false) ||
        (activeFilter === 'inactive' && p.active === false);
      return matchSearch && matchCat && matchActive;
    });
    currentPage = 1;
    renderTable();
    renderPagination();
  }

  // ─── Render table ─────────────────────────────────────────────────────────
  function renderTable() {
    const tbody = document.getElementById('prod-admin-tbody');
    if (!tbody) return;

    const start = (currentPage - 1) * PAGE_SIZE;
    const pageItems = filteredProducts.slice(start, start + PAGE_SIZE);

    const countEl = document.getElementById('prod-admin-count');
    if (countEl) countEl.textContent = `${filteredProducts.length} sản phẩm`;

    if (pageItems.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" class="text-center" style="padding:24px;color:var(--text-muted)">Không có sản phẩm nào</td></tr>';
      return;
    }

    tbody.innerHTML = pageItems.map((p, idx) => {
      const isActive = p.active !== false;
      const imgSrc = p.image_url || '';
      const imgHtml = imgSrc
        ? `<img src="${imgSrc}" alt="${p.name}" style="width:44px;height:44px;object-fit:cover;border-radius:8px;background:#f0f0f0;">`
        : `<div style="width:44px;height:44px;border-radius:8px;background:#f0f0f0;display:flex;align-items:center;justify-content:center;font-size:20px;">📷</div>`;

      return `
        <tr data-pid="${p.id}" style="opacity:${isActive ? '1' : '0.5'}">
          <td>${imgHtml}</td>
          <td>
            <div style="font-weight:600;font-size:13px;">${p.name || ''}</div>
            <div style="font-size:11px;color:var(--text-muted)">${p.local_product_id || p.id}</div>
          </td>
          <td style="font-size:12px;">${p.category || ''}</td>
          <td style="font-size:12px;">${p.unit || ''}</td>
          <td style="font-weight:700;color:var(--color-emerald);font-size:13px;">${fmt(p.price_wholesale)}</td>
          <td style="font-size:12px;color:var(--text-muted);text-decoration:line-through;">${p.price_retail ? fmt(p.price_retail) : ''}</td>
          <td>
            <span class="badge ${isActive ? 'badge-emerald' : 'badge-secondary'}">${isActive ? 'Hiển thị' : 'Đã ẩn'}</span>
          </td>
          <td>
            <div style="display:flex;gap:6px;flex-wrap:wrap;">
              <button class="btn btn-secondary btn-xs" onclick="window.productsAdminModule.openEdit('${p.id}')">
                <i class="fa-solid fa-pen"></i> Sửa
              </button>
              <button class="btn ${isActive ? 'btn-danger' : 'btn-emerald'} btn-xs" onclick="window.productsAdminModule.toggleActive('${p.id}')">
                ${isActive ? '<i class="fa-solid fa-eye-slash"></i> Ẩn' : '<i class="fa-solid fa-eye"></i> Hiện'}
              </button>
            </div>
          </td>
        </tr>`;
    }).join('');
  }

  function renderPagination() {
    const totalPages = Math.ceil(filteredProducts.length / PAGE_SIZE);
    const container = document.getElementById('prod-admin-pagination');
    if (!container) return;

    if (totalPages <= 1) {
      container.innerHTML = '';
      return;
    }

    container.innerHTML = `
      <div class="pagination-info">Trang ${currentPage} / ${totalPages} (${filteredProducts.length} kết quả)</div>
      <div class="pagination-buttons">
        <button class="btn btn-secondary btn-xs" onclick="window.productsAdminModule.goPage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>
          <i class="fa-solid fa-chevron-left"></i>
        </button>
        <span class="pag-number">${currentPage}</span>
        <button class="btn btn-secondary btn-xs" onclick="window.productsAdminModule.goPage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>
          <i class="fa-solid fa-chevron-right"></i>
        </button>
      </div>`;
  }

  // ─── Edit Modal ───────────────────────────────────────────────────────────
  function openEdit(productId) {
    const p = allProducts.find(x => x.id === productId);
    if (!p) return;

    // Remove old modal
    const old = document.getElementById('prod-edit-modal');
    if (old) old.remove();

    const modal = document.createElement('div');
    modal.id = 'prod-edit-modal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:flex-end;justify-content:center;';

    modal.innerHTML = `
      <div style="background:var(--surface-card,#1e2a38);color:var(--text-primary,#e2e8f0);width:100%;max-width:560px;border-radius:20px 20px 0 0;padding:28px;max-height:90vh;overflow-y:auto;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
          <h3 style="margin:0;font-size:16px;"><i class="fa-solid fa-pen-to-square"></i> Sửa sản phẩm</h3>
          <button onclick="document.getElementById('prod-edit-modal').remove()" style="background:none;border:none;color:var(--text-muted,#8899aa);font-size:22px;cursor:pointer;">&times;</button>
        </div>

        <!-- Image Upload -->
        <div style="text-align:center;margin-bottom:20px;">
          <div id="prod-edit-img-preview" onclick="document.getElementById('prod-edit-img-input').click()" style="width:80px;height:80px;border-radius:12px;border:2px dashed #444;margin:0 auto 8px;display:flex;align-items:center;justify-content:center;cursor:pointer;overflow:hidden;background:#2a3a4a;">
            ${p.image_url
              ? `<img src="${p.image_url}" style="width:100%;height:100%;object-fit:cover;">`
              : `<i class="fa-solid fa-camera" style="font-size:28px;color:#666;"></i>`}
          </div>
          <input type="file" id="prod-edit-img-input" accept="image/*" style="display:none;" onchange="window.productsAdminModule.previewImg(this)">
          <button type="button" onclick="document.getElementById('prod-edit-img-input').click()" style="background:none;border:none;color:#60a5fa;font-size:12px;cursor:pointer;"><i class="fa-solid fa-upload"></i> Chọn hình ảnh</button>
          <div id="prod-edit-img-status" style="font-size:11px;color:#8899aa;margin-top:4px;"></div>
        </div>

        <!-- Fields -->
        <div style="display:grid;gap:12px;">
          <div>
            <label style="font-size:12px;color:#8899aa;display:block;margin-bottom:4px;">Tên sản phẩm *</label>
            <input id="pe-name" type="text" class="form-control" value="${(p.name || '').replace(/"/g,'&quot;')}">
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
            <div>
              <label style="font-size:12px;color:#8899aa;display:block;margin-bottom:4px;">Giá sỉ (VND)</label>
              <input id="pe-price-w" type="number" class="form-control" value="${p.price_wholesale || 0}">
            </div>
            <div>
              <label style="font-size:12px;color:#8899aa;display:block;margin-bottom:4px;">Giá lẻ (VND)</label>
              <input id="pe-price-r" type="number" class="form-control" value="${p.price_retail || 0}">
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
            <div>
              <label style="font-size:12px;color:#8899aa;display:block;margin-bottom:4px;">Đơn vị</label>
              <input id="pe-unit" type="text" class="form-control" value="${p.unit || ''}">
            </div>
            <div>
              <label style="font-size:12px;color:#8899aa;display:block;margin-bottom:4px;">Quy cách</label>
              <input id="pe-pack" type="text" class="form-control" value="${(p.pack_size || '').replace(/"/g,'&quot;')}">
            </div>
          </div>
          <div>
            <label style="font-size:12px;color:#8899aa;display:block;margin-bottom:4px;">Danh mục</label>
            <select id="pe-category" class="form-control">
              ${categories.map(cat => `<option value="${cat}" ${p.category === cat ? 'selected' : ''}>${cat}</option>`).join('')}
            </select>
          </div>
          <div>
            <label style="font-size:12px;color:#8899aa;display:block;margin-bottom:4px;">Ghi chú</label>
            <textarea id="pe-notes" class="form-control" rows="2">${p.notes || ''}</textarea>
          </div>
          <div style="display:flex;align-items:center;gap:10px;">
            <label style="font-size:13px;font-weight:500;">Hiển thị sản phẩm:</label>
            <label class="toggle-switch" style="position:relative;display:inline-block;width:44px;height:24px;">
              <input type="checkbox" id="pe-active" ${p.active !== false ? 'checked' : ''} style="opacity:0;width:0;height:0;">
              <span onclick="this.previousElementSibling.click()" style="position:absolute;inset:0;background:${p.active !== false ? '#34c759' : '#555'};border-radius:12px;cursor:pointer;transition:background 0.2s;display:flex;align-items:center;padding:2px;">
                <span style="width:20px;height:20px;border-radius:50%;background:#fff;transition:transform 0.2s;transform:${p.active !== false ? 'translateX(20px)' : 'translateX(0)'};box-shadow:0 1px 4px rgba(0,0,0,0.4);"></span>
              </span>
            </label>
            <span id="pe-active-label" style="font-size:12px;color:${p.active !== false ? '#34c759' : '#8899aa'};">${p.active !== false ? 'Đang hiển thị' : 'Đã ẩn'}</span>
          </div>
        </div>

        <!-- Actions -->
        <div style="display:flex;gap:10px;margin-top:20px;">
          <button onclick="document.getElementById('prod-edit-modal').remove()" class="btn btn-secondary" style="flex:1;">Hủy</button>
          <button onclick="window.productsAdminModule.saveEdit('${p.id}')" class="btn btn-primary" style="flex:2;" id="prod-edit-save-btn">
            <i class="fa-solid fa-floppy-disk"></i> Lưu thay đổi
          </button>
        </div>
      </div>`;

    // Toggle animation for active checkbox
    const checkbox = modal.querySelector('#pe-active');
    const label = modal.querySelector('#pe-active-label');
    const slider = modal.querySelector('.toggle-switch span');
    const dot = slider?.querySelector('span');
    if (checkbox) {
      checkbox.addEventListener('change', () => {
        const isChecked = checkbox.checked;
        if (slider) slider.style.background = isChecked ? '#34c759' : '#555';
        if (dot) dot.style.transform = isChecked ? 'translateX(20px)' : 'translateX(0)';
        if (label) {
          label.textContent = isChecked ? 'Đang hiển thị' : 'Đã ẩn';
          label.style.color = isChecked ? '#34c759' : '#8899aa';
        }
      });
    }

    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
    document.body.appendChild(modal);
  }

  function previewImg(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const preview = document.getElementById('prod-edit-img-preview');
      if (preview) preview.innerHTML = `<img src="${e.target.result}" style="width:100%;height:100%;object-fit:cover;">`;
    };
    reader.readAsDataURL(file);
  }

  async function saveEdit(productId) {
    const p = allProducts.find(x => x.id === productId);
    if (!p) return;

    const saveBtn = document.getElementById('prod-edit-save-btn');
    if (saveBtn) { saveBtn.disabled = true; saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang lưu...'; }

    try {
      const updates = {
        name: document.getElementById('pe-name')?.value.trim() || p.name,
        price_wholesale: Number(document.getElementById('pe-price-w')?.value) || 0,
        price_retail: Number(document.getElementById('pe-price-r')?.value) || 0,
        unit: document.getElementById('pe-unit')?.value.trim() || p.unit,
        pack_size: document.getElementById('pe-pack')?.value.trim() || null,
        category: document.getElementById('pe-category')?.value || p.category,
        notes: document.getElementById('pe-notes')?.value.trim() || null,
        active: document.getElementById('pe-active')?.checked !== false,
        updated_at: new Date().toISOString(),
      };

      // Image upload
      const imgInput = document.getElementById('prod-edit-img-input');
      if (imgInput?.files?.[0]) {
        const statusEl = document.getElementById('prod-edit-img-status');
        if (statusEl) statusEl.textContent = '📤 Đang upload hình...';
        const url = await uploadImage(imgInput.files[0], p.local_product_id || p.id);
        if (url) updates.image_url = url;
        if (statusEl) statusEl.textContent = '✅ Upload thành công';
      }

      // Save to Supabase
      const client = getRawClient();
      if (!client) throw new Error('Supabase client không khởi tạo được');

      const { error } = await client.from('products').update(updates).eq('id', productId);
      if (error) throw error;

      // Update local state
      const idx = allProducts.findIndex(x => x.id === productId);
      if (idx !== -1) allProducts[idx] = { ...allProducts[idx], ...updates };

      toast('✅ Đã lưu sản phẩm thành công');
      document.getElementById('prod-edit-modal')?.remove();
      applyFilters();
    } catch (err) {
      console.error('[ProductAdmin] Save error:', err);
      toast('Lỗi lưu: ' + err.message, 'error');
      if (saveBtn) { saveBtn.disabled = false; saveBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Lưu thay đổi'; }
    }
  }

  async function uploadImage(file, productLocalId) {
    const client = getRawClient();
    if (!client) return null;
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const fileName = `${productLocalId}.${ext}`;
    const { error } = await client.storage.from('product-images').upload(fileName, file, { upsert: true, contentType: file.type });
    if (error) throw error;
    const { data } = client.storage.from('product-images').getPublicUrl(fileName);
    return data.publicUrl;
  }

  async function toggleActive(productId) {
    const p = allProducts.find(x => x.id === productId);
    if (!p) return;
    const newActive = p.active === false;

    try {
      const client = getRawClient();
      if (!client) throw new Error('Supabase chưa sẵn sàng');
      const { error } = await client.from('products').update({ active: newActive, updated_at: new Date().toISOString() }).eq('id', productId);
      if (error) throw error;

      const idx = allProducts.findIndex(x => x.id === productId);
      if (idx !== -1) allProducts[idx].active = newActive;

      toast(newActive ? '✅ Đã hiển thị sản phẩm' : '🚫 Đã ẩn sản phẩm');
      applyFilters();
    } catch (err) {
      toast('Lỗi: ' + err.message, 'error');
    }
  }

  function goPage(page) {
    const totalPages = Math.ceil(filteredProducts.length / PAGE_SIZE);
    if (page < 1 || page > totalPages) return;
    currentPage = page;
    renderTable();
    renderPagination();
  }

  // ─── Init & event binding ─────────────────────────────────────────────────
  function bindEvents() {
    // Search
    const searchInput = document.getElementById('prod-admin-search');
    if (searchInput) {
      let timer;
      searchInput.addEventListener('input', () => {
        clearTimeout(timer);
        timer = setTimeout(() => { searchTerm = searchInput.value; applyFilters(); }, 300);
      });
    }

    // Category filter
    const catSel = document.getElementById('prod-admin-cat-filter');
    if (catSel) catSel.addEventListener('change', () => { categoryFilter = catSel.value; applyFilters(); });

    // Active filter
    const activeSel = document.getElementById('prod-admin-active-filter');
    if (activeSel) activeSel.addEventListener('change', () => { activeFilter = activeSel.value; applyFilters(); });

    // Reload button
    const reloadBtn = document.getElementById('prod-admin-reload-btn');
    if (reloadBtn) reloadBtn.addEventListener('click', loadProducts);
  }

  function init() {
    bindEvents();
    // Load products when tab is first activated
    const navItem = document.querySelector('[data-tab="tab-products"]');
    if (navItem) {
      navItem.addEventListener('click', () => {
        if (allProducts.length === 0) loadProducts();
      });
    }
  }

  document.addEventListener('DOMContentLoaded', init);

  // ─── Public API ───────────────────────────────────────────────────────────
  window.productsAdminModule = {
    loadProducts,
    openEdit,
    previewImg,
    saveEdit,
    toggleActive,
    goPage,
  };
})();
