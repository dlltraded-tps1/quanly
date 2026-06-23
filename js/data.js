// MOCK DATA & CATALOG DEFINITIONS: THỰC PHẨM SỐ MỘT

// 1. Danh mục sản phẩm Thực phẩm số 1
const DEFAULT_PRODUCTS = [
  { id: 'prod_beef_shplate', name: 'Ba chỉ bò Mỹ (US Beef Short Plate)', unit: 'Kg', price_retail: 195000, price_wholesale: 165000, category: 'Thịt bò nhập khẩu' },
  { id: 'prod_beef_topblade', name: 'Lõi vai bò Mỹ (US Beef Top Blade)', unit: 'Kg', price_retail: 260000, price_wholesale: 220000, category: 'Thịt bò nhập khẩu' },
  { id: 'prod_beef_ribfinger', name: 'Dẻ sườn bò Mỹ (US Beef Rib Finger)', unit: 'Kg', price_retail: 320000, price_wholesale: 280000, category: 'Thịt bò nhập khẩu' },
  { id: 'prod_salmon_fillet', name: 'Cá hồi Nauy Fillet tươi sạch', unit: 'Kg', price_retail: 415000, price_wholesale: 375000, category: 'Thủy hải sản nhập khẩu' },
  { id: 'prod_pork_ribs', name: 'Sườn non heo Nga nhập khẩu', unit: 'Kg', price_retail: 120000, price_wholesale: 95000, category: 'Thịt heo nhập khẩu' },
  { id: 'prod_pork_belly', name: 'Ba rọi heo Tây Ban Nha', unit: 'Kg', price_retail: 130000, price_wholesale: 105000, category: 'Thịt heo nhập khẩu' },
  { id: 'prod_chicken_korean', name: 'Gà dai Hàn Quốc nguyên con', unit: 'Con', price_retail: 70000, price_wholesale: 55000, category: 'Thịt gia cầm' },
  { id: 'prod_chicken_drum', name: 'Đùi tỏi gà Mỹ (US Chicken Drumstick)', unit: 'Kg', price_retail: 55000, price_wholesale: 42000, category: 'Thịt gia cầm' },
  { id: 'prod_beef_shshank', name: 'Bắp hoa bò Mỹ (US Beef Shank)', unit: 'Kg', price_retail: 230000, price_wholesale: 195000, category: 'Thịt bò nhập khẩu' },
  { id: 'prod_salmon_whole', name: 'Cá hồi Nauy nguyên con tươi', unit: 'Kg', price_retail: 330000, price_wholesale: 295000, category: 'Thủy hải sản nhập khẩu' }
];

// 2. Danh sách Kênh Marketing MKT Sources
const MARKETING_SOURCES = [
  'Facebook Ads',
  'Google Ads',
  'TikTok Ads',
  'Zalo',
  'Website',
  'Hotline',
  'Giới thiệu'
];

// 3. Danh sách leads hạt giống ban đầu (Seed Leads)
const DEFAULT_LEADS = [
  {
    id: 'lead_1001',
    name: 'Anh Trần Hùng (Nhà hàng Sen Vàng Biên Hòa)',
    phone: '0912345678',
    email: 'senwang.bienhoa@gmail.com',
    source: 'Google Ads',
    status: 'quoting',
    priority: 'high',
    category: 'wholesale_restaurant',
    notes: [
      {
        timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 ngày trước
        author: "Hệ thống",
        text: "Lead được tạo tự động từ Google Sheet Form. Ghi chú của khách: Cần tìm nhà cung cấp sỉ ba chỉ bò Mỹ và cá hồi fillet cho chuỗi buffet lẩu nướng tại Biên Hòa."
      },
      {
        timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        author: "Kinh doanh 1",
        text: "Đã liên hệ qua điện thoại. Khách hàng thân thiện, nhu cầu lấy khoảng 50kg ba chỉ bò Mỹ và 20kg cá hồi fillet mỗi tuần. Đã gửi bảng giá sỉ qua Zalo."
      },
      {
        timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        author: "Kinh doanh 1",
        text: "Đã lên đơn báo giá nháp gửi khách. Khách đang đàm phán xin chiết khấu thêm 2% trên tổng đơn hàng do cam kết lấy số lượng lớn định kỳ."
      }
    ],
    quotes: ['quote_1001'],
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'lead_1002',
    name: 'Chị Mai (Đại lý thực phẩm sạch Long Khánh)',
    phone: '0987654321',
    email: 'maifood.longkhanh@gmail.com',
    source: 'Facebook Ads',
    status: 'quoted',
    priority: 'medium',
    category: 'wholesale_agency',
    notes: [
      {
        timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        author: "Hệ thống",
        text: "Lead đăng ký từ Facebook Lead Form MKT. Khách muốn làm đại lý phân phối thịt bò ba chỉ Mỹ và sườn heo Nga tại khu vực Long Khánh."
      },
      {
        timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        author: "Kinh doanh 2",
        text: "Đã gọi điện tư vấn chính sách đại lý và gửi báo giá sỉ đại lý. Khách phản hồi giá khá cạnh tranh, đang bàn với chồng để chốt số lượng đơn đầu tiên."
      }
    ],
    quotes: ['quote_1002'],
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'lead_1003',
    name: 'Anh Nguyễn Minh Trí',
    phone: '0909888777',
    email: 'minhtri90@gmail.com',
    source: 'Hotline',
    status: 'won',
    priority: 'medium',
    category: 'retail_vip',
    notes: [
      {
        timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        author: "Kinh doanh 1",
        text: "Khách gọi hotline hỏi mua 1 con cá hồi tươi và 3kg lõi vai bò Mỹ ăn tiệc gia đình vào cuối tuần."
      },
      {
        timestamp: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
        author: "Kinh doanh 1",
        text: "Đã lên báo giá bán lẻ, giảm giá 5% tri ân khách mua nhiều. Khách đã chuyển khoản đặt cọc trước 1.000.000 đ."
      },
      {
        timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        author: "Hệ thống",
        text: "Đã chuyển trạng thái sang Đã chốt đơn. Đã giao hàng thành công bằng GrabExpress. Khách phản hồi cá hồi tươi, ăn sashimi rất béo ngon."
      }
    ],
    quotes: ['quote_1003'],
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'lead_1004',
    name: 'Cửa Hàng Lẩu Bò K-Town (Biên Hòa)',
    phone: '0866554433',
    email: 'ktown.lualau@gmail.com',
    source: 'TikTok Ads',
    status: 'new',
    priority: 'high',
    // Nhận được lead cách đây 5 phút để tạo tình huống phản hồi nhanh dưới 15 phút!
    createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(), 
    updatedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    category: 'wholesale_restaurant',
    // Dữ liệu khảo sát mẫu từ website
    role: 'Người mua',
    formType: 'Báo giá / chào hàng',
    channel: 'Website',
    company: 'Cửa Hàng Lẩu Bò K-Town',
    facilityType: 'Nhà hàng / Khách sạn',
    interestedIn: 'Thịt bò nhập khẩu, Thủy hải sản',
    purchaseScale: '50 - 100 suất/ngày',
    deliveryFrequency: '3 lần/tuần',
    deliveryArea: 'Biên Hòa, Đồng Nai',
    needBy: 'Tuần sau khai trương',
    message: 'Cần báo giá ba chỉ bò Mỹ cuộn cuộn lẩu cho quán khai trương vào tuần sau. Liên hệ gấp.',
    selectedItems: 'Ba chỉ bò Mỹ (US Beef Short Plate) (SL: 50), Cá hồi Nauy Fillet tươi sạch (SL: 10)',
    selectedCount: 2,
    notes: [
      {
        timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
        author: "Hệ thống",
        text: "Lead mới nhận từ chiến dịch TikTok Video. Khách để lại thông tin: 'Cần báo giá ba chỉ bò Mỹ cuộn cuộn lẩu cho quán khai trương vào tuần sau. Liên hệ gấp.'"
      }
    ],
    quotes: []
  },
  {
    id: 'lead_1005',
    name: 'Chị Vy (Mua lẻ lẩu nướng gia đình)',
    phone: '0707112233',
    email: '',
    source: 'Website',
    status: 'contacting',
    priority: 'low',
    createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    category: 'retail_regular',
    notes: [
      {
        timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
        author: "Hệ thống",
        text: "Khách thêm 2 sản phẩm vào giỏ hàng và điền form liên hệ tư vấn giao hàng tận nơi tại Tam Hiệp."
      },
      {
        timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
        author: "Kinh doanh 2",
        text: "Đã nhắn tin Zalo chào khách nhưng chưa thấy khách xem/trả lời. Sẽ gọi điện thoại nhắc vào chiều nay."
      }
    ],
    quotes: []
  }
];

// 4. Danh sách báo giá hạt giống ban đầu (Seed Quotes)
const DEFAULT_QUOTES = [
  {
    id: 'quote_1001',
    leadId: 'lead_1001',
    priceType: 'wholesale',
    items: [
      { productId: 'prod_beef_shplate', name: 'Ba chỉ bò Mỹ (US Beef Short Plate)', unit: 'Kg', price: 165000, qty: 50 },
      { productId: 'prod_salmon_fillet', name: 'Cá hồi Nauy Fillet tươi sạch', unit: 'Kg', price: 375000, qty: 20 }
    ],
    discount: 2, // 2%
    shipping: 50000,
    deposit: 0,
    note: 'Báo giá sỉ cho nhà hàng Sen Vàng Biên Hòa. Cam kết giao tươi mỗi sáng trước 8:00.',
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'quote_1002',
    leadId: 'lead_1002',
    priceType: 'wholesale',
    items: [
      { productId: 'prod_beef_shplate', name: 'Ba chỉ bò Mỹ (US Beef Short Plate)', unit: 'Kg', price: 165000, qty: 100 },
      { productId: 'prod_pork_ribs', name: 'Sườn non heo Nga nhập khẩu', unit: 'Kg', price: 95000, qty: 50 }
    ],
    discount: 0,
    shipping: 150000,
    deposit: 0,
    note: 'Báo giá sỉ đại lý đợt đầu tiên cho chị Mai Long Khánh.',
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'quote_1003',
    leadId: 'lead_1003',
    priceType: 'retail',
    items: [
      { productId: 'prod_salmon_whole', name: 'Cá hồi Nauy nguyên con tươi', unit: 'Kg', price: 330000, qty: 6.2 },
      { productId: 'prod_beef_topblade', name: 'Lõi vai bò Mỹ (US Beef Top Blade)', unit: 'Kg', price: 260000, qty: 3 }
    ],
    discount: 5, // 5%
    shipping: 30000,
    deposit: 1000000,
    note: 'Giao hàng lát mỏng sẵn làm sashimi và nướng cho tiệc gia đình anh Trí.',
    createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString()
  }
];
