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
        <div class="kanban-card-title">${window.escapeHTML(lead.name)}</div>
        <div class="kanban-card-body">
          <p><i class="fa-solid fa-phone"></i> ${window.escapeHTML(lead.phone)}</p>
          <p><i class="fa-solid fa-share-nodes"></i> Nguồn: ${window.escapeHTML(lead.source)}</p>
          <p><i class="fa-solid fa-tag"></i> Nhóm: ${categoryText}</p>
          <p style="font-style: italic; color: var(--text-muted); margin-top:8px;">${window.escapeHTML(lastNoteText)}</p>
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
    
    // Đồng bộ trạng thái lên Supabase (Zalo Mini App)
    if (window.supabaseModule && typeof window.supabaseModule.syncLeadStatus === 'function') {
      window.supabaseModule.syncLeadStatus(state.leads[leadIndex], oldStatus, nextStatus, 'Thay đổi từ bảng Kanban')
        .catch(err => console.error('Lỗi syncLeadStatus Supabase (Kanban):', err));
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
        try {
          const jsonString = JSON.stringify(state, null, 2);
          const blob = new Blob([jsonString], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const downloadAnchor = document.createElement('a');
          downloadAnchor.href = url;
          downloadAnchor.download = `tps1_leads_backup_${new Date().toISOString().slice(0,10)}.json`;
          document.body.appendChild(downloadAnchor);
          downloadAnchor.click();
          document.body.removeChild(downloadAnchor);
          URL.revokeObjectURL(url);
          if (typeof showToastNotification === 'function') {
            showToastNotification("Đã tải xuống file sao lưu JSON thành công!");
          }
        } catch (e) {
          console.error("Lỗi xuất JSON:", e);
        }
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
    }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
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
      pageLeads.forEach((lead, index) => {
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
          <td data-label="STT"><strong>${startIdx + index + 1}</strong></td>
          <td data-label="Khách hàng"><strong>${window.escapeHTML(lead.name)}</strong></td>
          <td data-label="SĐT">${window.escapeHTML(lead.phone)}</td>
          <td data-label="Kênh Nguồn">${window.escapeHTML(lead.source)}</td>
          <td data-label="Nhóm Khách">${categoryText}</td>
          <td data-label="Mức Ưu Tiên" class="${priorityClass} font-600"><i class="fa-solid fa-circle" style="font-size:8px;"></i> ${priorityText}</td>
          <td data-label="Quy Trình">${statusBadge}</td>
          <td data-label="Doanh số"><strong>${revText}</strong></td>
          <td data-label="Ngày nhận">${formatDateFull(lead.createdAt)}</td>
          <td>
            <div style="display:flex; gap:6px; justify-content: flex-end;">
              <button class="btn btn-secondary btn-xs" onclick="openLeadDrawer('${window.escapeHTML(lead.id)}')">
                <i class="fa-solid fa-pen-to-square"></i> Chi tiết
              </button>
              <button class="btn btn-secondary btn-xs" style="color:#EF4444; border-color:rgba(239,68,68,0.2)" onclick="deleteLeadConfirm('${window.escapeHTML(lead.id)}')">
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

  // Xác nhận xóa lead (Sheet-First: POST lên Sheet trước)
  window.deleteLeadConfirm = function(leadId) {
    const lead = state.leads.find(l => l.id === leadId);
    if (!lead) return;

    if (!confirm(`⚠️ Xóa vĩnh viễn khách hàng "${lead.name}"? Hành động này sẽ xóa dữ liệu trên Google Sheet và không thể hoàn tác.`)) return;

    // 1. Optimistic: xóa local ngay cho UX nhanh
    const quotesToDelete = state.quotes.filter(q => q.leadId === leadId);
    if (window.supabaseModule && window.supabaseModule.deleteQuoteByLocalId) {
      quotesToDelete.forEach(q => {
        window.supabaseModule.deleteQuoteByLocalId(q.id).catch(err => console.error('Lỗi xóa quote Supabase:', err));
      });
    }
    state.quotes = state.quotes.filter(q => q.leadId !== leadId);
    state.leads  = state.leads.filter(l => l.id !== leadId);
    saveState('leads');
    saveState('quotes');
    renderLeadsList();
    showToastNotification('⏳ Đang xóa trên Google Sheet...');

    // 2. POST lên Sheet để xóa thật
    if (window.sheetsModule && typeof window.sheetsModule.syncWriteGoogleSheets === 'function') {
      window.sheetsModule.syncWriteGoogleSheets('delete', { phone: lead.phone });
    }
  };

  // Render bảng Kho Lưu Trữ Leads Đã Xóa (trong Settings)
  window.renderDeletedLeadsArchive = function() {
    const tbody = document.getElementById('deleted-leads-body');
    const emptyEl = document.getElementById('deleted-leads-empty');
    const tableWrap = document.getElementById('deleted-leads-table-wrap');
    if (!tbody) return;

    const deletedLeads = JSON.parse(localStorage.getItem('tps1_deleted_leads') || '[]');

    if (deletedLeads.length === 0) {
      if (emptyEl) emptyEl.classList.remove('hidden');
      if (tableWrap) tableWrap.style.display = 'none';
      return;
    }

    if (emptyEl) emptyEl.classList.add('hidden');
    if (tableWrap) tableWrap.style.display = '';

    const statusLabels = {
      new: 'Mới', contacting: 'Đã liên hệ', quoting: 'Đang báo giá',
      quoted: 'Đã báo giá', won: 'Đã chốt', unqualified: 'Không tiềm năng', canceled: 'Hủy'
    };

    tbody.innerHTML = deletedLeads.map((d, i) => {
      const date = d.deletedAt ? new Date(d.deletedAt).toLocaleString('vi-VN') : '---';
      const statusBadge = d.status ? `<span class="badge badge-secondary" style="font-size:10px">${statusLabels[d.status] || d.status}</span>` : '';
      return `<tr>
        <td><strong>${d.name}</strong> ${statusBadge}</td>
        <td><code style="font-size:12px">${d.phone}</code></td>
        <td style="font-size:12px;color:var(--text-secondary)">${d.source || '---'}</td>
        <td style="font-size:12px;color:var(--text-secondary)">${date}</td>
        <td class="text-center">
          <button class="btn btn-secondary btn-xs" onclick="restoreDeletedLead(${i})" title="Khôi phục: cho phép lead này xuất hiện lại khi sync">
            <i class="fa-solid fa-rotate-left"></i> Khôi phục
          </button>
        </td>
      </tr>`;
    }).join('');
  };

  // Khôi phục một lead khỏi blacklist (để nó có thể sync lại từ Sheet)
  window.restoreDeletedLead = function(index) {
    const deletedLeads = JSON.parse(localStorage.getItem('tps1_deleted_leads') || '[]');
    const restored = deletedLeads[index];
    if (!restored) return;
    if (!confirm(`Khôi phục "${restored.name}" (${restored.phone})? Lead này sẽ xuất hiện lại khi đồng bộ Google Sheets lần tiếp theo.`)) return;

    deletedLeads.splice(index, 1);
    localStorage.setItem('tps1_deleted_leads', JSON.stringify(deletedLeads));
    const phones = deletedLeads.map(d => d.phone);
    localStorage.setItem('tps1_deleted_phones', JSON.stringify(phones));

    renderDeletedLeadsArchive();
    showToastNotification(`Đã khôi phục "${restored.name}". Lead sẽ xuất hiện lại ở lần đồng bộ tiếp theo.`);
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
