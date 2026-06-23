// KANBAN BOARD & LEADS LIST: THỰC PHẨM SỐ MỘT

(function() {
  // Biến cục bộ phân trang
  let listCurrentPage = 1;
  const listPageSize = 10;

  // Khởi tạo các sự kiện khi load trang
  document.addEventListener('DOMContentLoaded', () => {
    setupKanbanListeners();
    setupListListeners();
  });

  // 1. KANBAN BOARD CODE
  function setupKanbanListeners() {
    const searchInput = document.getElementById('kanban-search-input');
    const categoryFilter = document.getElementById('kanban-filter-category');

    if (searchInput) {
      searchInput.addEventListener('input', renderKanban);
    }
    if (categoryFilter) {
      categoryFilter.addEventListener('change', renderKanban);
    }

    // Gắn sự kiện kéo thả cho các cột Kanban
    const columns = document.querySelectorAll('.kanban-column');
    columns.forEach(col => {
      const wrapper = col.querySelector('.kanban-cards-wrapper');
      
      wrapper.addEventListener('dragover', (e) => {
        e.preventDefault();
        wrapper.classList.add('dragover');
      });

      wrapper.addEventListener('dragenter', (e) => {
        e.preventDefault();
        wrapper.classList.add('dragover');
      });

      wrapper.addEventListener('dragleave', () => {
        wrapper.classList.remove('dragover');
      });

      wrapper.addEventListener('drop', (e) => {
        e.preventDefault();
        wrapper.classList.remove('dragover');
        
        const leadId = e.dataTransfer.getData('text/plain');
        const newStatus = col.getAttribute('data-status');
        
        moveLeadStatus(leadId, newStatus);
      });
    });
  }

  // Render Kanban Board
  function renderKanban() {
    const searchVal = document.getElementById('kanban-search-input').value.toLowerCase().trim();
    const categoryVal = document.getElementById('kanban-filter-category').value;

    const statuses = Array.isArray(window.LEAD_STATUS_ORDER) && window.LEAD_STATUS_ORDER.length
      ? window.LEAD_STATUS_ORDER
      : ['new', 'contacting', 'quoting', 'quoted', 'won', 'unqualified', 'canceled'];
    const columns = {};
    statuses.forEach(status => {
      columns[status] = document.getElementById(`col-${status}`);
      if (columns[status]) columns[status].innerHTML = '';
    });

    // Đếm số lượng cột
    const counts = statuses.reduce((acc, status) => {
      acc[status] = 0;
      return acc;
    }, {});

    // Lọc leads
    const filteredLeads = state.leads.filter(lead => {
      // Lọc theo từ khóa tìm kiếm
      const matchSearch = lead.name.toLowerCase().includes(searchVal) || 
                          lead.phone.includes(searchVal) ||
                          (lead.email && lead.email.toLowerCase().includes(searchVal));
      
      // Lọc theo nhóm khách
      const matchCategory = !categoryVal || lead.category === categoryVal;

      return matchSearch && matchCategory;
    });

    // Tạo thẻ card và đẩy vào cột
    filteredLeads.forEach(lead => {
      const card = document.createElement('div');
      card.className = 'kanban-card';
      card.setAttribute('draggable', 'true');
      card.setAttribute('data-id', lead.id);
      
      // Mức ưu tiên
      let priorityClass = '';
      let priorityText = '';
      if (lead.priority === 'high') { priorityClass = 'priority-high'; priorityText = 'Cao'; }
      else if (lead.priority === 'medium') { priorityClass = 'priority-medium'; priorityText = 'Trung bình'; }
      else { priorityClass = 'priority-low'; priorityText = 'Thấp'; }

      // Lấy ghi chú gần nhất
      let lastNoteText = 'Chưa có ghi chú';
      if (lead.notes && lead.notes.length > 0) {
        // Sắp xếp lấy note mới nhất
        const sortedNotes = [...lead.notes].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        lastNoteText = sortedNotes[0].text;
      }
      // Cắt ngắn note nếu dài
      if (lastNoteText.length > 60) lastNoteText = lastNoteText.substring(0, 57) + '...';

      const categoryText = {
        wholesale_restaurant: 'Sỉ - Nhà hàng',
        wholesale_agency: 'Sỉ - Đại lý',
        retail_vip: 'Lẻ - VIP',
        retail_regular: 'Lẻ - Thường'
      }[lead.category] || 'Chưa phân loại';

      card.innerHTML = `
        <div class="kanban-card-title">${lead.name}</div>
        <div class="kanban-card-body">
          <p><i class="fa-solid fa-phone"></i> ${lead.phone}</p>
          <p><i class="fa-solid fa-share-nodes"></i> Nguồn: ${lead.source}</p>
          <p><i class="fa-solid fa-tag"></i> Nhóm: ${categoryText}</p>
          <p style="font-style: italic; color: var(--text-muted); margin-top:8px;">${lastNoteText}</p>
        </div>
        <div class="kanban-card-footer">
          <span class="priority-cell ${priorityClass}"><i class="fa-solid fa-circle"></i> UT: ${priorityText}</span>
          <span style="font-size:11px; color: var(--text-muted);">${formatDateRelative(lead.createdAt)}</span>
        </div>
      `;

      // Click vào card để mở drawer chi tiết
      card.addEventListener('click', () => {
        openLeadDrawer(lead.id);
      });

      // Bắt đầu kéo
      card.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', lead.id);
        card.style.opacity = '0.5';
      });

      // Kết thúc kéo
      card.addEventListener('dragend', () => {
        card.style.opacity = '1';
      });

      // Đẩy vào cột tương ứng
      const statusKey = typeof window.normalizeLeadStatus === 'function' ? window.normalizeLeadStatus(lead.status) : lead.status;
      const targetCol = columns[statusKey];

      if (targetCol) {
        targetCol.appendChild(card);
        counts[statusKey]++;
      }
    });

    // Cập nhật số lượng đầu cột
    document.querySelectorAll('.kanban-column').forEach(col => {
      const status = col.getAttribute('data-status');
      col.querySelector('.card-count').innerText = counts[status] || 0;
    });
  }

  // Di chuyển lead trạng thái (Kéo thả)
  function moveLeadStatus(leadId, newStatus) {
    const leadIndex = state.leads.findIndex(l => l.id === leadId);
    if (leadIndex === -1) return;

    const normalize = typeof window.normalizeLeadStatus === 'function'
      ? window.normalizeLeadStatus
      : (status) => status;
    const oldStatus = normalize(state.leads[leadIndex].status);
    const nextStatus = normalize(newStatus);
    if (oldStatus === nextStatus) return; // Không thay đổi

    // Hiển thị modal xác nhận (từ app.js)
    if (typeof window.showConfirmStatusModal === 'function') {
      window.showConfirmStatusModal(nextStatus, 
        () => {
          // Xác nhận
          executeMoveLeadStatus(leadId, nextStatus, oldStatus);
        },
        () => {
          // Hủy bỏ: Redraw lại bảng kanban để đưa card về vị trí cũ
          renderKanban();
        }
      );
    } else {
      executeMoveLeadStatus(leadId, nextStatus, oldStatus);
    }
  }

  function executeMoveLeadStatus(leadId, nextStatus, oldStatus) {
    const leadIndex = state.leads.findIndex(l => l.id === leadId);
    if (leadIndex === -1) return;

    state.leads[leadIndex].status = nextStatus;
    state.leads[leadIndex].updatedAt = new Date().toISOString();

    // Ghi chú hệ thống tự động
    state.leads[leadIndex].notes.push({
      timestamp: new Date().toISOString(),
      author: "Hệ thống",
      text: `Thay đổi quy trình bằng kéo thả: <strong>${getLeadStatusLabel(oldStatus)}</strong> -> <strong>${getLeadStatusLabel(nextStatus)}</strong>`
    });

    saveState('leads');
    renderKanban();

    // Đồng bộ trạng thái lên Google Sheets
    if (window.sheetsModule && typeof window.sheetsModule.syncWriteGoogleSheets === 'function') {
      window.sheetsModule.syncWriteGoogleSheets('update_status', { phone: state.leads[leadIndex].phone, status: nextStatus });
    }

    // Hiện toast chúc mừng nếu chốt thành công!
    if (nextStatus === 'won') {
      showToastNotification(`🎉 Tuyệt vời! Bạn đã chốt thành công đơn hàng cho ${state.leads[leadIndex].name}!`);
    } else {
      showToastNotification(`Đã cập nhật quy trình khách hàng: ${state.leads[leadIndex].name}.`);
    }
  }


  // 2. CUSTOMERS LIST (TABLE VIEW) CODE
  function setupListListeners() {
    const searchInput = document.getElementById('list-search-input');
    const statusFilter = document.getElementById('list-filter-status');
    const sourceFilter = document.getElementById('list-filter-source');
    const categoryFilter = document.getElementById('list-filter-category');

    const prevBtn = document.getElementById('pag-prev-btn');
    const nextBtn = document.getElementById('pag-next-btn');
    const exportBtn = document.getElementById('btn-export-json');

    // Sự kiện nhập bộ lọc
    [searchInput, statusFilter, sourceFilter, categoryFilter].forEach(el => {
      if (el) {
        el.addEventListener('change', () => { listCurrentPage = 1; renderLeadsList(); });
        if (el.tagName === 'INPUT') {
          el.addEventListener('input', () => { listCurrentPage = 1; renderLeadsList(); });
        }
      }
    });

    // Phân trang
    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        if (listCurrentPage > 1) {
          listCurrentPage--;
          renderLeadsList();
        }
      });
    }
    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        const totalLeads = getFilteredLeadsList().length;
        const totalPages = Math.ceil(totalLeads / listPageSize);
        if (listCurrentPage < totalPages) {
          listCurrentPage++;
          renderLeadsList();
        }
      });
    }

    // Xuất Backup JSON
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state, null, 2));
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute("href",     dataStr);
        downloadAnchor.setAttribute("download", `tps1_leads_backup_${new Date().toISOString().slice(0,10)}.json`);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
        showToastNotification("Đã tải xuống file sao lưu JSON thành công!");
      });
    }
  }

  // Lọc danh sách leads phục vụ render & đếm phân trang
  function getFilteredLeadsList() {
    const searchVal = document.getElementById('list-search-input').value.toLowerCase().trim();
    const statusVal = document.getElementById('list-filter-status').value;
    const sourceVal = document.getElementById('list-filter-source').value;
    const categoryVal = document.getElementById('list-filter-category').value;

    return state.leads.filter(lead => {
      const matchSearch = lead.name.toLowerCase().includes(searchVal) || 
                          lead.phone.includes(searchVal) ||
                          (lead.email && lead.email.toLowerCase().includes(searchVal));
      
      const leadStatus = typeof window.normalizeLeadStatus === 'function' ? window.normalizeLeadStatus(lead.status) : lead.status;
      const matchStatus = !statusVal || leadStatus === statusVal;
      const matchSource = !sourceVal || lead.source === sourceVal;
      const matchCategory = !categoryVal || lead.category === categoryVal;

      return matchSearch && matchStatus && matchSource && matchCategory;
    });
  }

  // Render bảng danh sách leads
  function renderLeadsList() {
    const tableBody = document.getElementById('leads-table-body');
    if (!tableBody) return;
    tableBody.innerHTML = '';

    const filteredLeads = getFilteredLeadsList();
    const totalLeads = filteredLeads.length;
    const totalPages = Math.ceil(totalLeads / listPageSize) || 1;

    // Giới hạn trang hiện tại
    if (listCurrentPage > totalPages) listCurrentPage = totalPages;
    if (listCurrentPage < 1) listCurrentPage = 1;

    const startIdx = (listCurrentPage - 1) * listPageSize;
    const endIdx = Math.min(startIdx + listPageSize, totalLeads);

    const pageLeads = filteredLeads.slice(startIdx, endIdx);

    // Render từng hàng
    if (pageLeads.length > 0) {
      pageLeads.forEach(lead => {
        const row = document.createElement('tr');

        // Mức ưu tiên badge
        let priorityClass = '';
        let priorityText = '';
        if (lead.priority === 'high') { priorityClass = 'priority-high'; priorityText = 'Cao'; }
        else if (lead.priority === 'medium') { priorityClass = 'priority-medium'; priorityText = 'T.Bình'; }
        else { priorityClass = 'priority-low'; priorityText = 'Thấp'; }

        // Trạng thái badge
        const statusKey = typeof window.normalizeLeadStatus === 'function' ? window.normalizeLeadStatus(lead.status) : lead.status;
        const statusBadge = `<span class="badge ${getLeadStatusBadgeClass(statusKey)}">${getLeadStatusLabel(statusKey)}</span>`;

        // Phân loại nhóm
        const categoryText = {
          wholesale_restaurant: 'Sỉ - Nhà hàng',
          wholesale_agency: 'Sỉ - Đại lý',
          retail_vip: 'Lẻ - VIP',
          retail_regular: 'Lẻ - Thường'
        }[lead.category] || 'Chưa phân loại';

        // Tính doanh số đơn hàng từ các quote
        let totalRevenue = 0;
        const leadQuotes = state.quotes.filter(q => q.leadId === lead.id);
        leadQuotes.forEach(q => {
          const items = q.items || [];
          let quoteSubtotal = items.reduce((sum, item) => sum + (item.price * item.qty), 0);
          let quoteDiscountAmt = (quoteSubtotal * (q.discount || 0)) / 100;
          totalRevenue += quoteSubtotal - quoteDiscountAmt + (q.shipping || 0);
        });

        const revText = totalRevenue > 0 ? formatCurrency(totalRevenue) : '0 đ';

        row.innerHTML = `
          <td data-label="Khách hàng"><strong>${lead.name}</strong></td>
          <td data-label="SĐT">${lead.phone}</td>
          <td data-label="Kênh Nguồn">${lead.source}</td>
          <td data-label="Nhóm Khách">${categoryText}</td>
          <td data-label="Mức Ưu Tiên" class="${priorityClass} font-600"><i class="fa-solid fa-circle" style="font-size:8px;"></i> ${priorityText}</td>
          <td data-label="Quy Trình">${statusBadge}</td>
          <td data-label="Doanh số"><strong>${revText}</strong></td>
          <td data-label="Ngày nhận">${formatDateFull(lead.createdAt)}</td>
          <td>
            <div style="display:flex; gap:6px; justify-content: flex-end;">
              <button class="btn btn-secondary btn-xs" onclick="openLeadDrawer('${lead.id}')">
                <i class="fa-solid fa-pen-to-square"></i> Chi tiết
              </button>
              <button class="btn btn-secondary btn-xs" style="color:#EF4444; border-color:rgba(239,68,68,0.2)" onclick="deleteLeadConfirm('${lead.id}')">
                <i class="fa-solid fa-trash-can"></i> Xóa
              </button>
            </div>
          </td>
        `;
        tableBody.appendChild(row);
      });
    } else {
      tableBody.innerHTML = `
        <tr>
          <td colspan="9" class="text-center" style="color: var(--text-muted); padding:40px 0;">Không tìm thấy khách hàng nào khớp bộ lọc.</td>
        </tr>
      `;
    }

    // Cập nhật thông số phân trang
    document.getElementById('pag-start').innerText = totalLeads > 0 ? startIdx + 1 : 0;
    document.getElementById('pag-end').innerText = endIdx;
    document.getElementById('pag-total').innerText = totalLeads;
    document.getElementById('pag-current-page').innerText = listCurrentPage;

    // Trạng thái các nút phân trang
    const prevBtn = document.getElementById('pag-prev-btn');
    const nextBtn = document.getElementById('pag-next-btn');

    if (prevBtn) prevBtn.disabled = (listCurrentPage === 1);
    if (nextBtn) nextBtn.disabled = (listCurrentPage === totalPages);
  }

  // Xác nhận xóa lead
  window.deleteLeadConfirm = function(leadId) {
    const lead = state.leads.find(l => l.id === leadId);
    if (!lead) return;

    if (confirm(`⚠️ Bạn có chắc chắn muốn xóa vĩnh viễn khách hàng "${lead.name}" cùng toàn bộ lịch sử báo giá? Hành động này không thể hoàn tác.`)) {
      // Xóa các quote liên quan
      state.quotes = state.quotes.filter(q => q.leadId !== leadId);
      // Xóa lead
      state.leads = state.leads.filter(l => l.id !== leadId);
      
      saveState('leads');
      saveState('quotes');
      
      // Đồng bộ xóa lên Google Sheets
      if (window.sheetsModule && typeof window.sheetsModule.syncWriteGoogleSheets === 'function') {
        window.sheetsModule.syncWriteGoogleSheets('delete', { phone: lead.phone });
      }
      
      renderLeadsList();
      showToastNotification("Đã xóa vĩnh viễn khách hàng.");
    }
  };

  // Helper định dạng tiền tệ
  function formatCurrency(amount) {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount).replace('₫', 'đ');
  }

  function formatDateFull(isoString) {
    const date = new Date(isoString);
    return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  }

  function formatDateRelative(isoString) {
    const timeMs = new Date(isoString).getTime();
    const diffMs = Date.now() - timeMs;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Vừa xong';
    if (diffMins < 60) return `${diffMins} phút trước`;
    if (diffHours < 24) return `${diffHours} giờ trước`;
    if (diffDays < 7) return `${diffDays} ngày trước`;
    
    const d = new Date(isoString);
    return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
  }

  // Export module để sử dụng toàn cục
  window.kanbanModule = {
    renderKanban: renderKanban,
    renderLeadsList: renderLeadsList
  };
})();
