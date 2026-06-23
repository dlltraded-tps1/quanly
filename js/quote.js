// QUOTE BUILDER & INVOICE GENERATOR: THỰC PHẨM SỐ MỘT

(function() {
  // Trạng thái đơn hàng hiện tại đang soạn thảo
  let activeQuote = {
    id: null,
    leadId: '',
    priceType: 'wholesale', // wholesale hoặc retail
    items: [],
    discount: 0,
    shipping: 0,
    vatRate: 8,
    deposit: 0,
    note: '',
    status: 'draft',
    result: '',
    createdAt: null,
    updatedAt: null,
    sentAt: null,
    closedAt: null,
    history: [],
    quoteCode: ''
  };

  let pendingDeleteQuote = {
    quoteId: null,
    leadId: null,
    quoteCode: ''
  };

  // Khởi tạo các sự kiện liên quan khi load trang
  document.addEventListener('DOMContentLoaded', () => {
    setupQuoteListeners();
  });

  function setupQuoteListeners() {
    const leadSelector = document.getElementById('quote-lead-selector');
    const productSelector = document.getElementById('quote-product-selector');
    const addItemBtn = document.getElementById('quote-add-item-btn');
    const priceWholesaleRadio = document.getElementById('price-type-wholesale');
    const priceRetailRadio = document.getElementById('price-type-retail');
    
    const discountInput = document.getElementById('quote-discount-input');
    const shippingInput = document.getElementById('quote-shipping-input');
    const vatRateInput = document.getElementById('quote-vat-rate-input');
    const depositInput = document.getElementById('quote-deposit-input');
    const noteInput = document.getElementById('quote-note-input');

    const resetBtn = document.getElementById('quote-reset-btn');
    const saveBtn = document.getElementById('quote-save-btn');
    const copyZaloBtn = document.getElementById('quote-copy-zalo-btn');
    const printBtn = document.getElementById('quote-print-btn');
    const previewContainer = document.getElementById('quote-preview-container');
    const previewPrintBtn = document.getElementById('quote-preview-print-btn');
    const previewCloseBtn = document.getElementById('quote-preview-close-btn');
    const savedQuotesBody = document.getElementById('saved-quotes-body');
    const quoteMgmtSearch = document.getElementById('quote-management-search');
    const quoteMgmtStatusFilter = document.getElementById('quote-management-status-filter');
    const quoteMgmtRefreshBtn = document.getElementById('quote-management-refresh-btn');
    const quoteHistoryModal = document.getElementById('quote-history-modal');
    const quoteHistoryModalBody = document.getElementById('quote-history-modal-body');
    const quoteHistoryModalTitle = document.getElementById('quote-history-modal-title');
    const quoteHistoryModalClose = document.getElementById('quote-history-modal-close');
    const quoteHistoryModalOverlay = document.getElementById('quote-history-modal-overlay');
    const quoteStatusModalClose = document.getElementById('quote-status-modal-close');
    const quoteStatusModalOverlay = document.getElementById('quote-status-modal-overlay');
    const quoteStatusCancelBtn = document.getElementById('quote-status-cancel-btn');
    const quoteStatusSaveBtn = document.getElementById('quote-status-save-btn');
    const quoteDeleteModal = document.getElementById('quote-delete-modal');
    const quoteDeleteModalOverlay = document.getElementById('quote-delete-modal-overlay');
    const quoteDeleteModalClose = document.getElementById('quote-delete-modal-close');
    const quoteDeleteCancelBtn = document.getElementById('quote-delete-cancel-btn');
    const quoteDeleteConfirmBtn = document.getElementById('quote-delete-confirm-btn');
    const quoteDeleteConfirmCheckbox = document.getElementById('quote-delete-confirm-checkbox');
    const customProductBtn = document.getElementById('quote-add-custom-product-btn');
    const customProductModal = document.getElementById('quote-custom-product-modal');
    const customProductModalOverlay = document.getElementById('quote-custom-product-modal-overlay');
    const customProductModalClose = document.getElementById('quote-custom-product-modal-close');
    const customProductCancelBtn = document.getElementById('quote-custom-product-cancel-btn');
    const customProductSaveBtn = document.getElementById('quote-custom-product-save-btn');

    // 1. Khi chọn khách hàng
    if (leadSelector) {
      leadSelector.addEventListener('change', () => {
        const leadId = leadSelector.value;
        if (!leadId) {
          resetQuoteBuilder();
          return;
        }
        
        loadQuoteForLead(leadId);
      });
    }

    // 2. Khi thay đổi Loại giá (Sỉ/Lẻ)
    [priceWholesaleRadio, priceRetailRadio].forEach(radio => {
      if (radio) {
        radio.addEventListener('change', () => {
          activeQuote.priceType = priceWholesaleRadio.checked ? 'wholesale' : 'retail';
          // Cập nhật lại đơn giá của các mặt hàng đã chọn trong bảng
          recalculateSelectedItemsPrices();
          renderQuoteEditorTable();
          calculateTotals();
        });
      }
    });

    // 3. Thêm mặt hàng
    if (addItemBtn) {
      addItemBtn.addEventListener('click', () => {
        const prodId = productSelector.value;
        const qtyVal = parseFloat(document.getElementById('quote-qty-input').value);

        if (!prodId) {
          alert("Vui lòng chọn một mặt hàng thực phẩm!");
          return;
        }
        if (isNaN(qtyVal) || qtyVal <= 0) {
          alert("Vui lòng nhập số lượng lớn hơn 0!");
          return;
        }

        const product = state.products.find(p => p.id === prodId);
        if (!product) return;

        // Xác định đơn giá theo cấu hình sỉ/lẻ hiện tại
        const unitPrice = activeQuote.priceType === 'wholesale' ? product.price_wholesale : product.price_retail;

        // Kiểm tra xem sản phẩm đã có trong list chưa
        const existingIdx = activeQuote.items.findIndex(item => item.productId === prodId);
        if (existingIdx !== -1) {
          activeQuote.items[existingIdx].qty += qtyVal;
        } else {
          activeQuote.items.push({
            productId: prodId,
            name: product.name,
            unit: product.unit,
            price: unitPrice,
            qty: qtyVal,
            priceSource: 'catalog',
            isCustom: false
          });
        }

        // Reset ô nhập sản phẩm
        productSelector.value = '';
        document.getElementById('quote-qty-input').value = '';

        // Render & Tính toán lại
        renderQuoteEditorTable();
        calculateTotals();
        saveCurrentQuoteToState();
      });
    }

    if (customProductBtn) {
      customProductBtn.addEventListener('click', openCustomProductModal);
    }

    // 4. Lắng nghe thay đổi chiết khấu, vận chuyển, cọc và ghi chú
    if (discountInput) {
      discountInput.addEventListener('input', () => {
        activeQuote.discount = Math.min(100, Math.max(0, parseInt(discountInput.value) || 0));
        calculateTotals();
        saveCurrentQuoteToState();
      });
    }
    if (shippingInput) {
      shippingInput.addEventListener('input', () => {
        activeQuote.shipping = Math.max(0, parseInt(shippingInput.value) || 0);
        calculateTotals();
        saveCurrentQuoteToState();
      });
    }
    if (vatRateInput) {
      vatRateInput.addEventListener('change', () => {
        activeQuote.vatRate = [0, 8, 10].includes(parseInt(vatRateInput.value, 10)) ? parseInt(vatRateInput.value, 10) : 8;
        calculateTotals();
        saveCurrentQuoteToState();
      });
    }
    if (depositInput) {
      depositInput.addEventListener('input', () => {
        activeQuote.deposit = Math.max(0, parseInt(depositInput.value) || 0);
        calculateTotals();
        saveCurrentQuoteToState();
      });
    }
    if (noteInput) {
      noteInput.addEventListener('input', () => {
        activeQuote.note = noteInput.value.trim();
        document.getElementById('inv-note-text').innerText = activeQuote.note || 'Báo giá này mang tính chất tham khảo. Xin quý khách vui lòng liên hệ nhân viên kinh doanh để xác thực thời gian giao hàng và kiểm tra tồn kho.';
        saveCurrentQuoteToState();
      });
    }

    // 5. Nút Đặt lại
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        if (confirm("Bạn có chắc chắn muốn đặt lại và xóa toàn bộ sản phẩm đang soạn?")) {
          resetQuoteBuilder();
        }
      });
    }

    // 5b. Nút Tạo/Lưu báo giá
    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        if (!activeQuote.leadId) {
          showToastNotification('Vui lòng chọn khách hàng trước khi lưu báo giá.');
          return;
        }
        if (activeQuote.items.length === 0) {
          const acceptEmpty = confirm('Báo giá chưa có sản phẩm. Anh vẫn muốn tạo bản nháp chứ?');
          if (!acceptEmpty) return;
        }
        saveCurrentQuoteToState();
        showToastNotification('Đã tạo/lưu báo giá.');
      });
    }

    // 6. Nút Sao chép gửi Zalo
    if (copyZaloBtn) {
      copyZaloBtn.addEventListener('click', () => {
        const lead = state.leads.find(l => l.id === activeQuote.leadId);
        if (!lead) {
          alert("Vui lòng chọn khách hàng trước khi sao chép báo giá!");
          return;
        }
        if (activeQuote.items.length === 0) {
          alert("Báo giá chưa có sản phẩm nào!");
          return;
        }

        const zaloText = generateZaloQuoteText(lead);
        navigator.clipboard.writeText(zaloText)
          .then(() => {
            showToastNotification("Đã sao chép báo giá Zalo! Bạn có thể dán (Ctrl+V) sang chat box Zalo gửi khách hàng.");
            
            // Tự động chuyển trạng thái lead sang "Đã báo giá"
            if (['new', 'contacting', 'quoting'].includes(normalizeLeadStatus(lead.status))) {
              updateLeadField(lead.id, 'status', 'quoted');
            }
          })
          .catch(err => {
            console.error('Lỗi copy clipboard:', err);
            alert('Không thể sao chép tự động. Vui lòng thử lại!');
          });
      });
    }

    // 7. Nút In hóa đơn (PDF)
    if (printBtn) {
      printBtn.addEventListener('click', () => {
        const lead = state.leads.find(l => l.id === activeQuote.leadId);
        if (!lead) {
          alert("Vui lòng chọn khách hàng trước khi in báo giá!");
          return;
        }
        if (activeQuote.items.length === 0) {
          alert("Báo giá chưa có sản phẩm nào!");
          return;
        }

        // Tự động chuyển trạng thái lead sang "Đã báo giá"
        if (['new', 'contacting', 'quoting'].includes(normalizeLeadStatus(lead.status))) {
          updateLeadField(lead.id, 'status', 'quoted');
        }

        openQuotePreview();
      });
    }

    if (previewPrintBtn) {
      previewPrintBtn.addEventListener('click', () => {
        printQuoteInvoice();
      });
    }

    if (previewCloseBtn) {
      previewCloseBtn.addEventListener('click', () => {
        closeQuotePreview();
      });
    }

    if (previewContainer) {
      previewContainer.addEventListener('click', (e) => {
        if (e.target === previewContainer) {
          closeQuotePreview();
        }
      });
    }

    if (quoteMgmtSearch) {
      quoteMgmtSearch.addEventListener('input', () => renderSavedQuotesList());
    }

    if (quoteMgmtStatusFilter) {
      quoteMgmtStatusFilter.addEventListener('change', () => renderSavedQuotesList());
    }

    if (quoteMgmtRefreshBtn) {
      quoteMgmtRefreshBtn.addEventListener('click', async () => {
        if (window.supabaseModule && typeof window.supabaseModule.hydrateQuotesFromSupabase === 'function') {
          await window.supabaseModule.hydrateQuotesFromSupabase().catch(err => console.error('Lỗi kéo báo giá:', err));
        }
        if (window.supabaseModule && typeof window.supabaseModule.hydrateProductsFromSupabase === 'function') {
          await window.supabaseModule.hydrateProductsFromSupabase().catch(err => console.error('Lỗi kéo sản phẩm:', err));
        }
        renderSavedQuotesList();
        showToastNotification('Đã đồng bộ dữ liệu báo giá từ Supabase.');
      });
    }

    if (savedQuotesBody) {
      savedQuotesBody.addEventListener('click', (event) => {
        const button = event.target.closest('button[data-quote-action]');
        if (!button) return;

        const action = button.dataset.quoteAction;
        const quoteId = button.dataset.quoteId || '';
        const leadId = button.dataset.quoteLeadId || '';

        if (action === 'open' && leadId) {
          window.openSavedQuote(leadId);
          return;
        }

        if (action === 'history' && quoteId) {
          window.openQuoteHistory(quoteId);
          return;
        }

        if (action === 'status' && quoteId) {
          openQuoteStatusModal(quoteId);
          return;
        }

        if (action === 'delete' && quoteId) {
          window.deleteSavedQuote(quoteId);
        }
      });
    }

    if (quoteHistoryModalClose) {
      quoteHistoryModalClose.addEventListener('click', closeQuoteHistoryModal);
    }

    if (quoteHistoryModalOverlay) {
      quoteHistoryModalOverlay.addEventListener('click', closeQuoteHistoryModal);
    }

    if (quoteStatusModalClose) {
      quoteStatusModalClose.addEventListener('click', closeQuoteStatusModal);
    }

    if (quoteStatusModalOverlay) {
      quoteStatusModalOverlay.addEventListener('click', closeQuoteStatusModal);
    }

    if (quoteStatusCancelBtn) {
      quoteStatusCancelBtn.addEventListener('click', closeQuoteStatusModal);
    }

    if (quoteStatusSaveBtn) {
      quoteStatusSaveBtn.addEventListener('click', confirmQuoteStatusUpdate);
    }

    if (quoteDeleteConfirmCheckbox && quoteDeleteConfirmBtn) {
      quoteDeleteConfirmCheckbox.addEventListener('change', () => {
        quoteDeleteConfirmBtn.disabled = !quoteDeleteConfirmCheckbox.checked;
      });
    }

    if (quoteDeleteConfirmBtn) {
      quoteDeleteConfirmBtn.addEventListener('click', () => {
        if (!pendingDeleteQuote.quoteId) return;
        performDeleteSavedQuote(pendingDeleteQuote.quoteId);
      });
    }

    if (quoteDeleteCancelBtn) {
      quoteDeleteCancelBtn.addEventListener('click', closeQuoteDeleteModal);
    }

    if (quoteDeleteModalClose) {
      quoteDeleteModalClose.addEventListener('click', closeQuoteDeleteModal);
    }

    if (quoteDeleteModalOverlay) {
      quoteDeleteModalOverlay.addEventListener('click', closeQuoteDeleteModal);
    }

    if (customProductSaveBtn) {
      customProductSaveBtn.addEventListener('click', handleCustomProductSave);
    }

    if (customProductCancelBtn) {
      customProductCancelBtn.addEventListener('click', closeCustomProductModal);
    }

    if (customProductModalClose) {
      customProductModalClose.addEventListener('click', closeCustomProductModal);
    }

    if (customProductModalOverlay) {
      customProductModalOverlay.addEventListener('click', closeCustomProductModal);
    }

    renderSavedQuotesList();
  }

  function openQuotePreview() {
    const previewContainer = document.getElementById('quote-preview-container');
    if (!previewContainer) return;
    previewContainer.classList.add('preview-open');
  }

  function closeQuotePreview() {
    const previewContainer = document.getElementById('quote-preview-container');
    if (!previewContainer) return;
    previewContainer.classList.remove('preview-open');
  }

  function openCustomProductModal() {
    const modal = document.getElementById('quote-custom-product-modal');
    const nameInput = document.getElementById('quote-custom-name-input');
    const unitInput = document.getElementById('quote-custom-unit-input');
    const priceInput = document.getElementById('quote-custom-price-input');
    const qtyInput = document.getElementById('quote-custom-qty-input');

    if (nameInput) nameInput.value = '';
    if (unitInput) unitInput.value = 'Kg';
    if (priceInput) priceInput.value = '';
    if (qtyInput) qtyInput.value = 1;
    if (modal) modal.classList.remove('hidden');
    if (nameInput) nameInput.focus();
  }

  function closeCustomProductModal() {
    const modal = document.getElementById('quote-custom-product-modal');
    if (modal) modal.classList.add('hidden');
  }

  function handleCustomProductSave() {
    const nameInput = document.getElementById('quote-custom-name-input');
    const unitInput = document.getElementById('quote-custom-unit-input');
    const priceInput = document.getElementById('quote-custom-price-input');
    const qtyInput = document.getElementById('quote-custom-qty-input');

    const name = nameInput?.value.trim() || '';
    const unit = unitInput?.value.trim() || '';
    const price = parseFloat(priceInput?.value || '');
    const qty = parseFloat(qtyInput?.value || '1');

    if (!name) {
      showToastNotification('Vui lòng nhập tên sản phẩm.');
      return;
    }
    if (!unit) {
      showToastNotification('Vui lòng nhập đơn vị tính.');
      return;
    }
    if (isNaN(price) || price < 0) {
      showToastNotification('Vui lòng nhập giá bán hợp lệ.');
      return;
    }
    if (isNaN(qty) || qty <= 0) {
      showToastNotification('Vui lòng nhập số lượng lớn hơn 0.');
      return;
    }

    activeQuote.items.push({
      productId: `custom_${Date.now()}`,
      name,
      unit,
      price,
      qty,
      isCustom: true,
      priceSource: 'manual'
    });

    renderQuoteEditorTable();
    calculateTotals();
    saveCurrentQuoteToState();
    closeCustomProductModal();
    showToastNotification('Đã thêm sản phẩm mới vào báo giá.');
  }

  function printQuoteInvoice() {
    const invoicePaper = document.getElementById('invoice-paper');
    if (!invoicePaper) {
      alert('Không tìm thấy mẫu báo giá để in!');
      return;
    }

    const printTitle = 'TPS1-Admin - Báo giá';
    const printWindow = window.open('', '_blank', 'width=1100,height=1400');
    if (!printWindow) {
      alert('Trình duyệt đang chặn cửa sổ in. Vui lòng cho phép popup rồi thử lại.');
      return;
    }

    const printHtml = `<!doctype html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${printTitle}</title>
  <link rel="stylesheet" href="./css/style.css?v=21">
  <style>
    @page {
      size: A4;
      margin: 14mm 12mm;
    }
    html, body {
      margin: 0;
      padding: 0;
      background: #fff;
      color: #000;
    }
    body {
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      font-family: var(--font-family);
    }
    .print-shell {
      width: 100%;
      box-sizing: border-box;
      padding: 0 12mm;
    }
    .invoice-paper {
      width: 100%;
      max-width: 100%;
      box-shadow: none !important;
      border: none !important;
      border-radius: 0 !important;
      padding: 10mm 0 !important;
      margin: 0 !important;
      background: #fff !important;
      color: #000 !important;
    }
    .invoice-table-responsive {
      overflow: visible !important;
    }
    .invoice-header {
      margin-bottom: 16px;
    }
    .invoice-footer-notes {
      margin-bottom: 24px;
    }
    a {
      color: inherit;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="print-shell">
    ${invoicePaper.outerHTML}
  </div>
  <script>
    window.addEventListener('load', () => {
      document.title = ${JSON.stringify(printTitle)};
      setTimeout(() => {
        window.focus();
        window.print();
      }, 300);
    });
    window.addEventListener('afterprint', () => {
      window.close();
    });
  </script>
</body>
</html>`;

    printWindow.document.open();
    printWindow.document.write(printHtml);
    printWindow.document.close();
  }

  // Khởi tạo tab Lên đơn báo giá
  function initQuoteBuilder() {
    const leadSelector = document.getElementById('quote-lead-selector');
    const productSelector = document.getElementById('quote-product-selector');
    if (!leadSelector) return;

    // Xóa selector khách hàng
    leadSelector.innerHTML = '<option value="">-- Chọn khách hàng --</option>';
    
    // Đổ danh sách khách hàng hoạt động (không bị thất bại)
    const activeLeads = state.leads.filter(l => !['unqualified', 'canceled'].includes(normalizeLeadStatus(l.status)));
    activeLeads.forEach(lead => {
      const option = document.createElement('option');
      option.value = lead.id;
      option.innerText = `${lead.name} (${lead.phone})`;
      leadSelector.appendChild(option);
    });

    // Đổ danh mục sản phẩm
    productSelector.innerHTML = '<option value="">-- Chọn mặt hàng thực phẩm --</option>';
    state.products.forEach(prod => {
      const option = document.createElement('option');
      option.value = prod.id;
      option.innerText = `${prod.name} (${prod.unit})`;
      productSelector.appendChild(option);
    });

    // Reset giao diện ban đầu
    resetQuoteBuilder();
  }

  // Tải báo giá cho khách hàng cụ thể
  function loadQuoteForLead(leadId) {
    const lead = state.leads.find(l => l.id === leadId);
    if (!lead) return;

    // Tìm kiếm xem đã có quote nào cho lead này chưa
    const existingQuote = state.quotes.find(q => q.leadId === leadId);

    if (existingQuote) {
      activeQuote = {
        id: existingQuote.id,
        leadId: existingQuote.leadId,
        priceType: existingQuote.priceType || 'wholesale',
        items: [...(existingQuote.items || [])],
        discount: existingQuote.discount || 0,
        shipping: existingQuote.shipping || 0,
        vatRate: [0, 8, 10].includes(parseInt(existingQuote.vatRate, 10)) ? parseInt(existingQuote.vatRate, 10) : 0,
        deposit: existingQuote.deposit || 0,
        note: existingQuote.note || '',
        status: existingQuote.status || 'draft',
        result: existingQuote.result || '',
        createdAt: existingQuote.createdAt || null,
        updatedAt: existingQuote.updatedAt || null,
        sentAt: existingQuote.sentAt || null,
        closedAt: existingQuote.closedAt || null,
        history: [...(existingQuote.history || [])],
        quoteCode: existingQuote.quoteCode || `BG-${lead.id.replace('lead_', '')}`
      };
    } else {
      // Tạo quote mới hoàn toàn cho lead
      activeQuote = {
        id: 'quote_' + Date.now(),
        leadId: leadId,
        // Tự động phân phối loại giá mặc định theo nhóm khách
        priceType: (lead.category === 'wholesale_restaurant' || lead.category === 'wholesale_agency') ? 'wholesale' : 'retail',
        items: [],
        discount: 0,
        shipping: 0,
        vatRate: 8,
        deposit: 0,
        note: '',
        status: 'draft',
        result: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        sentAt: null,
        closedAt: null,
        history: [],
        quoteCode: `BG-${lead.id.replace('lead_', '')}`
      };
    }

    // Đồng bộ form Editor
    document.getElementById('quote-discount-input').value = activeQuote.discount;
    document.getElementById('quote-shipping-input').value = activeQuote.shipping;
    document.getElementById('quote-vat-rate-input').value = String([0, 8, 10].includes(parseInt(activeQuote.vatRate, 10)) ? parseInt(activeQuote.vatRate, 10) : 8);
    document.getElementById('quote-deposit-input').value = activeQuote.deposit;
    document.getElementById('quote-note-input').value = activeQuote.note;
    
    if (activeQuote.priceType === 'wholesale') {
      document.getElementById('price-type-wholesale').checked = true;
    } else {
      document.getElementById('price-type-retail').checked = true;
    }

    // Đổ thông tin khách lên mẫu hóa đơn in
    document.getElementById('inv-cust-name').innerText = lead.name;
    document.getElementById('inv-cust-phone').innerText = lead.phone;
    document.getElementById('inv-cust-email').innerText = lead.email || 'Chưa cung cấp';
    
    const categoryText = {
      wholesale_restaurant: 'Sỉ - Nhà hàng/Lẩu nướng',
      wholesale_agency: 'Sỉ - Đại lý phân phối',
      retail_vip: 'Lẻ - Khách hàng VIP',
      retail_regular: 'Lẻ - Khách hàng thường'
    }[lead.category] || 'Chưa phân loại';
    document.getElementById('inv-cust-cat').innerText = categoryText;

    // Tạo mã hóa đơn báo giá và ngày
    document.getElementById('inv-code').innerText = `BG-${lead.id.replace('lead_', '')}`;
    document.getElementById('inv-date').innerText = new Date(existingQuote ? existingQuote.createdAt : Date.now()).toLocaleDateString('vi-VN');

    // Chân hóa đơn note
    document.getElementById('inv-note-text').innerText = activeQuote.note || 'Báo giá này mang tính chất tham khảo. Xin quý khách vui lòng liên hệ nhân viên kinh doanh để xác thực thời gian giao hàng và kiểm tra tồn kho.';

    // Render bảng sản phẩm & tính tiền
    renderQuoteEditorTable();
    calculateTotals();
    renderSavedQuotesList();
  }

  // Đặt lại trình báo giá về rỗng
  function resetQuoteBuilder() {
    activeQuote = {
      id: null,
      leadId: '',
      priceType: 'wholesale',
      items: [],
      discount: 0,
      shipping: 0,
      vatRate: 8,
      deposit: 0,
      note: '',
      status: 'draft',
      result: '',
      createdAt: null,
      updatedAt: null,
      sentAt: null,
      closedAt: null,
      history: [],
      quoteCode: ''
    };

    document.getElementById('quote-lead-selector').value = '';
    document.getElementById('quote-product-selector').value = '';
    document.getElementById('quote-qty-input').value = '';
    
    document.getElementById('quote-discount-input').value = 0;
    document.getElementById('quote-shipping-input').value = 0;
    document.getElementById('quote-vat-rate-input').value = 8;
    document.getElementById('quote-deposit-input').value = 0;
    document.getElementById('quote-note-input').value = '';
    document.getElementById('price-type-wholesale').checked = true;
    closeCustomProductModal();

    // Trả mẫu hóa đơn về trống
    document.getElementById('inv-cust-name').innerText = 'Chưa chọn';
    document.getElementById('inv-cust-phone').innerText = '---';
    document.getElementById('inv-cust-email').innerText = '---';
    document.getElementById('inv-cust-cat').innerText = '---';
    document.getElementById('inv-code').innerText = 'BG-2026-XXXX';
    document.getElementById('inv-date').innerText = new Date().toLocaleDateString('vi-VN');
    document.getElementById('inv-note-text').innerText = 'Báo giá này mang tính chất tham khảo. Xin quý khách vui lòng liên hệ nhân viên kinh doanh để xác thực thời gian giao hàng và kiểm tra tồn kho.';

    renderQuoteEditorTable();
    calculateTotals();
    renderSavedQuotesList();
  }

  // Cập nhật lại đơn giá khi đổi nút chọn Sỉ/Lẻ
  function recalculateSelectedItemsPrices() {
    activeQuote.items.forEach(item => {
      const product = state.products.find(p => p.id === item.productId);
      if (product && item.priceSource !== 'manual' && !item.isCustom) {
        item.price = activeQuote.priceType === 'wholesale' ? product.price_wholesale : product.price_retail;
      }
    });
  }

  // Render bảng danh sách sản phẩm đã chọn bên khung soạn thảo
  function renderQuoteEditorTable() {
    const tbody = document.getElementById('quote-items-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (activeQuote.items.length === 0) {
      tbody.innerHTML = `
        <tr class="empty-row-msg">
          <td colspan="5" class="text-center">Chưa chọn sản phẩm nào cho báo giá</td>
        </tr>
      `;
      return;
    }

    activeQuote.items.forEach((item, index) => {
      const isCustomItem = !!item.isCustom || String(item.productId || '').startsWith('custom_');
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td data-label="Sản phẩm">
          <strong>${item.name}</strong>
          <div class="quote-item-meta">
            ${isCustomItem ? '<span class="quote-item-badge">Tự nhập</span>' : ''}
            <span class="text-muted" style="font-size:11px;">${item.unit || 'Kg'}</span>
          </div>
        </td>
        <td data-label="Đơn giá" class="text-right">
          <input
            type="number"
            class="form-control quote-price-input"
            min="0"
            step="1000"
            value="${Number(item.price || 0)}"
            onchange="updateItemPrice(${index}, this.value)"
          >
        </td>
        <td data-label="Số lượng" class="text-center">
          <div class="qty-btn-group">
            <button class="btn btn-secondary btn-xs" onclick="updateItemQty(${index}, -1)" style="padding: 2px 6px;">-</button>
            <span style="font-weight:600; width:35px; text-align:center;">${item.qty}</span>
            <button class="btn btn-secondary btn-xs" onclick="updateItemQty(${index}, 1)" style="padding: 2px 6px;">+</button>
          </div>
        </td>
        <td data-label="Thành tiền" class="text-right"><strong>${formatCurrency(item.price * item.qty)}</strong></td>
        <td>
          <button class="btn-icon" onclick="deleteQuoteItem(${index})" style="color:#EF4444;">
            <i class="fa-solid fa-trash-can"></i><span class="show-mobile-inline" style="margin-left: 6px;">Xóa dòng</span>
          </button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  // Hàm thay đổi số lượng sản phẩm từ bảng Editor
  window.updateItemQty = function(index, delta) {
    if (activeQuote.items[index]) {
      activeQuote.items[index].qty = Math.max(0.1, activeQuote.items[index].qty + delta);
      // Đảm bảo số lượng làm tròn đẹp mắt
      activeQuote.items[index].qty = Math.round(activeQuote.items[index].qty * 100) / 100;
      
      renderQuoteEditorTable();
      calculateTotals();
      saveCurrentQuoteToState();
    }
  };

  window.updateItemPrice = function(index, rawValue) {
    if (!activeQuote.items[index]) return;
    const nextPrice = Math.max(0, parseFloat(rawValue) || 0);
    activeQuote.items[index].price = nextPrice;
    activeQuote.items[index].priceSource = 'manual';
    renderQuoteEditorTable();
    calculateTotals();
    saveCurrentQuoteToState();
  };

  // Hàm xóa sản phẩm khỏi bảng Editor
  window.deleteQuoteItem = function(index) {
    activeQuote.items.splice(index, 1);
    renderQuoteEditorTable();
    calculateTotals();
    saveCurrentQuoteToState();
  };

  function calculateQuoteFinancials(quote) {
    const items = quote.items || [];
    const subtotal = items.reduce((sum, item) => sum + (item.price * item.qty), 0);
    const discountAmount = (subtotal * (quote.discount || 0)) / 100;
    const vatRate = [0, 8, 10].includes(parseInt(quote.vatRate, 10)) ? parseInt(quote.vatRate, 10) : 0;
    const totalBeforeVat = subtotal - discountAmount + (quote.shipping || 0);
    const vatAmount = (totalBeforeVat * vatRate) / 100;
    const grandTotal = totalBeforeVat + vatAmount;
    const balance = grandTotal - (quote.deposit || 0);

    return {
      subtotal,
      discountAmount,
      totalBeforeVat,
      vatRate,
      vatAmount,
      grandTotal,
      balance
    };
  }

  // Tính toán tổng số tiền và render lên hóa đơn preview bên phải
  function calculateTotals() {
    const totals = calculateQuoteFinancials(activeQuote);

    // Đổ số liệu lên hóa đơn in
    document.getElementById('inv-subtotal').innerText = formatCurrency(totals.subtotal);
    document.getElementById('inv-discount').innerText = `-${formatCurrency(totals.discountAmount)} (${activeQuote.discount}%)`;
    document.getElementById('inv-shipping').innerText = formatCurrency(activeQuote.shipping);
    const vatLabel = totals.vatRate > 0 ? ` (${totals.vatRate}%)` : ' (Không VAT)';
    document.getElementById('inv-pre-vat').innerText = formatCurrency(totals.totalBeforeVat);
    document.getElementById('inv-vat').innerText = `${formatCurrency(totals.vatAmount)}${vatLabel}`;
    document.getElementById('inv-grandtotal').innerText = formatCurrency(totals.grandTotal);
    document.getElementById('inv-deposit').innerText = formatCurrency(activeQuote.deposit);
    document.getElementById('inv-balance').innerText = formatCurrency(totals.balance);
    const totalBeforeVatDisplay = document.getElementById('quote-total-before-vat-display');
    const vatAmountDisplay = document.getElementById('quote-vat-amount-display');
    const grandTotalDisplay = document.getElementById('quote-grandtotal-display');
    if (totalBeforeVatDisplay) totalBeforeVatDisplay.innerText = formatCurrency(totals.totalBeforeVat);
    if (vatAmountDisplay) vatAmountDisplay.innerText = `${formatCurrency(totals.vatAmount)}${vatLabel}`;
    if (grandTotalDisplay) grandTotalDisplay.innerText = formatCurrency(totals.grandTotal);

    // Render bảng sản phẩm lên hóa đơn in
    const invTbody = document.getElementById('invoice-items-body');
    if (!invTbody) return;
    invTbody.innerHTML = '';

    if (activeQuote.items.length === 0) {
      invTbody.innerHTML = `
        <tr>
          <td colspan="6" class="text-center" style="color: #94a3b8; font-style: italic; padding: 30px 0;">Vui lòng chọn sản phẩm và cấu hình để hiển thị hóa đơn</td>
        </tr>
      `;
      return;
    }

    activeQuote.items.forEach((item, index) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="text-center">${index + 1}</td>
        <td><strong>${item.name}</strong></td>
        <td class="text-center">${item.unit}</td>
        <td class="text-right">${formatCurrency(item.price)}</td>
        <td class="text-center">${item.qty}</td>
        <td class="text-right"><strong>${formatCurrency(item.price * item.qty)}</strong></td>
      `;
      invTbody.appendChild(tr);
    });

    return totals;
  }

  // Lưu báo giá đang sửa đổi vào State tổng cục và lưu LocalStorage
  function saveCurrentQuoteToState() {
    if (!activeQuote.leadId) return;

    const existingIdx = state.quotes.findIndex(q => q.leadId === activeQuote.leadId);
    const lead = state.leads.find(l => l.id === activeQuote.leadId);
    const now = new Date().toISOString();
    const existingQuote = existingIdx !== -1 ? state.quotes[existingIdx] : null;
    const totals = calculateQuoteFinancials(activeQuote);
    
    const quoteDataToSave = {
      id: activeQuote.id,
      leadId: activeQuote.leadId,
      quoteCode: activeQuote.quoteCode || `BG-${activeQuote.leadId.replace('lead_', '')}`,
      priceType: activeQuote.priceType,
      items: activeQuote.items,
      discount: activeQuote.discount,
      shipping: activeQuote.shipping,
      vatRate: [0, 8, 10].includes(parseInt(activeQuote.vatRate, 10)) ? parseInt(activeQuote.vatRate, 10) : 0,
      deposit: activeQuote.deposit,
      note: activeQuote.note,
      status: existingQuote?.status || 'draft',
      result: existingQuote?.result || '',
      subtotal: totals.subtotal,
      discountAmount: totals.discountAmount,
      totalBeforeVat: totals.totalBeforeVat,
      vatAmount: totals.vatAmount,
      grandTotal: totals.grandTotal,
      balance: totals.balance,
      createdAt: existingQuote?.createdAt || now,
      updatedAt: now,
      sentAt: existingQuote?.sentAt || null,
      closedAt: existingQuote?.closedAt || null,
      history: existingQuote?.history || []
    };

    if (existingIdx !== -1) {
      state.quotes[existingIdx] = quoteDataToSave;
    } else {
      state.quotes.push(quoteDataToSave);
      // Đổ quote_id vào lead để liên kết
      const leadIdx = state.leads.findIndex(l => l.id === activeQuote.leadId);
      if (leadIdx !== -1) {
        state.leads[leadIdx].quotes = [activeQuote.id];
        saveState('leads');
      }
    }

    saveState('quotes');
    renderSavedQuotesList();

    if (window.supabaseModule && typeof window.supabaseModule.syncQuote === 'function') {
      const leadSnapshot = lead ? {
        id: lead.id,
        name: lead.name,
        phone: lead.phone,
        email: lead.email || '',
        category: lead.category || '',
        source: lead.source || '',
        status: lead.status || ''
      } : null;
      const previousStatus = existingQuote?.status || 'draft';
      window.supabaseModule.syncQuote(quoteDataToSave, leadSnapshot, previousStatus)
        .catch(err => {
          console.error('Lỗi đồng bộ báo giá Supabase:', err);
          showToastNotification(`Không lưu được lên Supabase: ${err.message}`);
        });
    }
  }

  function renderSavedQuotesList() {
    const tbody = document.getElementById('saved-quotes-body');
    const countEl = document.getElementById('saved-quotes-count');
    const totalEl = document.getElementById('quote-mgmt-total');
    const sentEl = document.getElementById('quote-mgmt-sent');
    const wonEl = document.getElementById('quote-mgmt-won');
    const lostEl = document.getElementById('quote-mgmt-lost');
    const quoteCountBadge = document.getElementById('quote-management-count');
    if (!tbody) return;

    const searchValue = document.getElementById('quote-management-search')?.value.trim().toLowerCase() || '';
    const statusFilter = document.getElementById('quote-management-status-filter')?.value || '';

    const quotes = [...(state.quotes || [])]
      .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0));

    const filteredQuotes = quotes.filter(quote => {
      const lead = state.leads.find(l => l.id === quote.leadId);
      const haystack = [
        quote.quoteCode || '',
        quote.leadId || '',
        lead?.name || '',
        lead?.phone || '',
        lead?.email || '',
        quote.note || ''
      ].join(' ').toLowerCase();
      const statusOk = !statusFilter || (quote.status || 'draft') === statusFilter;
      const searchOk = !searchValue || haystack.includes(searchValue);
      return statusOk && searchOk;
    });

    const stats = quotes.reduce((acc, quote) => {
      acc.total += 1;
      if (quote.status === 'sent') acc.sent += 1;
      if (quote.status === 'won') acc.won += 1;
      if (quote.status === 'lost') acc.lost += 1;
      return acc;
    }, { total: 0, sent: 0, won: 0, lost: 0 });

    if (totalEl) totalEl.innerText = stats.total;
    if (sentEl) sentEl.innerText = stats.sent;
    if (wonEl) wonEl.innerText = stats.won;
    if (lostEl) lostEl.innerText = stats.lost;

    if (countEl) {
      countEl.innerText = `${filteredQuotes.length} báo giá`;
    }
    if (quoteCountBadge) {
      quoteCountBadge.innerText = `${filteredQuotes.length}/${stats.total} báo giá`;
    }

    tbody.innerHTML = '';

    if (filteredQuotes.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="text-center" style="color: var(--text-muted); padding: 24px 0;">Không có báo giá nào phù hợp bộ lọc hiện tại.</td>
        </tr>
      `;
      return;
    }

    filteredQuotes.slice(0, 100).forEach(quote => {
      const lead = state.leads.find(l => l.id === quote.leadId);
      const statusLabel = {
        draft: '<span class="badge badge-blue">Nháp</span>',
        sent: '<span class="badge badge-amber">Đã gửi</span>',
        quoted: '<span class="badge badge-purple">Đã báo giá</span>',
        negotiating: '<span class="badge badge-pink">Thương lượng</span>',
        won: '<span class="badge badge-emerald">Chốt đơn</span>',
        lost: '<span class="badge badge-rose">Thất bại</span>'
      }[quote.status || 'draft'] || quote.status || 'draft';

      const row = document.createElement('tr');
      row.innerHTML = `
        <td data-label="Mã báo giá"><strong>${quote.quoteCode || `BG-${(quote.leadId || '').replace('lead_', '')}`}</strong></td>
        <td data-label="Khách hàng">
          <div><strong>${lead ? lead.name : 'Đã xóa lead'}</strong></div>
          <div class="text-muted" style="font-size:12px;">${lead ? lead.phone : quote.leadId}</div>
        </td>
        <td data-label="Tổng cộng" class="text-right">${formatCurrency(quote.grandTotal || 0)}</td>
        <td data-label="Trạng thái">${statusLabel}</td>
        <td data-label="Cập nhật">${formatDateShort(quote.updatedAt || quote.createdAt || new Date().toISOString())}</td>
        <td data-label="Sản phẩm">${(quote.items || []).length}</td>
        <td>
          <div style="display:flex; gap:6px; flex-wrap:wrap; justify-content:flex-end;">
            <button class="btn btn-secondary btn-xs" type="button" data-quote-action="open" data-quote-lead-id="${quote.leadId}">Mở sửa</button>
            <button class="btn btn-secondary btn-xs" type="button" data-quote-action="history" data-quote-id="${quote.id}">Lịch sử</button>
            <button class="btn btn-primary btn-xs" type="button" data-quote-action="status" data-quote-id="${quote.id}" style="padding: 4px 10px;">Đổi trạng thái</button>
            <button class="btn btn-danger btn-xs" type="button" data-quote-action="delete" data-quote-id="${quote.id}">Xóa</button>
          </div>
        </td>
      `;
      tbody.appendChild(row);
    });
  }

  window.openSavedQuote = function(leadId) {
    const quoteTabLink = document.querySelector('.sidebar-nav .nav-item[data-tab="tab-quote"] a');
    if (quoteTabLink) {
      quoteTabLink.click();
    }
    requestAnimationFrame(() => {
      const leadSelector = document.getElementById('quote-lead-selector');
      if (leadSelector) {
        leadSelector.value = leadId;
      }
      loadQuoteForLead(leadId);
      openQuotePreview();
    });
  };

  window.markSavedQuoteResult = function(leadId, status) {
    const quote = state.quotes.find(q => q.leadId === leadId);
    if (!quote) return;
    openQuoteStatusModal(quote.id);
    const selectEl = document.getElementById('quote-status-select');
    if (selectEl) selectEl.value = status;
  };

  window.deleteSavedQuote = function(quoteId) {
    openQuoteDeleteModal(quoteId);
  };

  function openQuoteDeleteModal(quoteId) {
    const quote = state.quotes.find(q => q.id === quoteId);
    if (!quote) return;

    pendingDeleteQuote.quoteId = quote.id;
    pendingDeleteQuote.leadId = quote.leadId;
    pendingDeleteQuote.quoteCode = quote.quoteCode || quote.id;

    const modal = document.getElementById('quote-delete-modal');
    const titleEl = document.getElementById('quote-delete-modal-title');
    const descEl = document.getElementById('quote-delete-modal-desc');
    const checkboxEl = document.getElementById('quote-delete-confirm-checkbox');
    const confirmEl = document.getElementById('quote-delete-confirm-btn');

    const lead = state.leads.find(l => l.id === quote.leadId);
    if (titleEl) titleEl.innerText = `Xác nhận xóa ${pendingDeleteQuote.quoteCode}`;
    if (descEl) {
      descEl.innerText = `Báo giá của ${lead ? lead.name : 'khách hàng này'} sẽ bị xóa khỏi quản lý và Supabase. Hành động này không thể hoàn tác.`;
    }
    if (checkboxEl) checkboxEl.checked = false;
    if (confirmEl) confirmEl.disabled = true;
    if (modal) modal.classList.remove('hidden');
  }

  function closeQuoteDeleteModal() {
    const modal = document.getElementById('quote-delete-modal');
    const checkboxEl = document.getElementById('quote-delete-confirm-checkbox');
    const confirmEl = document.getElementById('quote-delete-confirm-btn');
    pendingDeleteQuote.quoteId = null;
    pendingDeleteQuote.leadId = null;
    pendingDeleteQuote.quoteCode = '';
    if (checkboxEl) checkboxEl.checked = false;
    if (confirmEl) confirmEl.disabled = true;
    if (modal) modal.classList.add('hidden');
  }

  async function performDeleteSavedQuote(quoteId) {
    const quote = state.quotes.find(q => q.id === quoteId);
    if (!quote) {
      closeQuoteDeleteModal();
      return;
    }

    if (!window.supabaseModule || typeof window.supabaseModule.deleteQuoteByLocalId !== 'function') {
      showToastNotification('Supabase chưa sẵn sàng, không thể xóa đồng bộ.');
      return;
    }

    try {
      await window.supabaseModule.deleteQuoteByLocalId(quote.id);
    } catch (err) {
      console.error('Lỗi xóa báo giá Supabase:', err);
      showToastNotification(`Không xóa được trên Supabase: ${err.message}`);
      return;
    }

    state.quotes = state.quotes.filter(q => q.id !== quoteId);
    const leadIdx = state.leads.findIndex(l => l.id === quote.leadId);
    if (leadIdx !== -1 && Array.isArray(state.leads[leadIdx].quotes)) {
      state.leads[leadIdx].quotes = state.leads[leadIdx].quotes.filter(q => q !== quote.id);
    }
    saveState('quotes');
    saveState('leads');

    if (activeQuote.id === quote.id || activeQuote.leadId === quote.leadId) {
      resetQuoteBuilder();
    }

    renderSavedQuotesList();
    closeQuoteDeleteModal();
    showToastNotification('Đã xóa báo giá.');
  }

  function closeQuoteHistoryModal() {
    const modal = document.getElementById('quote-history-modal');
    if (modal) modal.classList.add('hidden');
  }

  function closeQuoteStatusModal() {
    const modal = document.getElementById('quote-status-modal');
    if (modal) modal.classList.add('hidden');
  }

  let pendingStatusUpdate = {
    quoteId: null,
    leadId: null
  };

  function openQuoteStatusModal(quoteId) {
    const quote = state.quotes.find(q => q.id === quoteId);
    if (!quote) return;

    const lead = state.leads.find(l => l.id === quote.leadId);
    const modal = document.getElementById('quote-status-modal');
    const titleEl = document.getElementById('quote-status-modal-title');
    const descEl = document.getElementById('quote-status-modal-desc');
    const selectEl = document.getElementById('quote-status-select');
    const confirmEl = document.getElementById('quote-status-confirm-checkbox');
    if (!modal || !titleEl || !descEl || !selectEl || !confirmEl) return;

    pendingStatusUpdate = {
      quoteId: quote.id,
      leadId: quote.leadId
    };

    titleEl.innerText = `Cập nhật trạng thái ${quote.quoteCode || quote.id}`;
    descEl.innerText = `Khách hàng: ${lead ? lead.name : 'Đã xóa lead'} | Trạng thái hiện tại: ${quote.status || 'draft'}`;
    selectEl.value = quote.status || 'draft';
    confirmEl.checked = false;
    modal.classList.remove('hidden');
  }

  window.openQuoteStatusModal = openQuoteStatusModal;

  function applyQuoteStatusUpdate(quoteId, status) {
    const quoteIdx = state.quotes.findIndex(q => q.id === quoteId);
    if (quoteIdx === -1) return;

    const quote = state.quotes[quoteIdx];
    const lead = state.leads.find(l => l.id === quote.leadId);
    const now = new Date().toISOString();
    const previousStatus = quote.status || 'draft';

    quote.status = status;
    quote.updatedAt = now;
    quote.history = Array.isArray(quote.history) ? quote.history : [];
    quote.history.push({
      at: now,
      action: 'status_change',
      from: previousStatus,
      to: status,
      note: 'Cập nhật trạng thái từ bảng quản lý báo giá'
    });

    if ((status === 'quoted' || status === 'sent') && !quote.sentAt) quote.sentAt = now;
    if (status === 'won' || status === 'lost') {
      quote.closedAt = now;
      quote.result = status;
    } else if (previousStatus === 'won' || previousStatus === 'lost') {
      quote.result = '';
    }

    if (lead) {
      const leadIdx = state.leads.findIndex(l => l.id === lead.id);
      if (leadIdx !== -1) {
        const leadStatusMap = {
          sent: 'quoted',
          quoted: 'quoted',
          negotiating: 'quoting',
          won: 'won',
          lost: 'unqualified'
        };
        const nextLeadStatus = leadStatusMap[status];
        if (nextLeadStatus) {
          state.leads[leadIdx].status = nextLeadStatus;
        }
        state.leads[leadIdx].updatedAt = now;
        state.leads[leadIdx].notes = Array.isArray(state.leads[leadIdx].notes) ? state.leads[leadIdx].notes : [];
        state.leads[leadIdx].notes.push({
          timestamp: now,
          author: 'Hệ thống',
          text: `Đã cập nhật trạng thái báo giá sang <strong>${status}</strong>`
        });
      }
    }

    saveState('quotes');
    saveState('leads');
    renderSavedQuotesList();

    if (window.supabaseModule && typeof window.supabaseModule.syncQuote === 'function') {
      const leadSnapshot = lead ? {
        id: lead.id,
        name: lead.name,
        phone: lead.phone,
        email: lead.email || '',
        category: lead.category || '',
        source: lead.source || '',
        status
      } : null;
      window.supabaseModule.syncQuote(quote, leadSnapshot, previousStatus)
        .catch(err => console.error('Lỗi đồng bộ trạng thái báo giá Supabase:', err));
    }

    if (window.supabaseModule && lead && typeof window.supabaseModule.syncLeadStatus === 'function') {
      window.supabaseModule.syncLeadStatus(lead, previousStatus, status, 'Cập nhật từ bảng quản lý báo giá')
        .catch(err => console.error('Lỗi syncLeadStatus Supabase:', err));
    }
  }

  window.confirmQuoteStatusUpdate = function() {
    const selectEl = document.getElementById('quote-status-select');
    const confirmEl = document.getElementById('quote-status-confirm-checkbox');
    if (!selectEl || !confirmEl) return;

    if (!confirmEl.checked) {
      showToastNotification('Vui lòng tick xác nhận trước khi cập nhật trạng thái.');
      return;
    }

    if (!pendingStatusUpdate.quoteId) return;
    applyQuoteStatusUpdate(pendingStatusUpdate.quoteId, selectEl.value);
    closeQuoteStatusModal();
    showToastNotification('Đã cập nhật trạng thái báo giá.');
  };

  window.openQuoteHistory = function(quoteId) {
    const quote = state.quotes.find(q => q.id === quoteId || q.leadId === quoteId);
    if (!quote) return;

    const lead = state.leads.find(l => l.id === quote.leadId);
    const modal = document.getElementById('quote-history-modal');
    const titleEl = document.getElementById('quote-history-modal-title');
    const bodyEl = document.getElementById('quote-history-modal-body');
    if (!modal || !titleEl || !bodyEl) return;

    const statusLabel = {
      draft: 'Nháp',
      sent: 'Đã gửi',
      quoted: 'Đã báo giá',
      negotiating: 'Thương lượng',
      won: 'Chốt đơn',
      lost: 'Thất bại'
    }[quote.status || 'draft'] || quote.status || 'draft';

    titleEl.innerText = `Chi tiết báo giá ${quote.quoteCode || quote.id}`;
    bodyEl.innerHTML = `
      <div class="quote-history-detail-grid">
        <div class="quote-history-meta">
          <p><strong>Khách hàng:</strong> ${lead ? lead.name : 'Đã xóa lead'}</p>
          <p><strong>SĐT:</strong> ${lead ? lead.phone : '---'}</p>
          <p><strong>Trạng thái:</strong> ${statusLabel}</p>
          <p><strong>Tổng cộng:</strong> ${formatCurrency(quote.grandTotal || 0)}</p>
          <p><strong>Cập nhật:</strong> ${formatDateShort(quote.updatedAt || quote.createdAt || new Date().toISOString())}</p>
        </div>
        <div class="quote-history-meta">
          <p><strong>Chiết khấu:</strong> ${quote.discount || 0}%</p>
          <p><strong>Phí vận chuyển:</strong> ${formatCurrency(quote.shipping || 0)}</p>
          <p><strong>VAT:</strong> ${[0, 8, 10].includes(parseInt(quote.vatRate, 10)) ? (parseInt(quote.vatRate, 10) > 0 ? `${parseInt(quote.vatRate, 10)}%` : 'Không VAT') : 'Không VAT'}</p>
          <p><strong>Thành tiền trước VAT:</strong> ${formatCurrency(quote.totalBeforeVat || 0)}</p>
          <p><strong>Tiền VAT:</strong> ${formatCurrency(quote.vatAmount || 0)}</p>
          <p><strong>Đã cọc:</strong> ${formatCurrency(quote.deposit || 0)}</p>
          <p><strong>Còn lại:</strong> ${formatCurrency(quote.balance || 0)}</p>
          <p><strong>Sản phẩm:</strong> ${(quote.items || []).length}</p>
        </div>
      </div>
      <div class="quote-history-section">
        <h4>Lịch sử thay đổi</h4>
        <div class="quote-history-timeline">
          ${(quote.history || []).length > 0 ? quote.history.map(item => `
            <div class="quote-history-item">
              <div class="quote-history-item-head">
                <strong>${item.action || 'status_change'}</strong>
                <span>${formatDateShort(item.at || new Date().toISOString())}</span>
              </div>
              <div class="quote-history-item-body">
                <p>Từ: <strong>${item.from || '---'}</strong> -> Đến: <strong>${item.to || '---'}</strong></p>
                <p>${item.note || ''}</p>
              </div>
            </div>
          `).join('') : '<p class="text-muted">Chưa có lịch sử thay đổi.</p>'}
        </div>
      </div>
    `;

    modal.classList.remove('hidden');
  };

  // TẠO NỘI DUNG VĂN BẢN GỬI QUA ZALO
  function generateZaloQuoteText(lead) {
    const items = activeQuote.items || [];
    const subtotal = items.reduce((sum, item) => sum + (item.price * item.qty), 0);
    const discountAmt = (subtotal * activeQuote.discount) / 100;
    const totalBeforeVat = subtotal - discountAmt + activeQuote.shipping;
    const vatRate = [0, 8, 10].includes(parseInt(activeQuote.vatRate, 10)) ? parseInt(activeQuote.vatRate, 10) : 0;
    const vatAmt = (totalBeforeVat * vatRate) / 100;
    const grandTotal = totalBeforeVat + vatAmt;
    const balance = grandTotal - activeQuote.deposit;

    let itemsLines = "";
    activeQuote.items.forEach((item, idx) => {
      itemsLines += `${idx + 1}. ${item.name}\n   -> SL: ${item.qty} ${item.unit} x Đơn giá: ${formatCurrency(item.price)} = ${formatCurrency(item.price * item.qty)}\n`;
    });

    const quoteCode = `BG-${lead.id.replace('lead_', '')}`;

    return `*THƯƠNG HIỆU THỰC PHẨM SỐ MỘT (TPS1)*
------------------------------------
*BÁO GIÁ ĐƠN HÀNG HÀNG HÓA*
Mã báo giá: *${quoteCode}*
Ngày lập: ${new Date().toLocaleDateString('vi-VN')}

Kính gửi Quý khách hàng: *${lead.name}*
SĐT liên hệ: ${lead.phone}

*Chi tiết danh mục thực phẩm báo giá:*
${itemsLines}
------------------------------------
- *Cộng tiền hàng:* ${formatCurrency(subtotal)}
- *Chiết khấu:* -${formatCurrency(discountAmt)} (${activeQuote.discount}%)
- *Phí vận chuyển:* ${formatCurrency(activeQuote.shipping)}
- *Thành tiền (trước VAT):* ${formatCurrency(totalBeforeVat)}
- *VAT (${vatRate > 0 ? `${vatRate}%` : 'Không VAT'}):* ${formatCurrency(vatAmt)}
- *TỔNG THANH TOÁN:* *${formatCurrency(grandTotal)}*
- *Đã tạm ứng/đặt cọc:* ${formatCurrency(activeQuote.deposit)}
- *Số tiền còn lại cần thanh toán:* *${formatCurrency(balance)}*

*Ghi chú báo giá:*
${activeQuote.note || 'Miễn phí giao hàng Biên Hòa cho đơn hàng trên 2 triệu. Vui lòng phản hồi sớm để kịp sắp xếp xe giao sáng mai.'}

*THÔNG TIN THANH TOÁN CHUYỂN KHOẢN:*
- Tên chủ tài khoản: CÔNG TY TNHH THỰC PHẨM SỐ MỘT
- Số tài khoản: 0898902222
- Ngân hàng: ACB (Á Châu)
- Nội dung CK: Chuyen khoan ${quoteCode}

Xin cảm ơn Quý khách đã tin tưởng dịch vụ sỉ lẻ của Thực phẩm số một!
Hotline hỗ trợ: 089 890 2222
Website: https://thucphamsomot.vn`;
  }

  // Định dạng tiền tệ
  function formatCurrency(amount) {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount).replace('₫', 'đ');
  }

  function formatDateShort(isoString) {
    const date = new Date(isoString);
    return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
  }

  // Export module để sử dụng toàn cục
  window.quoteModule = {
    initQuoteBuilder: initQuoteBuilder,
    loadQuoteForLead: loadQuoteForLead,
    renderSavedQuotesList: renderSavedQuotesList
  };
})();
