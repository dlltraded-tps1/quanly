const lead = {
    message: 'Mã đơn: DH587862\nĐịa chỉ: Giao tận nơi: 123 Duong ABC, Bien Hoa (Home)\nThanh toán: Trực tiếp\nTổng tiền: 78888.89đ\nChi tiết:\nBắp chuối nguyên cái x1 - 23888.89đ\nBắp nếp hạt x1 - 55000đ',
    selectedItems: [{"name":"Bắp chuối nguyên cái","qty":1},{"name":"Bắp nếp hạt","qty":1}]
};

let itemPrices = {};
let newQuote = {};
if (lead.message) {
    const matchTotal = lead.message.match(/Tổng tiền:\s*([\d,.]+)/);
    if (matchTotal) newQuote.grandTotal = Number(matchTotal[1].replace(/[^\d]/g, ''));

    const lines = lead.message.split('\n');
    let isDetails = false;
    for (let line of lines) {
        if (line.includes('Chi tiết:')) {
            isDetails = true;
            continue;
        }
        if (isDetails && line.trim()) {
            const match = line.match(/(.+?)\s+x\d+\s+-\s+([\d,.]+)/);
            if (match) {
                const name = match[1].trim();
                const priceStr = match[2].replace(/[^\d]/g, '');
                itemPrices[name.toLowerCase()] = Number(priceStr);
            }
        }
    }
}
console.log("itemPrices:", itemPrices);

newQuote.items = lead.selectedItems.map(item => {
    const name = item.name || item;
    const qty = item.qty || item.quantity || 1;
    let price = 0;
    
    if (itemPrices[name.toLowerCase()]) {
        price = itemPrices[name.toLowerCase()];
    }
    
    return {
        name: name,
        quantity: qty,
        price: price,
        total: price * qty
    };
});

console.log("newQuote:", JSON.stringify(newQuote, null, 2));
