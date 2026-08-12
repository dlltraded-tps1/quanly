(function() {
  const STORAGE_KEY = 'tps1_supabase_config';
  const STATUS_KEY = 'tps1_supabase_status';
  const DEFAULT_CONFIG = {
    url: 'https://yntgxollwjemyidizhnn.supabase.co',
    anonKey: 'sb_publishable_BhQX_aNaD5wzocEp7MXD_Q_DA4kOAZn',
    enabled: true
  };

  let client = null;
  let config = loadConfig();

  function loadConfig() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { ...DEFAULT_CONFIG };
      const parsed = JSON.parse(raw);
      const merged = { ...DEFAULT_CONFIG, ...parsed };
      if (!merged.anonKey) merged.anonKey = DEFAULT_CONFIG.anonKey;
      if (!Object.prototype.hasOwnProperty.call(parsed, 'enabled')) merged.enabled = true;
      return merged;
    } catch (err) {
      console.warn('Không đọc được cấu hình Supabase:', err);
      return { ...DEFAULT_CONFIG };
    }
  }

  function saveConfig(nextConfig) {
    config = {
      ...config,
      ...nextConfig
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    refreshSettingsForm();
    initClient();
    return config;
  }

  function initClient() {
    if (!window.supabase || typeof window.supabase.createClient !== 'function') {
      client = null;
      updateStatus('missing-sdk');
      return client;
    }

    if (!config.enabled || !config.url || !config.anonKey) {
      client = null;
      updateStatus('disabled');
      return client;
    }

    try {
      client = window.supabase.createClient(config.url, config.anonKey);
      updateStatus('ready');
      setTimeout(() => {
        hydrateProductsFromSupabase().catch(err => console.error('Lỗi hydrate sản phẩm Supabase:', err));
        hydrateQuotesFromSupabase().catch(err => console.error('Lỗi hydrate Supabase:', err));
      }, 0);
      return client;
    } catch (err) {
      console.error('Không khởi tạo được Supabase client:', err);
      client = null;
      updateStatus('error');
      return null;
    }
  }

  function isReady() {
    return !!client;
  }

  function getConfig() {
    return { ...config };
  }

  function updateStatus(status, detail) {
    const statusMap = {
      ready: 'Đã kết nối Supabase',
      saved: 'Đã lưu cấu hình',
      disabled: 'Chưa bật Supabase',
      'missing-sdk': 'Thiếu thư viện Supabase',
      error: 'Lỗi kết nối Supabase'
    };

    const payload = {
      status,
      label: statusMap[status] || status,
      detail: detail || null,
      updatedAt: new Date().toISOString()
    };
    localStorage.setItem(STATUS_KEY, JSON.stringify(payload));

    const statusEl = document.getElementById('supabase-status-text');
    const detailEl = document.getElementById('supabase-status-detail');
    const badgeEl = document.getElementById('supabase-status-badge');

    if (statusEl) statusEl.innerText = payload.label;
    if (detailEl) detailEl.innerText = detail || '';
    if (badgeEl) {
      badgeEl.className = 'sync-badge';
      badgeEl.classList.add(status === 'ready' ? 'idle' : 'error');
    }
  }

  function refreshSettingsForm() {
    const urlInput = document.getElementById('supabase-url-input');
    const keyInput = document.getElementById('supabase-key-input');
    const enableInput = document.getElementById('supabase-enabled-input');
    if (urlInput) urlInput.value = config.url || '';
    if (keyInput) keyInput.value = config.anonKey || '';
    if (enableInput) enableInput.checked = !!config.enabled;

    const quoteCountEl = document.getElementById('supabase-quotes-count');
    if (quoteCountEl && window.state && Array.isArray(window.state.quotes)) {
      quoteCountEl.innerText = window.state.quotes.length;
    }

    const productCountEl = document.getElementById('supabase-products-count');
    if (productCountEl && window.state && Array.isArray(window.state.products)) {
      productCountEl.innerText = window.state.products.length;
    }
  }

  function normalizeRemoteQuote(row, historyRows) {
    const quoteCode = row.quote_code || row.quoteCode || '';
    const history = (historyRows || [])
      .map(item => ({
        at: item.created_at || item.createdAt || new Date().toISOString(),
        action: item.action || 'status_change',
        from: item.from_status || item.fromStatus || null,
        to: item.to_status || item.toStatus || null,
        note: item.note || '',
        payload: item.payload || {}
      }))
      .sort((a, b) => new Date(a.at) - new Date(b.at));

    return {
      id: row.local_quote_id || row.id || `quote_${Date.now()}`,
      leadId: row.lead_id || row.leadId || '',
      quoteCode: quoteCode || `BG-${String(row.lead_id || row.leadId || '').replace('lead_', '')}`,
      priceType: row.price_type || row.priceType || 'wholesale',
      items: Array.isArray(row.items) ? row.items : [],
      discount: Number(row.discount_percent ?? row.discount ?? 0),
      shipping: Number(row.shipping_amount ?? row.shipping ?? 0),
      vatRate: Number(row.vat_rate ?? row.vatRate ?? 0),
      deposit: Number(row.deposit_amount ?? row.deposit ?? 0),
      note: row.note || '',
      status: row.status || 'draft',
      result: row.result || '',
      subtotal: Number(row.subtotal ?? 0),
      discountAmount: Number(row.discount_amount ?? 0),
      totalBeforeVat: Number(row.total_before_vat ?? row.totalBeforeVat ?? 0),
      vatAmount: Number(row.vat_amount ?? row.vatAmount ?? 0),
      grandTotal: Number(row.grand_total ?? 0),
      balance: Number(row.balance_amount ?? 0),
      createdAt: row.created_at || row.createdAt || new Date().toISOString(),
      updatedAt: row.updated_at || row.updatedAt || new Date().toISOString(),
      sentAt: row.sent_at || row.sentAt || null,
      closedAt: row.closed_at || row.closedAt || null,
      history
    };
  }

  async function fetchQuotesFromSupabase() {
    if (!ensureReady()) return { ok: false, skipped: true };

    const [{ data: quotesData, error: quotesError }, { data: historyData, error: historyError }] = await Promise.all([
      client
        .from('quotes')
        .select('*')
        .order('updated_at', { ascending: false }),
      client
        .from('quote_history')
        .select('*')
        .order('created_at', { ascending: true })
    ]);

    if (quotesError) {
      updateStatus('error', quotesError.message);
      throw quotesError;
    }
    if (historyError) {
      console.warn('Không tải được lịch sử báo giá Supabase:', historyError);
    }

    const historyMap = new Map();
    (historyData || []).forEach(row => {
      const key = row.local_quote_id;
      if (!historyMap.has(key)) historyMap.set(key, []);
      historyMap.get(key).push(row);
    });

    const remoteQuotes = (quotesData || [])
      .filter(row => !row.deleted_at)
      .map(row => normalizeRemoteQuote(row, historyMap.get(row.local_quote_id) || []));
    return { ok: true, quotes: remoteQuotes };
  }

  function normalizeRemoteProduct(row) {
    return {
      id: row.local_product_id || row.id || `prod_${Date.now()}`,
      sku: row.sku || '',
      name: row.name || '',
      unit: row.unit || 'Kg',
      category: row.category || '',
      subCategory: row.sub_category || '',
      packSize: row.pack_size || '',
      price_wholesale: Number(row.price_wholesale ?? 0),
      price_retail: Number(row.price_retail ?? 0),
      supplier: row.supplier || '',
      origin: row.origin || '',
      active: row.active !== false,
      tags: Array.isArray(row.tags) ? row.tags : [],
      notes: row.notes || '',
      createdAt: row.created_at || row.createdAt || new Date().toISOString(),
      updatedAt: row.updated_at || row.updatedAt || new Date().toISOString()
    };
  }

  async function fetchProductsFromSupabase() {
    if (!ensureReady()) return { ok: false, skipped: true };

    const { data, error } = await client
      .from('products')
      .select('*')
      .order('category', { ascending: true })
      .order('name', { ascending: true });

    if (error) {
      updateStatus('error', error.message);
      throw error;
    }

    const products = (data || []).map(normalizeRemoteProduct);
    return { ok: true, products };
  }

  async function hydrateProductsFromSupabase() {
    if (!ensureReady()) return { ok: false, skipped: true };

    try {
      let { products: remoteProducts } = await fetchProductsFromSupabase();
      if (window.sanitizeObject) remoteProducts = window.sanitizeObject(remoteProducts);
      const localProducts = Array.isArray(window.state?.products) ? window.state.products : [];
      const merged = new Map();

      localProducts.forEach(product => {
        if (product && product.id) merged.set(product.id, product);
      });

      remoteProducts.forEach(product => {
        const existing = merged.get(product.id);
        if (!existing) {
          merged.set(product.id, product);
          return;
        }

        const existingTime = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
        const remoteTime = new Date(product.updatedAt || product.createdAt || 0).getTime();
        if (remoteTime >= existingTime) {
          merged.set(product.id, {
            ...existing,
            ...product
          });
        }
      });

      window.state.products = Array.from(merged.values());
      localStorage.setItem('tps1_products', JSON.stringify(window.state.products));
      refreshSettingsForm();
      updateStatus('ready', `Đã tải ${remoteProducts.length} sản phẩm từ Supabase`);
      return { ok: true, count: remoteProducts.length };
    } catch (err) {
      console.error('Lỗi tải sản phẩm từ Supabase:', err);
      updateStatus('error', err.message);
      return { ok: false, error: err };
    }
  }

  function buildProductPayload(product) {
    return {
      local_product_id: product.id,
      sku: product.sku || null,
      name: product.name || '',
      category: product.category || '',
      sub_category: product.subCategory || product.sub_category || null,
      unit: product.unit || 'Kg',
      pack_size: product.packSize || product.pack_size || null,
      price_wholesale: Number(product.price_wholesale ?? product.priceWholesale ?? 0),
      price_retail: Number(product.price_retail ?? product.priceRetail ?? 0),
      supplier: product.supplier || null,
      origin: product.origin || null,
      active: product.active !== false,
      tags: Array.isArray(product.tags) ? product.tags : [],
      notes: product.notes || null,
      created_at: product.createdAt || product.created_at || new Date().toISOString(),
      updated_at: product.updatedAt || product.updated_at || new Date().toISOString()
    };
  }

  async function syncProduct(product) {
    if (!ensureReady()) return { ok: false, skipped: true };
    const payload = buildProductPayload(product);
    const { error } = await client
      .from('products')
      .upsert(payload, { onConflict: 'local_product_id' });
    if (error) {
      updateStatus('error', error.message);
      throw error;
    }
    updateStatus('ready');
    return { ok: true };
  }

  async function syncProductsBatch(products) {
    if (!ensureReady()) return { ok: false, skipped: true };
    const payload = (products || []).map(buildProductPayload);
    const { error } = await client
      .from('products')
      .upsert(payload, { onConflict: 'local_product_id' });
    if (error) {
      updateStatus('error', error.message);
      throw error;
    }
    updateStatus('ready');
    return { ok: true, count: payload.length };
  }

  async function deleteQuoteByLocalId(localQuoteId) {
    if (!ensureReady()) return { ok: false, skipped: true };
    const { error } = await client
      .from('quotes')
      .delete()
      .eq('local_quote_id', localQuoteId);
    if (error) {
      updateStatus('error', error.message);
      throw error;
    }

    updateStatus('ready');
    return { ok: true };
  }

  async function hydrateQuotesFromSupabase() {
    if (!ensureReady()) return { ok: false, skipped: true };

    try {
      let { quotes: remoteQuotes } = await fetchQuotesFromSupabase();
      if (window.sanitizeObject) remoteQuotes = window.sanitizeObject(remoteQuotes);
      const localQuotes = Array.isArray(window.state?.quotes) ? window.state.quotes : [];
      const merged = new Map();

      localQuotes.forEach(quote => {
        if (quote && quote.id) merged.set(quote.id, quote);
      });

      remoteQuotes.forEach(quote => {
        const existing = merged.get(quote.id);
        if (!existing) {
          merged.set(quote.id, quote);
          return;
        }

        const existingTime = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
        const remoteTime = new Date(quote.updatedAt || quote.createdAt || 0).getTime();
        if (remoteTime >= existingTime) {
          merged.set(quote.id, {
            ...existing,
            ...quote,
            history: Array.isArray(quote.history) && quote.history.length > 0
              ? quote.history
              : (Array.isArray(existing.history) ? existing.history : [])
          });
        }
      });

      window.state.quotes = Array.from(merged.values());
      localStorage.setItem('tps1_quotes', JSON.stringify(window.state.quotes));
      refreshSettingsForm();
      if (window.quoteModule && typeof window.quoteModule.renderSavedQuotesList === 'function') {
        window.quoteModule.renderSavedQuotesList();
      }
      updateStatus('ready', `Đã tải ${remoteQuotes.length} báo giá từ Supabase`);
      return { ok: true, count: remoteQuotes.length };
    } catch (err) {
      console.error('Lỗi tải báo giá từ Supabase:', err);
      updateStatus('error', err.message);
      return { ok: false, error: err };
    }
  }

  async function upsertQuote(quoteRecord, leadSnapshot, previousStatus) {
    if (!isReady()) return { ok: false, skipped: true };

    const payload = buildQuotePayload(quoteRecord, leadSnapshot);
    const { error } = await client
      .from('quotes')
      .upsert(payload, { onConflict: 'local_quote_id' });

    if (error) {
      updateStatus('error', error.message);
      throw error;
    }

    if ((previousStatus || '') !== (quoteRecord.status || '')) {
      await insertHistory({
        quoteRecord,
        action: 'status_change',
        fromStatus: previousStatus || null,
        toStatus: quoteRecord.status || null,
        note: 'Đồng bộ trạng thái báo giá'
      });

      // Gửi thông báo ZNS báo giá khi trạng thái được chuyển sang "quoted" (Đã báo giá) hoặc "sent" (Đã gửi)
      const nextStatus = quoteRecord.status || '';
      const prevStatus = previousStatus || '';
      if ((nextStatus === 'quoted' || nextStatus === 'sent') && 
          prevStatus !== 'quoted' && prevStatus !== 'sent') {
        triggerQuoteZns(quoteRecord, leadSnapshot);
      }
    }

    updateStatus('ready');
    return { ok: true };
  }

  function triggerQuoteZns(quoteRecord, leadSnapshot) {
    if (!leadSnapshot || !leadSnapshot.phone) {
      console.warn('Không thể gửi ZNS: Thiếu thông tin số điện thoại khách hàng');
      return;
    }

    // Xác định URL Next.js API theo hostname
    const backendUrl = window.location.hostname === 'localhost' 
      ? 'http://localhost:8080' 
      : 'https://thucphamsomot.vn';

    console.log(`Đang gọi API gửi ZNS thông báo báo giá cho ${leadSnapshot.phone}...`);

    fetch(`${backendUrl}/api/zalo/send-zns-quote`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        phone: leadSnapshot.phone,
        name: leadSnapshot.name,
        quoteId: quoteRecord.id,
        quoteCode: quoteRecord.quoteCode || quoteRecord.id,
        grandTotal: quoteRecord.grandTotal || quoteRecord.total || 0
      })
    })
      .then(res => res.json())
      .then(data => {
        console.log('Kết quả gửi ZNS báo giá:', data);
        if (data.error === 0 && typeof window.showToastNotification === 'function') {
          window.showToastNotification(`Đã tự động gửi ZNS báo giá Zalo đến khách hàng ${leadSnapshot.name}!`);
        }
      })
      .catch(err => console.error('Lỗi khi gọi API gửi ZNS báo giá:', err));
  }

  async function insertHistory({ quoteRecord, action, fromStatus, toStatus, note, payload }) {
    if (!isReady()) return { ok: false, skipped: true };

    const historyPayload = {
      local_quote_id: quoteRecord.id,
      lead_id: quoteRecord.leadId,
      action,
      from_status: fromStatus || null,
      to_status: toStatus || null,
      note: note || null,
      payload: payload || {},
      created_at: new Date().toISOString()
    };

    const { error } = await client.from('quote_history').insert(historyPayload);
    if (error) {
      updateStatus('error', error.message);
      throw error;
    }

    updateStatus('ready');
    return { ok: true };
  }

  function buildQuotePayload(quoteRecord, leadSnapshot) {
    // --- Parse delivery info (structured fields win, fallback to parsing message) ---
    let deliveryType    = leadSnapshot?.deliveryType    || quoteRecord?.deliveryType    || 'shipping';
    let deliveryAddress = leadSnapshot?.deliveryAddress || quoteRecord?.deliveryAddress || '';
    let deliveryAlias   = leadSnapshot?.deliveryAlias   || quoteRecord?.deliveryAlias   || '';

    if (!deliveryAddress) {
      const msg = leadSnapshot?.message || leadSnapshot?.rawNotes || '';
      const addressLine = (msg.match(/Địa chỉ:\s*(.+)/) || [])[1] || '';
      if (addressLine) {
        if (addressLine.includes('Tự đến lấy')) {
          deliveryType    = 'pickup';
          deliveryAddress = addressLine.replace('Tự đến lấy:', '').trim();
        } else {
          deliveryType = 'shipping';
          const aliasMatch = addressLine.match(/(.*?)\((.*?)\)$/);
          if (aliasMatch) {
            deliveryAddress = aliasMatch[1].replace('Giao tận nơi:', '').trim();
            deliveryAlias   = aliasMatch[2].trim();
          } else {
            deliveryAddress = addressLine.replace('Giao tận nơi:', '').trim();
          }
        }
      }
    }
    // ---------------------------------------------------------------------------

    return {
      local_quote_id: quoteRecord.id,
      lead_id: quoteRecord.leadId,
      quote_code: quoteRecord.quoteCode || null,
      lead_name: leadSnapshot?.name || '',
      lead_phone: leadSnapshot?.phone || '',
      lead_email: leadSnapshot?.email || null,
      lead_category: leadSnapshot?.category || null,
      lead_source: leadSnapshot?.source || null,
      lead_snapshot: leadSnapshot || {},
      quote_snapshot: quoteRecord,
      price_type: quoteRecord.priceType || 'wholesale',
      status: quoteRecord.status || 'draft',
      result: quoteRecord.result || null,
      items: quoteRecord.items || [],
      subtotal: quoteRecord.subtotal || 0,
      discount_percent: quoteRecord.discount || 0,
      discount_amount: quoteRecord.discountAmount || 0,
      shipping_amount: quoteRecord.shipping || 0,
      deposit_amount: quoteRecord.deposit || 0,
      grand_total: quoteRecord.grandTotal || 0,
      balance_amount: quoteRecord.balance || 0,
      note: quoteRecord.note || null,
      delivery_type:    deliveryType,
      delivery_address: deliveryAddress,
      delivery_alias:   deliveryAlias,
      created_at: quoteRecord.createdAt || new Date().toISOString(),
      updated_at: quoteRecord.updatedAt || new Date().toISOString(),
      sent_at: quoteRecord.sentAt || null,
      closed_at: quoteRecord.closedAt || null,
    };
  }

  function ensureReady() {
    if (!client) initClient();
    return !!client;
  }

  async function syncQuote(quoteRecord, leadSnapshot, previousStatus) {
    try {
      if (!ensureReady()) return { ok: false, skipped: true };
      return await upsertQuote(quoteRecord, leadSnapshot, previousStatus);
    } catch (err) {
      console.error('Lỗi đồng bộ báo giá Supabase:', err);
      if (typeof window.showToastNotification === 'function') {
        window.showToastNotification(`Lỗi đồng bộ Supabase: ${err.message}`);
      }
      return { ok: false, error: err };
    }
  }

  async function syncLeadStatus(lead, fromStatus, toStatus, note) {
    try {
      if (!ensureReady()) return { ok: false, skipped: true };
      // TỰ ĐỘNG TẠO BÁO GIÁ CHO ĐƠN TỪ ZALO MINI APP
      // Xác định mã đơn từ lời nhắn
      const expectedQuoteCode = lead.message ? (lead.message.match(/Mã đơn:\s*(DH\d+)/)?.[1]) : null;
      
      // Kiểm tra xem ĐÃ TỒN TẠI báo giá có mã này chưa (hoặc lead chưa có báo giá nào)
      let relatedQuotes = (window.state?.quotes || []).filter(q => q.leadId === lead.id);
      let quoteAlreadyExists = expectedQuoteCode ? 
            (window.state?.quotes || []).some(q => q.quoteCode === expectedQuoteCode) : 
            (relatedQuotes.length > 0);

      // Nếu chưa có báo giá cho đơn này, ta sẽ tự tạo 1 báo giá ảo để đẩy lên Supabase
      if (!quoteAlreadyExists && expectedQuoteCode) {
        const newQuote = {
          id: 'quote_' + Date.now(),
          leadId: lead.id,
          quoteCode: lead.message ? (lead.message.match(/Mã đơn:\s*(DH\d+)/)?.[1] || `DH-${Date.now().toString().slice(-4)}`) : `DH-${Date.now().toString().slice(-4)}`,
          priceType: 'retail',
          status: 'draft',
          items: [],
          subtotal: 0,
          grandTotal: 0,
          createdAt: lead.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        
        let itemPrices = {};
        if (lead.message) {
           const matchTotal = lead.message.match(/Tổng tiền:\s*([\d,.]+)/);
           // Fix: Keep decimal points when removing formatting characters
           if (matchTotal) newQuote.grandTotal = Number(matchTotal[1].replace(/[^\d.]/g, ''));

           // Lấy giá từng sản phẩm nếu có
           const lines = lead.message.split('\n');
           const detailIdx = lines.findIndex(l => l.trim() === 'Chi tiết:');
           if (detailIdx >= 0) {
              for (let i = detailIdx + 1; i < lines.length; i++) {
                 // Fix: Support quantity with decimals (x0.5)
                 const m = lines[i].match(/(.+?)\s*x([\d.]+)\s*-\s*([\d,.]+)đ/);
                 if (m) {
                    // Fix: Keep decimal points for price
                    itemPrices[m[1].trim().toLowerCase()] = Number(m[3].replace(/[^\d.]/g, ''));
                 }
              }
           }
        }
        
        // Build items từ selectedItems (pipe-separated) hoặc cartItems (JSON)
        let rawItems = [];
        
        // Ưu tiên cartItems (JSON từ cột "Giỏ hàng") vì chứa qty chính xác hơn
        if (lead.cartItems) {
           try {
              const parsed = JSON.parse(lead.cartItems);
              if (Array.isArray(parsed)) {
                 rawItems = parsed.map(i => ({ name: i.name || i.title || '', qty: i.qty || i.quantity || 1, price: i.price || 0 }));
              }
           } catch(e) { /* fallback bên dưới */ }
        }
        
        // Nếu không có cartItems hợp lệ, parse từ selectedItems string "Tên x1 | Tên x2"
        if (rawItems.length === 0 && lead.selectedItems) {
           rawItems = lead.selectedItems.split('|').map(p => {
              const m = p.trim().match(/^(.+?)\s*x([\d.]+)$/i);
              return m ? { name: m[1].trim(), qty: Number(m[2]) } : { name: p.trim(), qty: 1 };
           }).filter(i => i.name);
        }
        
        if (rawItems.length > 0) {
           newQuote.items = rawItems.map((item, idx) => {
              const name = item.name;
              const qty = item.qty || 1;
              // Ưu tiên: price từ cartItems (gioHang) > parse từ message > product catalog
              let price = (item.price && item.price > 0) ? item.price 
                         : (itemPrices[name.toLowerCase()] !== undefined ? itemPrices[name.toLowerCase()] : 0);
              let unit = 'Kg';
              let productId = null;
              const matchedProduct = window.state.products.find(prod => prod.name.toLowerCase() === name.toLowerCase());
              
              if (matchedProduct) {
                 productId = matchedProduct.id;
                 if (price === 0) price = matchedProduct.price_retail || 0;
                 unit = matchedProduct.unit || 'Kg';
              }
              
              return { id: idx, productId, name, qty, price, unit };
           });
           
           newQuote.subtotal = newQuote.items.reduce((sum, item) => sum + (item.price * item.qty), 0);
           if (!newQuote.grandTotal) newQuote.grandTotal = newQuote.subtotal;
        }

        
        window.state.quotes.push(newQuote);
        relatedQuotes = [newQuote];
        
        // Save to local storage
        localStorage.setItem('tps1_quotes', JSON.stringify(window.state.quotes));
        if (window.quoteModule && typeof window.quoteModule.renderSavedQuotesList === 'function') {
           window.quoteModule.renderSavedQuotesList();
        }
      }

      const normalizedLeadStatus = typeof window.normalizeLeadStatus === 'function'
        ? window.normalizeLeadStatus(toStatus)
        : toStatus;
      const leadStatusToQuoteStatus = {
        quoted: 'quoted',
        quoting: 'negotiating',
        won: 'won',
        unqualified: 'lost',
        canceled: 'lost'
      };
      const nextQuoteStatus = leadStatusToQuoteStatus[normalizedLeadStatus] || null;
      const leadSnapshot = {
        id: lead.id,
        name: lead.name,
        phone: lead.phone,
        email: lead.email || '',
        category: lead.category || '',
        source: lead.source || ''
      };

      await Promise.all(relatedQuotes.map(async (quoteRecord) => {
        const quoteStatus = nextQuoteStatus || quoteRecord.status || 'draft';
        const updatedQuote = {
          ...quoteRecord,
          status: quoteStatus,
          updatedAt: new Date().toISOString(),
          closedAt: quoteStatus === 'won' || quoteStatus === 'lost' ? new Date().toISOString() : quoteRecord.closedAt || null
        };
        await syncQuote(updatedQuote, leadSnapshot, quoteRecord.status);
        await insertHistory({
          quoteRecord: updatedQuote,
          action: 'lead_status_change',
          fromStatus,
          toStatus,
          note: note || `Lead đổi trạng thái sang ${normalizedLeadStatus}`
        });
      }));

      return { ok: true };
    } catch (err) {
      console.error('Lỗi syncLeadStatus Supabase:', err);
      return { ok: false, error: err };
    }
  }

  function bindSettingsForm() {
    const saveBtn = document.getElementById('supabase-save-btn');
    const pullBtn = document.getElementById('supabase-pull-btn');
    const testBtn = document.getElementById('supabase-test-btn');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        const url = document.getElementById('supabase-url-input')?.value.trim();
        const anonKey = document.getElementById('supabase-key-input')?.value.trim();
        const enabled = document.getElementById('supabase-enabled-input')?.checked;
        if (!url) {
          showToastNotification('Vui lòng nhập Supabase URL.');
          return;
        }
        if (!anonKey) {
          showToastNotification('Vui lòng nhập Supabase anon public key.');
          return;
        }
        saveConfig({ url, anonKey, enabled });
        showToastNotification('Đã lưu cấu hình Supabase.');
      });
    }

    if (pullBtn) {
      pullBtn.addEventListener('click', async () => {
        if (!ensureReady()) {
          showToastNotification('Supabase chưa sẵn sàng. Hãy lưu URL và anon key trước.');
          return;
        }
        try {
          const [quotesPull, productsPull] = await Promise.all([
            hydrateQuotesFromSupabase(),
            hydrateProductsFromSupabase()
          ]);
          const quoteCount = quotesPull?.count || 0;
          const productCount = productsPull?.count || 0;
          updateStatus('ready', `Đã tải ${quoteCount} báo giá và ${productCount} sản phẩm`);
          showToastNotification('Đã kéo dữ liệu từ Supabase về.');
        } catch (err) {
          updateStatus('error', err.message);
          showToastNotification(`Lỗi Supabase: ${err.message}`);
        }
      });
    }

    if (testBtn) {
      testBtn.addEventListener('click', async () => {
        if (!ensureReady()) {
          showToastNotification('Supabase chưa sẵn sàng. Hãy lưu URL và anon key trước.');
          return;
        }
        try {
          const { error } = await client.from('quotes').select('id', { count: 'exact', head: true });
          if (error) throw error;
          const [quotePull, productPull] = await Promise.all([
            hydrateQuotesFromSupabase(),
            hydrateProductsFromSupabase()
          ]);
          updateStatus('ready', `Kiểm tra OK, tải ${quotePull?.count || 0} báo giá và ${productPull?.count || 0} sản phẩm`);
          showToastNotification('Kết nối Supabase ổn.');
        } catch (err) {
          updateStatus('error', err.message);
          showToastNotification(`Lỗi Supabase: ${err.message}`);
        }
      });
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    refreshSettingsForm();
    bindSettingsForm();
    initClient();
    refreshSettingsForm();
  });

  window.supabaseModule = {
    getConfig,
    saveConfig,
    initClient,
    isReady,
    syncQuote,
    syncLeadStatus,
    insertHistory,
    fetchQuotesFromSupabase,
    hydrateQuotesFromSupabase,
    fetchProductsFromSupabase,
    hydrateProductsFromSupabase,
    syncProduct,
    syncProductsBatch,
    deleteQuoteByLocalId,
    refreshSettingsForm,
    updateStatus,
    getClient: () => client
  };
})();
