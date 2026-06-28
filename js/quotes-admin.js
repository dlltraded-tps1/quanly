// QUOTES MANAGEMENT MODULE

(function() {
  // Config: Using the same Supabase URL and ANON KEY from products-admin.js
  const SUPABASE_URL = "https://yntgxollwjemyidizhnn.supabase.co";
  const SUPABASE_ANON_KEY = "sb_publishable_BhQX_aNaD5wzocEp7MXD_Q_DA4kOAZn"; // Since Admin is statically deployed, this is fine. It has RLS policies if configured, or it's an internal admin tool.
  
  let supabase = null;
  let currentQuotes = [];

  document.addEventListener('DOMContentLoaded', () => {
    // Initialize Supabase Client
    if (window.supabase) {
      supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    } else {
      console.error("Supabase script not loaded!");
    }

    setupQuotesListeners();
  });

  function setupQuotesListeners() {
    const saveQuoteBtn = document.getElementById('quote-save-btn');
    const refreshQuotesBtn = document.getElementById('quote-management-refresh-btn');
    const searchInput = document.getElementById('quote-management-search');
    const statusFilter = document.getElementById('quote-management-status-filter');

    // Nút Lưu/Tạo báo giá bên tab Quote Builder
    if (saveQuoteBtn) {
      saveQuoteBtn.addEventListener('click', async () => {
        if (!window.state || !window.state.quoteBuilder) return;
        
        // Disable nút trong lúc lưu
        const originalText = saveQuoteBtn.innerHTML;
        saveQuoteBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang lưu...';
        saveQuoteBtn.disabled = true;

        try {
          await saveQuoteToSupabase(window.state.quoteBuilder);
          // Chuyển sang tab quản lý báo giá
          const mgmtTabBtn = document.querySelector('[data-tab="tab-quote-management"]');
          if (mgmtTabBtn) mgmtTabBtn.click();
          
        } catch (error) {
          console.error("Lỗi khi lưu báo giá:", error);
          if (window.showToastNotification) window.showToastNotification("Có lỗi xảy ra khi lưu báo giá!", "error");
        } finally {
          saveQuoteBtn.innerHTML = originalText;
          saveQuoteBtn.disabled = false;
        }
      });
    }

    // Nút Refresh danh sách báo giá
    if (refreshQuotesBtn) {
      refreshQuotesBtn.addEventListener('click', fetchQuotesFromSupabase);
    }

    // Các bộ lọc
    if (searchInput) searchInput.addEventListener('input', renderQuotesTable);
    if (statusFilter) statusFilter.addEventListener('change', renderQuotesTable);
    
    // Tự động load lần đầu khi click vào tab
    const mgmtTabBtn = document.querySelector('[data-tab="tab-quote-management"]');
    if (mgmtTabBtn) {
      mgmtTabBtn.addEventListener('click', () => {
        if (currentQuotes.length === 0) {
          fetchQuotesFromSupabase();
        }
      });
    }
  }

  async function saveQuoteToSupabase(quoteData) {
    if (!supabase) {
      if (window.showToastNotification) window.showToastNotification("Lỗi kết nối Supabase", "error");
      return;
    }

    // Lấy thông tin khách hàng từ lead hiện tại
    const lead = window.state.leads.find(l => l.id === quoteData.leadId);
    if (!lead) {
      if (window.showToastNotification) window.showToastNotification("Vui lòng chọn khách hàng trước khi lưu!", "error");
      throw new Error("Missing lead");
    }

    // Tạo Quote_Code nếu chưa có (format QT-YYMMDD-XXXX)
    function _genCode() {
      const n = new Date();
      const p = `QT-${String(n.getFullYear()).slice(-2)}${String(n.getMonth()+1).padStart(2,'0')}${String(n.getDate()).padStart(2,'0')}-`;
      const codes = (window.state?.quotes || []).map(q => q.quoteCode || '').filter(c => c.startsWith(p));
      let mx = 0; codes.forEach(c => { const s = parseInt(c.replace(p,''),10); if (!isNaN(s) && s > mx) mx = s; });
      return `${p}${String(mx+1).padStart(4,'0')}`;
    }
    const quoteCode = quoteData.quoteCode || _genCode();
    
    const dbQuote = {
      local_quote_id: quoteData.id,
      lead_id: quoteData.leadId,
      quote_code: quoteCode,
      lead_name: lead.name,
      lead_phone: lead.phone,
      lead_email: lead.email || '',
      lead_category: lead.category,
      lead_source: lead.source,
      lead_snapshot: lead,
      quote_snapshot: quoteData,
      price_type: quoteData.priceType || 'retail',
      status: quoteData.status || 'quoted',
      items: quoteData.items,
      subtotal: quoteData.subtotal || 0,
      discount_percent: quoteData.discount || 0,
      discount_amount: quoteData.discountAmount || 0,
      shipping_amount: quoteData.shipping || 0,
      deposit_amount: quoteData.deposit || 0,
      grand_total: quoteData.grandTotal || 0,
      balance_amount: quoteData.balance || 0,
      note: quoteData.note || '',
      updated_at: new Date().toISOString()
    };

    // Kiểm tra xem đã tồn tại trên DB chưa (update or insert)
    // Để đơn giản, cứ push lên Supabase. Cột local_quote_id có thể là unique key
    const { data, error } = await supabase
      .from('quotes')
      .upsert(dbQuote, { onConflict: 'local_quote_id' })
      .select();

    if (error) {
      throw error;
    }

    if (window.showToastNotification) window.showToastNotification(`Lưu báo giá ${quoteCode} thành công!`);
    
    // Cập nhật lại list quote
    fetchQuotesFromSupabase();
  }

  async function fetchQuotesFromSupabase() {
    if (!supabase) return;

    const countEl = document.getElementById('quote-management-count');
    if (countEl) countEl.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang tải...';

    const { data, error } = await supabase
      .from('quotes')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Lỗi khi tải báo giá:", error);
      if (window.showToastNotification) window.showToastNotification("Không thể tải danh sách báo giá", "error");
      if (countEl) countEl.innerText = "Lỗi tải dữ liệu";
      return;
    }

    currentQuotes = data || [];
    renderQuotesTable();
    updateQuotesStats();
  }

  function renderQuotesTable() {
    const tbody = document.getElementById('saved-quotes-body');
    const searchVal = (document.getElementById('quote-management-search')?.value || '').toLowerCase().trim();
    const statusVal = document.getElementById('quote-management-status-filter')?.value || '';

    if (!tbody) return;

    let filtered = currentQuotes.filter(q => {
      const matchSearch = (q.quote_code && q.quote_code.toLowerCase().includes(searchVal)) ||
                          (q.lead_name && q.lead_name.toLowerCase().includes(searchVal)) ||
                          (q.lead_phone && q.lead_phone.includes(searchVal));
      const matchStatus = !statusVal || q.status === statusVal;
      return matchSearch && matchStatus;
    });

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-center" style="color: var(--text-muted); padding: 24px 0;">Không tìm thấy báo giá nào.</td></tr>`;
      return;
    }

    tbody.innerHTML = filtered.map(q => {
      const dateStr = q.created_at ? new Date(q.created_at).toLocaleString('vi-VN') : '';
      const totalStr = window.formatCurrency ? window.formatCurrency(q.grand_total) : (q.grand_total + ' đ');
      
      let statusBadge = '';
      switch(q.status) {
        case 'draft': statusBadge = '<span class="badge" style="background:#e2e8f0;color:#475569;">Nháp</span>'; break;
        case 'quoted': statusBadge = '<span class="badge" style="background:#fce7f3;color:#be185d;">Đã báo giá</span>'; break;
        case 'sent': statusBadge = '<span class="badge badge-blue">Đã gửi</span>'; break;
        case 'negotiating': statusBadge = '<span class="badge badge-purple">Thương lượng</span>'; break;
        case 'won': statusBadge = '<span class="badge badge-emerald">Chốt đơn</span>'; break;
        case 'lost': statusBadge = '<span class="badge badge-rose">Thất bại</span>'; break;
        default: statusBadge = `<span class="badge" style="background:#f1f5f9;color:#64748b;">${q.status}</span>`;
      }

      const itemCount = Array.isArray(q.items) ? q.items.length : 0;

      return `
        <tr>
          <td><strong>${q.quote_code || '---'}</strong></td>
          <td>
            <div style="font-weight:500;">${q.lead_name || 'Khách ẩn danh'}</div>
            <div style="font-size:12px; color:var(--text-muted);">${q.lead_phone || ''}</div>
          </td>
          <td class="text-right" style="font-weight:600; color:var(--emerald-600);">${totalStr}</td>
          <td>
            <select class="form-control status-updater" data-id="${q.local_quote_id}" style="width:130px; font-size:12px; padding:4px;">
              <option value="draft" ${q.status==='draft'?'selected':''}>Nháp</option>
              <option value="quoted" ${q.status==='quoted'?'selected':''}>Đã báo giá</option>
              <option value="sent" ${q.status==='sent'?'selected':''}>Đã gửi</option>
              <option value="negotiating" ${q.status==='negotiating'?'selected':''}>Thương lượng</option>
              <option value="won" ${q.status==='won'?'selected':''}>Chốt đơn</option>
              <option value="lost" ${q.status==='lost'?'selected':''}>Thất bại</option>
            </select>
          </td>
          <td style="font-size:12px; color:var(--text-muted);">${dateStr}</td>
          <td style="font-size:12px;">${itemCount} món</td>
          <td class="text-right">
            <button class="btn btn-secondary btn-xs btn-view-quote" data-id="${q.local_quote_id}" title="Xem/Sửa">
              <i class="fa-solid fa-eye"></i>
            </button>
            <button class="btn btn-secondary btn-xs btn-delete-quote" data-id="${q.local_quote_id}" title="Xóa" style="color:var(--rose-600);">
              <i class="fa-solid fa-trash"></i>
            </button>
          </td>
        </tr>
      `;
    }).join('');

    // Gắn sự kiện thay đổi trạng thái
    const statusSelects = tbody.querySelectorAll('.status-updater');
    statusSelects.forEach(select => {
      select.addEventListener('change', async (e) => {
        const quoteId = e.target.getAttribute('data-id');
        const newStatus = e.target.value;
        await updateQuoteStatus(quoteId, newStatus);
      });
    });

    // Gắn sự kiện Xem lại báo giá
    const viewBtns = tbody.querySelectorAll('.btn-view-quote');
    viewBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const quoteId = e.currentTarget.getAttribute('data-id');
        loadQuoteIntoBuilder(quoteId);
      });
    });

    // Gắn sự kiện Xóa báo giá
    const delBtns = tbody.querySelectorAll('.btn-delete-quote');
    delBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const quoteId = e.currentTarget.getAttribute('data-id');
        deleteQuote(quoteId);
      });
    });
  }

  function updateQuotesStats() {
    const totalEl = document.getElementById('quote-mgmt-total');
    const sentEl = document.getElementById('quote-mgmt-sent');
    const wonEl = document.getElementById('quote-mgmt-won');
    const lostEl = document.getElementById('quote-mgmt-lost');
    const countEl = document.getElementById('quote-management-count');

    if (!totalEl) return;

    let total = currentQuotes.length;
    let sent = 0;
    let won = 0;
    let lost = 0;

    currentQuotes.forEach(q => {
      if (['sent', 'quoted'].includes(q.status)) sent++;
      if (q.status === 'won') won++;
      if (q.status === 'lost') lost++;
    });

    totalEl.innerText = total;
    sentEl.innerText = sent;
    wonEl.innerText = won;
    lostEl.innerText = lost;
    
    if (countEl) countEl.innerText = `${total} báo giá`;
  }

  async function updateQuoteStatus(quoteId, newStatus) {
    if (!supabase) return;
    try {
      const { error } = await supabase
        .from('quotes')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('local_quote_id', quoteId);

      if (error) throw error;
      
      // Update local state
      const idx = currentQuotes.findIndex(q => q.local_quote_id === quoteId);
      if (idx !== -1) currentQuotes[idx].status = newStatus;
      
      updateQuotesStats();
      if (window.showToastNotification) window.showToastNotification("Đã cập nhật trạng thái báo giá!");

      // Update lead status on Google Sheets / local for ALL status changes
      const statusMap = {
        quoted: 'quoted',
        negotiating: 'quoting',
        won: 'won',
        lost: 'unqualified',
        canceled: 'canceled'
      };
      const mappedLeadStatus = statusMap[newStatus] || newStatus;

      if (idx !== -1) {
        const quote = currentQuotes[idx];
        if (window.state && window.state.leads) {
          const leadIdx = window.state.leads.findIndex(l => l.id === quote.lead_id);
          if (leadIdx !== -1) {
            window.state.leads[leadIdx].status = mappedLeadStatus;
            if (typeof saveState === 'function') saveState('leads');
            if (typeof renderKanban === 'function') renderKanban();
            if (typeof window.renderRecentLeads === 'function') window.renderRecentLeads();
            if (window.sheetsModule && typeof window.sheetsModule.syncWriteGoogleSheets === 'function') {
              window.sheetsModule.syncWriteGoogleSheets('update_status', { phone: window.state.leads[leadIdx].phone, status: mappedLeadStatus });
            }
          }
        }
      }

    } catch (err) {
      console.error(err);
      if (window.showToastNotification) window.showToastNotification("Lỗi cập nhật trạng thái báo giá", "error");
    }
  }

  async function deleteQuote(quoteId) {
    if (!confirm("Bạn có chắc chắn muốn xóa báo giá này vĩnh viễn?")) return;
    if (!supabase) return;

    try {
      const { error } = await supabase
        .from('quotes')
        .delete()
        .eq('local_quote_id', quoteId);

      if (error) throw error;
      
      if (window.showToastNotification) window.showToastNotification("Đã xóa báo giá!");
      fetchQuotesFromSupabase();
    } catch (err) {
      console.error(err);
      if (window.showToastNotification) window.showToastNotification("Lỗi khi xóa báo giá", "error");
    }
  }

  function loadQuoteIntoBuilder(quoteId) {
    const quote = currentQuotes.find(q => q.local_quote_id === quoteId);
    if (!quote || !quote.quote_snapshot) return;

    if (window.state) {
      window.state.quoteBuilder = quote.quote_snapshot;
      // Khôi phục quoteCode
      window.state.quoteBuilder.quoteCode = quote.quote_code;
      if (typeof saveState === 'function') saveState('quoteBuilder');
      
      // Initialize quote builder with the newly saved state
      if (window.quoteModule && typeof window.quoteModule.initQuoteBuilder === 'function') {
        window.quoteModule.initQuoteBuilder();
      }
      
      // Chuyển sang tab báo giá
      const qTabBtn = document.querySelector('[data-tab="tab-quote"]');
      if (qTabBtn) qTabBtn.click();
    }
  }

})();
