// Fictional NovaMart demo data. Prices are illustrative, not real retail prices.
// Every value is fixed so each seed run produces the same database.

export const stores = [
  { code: "DEL01", name: "NovaMart Connaught Place", city: "New Delhi" },
  { code: "GGN01", name: "NovaMart Cyber Hub", city: "Gurugram" },
  { code: "NOIDA01", name: "NovaMart Sector 18", city: "Noida" },
  { code: "FAR01", name: "NovaMart Crown Plaza", city: "Faridabad" },
] as const;

export type StoreCode = (typeof stores)[number]["code"];

type Specs = Record<string, string | number | boolean>;
export type ProductSeed = {
  sku: string;
  name: string;
  brand: string;
  price: number;
  rating: number;
  specs: Specs;
  category: string;
};

// [sku, name, brand, price (₹), rating, specs]
type Row = [string, string, string, number, number, Specs];

const laptops: Row[] = [
  // The three Java/Docker-friendly laptops under ₹80,000 (16 GB RAM, SSD):
  ["P101", "ASUS TUF Gaming A15", "ASUS", 76990, 4.5, { cpu: "AMD Ryzen 7 7735HS", ram: "16 GB DDR5", storage: "512 GB SSD", gpu: "NVIDIA RTX 3050 4 GB", display: '15.6" FHD 144 Hz', weightKg: 2.2 }],
  ["P102", "Lenovo IdeaPad Slim 5", "Lenovo", 62990, 4.4, { cpu: "AMD Ryzen 7 7730U", ram: "16 GB", storage: "512 GB SSD", gpu: "Integrated Radeon", display: '14" WUXGA IPS', weightKg: 1.46 }],
  ["P103", "HP Victus 15", "HP", 69990, 4.3, { cpu: "Intel Core i5-12450H", ram: "16 GB DDR4", storage: "512 GB SSD", gpu: "NVIDIA RTX 2050 4 GB", display: '15.6" FHD 144 Hz', weightKg: 2.29 }],
  // Under ₹80,000 but only 8 GB RAM, so weaker picks for development work:
  ["P104", "Dell Inspiron 14", "Dell", 58490, 4.1, { cpu: "Intel Core i5-1335U", ram: "8 GB", storage: "512 GB SSD", gpu: "Integrated Iris Xe", display: '14" FHD+', weightKg: 1.54 }],
  ["P105", "Acer Aspire 3", "Acer", 34990, 3.9, { cpu: "Intel Core i3-1215U", ram: "8 GB", storage: "512 GB SSD", gpu: "Integrated UHD", display: '15.6" FHD', weightKg: 1.7 }],
  ["P106", "HP Pavilion x360 14", "HP", 64990, 4.0, { cpu: "Intel Core i5-1335U", ram: "8 GB", storage: "512 GB SSD", gpu: "Integrated Iris Xe", display: '14" FHD touch', weightKg: 1.51 }],
  // Above ₹80,000:
  ["P107", "Lenovo ThinkPad E14 Gen 5", "Lenovo", 84990, 4.4, { cpu: "Intel Core i7-1355U", ram: "16 GB", storage: "512 GB SSD", gpu: "Integrated Iris Xe", display: '14" WUXGA', weightKg: 1.41 }],
  ["P108", "MSI Katana 15", "MSI", 104990, 4.3, { cpu: "Intel Core i7-13620H", ram: "16 GB DDR5", storage: "1 TB SSD", gpu: "NVIDIA RTX 4060 8 GB", display: '15.6" FHD 144 Hz', weightKg: 2.25 }],
  ["P109", "Apple MacBook Air 13 M3", "Apple", 114900, 4.8, { cpu: "Apple M3", ram: "16 GB", storage: "256 GB SSD", gpu: "8-core GPU", display: '13.6" Liquid Retina', weightKg: 1.24 }],
  ["P110", "Dell XPS 14", "Dell", 179990, 4.6, { cpu: "Intel Core Ultra 7 155H", ram: "32 GB", storage: "1 TB SSD", gpu: "NVIDIA RTX 4050 6 GB", display: '14.5" 3.2K OLED', weightKg: 1.68 }],
];

const mobiles: Row[] = [
  ["P201", "Samsung Galaxy S24", "Samsung", 74999, 4.6, { chip: "Exynos 2400", ram: "8 GB", storage: "256 GB", display: '6.2" AMOLED 120 Hz', batteryMah: 4000, network: "5G" }],
  ["P202", "Apple iPhone 15", "Apple", 69900, 4.7, { chip: "A16 Bionic", storage: "128 GB", display: '6.1" OLED', camera: "48 MP", network: "5G" }],
  ["P203", "OnePlus 12R", "OnePlus", 39999, 4.5, { chip: "Snapdragon 8 Gen 2", ram: "8 GB", storage: "128 GB", display: '6.78" AMOLED 120 Hz', batteryMah: 5500, network: "5G" }],
  ["P204", "Google Pixel 8a", "Google", 52999, 4.4, { chip: "Tensor G3", ram: "8 GB", storage: "128 GB", display: '6.1" OLED 120 Hz', batteryMah: 4492, network: "5G" }],
  ["P205", "Redmi Note 13 Pro", "Xiaomi", 23999, 4.2, { chip: "Snapdragon 7s Gen 2", ram: "8 GB", storage: "128 GB", display: '6.67" AMOLED 120 Hz', batteryMah: 5100, network: "5G" }],
  ["P206", "Samsung Galaxy A55", "Samsung", 39999, 4.3, { chip: "Exynos 1480", ram: "8 GB", storage: "128 GB", display: '6.6" AMOLED 120 Hz', batteryMah: 5000, network: "5G" }],
  ["P207", "Nothing Phone (2a)", "Nothing", 23999, 4.3, { chip: "Dimensity 7200 Pro", ram: "8 GB", storage: "128 GB", display: '6.7" AMOLED 120 Hz', batteryMah: 5000, network: "5G" }],
  ["P208", "Apple iPhone 16 Pro", "Apple", 119900, 4.8, { chip: "A18 Pro", storage: "128 GB", display: '6.3" OLED 120 Hz', camera: "48 MP triple", network: "5G" }],
  ["P209", "Motorola Edge 50 Fusion", "Motorola", 22999, 4.1, { chip: "Snapdragon 7s Gen 2", ram: "8 GB", storage: "128 GB", display: '6.7" pOLED 144 Hz', batteryMah: 5000, network: "5G" }],
  ["P210", "Realme 12 Pro+", "Realme", 29999, 4.2, { chip: "Snapdragon 7s Gen 2", ram: "8 GB", storage: "256 GB", display: '6.7" AMOLED 120 Hz', camera: "64 MP periscope", network: "5G" }],
];

const appliances: Row[] = [
  ["P301", "LG 655 L Side-by-Side Refrigerator", "LG", 89990, 4.4, { capacityL: 655, type: "Side-by-side", energyStars: 3, inverter: true, warrantyYears: 1, compressorWarrantyYears: 10 }],
  ["P302", "Samsung 253 L Double Door Refrigerator", "Samsung", 27490, 4.3, { capacityL: 253, type: "Double door", energyStars: 3, inverter: true, warrantyYears: 1, compressorWarrantyYears: 20 }],
  ["P303", "Whirlpool 7 kg Front Load Washer", "Whirlpool", 31990, 4.2, { capacityKg: 7, type: "Front load", energyStars: 5, rpm: 1200 }],
  ["P304", "IFB 8 kg Front Load Washer", "IFB", 38990, 4.4, { capacityKg: 8, type: "Front load", energyStars: 5, rpm: 1400, steamWash: true }],
  ["P305", "Daikin 1.5 Ton Inverter Split AC", "Daikin", 46990, 4.5, { capacityTon: 1.5, energyStars: 5, inverter: true, refrigerant: "R32" }],
  ["P306", "Voltas 1.5 Ton Inverter Split AC", "Voltas", 38490, 4.1, { capacityTon: 1.5, energyStars: 3, inverter: true, refrigerant: "R32" }],
  ["P307", "Philips 4.1 L Air Fryer", "Philips", 8999, 4.4, { capacityL: 4.1, powerW: 1400, presets: 7 }],
  ["P308", "Dyson V12 Detect Slim Vacuum", "Dyson", 52900, 4.6, { type: "Cordless stick", runtimeMin: 60, laserDust: true }],
  ["P309", "Kent Grand Plus RO Purifier", "Kent", 17499, 4.2, { capacityL: 8, stages: "RO+UV+UF", tdsControl: true }],
  ["P310", "Bajaj 25 L Convection Microwave", "Bajaj", 11490, 4.0, { capacityL: 25, type: "Convection", autoMenus: 32 }],
];

const tvAudio: Row[] = [
  // NovaTech is NovaMart's fictional house brand; the SmartTV X1 has a reset manual in the knowledge base.
  ["P401", 'NovaTech SmartTV X1 55" 4K', "NovaTech", 42990, 4.2, { screenInch: 55, resolution: "4K UHD", panel: "LED", os: "NovaOS", hdmiPorts: 3 }],
  ["P402", 'Sony Bravia 55" 4K Google TV', "Sony", 74990, 4.6, { screenInch: 55, resolution: "4K UHD", panel: "LED", os: "Google TV", hdmiPorts: 4 }],
  ["P403", 'Samsung Crystal 43" 4K TV', "Samsung", 31990, 4.3, { screenInch: 43, resolution: "4K UHD", panel: "LED", os: "Tizen", hdmiPorts: 3 }],
  ["P404", "Sony WH-1000XM5 Headphones", "Sony", 29990, 4.7, { type: "Over-ear wireless", anc: true, batteryHours: 30 }],
  ["P405", "boAt Rockerz 450 Headphones", "boAt", 1499, 4.1, { type: "On-ear wireless", anc: false, batteryHours: 15 }],
  ["P406", "JBL Flip 6 Speaker", "JBL", 9999, 4.6, { type: "Portable speaker", waterproof: "IP67", batteryHours: 12 }],
  ["P407", "Apple AirPods Pro (2nd gen)", "Apple", 24900, 4.7, { type: "In-ear wireless", anc: true, batteryHours: 6 }],
  ["P408", "Sonos Beam Gen 2 Soundbar", "Sonos", 44999, 4.5, { type: "Soundbar", dolbyAtmos: true, hdmiEarc: true }],
  ["P409", "Marshall Emberton II Speaker", "Marshall", 16999, 4.5, { type: "Portable speaker", waterproof: "IP67", batteryHours: 30 }],
  ["P410", "Samsung Galaxy Buds2 Pro", "Samsung", 11999, 4.3, { type: "In-ear wireless", anc: true, batteryHours: 5 }],
];

const accessories: Row[] = [
  ["P501", "Logitech MX Master 3S Mouse", "Logitech", 9995, 4.7, { connection: "Bluetooth / USB receiver", dpi: 8000, rechargeable: true }],
  ["P502", "Logitech K380 Keyboard", "Logitech", 3495, 4.5, { connection: "Bluetooth", multiDevice: 3, layout: "Compact" }],
  ["P503", "Anker 65 W GaN Charger", "Anker", 3999, 4.6, { powerW: 65, ports: "2x USB-C, 1x USB-A", gan: true }],
  ["P504", "SanDisk 1 TB Portable SSD", "SanDisk", 8499, 4.6, { capacity: "1 TB", readMBps: 1050, interface: "USB-C 3.2" }],
  ["P505", 'Dell P2422H 24" Monitor', "Dell", 15999, 4.5, { screenInch: 24, resolution: "1920x1080", panel: "IPS", ports: "HDMI, DP, USB" }],
  ["P506", "HP USB-C Dock G5", "HP", 11999, 4.2, { ports: "2x DP, HDMI, 4x USB, RJ45", powerDeliveryW: 100 }],
  ["P507", "Samsung 25 W USB-C Charger", "Samsung", 1299, 4.4, { powerW: 25, ports: "1x USB-C" }],
  ["P508", "Spigen Ultra Hybrid Case for iPhone 15", "Spigen", 1599, 4.3, { compatibleWith: "iPhone 15", material: "TPU + PC" }],
  ["P509", "TP-Link Archer AX23 Wi-Fi 6 Router", "TP-Link", 5499, 4.3, { standard: "Wi-Fi 6", speed: "AX1800", bands: 2 }],
  ["P510", "Lenovo 15.6 inch Laptop Backpack", "Lenovo", 1999, 4.2, { fitsLaptopInch: 15.6, waterResistant: true }],
];

const toProducts = (category: string, rows: Row[]): ProductSeed[] =>
  rows.map(([sku, name, brand, price, rating, specs]) => ({ sku, name, brand, price, rating, specs, category }));

export const products: ProductSeed[] = [
  ...toProducts("Laptops", laptops),
  ...toProducts("Mobiles", mobiles),
  ...toProducts("Appliances", appliances),
  ...toProducts("TV & Audio", tvAudio),
  ...toProducts("Accessories", accessories),
];

// Normal stock rules per category: reorder point, safety stock, supplier lead time, base daily sales per store.
export const categoryRules: Record<string, { reorderPoint: number; safetyStock: number; leadTimeDays: number; dailySales: number }> = {
  Laptops: { reorderPoint: 5, safetyStock: 3, leadTimeDays: 5, dailySales: 1 },
  Mobiles: { reorderPoint: 10, safetyStock: 5, leadTimeDays: 4, dailySales: 2 },
  Appliances: { reorderPoint: 4, safetyStock: 2, leadTimeDays: 10, dailySales: 1 },
  "TV & Audio": { reorderPoint: 8, safetyStock: 4, leadTimeDays: 5, dailySales: 2 },
  Accessories: { reorderPoint: 15, safetyStock: 8, leadTimeDays: 3, dailySales: 3 },
};

// Demo scenarios at specific stores. Anything not listed gets healthy stock.
type Override = { onHand: number; incomingQty?: number; reorderPoint?: number; safetyStock?: number; leadTimeDays?: number };
export const inventoryOverrides: Record<string, Partial<Record<StoreCode, Override>>> = {
  // P101: out of stock at DEL01 (a delivery is already on the way), 3 units at GGN01.
  P101: { DEL01: { onHand: 0, incomingQty: 8 }, GGN01: { onHand: 3, reorderPoint: 2 } },
  // The four low-stock products at DEL01 (available <= reorder point, nothing incoming).
  P405: { DEL01: { onHand: 12, reorderPoint: 40, safetyStock: 15, leadTimeDays: 5 } }, // ~2 days left: CRITICAL
  P205: { DEL01: { onHand: 6, reorderPoint: 20, safetyStock: 8, leadTimeDays: 4 } }, // ~2 days left: CRITICAL
  P503: { DEL01: { onHand: 9, reorderPoint: 25, safetyStock: 10, leadTimeDays: 7 } }, // ~4.5 days left: CRITICAL
  P302: { DEL01: { onHand: 3, reorderPoint: 6, safetyStock: 2, leadTimeDays: 10 } }, // ~14 days left: LOW
};

// Exact 14-day sales (oldest first) for the low-stock items at DEL01, so the agent's numbers are predictable.
export const salesOverrides: Record<string, Partial<Record<StoreCode, number[]>>> = {
  P405: { DEL01: [5, 6, 7, 6, 5, 6, 7, 6, 5, 6, 7, 6, 6, 6] }, // 84 → 6.0 / day
  P205: { DEL01: [3, 2, 4, 3, 3, 3, 2, 4, 3, 3, 3, 2, 4, 3] }, // 42 → 3.0 / day
  P503: { DEL01: [2, 2, 1, 3, 2, 2, 2, 1, 3, 2, 2, 2, 2, 2] }, // 28 → 2.0 / day
  P302: { DEL01: [0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0] }, // 3 → ~0.21 / day
};

export const SALES_DAYS = 14;
