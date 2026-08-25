/**
 * vouchers-admin.js
 * Quản lý mã khuyến mãi (voucher) cho TPS1
 */
(function () {
  'use strict';

  function getSb() { return window.supabaseModule?.getClient?.() || window.supabase; }
  function q(id) { return document.getElementById(id); }
  function money(n) { return n ? new Intl.NumberFormat('vi-VN').format(n) + 'đ' : '—'; }
  function dateStr(d) { return d ? new Date(d).toLocaleDateString('vi-VN') : '—'; }
  function dateTimeStr(d) { return d ? new Date(d).toLocaleString('vi-VN') : '—'; }

  let vouchers = [];
  let editingCode = null;

  function showToast(msg, type = 'success') {
    if (window.showAppToast) { window.showAppToast(msg, type); return; }
    const t = document.createElement('div');
    t.style.cssText = `position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:${type==='success'?'#16a34a':'#dc2626'};color:#fff;padding:10px 20px;border-radius:8px;z-index:99999;font-size:14px;font-weight:500;`;
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3000);
  }

  // ── Load danh sách voucher ──
  async function loadVouchers() {
    const tbody = q('vouchers-tbody');
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:24px;color:var(--text-secondary)"><i class="fa-solid fa-spinner fa-spin"></i> Đang tải...</td></tr>`;
    const sb = getSb();
    if (!sb) return;
    const { data, error } = await sb.from('vouchers').select('*').order('created_at', { ascending: false });
    if (error) { tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:#ef4444;padding:20px">❌ ${error.message}</td></tr>`; return; }
    vouchers = data || [];
    renderVouchers();
  }

  function renderVouchers() {
    const tbody = q('vouchers-tbody');
    if (!tbody) return;
    const keyword = (q('voucher-search')?.value || '').toLowerCase();
    const list = keyword ? vouchers.filter(v => v.code.toLowerCase().includes(keyword)) : vouchers;

    if (!list.length) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:32px;color:var(--text-secondary)">Chưa có voucher nào. Nhấn "+ Tạo Voucher" để bắt đầu.</td></tr>`;
      return;
    }

    tbody.innerHTML = list.map(v => {
      const isExpired = v.expires_at && new Date(v.expires_at) < new Date();
      const usageRatio = v.max_uses_total > 0 ? Math.min(100, Math.round(v.current_uses_total / v.max_uses_total * 100)) : null;
      const discountLabel = v.discount_percent > 0
        ? `${v.discount_percent}%${v.max_discount_value > 0 ? ` (tối đa ${money(v.max_discount_value)})` : ''}`
        : money(v.discount_amount);

      return `<tr style="${!v.is_active || isExpired ? 'opacity:0.6' : ''}">
        <td style="padding:12px 14px">
          <code style="background:rgba(99,102,241,0.15);color:#818cf8;padding:3px 8px;border-radius:6px;font-size:13px;font-weight:700;letter-spacing:1px">${v.code}</code>
        </td>
        <td style="padding:12px 14px;font-weight:600;color:${v.discount_percent>0?'#10b981':'#f59e0b'}">${discountLabel}</td>
        <td style="padding:12px 14px;font-size:13px;color:var(--text-secondary)">${v.min_order_value > 0 ? money(v.min_order_value) : 'Không yêu cầu'}</td>
        <td style="padding:12px 14px;text-align:center">
          <span style="color:${v.current_uses_total >= v.max_uses_total && v.max_uses_total > 0 ? '#ef4444' : 'var(--text-primary)'}">${v.current_uses_total}${v.max_uses_total > 0 ? '/' + v.max_uses_total : ''}</span>
          ${usageRatio !== null ? `<div style="width:60px;height:4px;background:#374151;border-radius:2px;margin-top:4px"><div style="width:${usageRatio}%;height:100%;background:${usageRatio>=100?'#ef4444':'#10b981'};border-radius:2px"></div></div>` : ''}
        </td>
        <td style="padding:12px 14px;font-size:13px;color:${isExpired?'#ef4444':'var(--text-secondary)'}">
          ${v.expires_at ? (isExpired ? '🔴 Đã hết hạn ' + dateStr(v.expires_at) : '⏳ ' + dateStr(v.expires_at)) : '♾️ Không giới hạn'}
        </td>
        <td style="padding:12px 14px;text-align:center">
          ${v.is_active && !isExpired
            ? '<span style="color:#10b981;font-size:12px;font-weight:600">✅ Hoạt động</span>'
            : '<span style="color:#6b7280;font-size:12px">⛔ Vô hiệu</span>'}
        </td>
        <td style="padding:12px 14px;text-align:center">
          <div style="display:flex;gap:6px;justify-content:center">
            <button onclick="window.voucherEdit('${v.code}')" style="background:none;border:1px solid var(--border-color);border-radius:6px;padding:5px 9px;cursor:pointer;color:var(--text-secondary);font-size:12px" title="Sửa"><i class="fa-solid fa-pen"></i></button>
            <button onclick="window.voucherToggle('${v.code}', ${v.is_active})" style="background:none;border:1px solid ${v.is_active?'#ef4444':'#10b981'};border-radius:6px;padding:5px 9px;cursor:pointer;color:${v.is_active?'#ef4444':'#10b981'};font-size:12px" title="${v.is_active?'Tắt':'Bật'}"><i class="fa-solid ${v.is_active?'fa-ban':'fa-check'}"></i></button>
            <button onclick="window.voucherHistory('${v.code}')" style="background:none;border:1px solid var(--border-color);border-radius:6px;padding:5px 9px;cursor:pointer;color:#818cf8;font-size:12px" title="Lịch sử"><i class="fa-solid fa-clock-rotate-left"></i></button>
          </div>
        </td>
      </tr>`;
    }).join('');
  }

  // ── Toggle active ──
  window.voucherToggle = async function (code, isActive) {
    const sb = getSb();
    const { error } = await sb.from('vouchers').update({ is_active: !isActive }).eq('code', code);
    if (error) { showToast('❌ ' + error.message, 'error'); return; }
    showToast(isActive ? '⛔ Đã tắt voucher ' + code : '✅ Đã bật voucher ' + code);
    await loadVouchers();
  };

  // ── Edit ──
  window.voucherEdit = function (code) {
    const v = vouchers.find(x => x.code === code);
    if (!v) return;
    editingCode = code;
    q('voucher-modal-title').textContent = 'Chỉnh Sửa Voucher';
    q('vf-code').value = v.code;
    q('vf-code').readOnly = true;
    q('vf-code').style.opacity = '0.6';
    q('vf-discount-type').value = v.discount_percent > 0 ? 'percent' : 'fixed';
    toggleDiscountType(v.discount_percent > 0 ? 'percent' : 'fixed');
    q('vf-discount-amount').value = v.discount_percent > 0 ? v.discount_percent : v.discount_amount;
    q('vf-max-discount').value = v.max_discount_value || '';
    q('vf-min-order').value = v.min_order_value || '';
    q('vf-max-uses').value = v.max_uses_total || '';
    q('vf-max-per-user').value = v.max_uses_per_user || 1;
    q('vf-expires').value = v.expires_at ? v.expires_at.substring(0, 10) : '';
    q('voucher-modal').classList.remove('hidden');
  };

  // ── View history ──
  window.voucherHistory = async function (code) {
    const sb = getSb();
    const historyEl = q('voucher-history-modal');
    const histTitle = q('voucher-history-title');
    const histBody = q('voucher-history-body');
    if (!historyEl || !histBody) return;
    if (histTitle) histTitle.textContent = 'Lịch sử dùng: ' + code;
    histBody.innerHTML = '<div style="text-align:center;padding:20px"><i class="fa-solid fa-spinner fa-spin"></i> Đang tải...</div>';
    historyEl.classList.remove('hidden');

    const { data, error } = await sb
      .from('voucher_usages')
      .select('*, orders(order_code, customer_name, final_amount)')
      .eq('voucher_code', code)
      .order('used_at', { ascending: false })
      .limit(50);

    if (error || !data?.length) {
      histBody.innerHTML = `<div style="text-align:center;padding:32px;color:var(--text-secondary)">Voucher chưa được sử dụng lần nào.</div>`;
      return;
    }

    histBody.innerHTML = `<table style="width:100%;border-collapse:collapse">
      <thead><tr style="background:var(--bg-surface)">
        <th style="text-align:left;padding:10px 14px;font-size:12px;color:var(--text-secondary)">ĐƠN HÀNG</th>
        <th style="text-align:left;padding:10px 14px;font-size:12px;color:var(--text-secondary)">KHÁCH HÀNG</th>
        <th style="text-align:right;padding:10px 14px;font-size:12px;color:var(--text-secondary)">GIẢM GIÁ</th>
        <th style="text-align:left;padding:10px 14px;font-size:12px;color:var(--text-secondary)">THỜI GIAN</th>
      </tr></thead><tbody>
      ${data.map(u => `<tr style="border-bottom:1px solid var(--border-color)">
        <td style="padding:10px 14px"><code style="color:#818cf8">${u.orders?.order_code || u.order_id?.substring(0,8)}</code></td>
        <td style="padding:10px 14px;font-size:13px">${u.orders?.customer_name || '—'}</td>
        <td style="padding:10px 14px;text-align:right;color:#f59e0b;font-weight:600">${money(u.discount_applied)}</td>
        <td style="padding:10px 14px;font-size:12px;color:var(--text-secondary)">${dateTimeStr(u.used_at)}</td>
      </tr>`).join('')}
      </tbody></table>`;
  };

  function toggleDiscountType(type) {
    const maxDiscRow = q('vf-max-discount-row');
    if (maxDiscRow) maxDiscRow.style.display = type === 'percent' ? '' : 'none';
    const amountLabel = q('vf-discount-label');
    if (amountLabel) amountLabel.textContent = type === 'percent' ? 'Giảm (%)' : 'Giảm (đồng)';
  }

  function openCreateModal() {
    editingCode = null;
    q('voucher-modal-title').textContent = '+ Tạo Voucher Mới';
    q('vf-code').value = '';
    q('vf-code').readOnly = false;
    q('vf-code').style.opacity = '1';
    q('vf-discount-type').value = 'fixed';
    toggleDiscountType('fixed');
    q('vf-discount-amount').value = '';
    q('vf-max-discount').value = '';
    q('vf-min-order').value = '';
    q('vf-max-uses').value = '';
    q('vf-max-per-user').value = '1';
    q('vf-expires').value = '';
    q('voucher-modal').classList.remove('hidden');
  }

  function closeModal() { q('voucher-modal').classList.add('hidden'); }
  function closeHistoryModal() { if (q('voucher-history-modal')) q('voucher-history-modal').classList.add('hidden'); }

  async function saveVoucher() {
    const sb = getSb();
    const code = (q('vf-code').value || '').trim().toUpperCase();
    if (!code) { showToast('❌ Nhập mã voucher!', 'error'); return; }
    const discType = q('vf-discount-type').value;
    const discValue = parseFloat(q('vf-discount-amount').value) || 0;
    const maxDisc = parseFloat(q('vf-max-discount').value) || 0;
    const minOrder = parseFloat(q('vf-min-order').value) || 0;
    const maxUses = parseInt(q('vf-max-uses').value) || 0;
    const maxPerUser = parseInt(q('vf-max-per-user').value) || 1;
    const expires = q('vf-expires').value ? new Date(q('vf-expires').value + 'T23:59:59').toISOString() : null;

    const payload = {
      discount_percent: discType === 'percent' ? discValue : 0,
      discount_amount: discType === 'fixed' ? discValue : 0,
      max_discount_value: discType === 'percent' ? maxDisc : 0,
      min_order_value: minOrder,
      max_uses_total: maxUses,
      max_uses_per_user: maxPerUser,
      expires_at: expires,
      is_active: true,
    };

    const btn = q('vf-save-btn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang lưu...';

    let error;
    if (editingCode) {
      ({ error } = await sb.from('vouchers').update(payload).eq('code', editingCode));
    } else {
      ({ error } = await sb.from('vouchers').insert({ code, ...payload }));
    }

    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Lưu';

    if (error) { showToast('❌ ' + error.message, 'error'); return; }
    showToast(editingCode ? '✅ Đã cập nhật voucher!' : '✅ Đã tạo voucher ' + code + '!');
    closeModal();
    await loadVouchers();
  }

  function init() {
    // Bind create button
    const createBtn = q('btn-create-voucher');
    if (createBtn) createBtn.addEventListener('click', openCreateModal);

    // Bind modal close
    const closeBtn = q('voucher-modal-close');
    const cancelBtn = q('voucher-modal-cancel');
    const overlay = q('voucher-modal-overlay');
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
    if (overlay) overlay.addEventListener('click', closeModal);

    const saveBtn = q('vf-save-btn');
    if (saveBtn) saveBtn.addEventListener('click', saveVoucher);

    const discTypeEl = q('vf-discount-type');
    if (discTypeEl) discTypeEl.addEventListener('change', () => toggleDiscountType(discTypeEl.value));

    const searchEl = q('voucher-search');
    if (searchEl) searchEl.addEventListener('input', renderVouchers);

    // History modal close
    const histClose = q('voucher-history-close');
    const histOverlay = q('voucher-history-overlay');
    if (histClose) histClose.addEventListener('click', closeHistoryModal);
    if (histOverlay) histOverlay.addEventListener('click', closeHistoryModal);
  }

  document.addEventListener('DOMContentLoaded', init);

  // Expose refresh for tab activation
  window.vouchersModule = {
    refresh: loadVouchers
  };

  // Auto-load khi tab được chọn
  window.addEventListener('tps1-tab-vouchers', loadVouchers);

})();
