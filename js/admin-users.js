(function() {
  function token() {
    return sessionStorage.getItem('tps1_admin_api_token') || localStorage.getItem('tps1_admin_api_token');
  }

  function getSb() {
    return window.supabaseModule?.getClient?.();
  }

  // ─── Load danh sách user thẳng từ Supabase (RLS đã tắt) ───
  async function loadUsers() {
    const tbody = document.getElementById('admin-users-tbody');
    if (!tbody) return;
    
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:24px;color:var(--text-secondary)"><i class="fa-solid fa-spinner fa-spin"></i> Đang tải...</td></tr>`;
    
    try {
      const sb = getSb();
      if (!sb) throw new Error('Supabase client chưa sẵn sàng');

      const { data, error } = await sb
        .from('admin_profiles')
        .select('id, name, role, is_active, email')
        .order('name');

      if (error) throw error;

      tbody.innerHTML = '';
      if (!data || data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:32px;color:var(--text-secondary)">Chưa có tài khoản nào.</td></tr>`;
        return;
      }
      
      data.forEach(u => {
        const roleColor = u.role === 'admin' ? '#f59e0b' : '#3b82f6';
        const roleLabel = u.role === 'admin' ? '👑 Quản Trị Viên' : '🧑‍💼 Sale';
        const statusBadge = u.is_active
          ? `<span style="background:rgba(16,185,129,0.15);color:#10b981;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600">Hoạt động</span>`
          : `<span style="background:rgba(100,116,139,0.15);color:#64748b;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600">Khóa</span>`;
        
        tbody.innerHTML += `
          <tr style="border-bottom:1px solid var(--border-color)">
            <td style="padding:12px 14px;font-weight:600;color:var(--text-primary)">${u.name || ''}</td>
            <td style="padding:12px 14px;color:var(--text-secondary);font-size:13px">${u.email || ''}</td>
            <td style="padding:12px 14px"><span style="color:${roleColor};font-weight:600;font-size:13px">${roleLabel}</span></td>
            <td style="padding:12px 14px">${statusBadge}</td>
            <td style="padding:12px 14px">
              <button onclick="toggleUserActive('${u.id}', ${u.is_active})" style="background:none;border:1px solid var(--border-color);border-radius:6px;padding:5px 10px;cursor:pointer;color:var(--text-secondary);font-size:12px">
                ${u.is_active ? 'Khóa' : 'Mở Khóa'}
              </button>
            </td>
          </tr>`;
      });
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:24px;color:#ef4444">❌ Lỗi: ${err.message}</td></tr>`;
    }
  }

  // ─── Toggle user active/inactive ───
  window.toggleUserActive = async function(id, currentActive) {
    const sb = getSb();
    if (!sb) return;
    const { error } = await sb.from('admin_profiles').update({ is_active: !currentActive }).eq('id', id);
    if (error) { alert('Lỗi: ' + error.message); return; }
    loadUsers();
  };

  // ─── Tạo user qua Backend API ───
  async function createUser(name, email, password, role) {
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + token(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ name, email, password, role })
    });
    return res.json();
  }

  function setupUI() {
    // Load users khi tab được active
    const menuBtn = document.getElementById('menu-admin-users');
    if (menuBtn) {
      menuBtn.addEventListener('click', () => {
        setTimeout(loadUsers, 200);
      });
    }

    // Panel header button cũng reload
    const btnCreate = document.getElementById('btn-create-admin-user');
    const modal = document.getElementById('modal-create-user');
    const overlay = document.getElementById('modal-create-user-overlay');
    const closeBtn = document.getElementById('modal-create-user-close');
    const cancelBtn = document.getElementById('modal-create-user-cancel');
    const submitBtn = document.getElementById('modal-create-user-submit');
    const errorMsg = document.getElementById('create-user-error');

    function openModal() {
      if (!modal) return;
      modal.classList.remove('hidden');
      document.getElementById('cu-name').value = '';
      document.getElementById('cu-email').value = '';
      document.getElementById('cu-password').value = '';
      document.getElementById('cu-role').value = 'sale';
      if (errorMsg) errorMsg.classList.add('hidden');
    }

    function closeModal() {
      if (modal) modal.classList.add('hidden');
    }

    if (btnCreate) btnCreate.addEventListener('click', openModal);
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
    if (overlay) overlay.addEventListener('click', closeModal);

    if (submitBtn) {
      submitBtn.addEventListener('click', async () => {
        const name = (document.getElementById('cu-name')?.value || '').trim();
        const email = (document.getElementById('cu-email')?.value || '').trim();
        const password = (document.getElementById('cu-password')?.value || '').trim();
        const role = document.getElementById('cu-role')?.value || 'sale';

        if (!name || !email || !password) {
          if (errorMsg) { errorMsg.textContent = 'Vui lòng điền đầy đủ!'; errorMsg.classList.remove('hidden'); }
          return;
        }
        if (password.length < 6) {
          if (errorMsg) { errorMsg.textContent = 'Mật khẩu phải từ 6 ký tự!'; errorMsg.classList.remove('hidden'); }
          return;
        }

        const oldText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang tạo...';
        submitBtn.disabled = true;
        if (errorMsg) errorMsg.classList.add('hidden');

        try {
          // Try API first
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 10000);
          
          let created = false;
          try {
            const res = await fetch('/api/admin/users', {
              method: 'POST',
              headers: { 'Authorization': 'Bearer ' + token(), 'Content-Type': 'application/json' },
              body: JSON.stringify({ name, email, password, role }),
              signal: controller.signal
            });
            clearTimeout(timeout);
            const data = await res.json();
            if (data.ok) created = true;
            else throw new Error(data.error);
          } catch (apiErr) {
            clearTimeout(timeout);
            // Fallback: create directly via Supabase admin (if service key available in env)
            throw new Error('Không thể kết nối backend API. Vui lòng kiểm tra SUPABASE_SERVICE_ROLE_KEY đã được thêm vào Vercel chưa. Lỗi: ' + apiErr.message);
          }

          if (created) {
            closeModal();
            await loadUsers();
            // Toast
            const toast = document.createElement('div');
            toast.style.cssText = 'position:fixed;top:20px;right:20px;background:#10b981;color:#fff;padding:12px 20px;border-radius:10px;z-index:9999;font-size:13px;font-weight:600';
            toast.textContent = '✅ Tạo tài khoản thành công!';
            document.body.appendChild(toast);
            setTimeout(() => toast.remove(), 3000);
          }
        } catch (err) {
          if (errorMsg) { errorMsg.textContent = err.message; errorMsg.classList.remove('hidden'); }
        } finally {
          submitBtn.innerHTML = oldText;
          submitBtn.disabled = false;
        }
      });
    }

    // Auto-load when tab becomes visible
    window.addEventListener('tps1-authenticated', () => {
      const menuAdmin = document.getElementById('menu-admin-users');
      if (menuAdmin && window.currentUserRole === 'admin') {
        menuAdmin.style.display = 'flex';
      }
    });
  }

  document.addEventListener('DOMContentLoaded', setupUI);
})();
