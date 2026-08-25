(function() {
  function token() {
    return sessionStorage.getItem('tps1_admin_api_token') || localStorage.getItem('tps1_admin_api_token');
  }

  async function loadUsers() {
    const tbody = document.getElementById('admin-users-tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '<tr><td colspan="5" class="text-center">Đang tải dữ liệu...</td></tr>';
    
    try {
      const res = await fetch('/api/admin/users', {
        headers: { 'Authorization': 'Bearer ' + token() }
      });
      const data = await res.json();
      
      if (!data.ok) throw new Error(data.error);
      
      tbody.innerHTML = '';
      if (!data.users || data.users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center">Chưa có tài khoản nào.</td></tr>';
        return;
      }
      
      data.users.forEach(u => {
        const badgeClass = u.role === 'admin' ? 'badge-rose' : 'badge-blue';
        const roleLabel = u.role === 'admin' ? 'Quản Trị Viên' : 'Sale';
        const activeBadge = u.is_active ? '<span class="badge badge-emerald">Hoạt động</span>' : '<span class="badge badge-slate">Khóa</span>';
        
        tbody.innerHTML += \`
          <tr>
            <td><strong>\${u.name}</strong></td>
            <td>\${u.email || ''}</td>
            <td><span class="badge \${badgeClass}">\${roleLabel}</span></td>
            <td>\${activeBadge}</td>
            <td>
              <button class="btn btn-sm btn-secondary" onclick="alert('Tính năng chỉnh sửa sắp ra mắt')"><i class="fa-solid fa-pen"></i></button>
            </td>
          </tr>
        \`;
      });
    } catch (err) {
      tbody.innerHTML = \`<tr><td colspan="5" class="text-center text-rose">Lỗi: \${err.message}</td></tr>\`;
    }
  }

  function setupUI() {
    // Menu logic is handled by app.js (menu-admin-users id is shown via RBAC in app.js).
    // Wait, let's make sure it's shown if role is admin:
    window.addEventListener('tps1-authenticated', () => {
      const menu = document.getElementById('menu-admin-users');
      if (menu && window.currentUserRole === 'admin') {
        menu.style.display = 'flex';
      }
    });

    const menu = document.getElementById('menu-admin-users');
    if (menu) {
      menu.addEventListener('click', () => {
        loadUsers();
      });
    }

    const modal = document.getElementById('modal-create-user');
    const overlay = document.getElementById('modal-create-user-overlay');
    const closeBtn = document.getElementById('modal-create-user-close');
    const cancelBtn = document.getElementById('modal-create-user-cancel');
    const submitBtn = document.getElementById('modal-create-user-submit');
    const btnCreate = document.getElementById('btn-create-admin-user');
    const errorMsg = document.getElementById('create-user-error');

    function closeModal() {
      if (modal) modal.classList.add('hidden');
    }

    function openModal() {
      if (modal) modal.classList.remove('hidden');
      document.getElementById('cu-name').value = '';
      document.getElementById('cu-email').value = '';
      document.getElementById('cu-password').value = '';
      document.getElementById('cu-role').value = 'sale';
      errorMsg.classList.add('hidden');
    }

    if (btnCreate) btnCreate.addEventListener('click', openModal);
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
    if (overlay) overlay.addEventListener('click', closeModal);

    if (submitBtn) {
      submitBtn.addEventListener('click', async () => {
        const name = document.getElementById('cu-name').value.trim();
        const email = document.getElementById('cu-email').value.trim();
        const password = document.getElementById('cu-password').value.trim();
        const role = document.getElementById('cu-role').value;

        if (!name || !email || !password) {
          errorMsg.textContent = 'Vui lòng điền đầy đủ thông tin!';
          errorMsg.classList.remove('hidden');
          return;
        }
        
        if (password.length < 6) {
          errorMsg.textContent = 'Mật khẩu phải từ 6 ký tự trở lên!';
          errorMsg.classList.remove('hidden');
          return;
        }

        const oldText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang tạo...';
        submitBtn.disabled = true;
        errorMsg.classList.add('hidden');

        try {
          const res = await fetch('/api/admin/users', {
            method: 'POST',
            headers: { 
              'Authorization': 'Bearer ' + token(),
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name, email, password, role })
          });
          
          const data = await res.json();
          if (!data.ok) throw new Error(data.error);

          closeModal();
          // Optionally show a toast
          if (typeof showToastNotification === 'function') {
            showToastNotification('Đã tạo tài khoản thành công!');
          }
          loadUsers();
        } catch (err) {
          errorMsg.textContent = 'Lỗi tạo tài khoản: ' + err.message;
          errorMsg.classList.remove('hidden');
        } finally {
          submitBtn.innerHTML = oldText;
          submitBtn.disabled = false;
        }
      });
    }
  }

  document.addEventListener('DOMContentLoaded', setupUI);

})();
