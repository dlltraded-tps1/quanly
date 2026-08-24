/**
 * vip-accounts.js
 * Quản lý tài khoản khách hàng VIP cho TPS1 Mini App
 * Tab: "Tài Khoản VIP Mini App"
 *
 * Toàn bộ thao tác đọc/ghi bảng vip_accounts đi qua các RPC (SECURITY DEFINER)
 * được tạo trong migration tps1-miniapp/supabase/migrations/20260812_customer_login.sql
 * — anon key KHÔNG được truy cập bảng này trực tiếp (RLS khóa), tránh lộ password_hash
 * hoặc toàn bộ danh sách khách hàng qua khóa công khai trong mã nguồn.
 */

(function () {
  'use strict';

  // ── Supabase client ──
  function getSb() {
    return window.supabaseModule?.getClient() || window.supabase;
  }

  // ── State ──
  let vipAccounts = [];
  let tiersConfig = [];
  let editingId = null;

  // ── DOM refs (lazy, sẽ query khi tab được mở) ──
  function q(id) { return document.getElementById(id); }

  // ── Format số tiền ──
  function formatMoney(n) {
    if (!n || n === 0) return '—';
    return new Intl.NumberFormat('vi-VN').format(n) + ' đ';
  }

  // ── Tier badge ──
  function tierBadge(tier) {
    const map = {
      VIP0: '<span class="badge badge-amber">VIP0</span>',
      VIP1: '<span class="badge badge-slate">VIP1</span>',
      VIP2: '<span class="badge badge-blue">🥈 VIP2</span>',
      VIP3: '<span class="badge badge-emerald">🥇 VIP3</span>',
    };
    return map[tier] || `<span class="badge">${tier || '—'}</span>`;
  }

  // ── Load danh sách khách hàng ──
  async function loadVipAccounts() {
    const tbody = q('vip-table-body');
    const countEl = q('vip-count');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--text-muted)"><i class="fa-solid fa-spinner fa-spin"></i> Đang tải...</td></tr>';

    try {
      const sb = getSb();
      if (!sb) throw new Error('Supabase client chưa sẵn sàng. Hãy đảm bảo đã cấu hình kết nối ở mục Quản Lý Báo Giá.');

      const { data, error } = await sb.rpc('admin_list_customers');
      if (error) throw error;
      vipAccounts = data || [];
      if (countEl) countEl.textContent = vipAccounts.length;
      renderTable();
    } catch (err) {
      console.error('Lỗi tải danh sách khách hàng VIP:', err);
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:24px;color:#ef4444">
        <i class="fa-solid fa-triangle-exclamation"></i> Lỗi: ${err.message}
        ${/function .* does not exist/i.test(err.message || '') ? '<br><span style="font-size:12px">Có vẻ chưa chạy migration SQL đăng nhập khách hàng trên Supabase.</span>' : ''}
      </td></tr>`;
    }
  }

  // ── Render table ──
  function renderTable() {
    const tbody = q('vip-table-body');
    if (!tbody) return;

    if (!vipAccounts.length) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--text-muted)">Chưa có khách hàng VIP nào. <a href="javascript:void(0)" onclick="document.getElementById(\'vip-add-btn\').click()" style="color:var(--primary-color)">Tạo ngay →</a></td></tr>';
      return;
    }

    tbody.innerHTML = vipAccounts.map((acc, idx) => `
      <tr class="${!acc.is_active ? 'row-inactive' : ''}">
        <td>${idx + 1}</td>
        <td>
          <div style="display:flex;align-items:center;gap:8px">
            <code class="partner-code-badge">${acc.partner_code}</code>
            <button class="btn-icon btn-sm" title="Sao chép mã" onclick="window.vipCopyCode('${acc.partner_code}')">
              <i class="fa-regular fa-copy"></i>
            </button>
          </div>
          ${acc.must_change_password ? '<div style="font-size:11px;color:#b45309;margin-top:2px"><i class="fa-solid fa-clock"></i> Chưa đổi mật khẩu</div>' : ''}
        </td>
        <td>
          <div class="lead-name">${acc.name || '—'}</div>
          <div class="lead-company" style="font-size:12px;color:var(--text-muted)">${acc.company || ''}</div>
          ${acc.default_shipping_address ? `<div style="font-size:11px;color:var(--text-muted);margin-top:3px"><i class="fa-solid fa-location-dot"></i> ${acc.default_shipping_address}</div>` : ''}
        </td>
        <td>${acc.phone}</td>
        <td>${tierBadge(acc.discount_tier)}${acc.verification_status === 'pending' ? '<div style="font-size:10px;color:#f59e0b;margin-top:4px"><i class="fa-regular fa-clock"></i> Chờ xác thực</div>' : '<div style="font-size:10px;color:#34d399;margin-top:4px"><i class="fa-solid fa-shield-check"></i> Đã xác thực</div>'}</td>
        <td>${formatMoney(acc.credit_limit)}</td>
        <td>
          <div class="action-buttons">
            ${acc.is_active
              ? `<span class="badge badge-emerald" style="font-size:11px">✅ Hoạt động</span>`
              : `<span class="badge badge-rose" style="font-size:11px">🔒 Đã khoá</span>`
            }
            <button class="btn btn-secondary btn-xs" onclick="window.vipEditAccount('${acc.id}')" title="Chỉnh sửa">
              <i class="fa-solid fa-pen"></i>
            </button>
            <button class="btn btn-secondary btn-xs" onclick="window.vipResetPassword('${acc.id}')" title="Reset mật khẩu">
              <i class="fa-solid fa-key"></i>
            </button>
            ${acc.discount_tier === 'CUSTOM' ? `
            <button class="btn btn-secondary btn-xs" onclick="window.vipManageContractPrices('${acc.id}', '${acc.name || ''}')" title="Bảng giá hợp đồng">
              <i class="fa-solid fa-file-contract"></i>
            </button>` : ''}
            <button class="btn ${acc.is_active ? 'btn-warning' : 'btn-emerald'} btn-xs"
              onclick="window.vipToggleActive('${acc.id}', ${acc.is_active})"
              title="${acc.is_active ? 'Khoá tài khoản' : 'Mở khoá'}">
              <i class="fa-solid ${acc.is_active ? 'fa-lock' : 'fa-lock-open'}"></i>
            </button>
          </div>
        </td>
      </tr>
    `).join('');
  }

  // ── Open modal (tạo mới / chỉnh sửa) ──
  function openModal(acc = null) {
    editingId = acc ? acc.id : null;
    q('vip-modal-title').textContent = acc ? 'Chỉnh Sửa Khách Hàng' : 'Tạo Khách Hàng VIP Mới';
    q('vip-edit-id').value = acc ? acc.id : '';
    q('vip-name').value = acc ? (acc.name || '') : '';
    q('vip-phone').value = acc ? acc.phone : '';
    q('vip-company').value = acc ? (acc.company || '') : '';
    q('vip-email').value = acc ? (acc.email || '') : '';
    q('vip-tax-code').value = acc ? (acc.tax_code || '') : '';
    q('vip-address').value = acc ? (acc.address || '') : '';
    q('vip-shipping-alias').value = acc ? (acc.default_shipping_alias || '') : 'Địa chỉ mặc định';
    q('vip-shipping-address').value = acc ? (acc.default_shipping_address || '') : '';
    q('vip-shipping-name').value = acc ? (acc.default_shipping_name || acc.name || '') : '';
    q('vip-shipping-phone').value = acc ? (acc.default_shipping_phone || acc.phone || '') : '';
    q('vip-tier').value = acc ? acc.discount_tier : 'VIP0';
    q('vip-credit').value = acc ? (acc.credit_limit || '') : '';
    q('vip-notes').value = acc ? (acc.notes || '') : '';

    const codeRow = q('vip-partner-code-row');
    if (acc) {
      codeRow.style.display = '';
      q('vip-partner-code-display').textContent = acc.partner_code;
    } else {
      codeRow.style.display = 'none';
    }

    q('vip-modal').classList.remove('hidden');
    document.body.classList.add('vip-modal-open');
  }

  function closeModal() {
    q('vip-modal').classList.add('hidden');
    document.body.classList.remove('vip-modal-open');
    editingId = null;
  }

  // ── Save (create or update) ──
  async function saveVipAccount(e) {
    e.preventDefault();
    const saveBtn = q('vip-modal-save');
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang lưu...';

    const name = q('vip-name').value.trim();
    const phone = q('vip-phone').value.trim();
    const company = q('vip-company').value.trim();
    const email = q('vip-email').value.trim();
    const taxCode = q('vip-tax-code').value.trim();
    const address = q('vip-address').value.trim();
    const shippingAlias = q('vip-shipping-alias').value.trim();
    const shippingAddress = q('vip-shipping-address').value.trim();
    const shippingName = q('vip-shipping-name').value.trim();
    const shippingPhone = q('vip-shipping-phone').value.trim();
    const tier = q('vip-tier').value;
    const credit = parseFloat(q('vip-credit').value) || 0;
    const notes = q('vip-notes').value.trim();

    try {
      const sb = getSb();
      if (!sb) throw new Error('Supabase client chưa sẵn sàng.');

      if (editingId) {
        const { error } = await sb.rpc('admin_update_customer', {
          p_id: editingId,
          p_name: name,
          p_phone: phone,
          p_company: company,
          p_email: email,
          p_tax_code: taxCode,
          p_address: address,
          p_shipping_alias: shippingAlias,
          p_shipping_address: shippingAddress,
          p_shipping_name: shippingName,
          p_shipping_phone: shippingPhone,
          p_tier: tier,
          p_credit_limit: credit,
          p_notes: notes,
        });
        if (error) throw error;
        showToast('✅ Đã cập nhật khách hàng!', 'success');
        closeModal();
        await loadVipAccounts();
      } else {
        const { data, error } = await sb.rpc('admin_create_customer', {
          p_name: name,
          p_phone: phone,
          p_company: company,
          p_tier: tier,
          p_email: email,
          p_tax_code: taxCode,
          p_address: address,
          p_shipping_alias: shippingAlias,
          p_shipping_address: shippingAddress,
          p_shipping_name: shippingName,
          p_shipping_phone: shippingPhone,
        });
        if (error) throw error;

        // Cập nhật thêm hạn mức/ghi chú vừa nhập (admin_create_customer không nhận 2 trường này)
        const created = Array.isArray(data) ? data[0] : data;
        if ((credit || notes) && created?.partner_code) {
          const acctRes = await sb.rpc('admin_list_customers');
          const acct = (acctRes.data || []).find(a => a.partner_code === created.partner_code);
          if (acct) {
            await sb.rpc('admin_update_customer', {
              p_id: acct.id, p_name: name, p_phone: phone, p_company: company,
              p_email: email, p_tax_code: taxCode, p_address: address,
              p_shipping_alias: shippingAlias, p_shipping_address: shippingAddress,
              p_shipping_name: shippingName, p_shipping_phone: shippingPhone,
              p_tier: tier, p_credit_limit: credit, p_notes: notes,
            });
          }
        }

        closeModal();
        await loadVipAccounts();
        showCredentialsModal(created?.partner_code, created?.temp_password);
      }
    } catch (err) {
      console.error(err);
      showToast('❌ Lỗi: ' + (err.message || 'Không lưu được'), 'error');
    } finally {
      saveBtn.disabled = false;
      saveBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Lưu Tài Khoản';
    }
  }

  // ── Toggle active ──
  window.vipToggleActive = async function (id, currentState) {
    const label = currentState ? 'khoá' : 'mở khoá';
    const targetState = !currentState;
    if (!confirm(`Bạn muốn ${label} tài khoản này?`)) return;
    const sb = getSb();
    if (!sb) { showToast('❌ Supabase client chưa sẵn sàng', 'error'); return; }

    try {
      const { error } = await sb.rpc('admin_toggle_customer_active', {
        p_id: id,
        p_is_active: targetState,
      });
      if (error) throw error;

      // RPC returns void, nên phải đọc lại Supabase trước khi báo thành công.
      const { data, error: verifyError } = await sb.rpc('admin_list_customers');
      if (verifyError) throw verifyError;
      const refreshedAccounts = data || [];
      const updatedAccount = refreshedAccounts.find((account) => account.id === id);
      if (!updatedAccount || Boolean(updatedAccount.is_active) !== targetState) {
        throw new Error('Supabase chưa xác nhận trạng thái mới. Vui lòng kiểm tra cấu hình kết nối.');
      }

      vipAccounts = refreshedAccounts;
      const countEl = q('vip-count');
      if (countEl) countEl.textContent = vipAccounts.length;
      renderTable();
      showToast(`✅ Đã ${label} tài khoản!`, 'success');
    } catch (err) {
      console.error('Lỗi cập nhật trạng thái tài khoản VIP:', err);
      showToast('❌ Lỗi: ' + (err.message || 'Không cập nhật được trạng thái'), 'error');
      await loadVipAccounts();
    }
  };

  // ── Reset password ──
  window.vipResetPassword = async function (id) {
    const acc = vipAccounts.find(a => a.id === id);
    if (!acc) return;
    if (!confirm(`Tạo mật khẩu tạm mới cho khách hàng "${acc.name}" (mã ${acc.partner_code})?\nMật khẩu cũ sẽ không còn dùng được nữa.`)) return;

    const sb = getSb();
    if (!sb) { showToast('❌ Supabase client chưa sẵn sàng', 'error'); return; }

    try {
      const { data, error } = await sb.rpc('admin_reset_customer_password', { p_code: acc.partner_code });
      if (error) throw error;
      await loadVipAccounts();
      showCredentialsModal(acc.partner_code, data);
    } catch (err) {
      showToast('❌ Lỗi: ' + (err.message || 'Không reset được mật khẩu'), 'error');
    }
  };

  // ── Edit ──
  window.vipEditAccount = function (id) {
    const acc = vipAccounts.find(a => a.id === id);
    if (acc) openModal(acc);
  };

  // ── Copy code ──
  window.vipCopyCode = function (code) {
    navigator.clipboard.writeText(code).then(() => {
      showToast(`📋 Đã sao chép mã: ${code}`, 'success');
    }).catch(() => {
      showToast(`Mã khách hàng: ${code}`, 'info');
    });
  };

  // ── Credentials result modal ──
  function showCredentialsModal(code, password) {
    q('vip-cred-code').textContent = code || '—';
    q('vip-cred-password').textContent = password || '—';
    q('vip-credentials-modal').classList.remove('hidden');
  }

  function closeCredentialsModal() {
    q('vip-credentials-modal').classList.add('hidden');
  }

  function bindCredentialsModal() {
    q('vip-credentials-close').addEventListener('click', closeCredentialsModal);
    q('vip-credentials-overlay').addEventListener('click', closeCredentialsModal);
    q('vip-cred-copy-code').addEventListener('click', () => {
      navigator.clipboard.writeText(q('vip-cred-code').textContent).then(() => showToast('📋 Đã sao chép mã khách hàng', 'success'));
    });
    q('vip-cred-copy-password').addEventListener('click', () => {
      navigator.clipboard.writeText(q('vip-cred-password').textContent).then(() => showToast('📋 Đã sao chép mật khẩu', 'success'));
    });
    q('vip-cred-copy-both').addEventListener('click', () => {
      const text = `Mã khách hàng: ${q('vip-cred-code').textContent}\nMật khẩu: ${q('vip-cred-password').textContent}`;
      navigator.clipboard.writeText(text).then(() => showToast('📋 Đã sao chép mã + mật khẩu', 'success'));
    });
  }

  // ── Cấu hình % chiết khấu theo nhóm ──
  async function loadTiersConfig() {
    const wrap = q('vip-tiers-config');
    if (!wrap) return;
    const sb = getSb();
    if (!sb) { wrap.innerHTML = '<span style="color:#ef4444;font-size:13px">Supabase chưa sẵn sàng.</span>'; return; }

    try {
      const { data, error } = await sb.from('customer_tiers').select('*').order('code', { ascending: true });
      if (error) throw error;
      tiersConfig = data || [];
      renderTiersConfig();
    } catch (err) {
      console.error('Lỗi tải cấu hình chiết khấu:', err);
      wrap.innerHTML = `<span style="color:#ef4444;font-size:13px">Lỗi: ${err.message}${/relation .* does not exist/i.test(err.message || '') ? ' (chưa chạy migration SQL)' : ''}</span>`;
    }
  }

  function renderTiersConfig() {
    const wrap = q('vip-tiers-config');
    if (!wrap) return;
    if (!tiersConfig.length) {
      wrap.innerHTML = '<span style="color:var(--text-muted);font-size:13px">Chưa có dữ liệu — hãy chạy migration SQL trước.</span>';
      return;
    }

    wrap.innerHTML = tiersConfig.map(t => `
      <div style="border:1px solid var(--border-color,#e5e7eb);border-radius:10px;padding:12px 14px;min-width:180px">
        <div style="font-weight:700;font-size:13px;margin-bottom:8px">${tierBadge(t.code)} <span style="font-weight:400;color:var(--text-muted);font-size:12px">${t.name}</span></div>
        <div style="display:flex;align-items:center;gap:6px">
          <input type="number" class="form-control" style="width:80px" min="0" max="100" step="0.5"
            id="vip-tier-input-${t.code}" value="${t.discount_percent}">
          <span style="font-size:13px">%</span>
          <button type="button" class="btn btn-primary btn-xs" onclick="window.vipSaveTierDiscount('${t.code}')">
            <i class="fa-solid fa-floppy-disk"></i>
          </button>
        </div>
      </div>
    `).join('');
  }

  window.vipSaveTierDiscount = async function (code) {
    const input = q(`vip-tier-input-${code}`);
    if (!input) return;
    const value = parseFloat(input.value);
    if (isNaN(value) || value < 0 || value > 100) {
      showToast('❌ % chiết khấu không hợp lệ (0-100)', 'error');
      return;
    }
    const sb = getSb();
    if (!sb) { showToast('❌ Supabase client chưa sẵn sàng', 'error'); return; }

    try {
      const { error } = await sb.rpc('admin_update_tier_discount', { p_code: code, p_discount_percent: value });
      if (error) throw error;
      showToast(`✅ Đã cập nhật chiết khấu ${code}: ${value}%`, 'success');
      await loadTiersConfig();
    } catch (err) {
      showToast('❌ Lỗi: ' + (err.message || 'Không lưu được'), 'error');
    }
  };

  // ── Toast helper ──
  function showToast(msg, type = 'info') {
    // Dùng toast system của app nếu có, fallback alert
    if (window.showAppToast) {
      window.showAppToast(msg, type);
    } else {
      const t = document.createElement('div');
      t.style.cssText = `
        position:fixed;bottom:24px;left:50%;transform:translateX(-50%);
        background:${type === 'success' ? '#16a34a' : type === 'error' ? '#dc2626' : '#2563eb'};
        color:#fff;padding:10px 20px;border-radius:8px;z-index:99999;
        font-size:14px;font-weight:500;box-shadow:0 4px 16px rgba(0,0,0,0.3);
        animation:fadeInUp 0.3s ease;
      `;
      t.textContent = msg;
      document.body.appendChild(t);
      setTimeout(() => t.remove(), 3000);
    }
  }

    // Bind events
  function bindEvents() {
    const addBtn = document.getElementById('vip-add-btn');
    if (addBtn) addBtn.addEventListener('click', () => openModal());
    q('vip-modal-close').addEventListener('click', closeModal);
    q('vip-modal-cancel').addEventListener('click', closeModal);
    q('vip-modal-overlay').addEventListener('click', (e) => {
      if (e.target === q('vip-modal-overlay')) closeModal();
    });
    q('vip-account-form').addEventListener('submit', saveVipAccount);
    bindCredentialsModal();
  }

  // ── Init: hook vào tab navigation system của admin ──
  function init() {
    bindEvents();

    // Nếu tab VIP đang active ngay khi load
    if (window.location.hash === '#vip') {
      loadVipAccounts();
      loadTiersConfig();
    }
  }

  // ── Run when DOM ready ──
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    setTimeout(init, 500); // Chờ app.js init xong
  }

  // App navigation gọi API này bất kể nút VIP nằm ở sidebar hay thanh công cụ con.
  window.vipAccountsModule = {
    refresh() {
      return Promise.all([loadVipAccounts(), loadTiersConfig()]);
    },
  };

})();
