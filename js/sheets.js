// GOOGLE SHEETS & EXCEL SYNCHRONIZATION: THỰC PHẨM SỐ MỘT

(function() {
  let autoSyncIntervalId = null;

  function normalizeSheetStatus(status) {
    if (typeof window.normalizeLeadStatus === 'function') {
      return window.normalizeLeadStatus(status);
    }

    const normalized = String(status || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!normalized) return 'new';
    if (['new', 'moi', 'moi nhan', 'tiep nhan'].includes(normalized)) return 'new';
    if (['contacting', 'da lien he', 'lien he', 'da lien lac', 'contact'].includes(normalized)) return 'contacting';
    if (['quoting', 'dang bao gia', 'thuong luong', 'negotiating', 'dang cham bao gia'].includes(normalized)) return 'quoting';
    if (['quoted', 'da bao gia', 'da gui bao gia', 'bao gia'].includes(normalized)) return 'quoted';
    if (['won', 'da chot don', 'chot don'].includes(normalized)) return 'won';
    if (['unqualified', 'khong tiem nang', 'lost', 'that bai', 'khong phu hop'].includes(normalized)) return 'unqualified';
    if (['canceled', 'cancelled', 'huy', 'huy bo', 'huy don'].includes(normalized)) return 'canceled';
    return 'new';
  }

  document.addEventListener('DOMContentLoaded', () => {
    initSettingsView();
    setupSyncListeners();
    initFileDragDrop();

    // Khởi tạo bảng lưu trữ leads đã xóa
    if (typeof window.renderDeletedLeadsArchive === 'function') {
      window.renderDeletedLeadsArchive();
    } else {
      // Render sau khi kanban.js nạp xong
      setTimeout(() => {
        if (typeof window.renderDeletedLeadsArchive === 'function') window.renderDeletedLeadsArchive();
      }, 300);
    }

    // Nút "Xóa tất cả lưu trữ"
    const clearAllBtn = document.getElementById('clear-all-deleted-btn');
    if (clearAllBtn) {
      clearAllBtn.addEventListener('click', () => {
        const deletedLeads = JSON.parse(localStorage.getItem('tps1_deleted_leads') || '[]');
        if (deletedLeads.length === 0) {
          showToastNotification('Kho lưu trữ đang trống.');
          return;
        }
        if (!confirm(`Xóa toàn bộ ${deletedLeads.length} mục khỏi kho lưu trữ? Tất cả các SĐT này sẽ có thể xuất hiện lại khi đồng bộ.`)) return;
        localStorage.removeItem('tps1_deleted_leads');
        localStorage.removeItem('tps1_deleted_phones');
        if (typeof window.renderDeletedLeadsArchive === 'function') window.renderDeletedLeadsArchive();
        showToastNotification('Đã xóa toàn bộ kho lưu trữ.');
      });
    }
  });

  // 1. Khởi tạo giao diện cài đặt
  function initSettingsView() {
    const sheetUrlInput = document.getElementById('settings-sheet-url');
    const syncIntervalSelect = document.getElementById('settings-sync-interval');

    if (sheetUrlInput) sheetUrlInput.value = state.syncSettings.sheetUrl || '';
    if (syncIntervalSelect) syncIntervalSelect.value = state.syncSettings.syncInterval || '300000';

    updateSyncStatusUI();
  }

  // 2. Lắng nghe sự kiện cấu hình
  function setupSyncListeners() {
    const saveBtn = document.getElementById('settings-save-btn');
    const syncBtn = document.getElementById('settings-sync-btn');
    const headerSyncBtn = document.getElementById('sync-now-btn');
    const headerActionSyncBtn = document.getElementById('btn-sync-now');

    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        const urlVal = document.getElementById('settings-sheet-url').value.trim();
        const intervalVal = parseInt(document.getElementById('settings-sync-interval').value);

        state.syncSettings.sheetUrl = urlVal;
        state.syncSettings.syncInterval = intervalVal;
        
        saveState('settings');
        showToastNotification("Đã lưu cấu hình Google Sheets thành công!");
        
        // Khởi động lại đồng bộ tự động
        startAutoSync();
        updateSyncStatusUI();
      });
    }

    // Các nút đồng bộ ngay lập tức
    [syncBtn, headerSyncBtn, headerActionSyncBtn].forEach(btn => {
      if (btn) {
        btn.addEventListener('click', () => {
          syncGoogleSheets(false);
        });
      }
    });

    // Tự động đồng bộ khi đăng nhập thành công
    window.addEventListener('tps1-authenticated', () => {
      // Nếu vừa reset (?no_sync=1), bỏ qua auto-sync lần đầu
      const params = new URLSearchParams(window.location.search);
      if (params.get('no_sync') === '1') {
        console.log('[Sync] Bỏ qua auto-sync sau reset (no_sync=1).');
        // Xóa param khỏi URL mà không reload
        const cleanUrl = window.location.pathname + '?t=' + Date.now();
        history.replaceState({}, '', cleanUrl);
        return;
      }
      if (state.syncSettings && state.syncSettings.sheetUrl) {
        syncGoogleSheets(true);
      }
    });
  }

  // Cập nhật giao diện Trạng thái đồng bộ
  function updateSyncStatusUI() {
    const statusTextEls = [
      document.getElementById('settings-status-text'),
      document.querySelector('#sync-status-badge .status-text')
    ];
    const badgeEl = document.getElementById('sync-status-badge');
    const lastSyncEl = document.getElementById('settings-last-sync');
    const rowsCountEl = document.getElementById('settings-rows-count');

    // Cập nhật thông số lần cuối
    if (lastSyncEl) {
      lastSyncEl.innerText = state.syncSettings.lastSync 
        ? new Date(state.syncSettings.lastSync).toLocaleString('vi-VN') 
        : 'Chưa từng đồng bộ';
    }

    if (rowsCountEl) {
      rowsCountEl.innerText = state.leads.length + ' leads';
    }

    // Cập nhật nhãn trạng thái và màu sắc
    statusTextEls.forEach(el => {
      if (!el) return;
      if (state.syncSettings.status === 'syncing') {
        el.innerText = 'Đang đồng bộ...';
      } else if (state.syncSettings.status === 'error') {
        el.innerText = 'Lỗi kết nối / Riêng tư';
      } else {
        el.innerText = state.syncSettings.lastSync ? 'Đã đồng bộ' : 'Chưa kết nối';
      }
    });

    if (badgeEl) {
      badgeEl.className = 'sync-badge';
      if (state.syncSettings.status === 'syncing') {
        badgeEl.classList.add('syncing');
      } else if (state.syncSettings.status === 'error') {
        badgeEl.classList.add('error');
      } else {
        badgeEl.classList.add('idle');
      }
    }
  }

  // 3. Khởi chạy đồng bộ tự động (Polling)
  function startAutoSync() {
    if (autoSyncIntervalId) {
      clearInterval(autoSyncIntervalId);
      autoSyncIntervalId = null;
    }

    const interval = state.syncSettings.syncInterval;
    if (interval > 0) {
      autoSyncIntervalId = setInterval(() => {
        syncGoogleSheets(true);
      }, interval);
    }
  }

  // 4. LOGIC ĐỒNG BỘ CHÍNH
  async function syncGoogleSheets(isBackground = false) {
    const url = state.syncSettings.sheetUrl;
    if (!url) {
      if (!isBackground) alert("Vui lòng cấu hình URL Google Sheets trước!");
      return;
    }

    state.syncSettings.status = 'syncing';
    updateSyncStatusUI();

    try {
      let rawData = [];

      // Kiểm tra xem là Web App Apps Script hay Google Sheets link thường
      if (url.includes('script.google.com') && url.includes('/exec')) {
        // Gọi Web App API
        const fetchUrl = url + (url.includes('?') ? '&' : '?') + 't=' + Date.now();
        const response = await fetch(fetchUrl);
        if (!response.ok) throw new Error("Không thể kết nối Apps Script API");
        rawData = await response.json();
      } else {
        // Link Google Sheets thường -> Chuyển thành link xuất CSV
        let sheetId = '';
        const match = url.match(/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
        if (match) {
          sheetId = match[1];
        } else {
          throw new Error("Đường dẫn Google Sheets không hợp lệ.");
        }

        const csvExportUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&timestamp=${Date.now()}`;
        const response = await fetch(csvExportUrl);
        
        if (!response.ok) throw new Error("Không thể truy xuất Sheet.");
        
        const text = await response.text();
        
        // Kiểm tra xem có bị chuyển hướng đến trang đăng nhập Google (Private Sheet) không
        if (text.includes('<!DOCTYPE html>') || text.includes('<html')) {
          state.syncSettings.status = 'error';
          updateSyncStatusUI();
          if (!isBackground) {
            alert("⚠️ Lỗi truy cập: Sheet hiện đang để ở chế độ RIÊNG TƯ.\n\nHướng dẫn:\n1. Bật quyền chia sẻ sang 'Bất kỳ ai có liên kết đều có thể xem' (View-only).\n2. Hoặc cấu hình Google Apps Script theo hướng dẫn phía dưới.");
          }
          return;
        }

        rawData = parseCSVToJSON(text);
      }

      // Xử lý và thay thế leads từ Sheet
      if (rawData && rawData.length > 0) {
        if (typeof window.sanitizeObject === 'function') {
          rawData = window.sanitizeObject(rawData);
        }
        replaceLeadsFromSheet(rawData);
      } else {
        // Sheet trống → xóa hết leads local
        state.leads = [];
        saveState('leads');
        if (typeof triggerTabRefresh === 'function') triggerTabRefresh('tab-dashboard');
        if (typeof calculateKPIs === 'function') calculateKPIs();
      }

      state.syncSettings.status = 'idle';
      state.syncSettings.lastSync = new Date().toISOString();
      saveState('settings');
      updateSyncStatusUI();

    } catch (error) {
      console.error("Lỗi đồng bộ sheets:", error);
      state.syncSettings.status = 'error';
      updateSyncStatusUI();
      if (!isBackground) {
        alert("Lỗi đồng bộ Google Sheets: " + error.message);
      }
    }
  }

  // Phân tích văn bản CSV thành mảng JSON
  function parseCSVToJSON(csvText) {
    // Tận dụng XLSX (SheetJS) tải từ CDN nếu có
    if (window.XLSX) {
      const workbook = XLSX.read(csvText, { type: 'string' });
      const sheetName = workbook.SheetNames[0];
      return XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
    }

    // Fallback: Split dòng thủ công đơn giản
    const lines = csvText.split(/\r?\n/);
    if (lines.length === 0) return [];
    
    // Tách dòng tiêu đề đầu
    const headers = splitCSVLine(lines[0]);
    const result = [];

    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      const values = splitCSVLine(lines[i]);
      const obj = {};
      
      for (let j = 0; j < headers.length; j++) {
        // Làm sạch tiêu đề cột
        const header = headers[j] ? headers[j].trim() : `Col_${j}`;
        obj[header] = values[j] ? values[j].trim() : '';
      }
      result.push(obj);
    }
    return result;
  }

  // Hàm phụ trợ split dòng CSV có tính đến dấu ngoặc kép
  function splitCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.replace(/^"|"$/g, ''));
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.replace(/^"|"$/g, ''));
    return result;
  }

  // ═══════════════════════════════════════════════════════════════
  // SHEET-FIRST: Thay thế toàn bộ state.leads từ dữ liệu Sheet
  // Sheet là SSOT — không cần merge phức tạp, không cần blacklist
  // ═══════════════════════════════════════════════════════════════
  function replaceLeadsFromSheet(sheetRows) {
    let newCount = 0;

    // Chuyển đổi từng dòng Sheet → lead object
    const sheetLeads = [];
    sheetRows.forEach(row => {
      const mapping = mapRowFields(row);
      if (!mapping.name && !mapping.phone) return; // Bỏ dòng trống

      // Chuẩn hóa SĐT
      let cleanPhone = (mapping.phone || '').toString().replace(/[^\d]/g, '');
      if (cleanPhone.startsWith('84')) cleanPhone = '0' + cleanPhone.slice(2);
      else if (cleanPhone.length === 9 && /^[98753]/.test(cleanPhone)) cleanPhone = '0' + cleanPhone;

      // Giữ lại ID + notes + quotes từ local nếu SĐT khớp (không mất dữ liệu đã làm)
      const existing = state.leads.find(l =>
        l.phone && l.phone.replace(/[^\d]/g, '') === cleanPhone
      );

      const lead = {
        id:         existing?.id || 'lead_' + cleanPhone + '_' + Date.now(),
        name:       mapping.name       || '',
        phone:      cleanPhone,
        email:      mapping.email      || '',
        source:     mapping.source     || existing?.source || '',
        channel:    mapping.channel    || existing?.channel || '',
        status:     normalizeSheetStatus(mapping.status) || existing?.status || 'new',
        priority:   mapping.priority   || existing?.priority || 'medium',
        category:   mapping.category   || existing?.category || 'retail_regular',
        company:    mapping.company    || '',
        role:       mapping.role       || '',
        formType:   mapping.formType   || '',
        facilityType:      mapping.facilityType      || '',
        interestedIn:      mapping.interestedIn      || '',
        purchaseScale:     mapping.purchaseScale     || '',
        deliveryFrequency: mapping.deliveryFrequency || '',
        deliveryArea:      mapping.deliveryArea      || '',
        needBy:     mapping.needBy     || '',
        message:    mapping.message    || '',
        selectedItems:  mapping.selectedItems  || '',
        selectedCount:  mapping.selectedCount  || '',
        cartItems:      mapping.cartItems      || '',
        submittedAt:    mapping.submittedAt    || '',
        createdAt:      mapping.submittedAt || existing?.createdAt || new Date().toISOString(),
        updatedAt:      new Date().toISOString(),
        // Giữ nguyên notes & quotes đã làm trên Admin
        notes:  Array.isArray(existing?.notes)  ? existing.notes  : [],
        quotes: Array.isArray(existing?.quotes) ? existing.quotes : []
      };

      // Zalo fields
      if (mapping.zaloUserId)      lead.zaloUserId      = mapping.zaloUserId;
      if (mapping.zaloDisplayName) lead.zaloDisplayName = mapping.zaloDisplayName;

      // Nếu là lead hoàn toàn mới → thêm note + trigger Supabase order nếu cần
      if (!existing) {
        newCount++;
        if (lead.message && lead.message.includes('Mã đơn:') &&
            window.supabaseModule && typeof window.supabaseModule.syncLeadStatus === 'function') {
          setTimeout(() => {
            window.supabaseModule.syncLeadStatus(lead, '', lead.status, 'Tự động tạo đơn hàng từ Zalo App').catch(console.error);
          }, 500);
        }
      }

      sheetLeads.push(lead);
    });

    // Xóa quotes mồ côi (lead không còn trên Sheet)
    if (window.state && window.state.quotes) {
      const sheetIds = new Set(sheetLeads.map(l => l.id));
      const orphanLeads = state.leads.filter(l => !sheetIds.has(l.id));
      orphanLeads.forEach(ol => {
        const orphanedQuotes = window.state.quotes.filter(q => q.leadId === ol.id);
        if (orphanedQuotes.length > 0) {
          orphanedQuotes.forEach(q => {
            if (window.supabaseModule && window.supabaseModule.deleteQuoteByLocalId) {
              window.supabaseModule.deleteQuoteByLocalId(q.id).catch(console.error);
            }
          });
          window.state.quotes = window.state.quotes.filter(q => q.leadId !== ol.id);
          localStorage.setItem('tps1_quotes', JSON.stringify(window.state.quotes));
        }
      });
    }

    // ✅ Replace hoàn toàn — Sheet là SSOT
    state.leads = sheetLeads;
    saveState('leads');

    // Thông báo nếu có lead mới
    if (newCount > 0) {
      showToastNotification(`🔔 ${newCount} lead mới vừa được đồng bộ từ Google Sheet!`);
    }

    // Refresh UI
    const activeNavItem = document.querySelector('.sidebar-nav .nav-item.active');
    const activeTab = activeNavItem ? activeNavItem.getAttribute('data-tab') : 'tab-dashboard';
    if (typeof triggerTabRefresh === 'function') triggerTabRefresh(activeTab);
    if (typeof calculateKPIs === 'function') calculateKPIs();
    if (typeof renderRecentLeads === 'function') renderRecentLeads();
  }


    let newLeadsAdded = 0;
    let leadsUpdated = 0;
    const processedLeadIds = new Set(); // Track exactly which leads were matched or created

    // Tải danh sách SĐT đã xóa (blacklist) - để tránh lead bị phục hồi sau mỗi lần sync
    const deletedPhones = JSON.parse(localStorage.getItem('tps1_deleted_phones') || '[]');

    newDataArray.forEach(row => {
      // Tìm kiếm các cột tương ứng
      const mapping = mapRowFields(row);
      if (!mapping.name || !mapping.phone) return; // Bắt buộc phải có tên và điện thoại

      // Làm sạch số điện thoại
      let cleanPhone = (mapping.phone || '').toString().replace(/[^\d]/g, '');
      if (cleanPhone.startsWith('84')) cleanPhone = '0' + cleanPhone.slice(2);
      else if (cleanPhone.length === 9 && /^[98753]/.test(cleanPhone)) cleanPhone = '0' + cleanPhone;

      // ⛔ Bỏ qua nếu SĐT này đã bị xóa bởi Admin
      if (deletedPhones.includes(cleanPhone)) return;

      // Tìm kiếm trong kho leads hiện có
      const existingIdx = state.leads.findIndex(l => {
        const phoneMatch = l.phone.replace(/[^0-9+]/g, '') === cleanPhone;
        if (!phoneMatch) return false;
        
        // 1. Cố gắng match bằng Mã đơn trước (chính xác tuyệt đối cho đơn Zalo)
        const getOrderCode = (msg) => msg ? (msg.match(/Mã đơn:\s*(DH\d+)/)?.[1]) : null;
        const mappedCode = getOrderCode(mapping.message);
        const lCode = getOrderCode(l.message);
        if (mappedCode && lCode && mappedCode === lCode) {
           return true;
        }
        
        // 2. Nếu có mapping.submittedAt, kiểm tra xem lead này có khớp submittedAt không
        if (mapping.submittedAt) {
          if (l.submittedAt) {
            return l.submittedAt === mapping.submittedAt;
          } else {
            // L.submittedAt trống (dữ liệu cũ từ đợt sync trước)
            // Khớp luôn để lấy submittedAt mới, nhưng bỏ qua nếu đã đóng
            if (['won', 'unqualified', 'canceled'].includes(l.status)) {
              return false; 
            }
            return true;
          }
        }
        
        // Fallback về merge theo SĐT (dành cho sheet không có cột thời gian)
        if (['won', 'unqualified', 'canceled'].includes(l.status)) {
          return false; 
        }
        return true;
      });

      if (existingIdx !== -1) {
        // Đã tồn tại -> Cập nhật thông tin cá nhân (Tên, Email, Kênh) nếu đổi
        let hasChange = false;
        const currentLead = state.leads[existingIdx];

        if (mapping.name && currentLead.name !== mapping.name) { currentLead.name = mapping.name; hasChange = true; }
        if (mapping.email && currentLead.email !== mapping.email) { currentLead.email = mapping.email; hasChange = true; }
        if (mapping.source && currentLead.source !== mapping.source) { currentLead.source = mapping.source; hasChange = true; }
        
        // Cập nhật submittedAt cho dữ liệu cũ
        if (mapping.submittedAt && !currentLead.submittedAt) {
          currentLead.submittedAt = mapping.submittedAt;
          hasChange = true;
        }

        // Cập nhật phân loại nếu thay đổi trên Sheets
        if (mapping.category && currentLead.category !== mapping.category) { 
          currentLead.category = mapping.category; 
          hasChange = true; 
        }

        // Cập nhật trạng thái nếu thay đổi trên Sheets
        const nextStatus = mapping.status ? normalizeSheetStatus(mapping.status) : '';
        if (nextStatus && currentLead.status !== nextStatus) {
          const statusOrder = { new: 1, contacting: 2, quoting: 3, quoted: 4, won: 5, unqualified: 6, canceled: 6 };
          const currentRank = statusOrder[currentLead.status] || 0;
          const nextRank = statusOrder[nextStatus] || 0;

          // Chỉ cập nhật từ Sheet nếu trạng thái trên Sheet tiến xa hơn trạng thái local hiện tại
          // Điều này giúp tránh việc kéo dữ liệu cũ từ Sheet đè mất trạng thái đã xử lý ở Admin
          if (nextRank > currentRank) {
            const oldStatus = currentLead.status;
            currentLead.status = nextStatus;
            hasChange = true;

            const statusLabels = {
              new: 'Mới',
              contacting: 'Đã liên hệ',
              quoting: 'Đang báo giá',
              quoted: 'Đã báo giá',
              won: 'Đã chốt đơn',
              unqualified: 'Không tiềm năng',
              canceled: 'Hủy'
            };
            
            currentLead.notes.push({
              timestamp: new Date().toISOString(),
              author: "Hệ thống",
              text: `Đồng bộ trạng thái từ Google Sheets: <strong>${statusLabels[normalizeSheetStatus(oldStatus)] || oldStatus}</strong> -> <strong>${statusLabels[nextStatus] || nextStatus}</strong>`
            });
          }
        }

        // Cập nhật các trường khảo sát báo giá nếu thay đổi hoặc chưa có trên hệ thống
        if (mapping.message && mapping.message !== currentLead.message) {
          currentLead.message = mapping.message; 
          hasChange = true;
          
          // NẾU LÀ ĐƠN ZALO MỚI CỦA KHÁCH CŨ (Lead đã có nhưng Message thay đổi sang mã đơn mới)
          if (currentLead.message.includes('Mã đơn:') && window.supabaseModule && typeof window.supabaseModule.syncLeadStatus === 'function') {
            setTimeout(() => {
              window.supabaseModule.syncLeadStatus(currentLead, '', currentLead.status, 'Tự động tạo đơn hàng từ Zalo App (Khách cũ)').catch(console.error);
            }, 500);
          }
        }
        const surveyFields = ['role', 'formType', 'channel', 'company', 'facilityType', 'interestedIn', 'purchaseScale', 'deliveryFrequency', 'deliveryArea', 'needBy', 'message', 'selectedItems', 'selectedCount', 'cartItems'];

        surveyFields.forEach(field => {
          if (mapping[field] !== undefined && currentLead[field] !== mapping[field]) {
            currentLead[field] = mapping[field];
            hasChange = true;
          }
        });

        if (hasChange) {
          currentLead.updatedAt = new Date().toISOString();
          leadsUpdated++;
        }
        
        processedLeadIds.add(currentLead.id);
      } else {
        // Chưa tồn tại -> Thêm mới với trạng thái đồng bộ hoặc mặc định "Mới" (new)
        const newLead = {
          id: 'lead_' + (Date.now() + newLeadsAdded), // Đảm bảo ID không trùng
          name: mapping.name,
          phone: cleanPhone,
          email: mapping.email || '',
          source: mapping.source || 'Website',
          status: normalizeSheetStatus(mapping.status),
          priority: mapping.priority || 'medium',
          category: mapping.category || 'retail_regular',
          notes: [
            {
              timestamp: new Date().toISOString(),
              author: "Hệ thống",
              text: `Lead đồng bộ tự động từ Google Sheet. Ghi chú gốc: ${mapping.rawNotes || 'Không có'}`
            }
          ],
          quotes: [],
          createdAt: mapping.submittedAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          submittedAt: mapping.submittedAt || '', // Lưu lại thời điểm submit để check trùng
          // Các trường khảo sát báo giá
          role: mapping.role || '',
          formType: mapping.formType || '',
          channel: mapping.channel || '',
          company: mapping.company || '',
          facilityType: mapping.facilityType || '',
          interestedIn: mapping.interestedIn || '',
          purchaseScale: mapping.purchaseScale || '',
          deliveryFrequency: mapping.deliveryFrequency || '',
          deliveryArea: mapping.deliveryArea || '',
          needBy: mapping.needBy || '',
          message: mapping.message || '',
          selectedItems: mapping.selectedItems || '',
          selectedCount: mapping.selectedCount || '',
          cartItems: mapping.cartItems || ''   // JSON từ cột "Giỏ hàng", dùng để parse item+qty chính xác

        };

        state.leads.push(newLead);
        newLeadsAdded++;
        processedLeadIds.add(newLead.id);

        // Tự động tạo báo giá (đơn hàng) lên Supabase nếu là đơn từ Zalo Mini App
        if (newLead.message && newLead.message.includes('Mã đơn:') && window.supabaseModule && typeof window.supabaseModule.syncLeadStatus === 'function') {
           setTimeout(() => {
             window.supabaseModule.syncLeadStatus(newLead, '', newLead.status, 'Tự động tạo đơn hàng từ Zalo App').catch(console.error);
           }, 500);
        }

        // Phát thông báo nổi
        showToastNotification(`🔔 Lead mới: ${newLead.name} (${newLead.phone}) vừa được đồng bộ về!`);
      }
    });

    // Xóa các lead cũ không còn trên Sheet (nhưng giữ lại lead tạo bằng tay)
    // Chạy cả background và manual sync
    {
      const initialCount = state.leads.length;
      state.leads = state.leads.filter(l => {
        // Có trong sheet lần này
        if (processedLeadIds.has(l.id)) return true;
        
        // Nếu không có trong sheet lần này, kiểm tra xem nó có phải lead TỪNG ĐƯỢC ĐỒNG BỘ TỪ SHEET không
        const isFromSheet = (l.submittedAt && l.submittedAt !== '') || 
                            (l.notes && l.notes.some(n => n.text && n.text.includes('Lead đồng bộ tự động từ Google Sheet')));
        
        if (isFromSheet) {
          // Khi xoá lead do mất dòng trên Google Sheets, ta xoá luôn các báo giá liên kết để tránh rác
          if (window.state && window.state.quotes) {
            const orphanedQuotes = window.state.quotes.filter(q => q.leadId === l.id);
            if (orphanedQuotes.length > 0) {
              orphanedQuotes.forEach(q => {
                if (window.supabaseModule && window.supabaseModule.deleteQuoteByLocalId) {
                  window.supabaseModule.deleteQuoteByLocalId(q.id).catch(console.error);
                }
              });
              window.state.quotes = window.state.quotes.filter(q => q.leadId !== l.id);
              localStorage.setItem('tps1_quotes', JSON.stringify(window.state.quotes));
              if (window.quoteModule && window.quoteModule.renderSavedQuotesList) {
                setTimeout(window.quoteModule.renderSavedQuotesList, 500);
              }
            }
          }
          return false; // Xóa lead từ sheet nhưng không còn trên sheet
        }
        
        return true; // Giữ lại lead thủ công
      });
      
      if (initialCount > state.leads.length) {
        leadsUpdated += (initialCount - state.leads.length);
      }
    }

    if (newLeadsAdded > 0 || leadsUpdated > 0) {
      saveState('leads');
      
      // Refresh giao diện hiện tại
      const activeNavItem = document.querySelector('.sidebar-nav .nav-item.active');
      const activeTab = activeNavItem ? activeNavItem.getAttribute('data-tab') : 'tab-dashboard';
      if (typeof triggerTabRefresh === 'function') {
        triggerTabRefresh(activeTab);
      }
      
      // Tính lại KPI trang chủ
      calculateKPIs();
      renderRecentLeads();
    }
  }

  // Hàm ánh xạ tiêu đề cột mềm dẻo (Fuzzy Column Mapping)
  function mapRowFields(row) {
    const keys = Object.keys(row);
    const mapping = {
      name: '',
      phone: '',
      email: '',
      source: '',
      category: '',
      priority: 'medium',
      status: '',
      rawNotes: '',
      // Khảo sát báo giá bổ sung
      role: '',
      formType: '',
      channel: '',
      company: '',
      facilityType: '',
      interestedIn: '',
      purchaseScale: '',
      deliveryFrequency: '',
      deliveryArea: '',
      needBy: '',
      message: '',
      selectedItems: '',
      selectedCount: '',
      submittedAt: '',  // Thời gian submit
      // Delivery info (structured - từ Zalo Mini App hoặc website form)
      deliveryType:    '',
      deliveryAddress: '',
      deliveryAlias:   ''
    };

    keys.forEach(k => {
      const lowerKey = k.toLowerCase().replace(/_/g, '').trim();

      // Bỏ qua các cột hệ thống của Zalo để tránh ghi đè nhầm (ví dụ: Zalo Display Name, Zalo Phone Token)
      if (lowerKey.includes('zalo') || lowerKey.includes('token') || lowerKey.includes('userid')) {
        return; 
      }

      // Ánh xạ Tên (camelCase + Vietnamese) - Ưu tiên cột đầu tiên tìm thấy
      if (!mapping.name && (lowerKey.includes('tên') || lowerKey.includes('name') || lowerKey === 'họ tên' || lowerKey === 'hotên' || lowerKey === 'khách hàng' || lowerKey === 'khachhang')) {
        mapping.name = row[k];
      }
      // Ánh xạ SĐT (camelCase + Vietnamese)
      else if (!mapping.phone && (lowerKey.includes('sđt') || lowerKey.includes('đt') || lowerKey.includes('phone') || lowerKey.includes('thoại') || lowerKey === 'số điện thoại')) {
        mapping.phone = row[k];
      }
      // Ánh xạ Email
      else if (!mapping.email && (lowerKey.includes('email') || lowerKey.includes('thư'))) {
        mapping.email = row[k];
      }
      // Ánh xạ Kênh Nguồn (camelCase: source, kenh)
      else if (!mapping.source && (lowerKey === 'source' || lowerKey === 'nguồn' || lowerKey === 'kenh' || lowerKey === 'kênh')) {
        mapping.source = row[k];
      }
      // Ánh xạ Ghi chú gốc
      else if (lowerKey.includes('chú') || lowerKey.includes('note') || lowerKey.includes('dung') || lowerKey.includes('nhu cầu')) {
        mapping.rawNotes = row[k];
      }
      // Ánh xạ Phân loại nhóm
      else if (lowerKey.includes('nhóm') || lowerKey.includes('phân loại') || lowerKey.includes('loại') || lowerKey === 'category') {
        const val = row[k].toString().toLowerCase();
        if (val.includes('nhà hàng') || val.includes('quán') || val.includes('sỉ') || val.includes('restaurant')) {
          mapping.category = 'wholesale_restaurant';
        } else if (val.includes('đại lý') || val.includes('phân phối') || val.includes('agency')) {
          mapping.category = 'wholesale_agency';
        } else if (val.includes('vip')) {
          mapping.category = 'retail_vip';
        } else {
          mapping.category = 'retail_regular';
        }
      }
      // Ánh xạ Mức ưu tiên
      else if (lowerKey.includes('tiên') || lowerKey.includes('priority')) {
        const val = row[k].toString().toLowerCase().trim();
        if (val.includes('cao') || val.includes('high')) mapping.priority = 'high';
        else if (val.includes('thấp') || val.includes('low')) mapping.priority = 'low';
        else mapping.priority = 'medium';
      }
      // Ánh xạ Trạng thái
      else if (lowerKey.includes('trạng thái') || lowerKey.includes('trangthai') || lowerKey === 'status') {
        const val = row[k].toString().toLowerCase().trim();
        if (val.includes('mới') || val.includes('tiep nhan') || val.includes('new')) {
          mapping.status = 'new';
        } else if (val.includes('đã liên hệ') || val.includes('da lien he') || val.includes('liên hệ') || val.includes('lien he') || val.includes('contact')) {
          mapping.status = 'contacting';
        } else if (val.includes('đang báo giá') || val.includes('dang bao gia') || val.includes('quoting')) {
          mapping.status = 'quoting';
        } else if (val.includes('đã báo giá') || val.includes('da bao gia') || val.includes('da gui bao gia') || val.includes('quoted') || val.includes('báo giá') || val.includes('bao gia')) {
          mapping.status = 'quoted';
        } else if (val.includes('đã chốt đơn') || val.includes('da chot don') || val.includes('chốt') || val.includes('chot') || val.includes('won')) {
          mapping.status = 'won';
        } else if (val.includes('không tiềm năng') || val.includes('khong tiem nang') || val.includes('thất bại') || val.includes('that bai') || val.includes('lost')) {
          mapping.status = 'unqualified';
        } else if (val.includes('hủy') || val.includes('huy') || val.includes('cancel')) {
          mapping.status = 'canceled';
        }
      }
      // Ánh xạ Vai trò
      else if (lowerKey === 'vai trò' || lowerKey === 'vaitro' || lowerKey === 'vaitrò' || lowerKey === 'role') {
        mapping.role = row[k];
      }
      // Ánh xạ Loại form
      else if (lowerKey === 'loại form' || lowerKey === 'loaiform' || lowerKey === 'formtype' || lowerKey === 'form type' || lowerKey === 'loaiForm'.toLowerCase()) {
        mapping.formType = row[k];
      }
      // Ánh xạ Kênh liên hệ (cột D của sheet)
      else if (lowerKey === 'kenh' || lowerKey === 'channel') {
        mapping.channel = row[k];
      }
      // Ánh xạ Công ty
      else if (lowerKey === 'company' || lowerKey === 'công ty' || lowerKey === 'congty' || lowerKey === 'công ty / đơn vị') {
        mapping.company = row[k];
      }
      // Ánh xạ Loại hình đơn vị
      else if (lowerKey === 'facility type' || lowerKey === 'facilitytype' || lowerKey === 'loại hình đơn vị' || lowerKey === 'loaihinhdonvi') {
        mapping.facilityType = row[k];
      }
      // Ánh xạ Mặt hàng quan tâm
      else if (lowerKey === 'interested in' || lowerKey === 'interestedin' || lowerKey === 'mặt hàng quan tâm' || lowerKey === 'mathangquantam' || lowerKey === 'nhóm hàng quan tâm') {
        mapping.interestedIn = row[k];
      }
      // Ánh xạ Quy mô nhu cầu
      else if (lowerKey === 'purchase scale' || lowerKey === 'purchasescale' || lowerKey === 'quy mô nhu cầu' || lowerKey === 'quymonhucau') {
        mapping.purchaseScale = row[k];
      }
      // Ánh xạ Tần suất giao hàng
      else if (lowerKey === 'delivery frequency' || lowerKey === 'deliveryfrequency' || lowerKey === 'tần suất giao' || lowerKey === 'tansuatgiao') {
        mapping.deliveryFrequency = row[k];
      }
      // Ánh xạ Khu vực giao hàng
      else if (lowerKey === 'delivery area' || lowerKey === 'deliveryarea' || lowerKey === 'khu vực giao' || lowerKey === 'khuvucgiao') {
        mapping.deliveryArea = row[k];
      }
      // Ánh xạ Thời gian cần hàng
      else if (lowerKey === 'need by' || lowerKey === 'needby' || lowerKey === 'cần trước' || lowerKey === 'cantruoc') {
        mapping.needBy = row[k];
      }
      // Ánh xạ Tin nhắn / Lời nhắn
      else if (lowerKey === 'message' || lowerKey === 'mô tả nhu cầu' || lowerKey === 'nhu cầu' || lowerKey === 'lời nhắn') {
        mapping.message = row[k];
      }
      // Ánh xạ Sản phẩm đã chọn (text)
      else if (lowerKey === 'selected items' || lowerKey === 'selecteditems' || lowerKey === 'selectedproducts' || lowerKey === 'selected products' || lowerKey === 'sản phẩm đã chọn') {
        mapping.selectedItems = row[k];
      }
      // Ánh xạ Số lượng mặt hàng
      else if (lowerKey === 'selected count' || lowerKey === 'selectedcount' || lowerKey === 'số sản phẩm' || lowerKey === 'soluongchon' || lowerKey === 'số lượng chọn') {
        mapping.selectedCount = row[k];
      }
      // Ánh xạ Giỏ hàng (cột mới thay thế Raw Payload)
      else if (lowerKey === 'giỏ hàng' || lowerKey === 'giohang' || lowerKey === 'cart' || lowerKey === 'cart items') {
        mapping.cartItems = row[k];
      }
      // Giữ backward compat với Raw Payload cũ (nếu còn rows cũ)
      else if (lowerKey === 'rawpayload' || lowerKey === 'raw payload' || lowerKey === 'raw_payload') {
        mapping.rawNotes = row[k];
      }
      // Ánh xạ Submitted At (Thời gian gửi form)
      else if (lowerKey === 'submitted at' || lowerKey === 'submittedat' || lowerKey === 'timestamp' || lowerKey === 'thời gian' || lowerKey === 'thoigian' || lowerKey === 'ngày') {
        mapping.submittedAt = row[k];
      }
      // Ánh xạ Delivery Type (loại giao hàng: shipping/pickup)
      else if (lowerKey === 'deliverytype' || lowerKey === 'delivery type' || lowerKey === 'loại giao hàng') {
        mapping.deliveryType = row[k];
      }
      // Ánh xạ Delivery Address (địa chỉ giao hàng)
      else if (lowerKey === 'deliveryaddress' || lowerKey === 'delivery address' || lowerKey === 'địa chỉ giao hàng' || lowerKey === 'địa chỉ') {
        mapping.deliveryAddress = row[k];
      }
      // Ánh xạ Delivery Alias (nhãn địa chỉ: Nhà riêng / Công ty)
      else if (lowerKey === 'deliveryalias' || lowerKey === 'delivery alias' || lowerKey === 'nhãn địa chỉ') {
        mapping.deliveryAlias = row[k];
      }
    });

    // Cung cấp giá trị fallback cho Kênh MKT nếu trống
    if (!mapping.source) mapping.source = 'Website';
    if (mapping.rawNotes && !mapping.rawNotes.trim()) mapping.rawNotes = '';
    // cartItems có thể là JSON string hoặc text - giữ nguyên để UI tự format
    if (mapping.cartItems === undefined) mapping.cartItems = mapping.selectedItems || '';

    return mapping;
  }

  // 5. KHU VỰC KÉO THẢ FILE LOCAL (CustomerProfit.xls)
  function initFileDragDrop() {
    const dragZone = document.getElementById('file-drag-zone');
    const fileInput = document.getElementById('file-file-input');
    const resultBox = document.getElementById('file-parse-result');
    const confirmBtn = document.getElementById('file-import-confirm-btn');
    
    let parsedLeadsTemp = [];

    if (!dragZone) return;

    // Click chọn tệp
    dragZone.addEventListener('click', () => {
      fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) handleFileParse(file);
    });

    // Kéo thả hover
    dragZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dragZone.classList.add('dragover');
    });

    dragZone.addEventListener('dragleave', () => {
      dragZone.classList.remove('dragover');
    });

    dragZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dragZone.classList.remove('dragover');
      
      const file = e.dataTransfer.files[0];
      if (file) handleFileParse(file);
    });

    // Xử lý phân giải file bằng SheetJS
    function handleFileParse(file) {
      if (!window.XLSX) {
        alert("Chưa tải được thư viện SheetJS XLSX. Vui lòng kiểm tra lại kết nối mạng!");
        return;
      }

      const reader = new FileReader();
      
      reader.onload = function(e) {
        try {
          const data = e.target.result;
          const workbook = XLSX.read(data, { type: 'binary' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const json = XLSX.utils.sheet_to_json(worksheet);

          if (json.length === 0) {
            alert("Tệp rỗng hoặc không đúng định dạng!");
            return;
          }

          parsedLeadsTemp = json;

          // Hiển thị kết quả lên giao diện
          document.getElementById('file-name-span').innerText = file.name;
          document.getElementById('file-leads-count').innerText = json.length;
          resultBox.classList.remove('hidden');

          showToastNotification(`Đã đọc thành công tệp Excel với ${json.length} dòng!`);

        } catch (err) {
          console.error("Lỗi parse file Excel:", err);
          alert("Lỗi đọc tệp Excel: Vui lòng đảm bảo tệp thuộc định dạng .xls, .xlsx hoặc .csv hợp lệ.");
        }
      };

      reader.readAsBinaryString(file);
    }

    // Xác nhận lưu vào local system
    confirmBtn.addEventListener('click', () => {
      if (parsedLeadsTemp.length === 0) return;

      mergeLeadsData(parsedLeadsTemp, false);
      
      // Xóa bộ nhớ tạm & ẩn kết quả
      parsedLeadsTemp = [];
      resultBox.classList.add('hidden');
      fileInput.value = '';

      showToastNotification("Đã lưu và đồng bộ toàn bộ dữ liệu tệp Excel vào hệ thống!");
    });
  }

  // 6. Ghi dữ liệu thời gian thực lên Google Sheets (Thêm / Xóa)
  async function syncWriteGoogleSheets(action, data) {
    const url = state.syncSettings.sheetUrl;
    if (!url) return;
    
    // Chỉ đồng bộ nếu là Web App Apps Script URL
    if (!url.includes('script.google.com') || !url.includes('/exec')) {
      console.log("Không đồng bộ ghi: Link không phải Google Apps Script Web App");
      if (typeof showToastNotification === 'function') {
        showToastNotification("⚠️ Cấu hình Google Sheets hiện tại (docs.google.com) chỉ hỗ trợ lấy dữ liệu. Để đẩy dữ liệu hai chiều, vui lòng cài đặt Apps Script.", 5000);
      }
      return;
    }

    try {
      console.log(`Đang gửi yêu cầu đồng bộ thời gian thực: ${action} lead...`);
      // Sử dụng Content-Type text/plain để tránh CORS preflight pre-check trên Apps Script Web App
      await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8'
        },
        body: JSON.stringify({
          action: action,
          data: data
        })
      });
      console.log(`Đồng bộ ghi Google Sheets thành công (${action}).`);
    } catch (error) {
      console.error(`Lỗi đồng bộ ghi Google Sheets (${action}):`, error);
    }
  }

  // Export module để sử dụng toàn cục
  window.sheetsModule = {
    initSettingsView: initSettingsView,
    startAutoSync: startAutoSync,
    syncGoogleSheets: syncGoogleSheets,
    syncWriteGoogleSheets: syncWriteGoogleSheets
  };
})();
