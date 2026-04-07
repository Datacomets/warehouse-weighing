// Mock ERP data — Open Item OI-03 in PRD.
// Replace with real ERP API integration when available.

export interface ErpItem {
  po_number: string;
  item_code: string;
  description: string;
  supplier: string;
  qty_per_carton: number;
  delivery_date: string; // YYYY-MM-DD
  lot: string;
}

export const MOCK_ERP_ITEMS: ErpItem[] = [
  {
    po_number: "6774-1",
    item_code: "LB-2693-b",
    description: "EMPTY PLASTIC BOTTLE 250ML",
    supplier: "PLASTIC INDUSTRIES CO., LTD.",
    qty_per_carton: 360,
    delivery_date: "2026-04-02",
    lot: "INV26-CWZ014",
  },
  {
    po_number: "6774-2",
    item_code: "LB-2693-c",
    description: "EMPTY PLASTIC BOTTLE 500ML",
    supplier: "PLASTIC INDUSTRIES CO., LTD.",
    qty_per_carton: 240,
    delivery_date: "2026-04-02",
    lot: "INV26-CWZ015",
  },
  {
    po_number: "6801-1",
    item_code: "LA-4212809",
    description: "LA GLACE FTP LABEL",
    supplier: "PRINTLABEL CO., LTD.",
    qty_per_carton: 1200,
    delivery_date: "2026-04-03",
    lot: "INV26-PRT001",
  },
  {
    po_number: "6810-1",
    item_code: "RM-STEEL-12",
    description: "STEEL ROD 12MM x 6M",
    supplier: "THAI METAL WORKS",
    qty_per_carton: 50,
    delivery_date: "2026-04-04",
    lot: "INV26-STL010",
  },
  {
    po_number: "6815-1",
    item_code: "PG-CARTON-A4",
    description: "CARTON BOX A4 SIZE",
    supplier: "PAPER PACKAGING CO.",
    qty_per_carton: 100,
    delivery_date: "2026-04-05",
    lot: "INV26-PCK022",
  },
];

export const DEFECT_CODES = [
  { code: "DEF-001", label: "บรรจุภัณฑ์ฉีกขาด" },
  { code: "DEF-002", label: "สินค้าแตกหัก" },
  { code: "DEF-003", label: "ป้ายฉลากผิด" },
  { code: "DEF-004", label: "MFG/EXP ไม่ตรง" },
  { code: "DEF-005", label: "จำนวนไม่ตรง" },
  { code: "DEF-006", label: "สินค้าเปียก/เลอะ" },
  { code: "DEF-007", label: "อื่นๆ" },
];

export const ISSUE_TYPES = [
  { value: "missing", label: "สินค้าขาดหาย" },
  { value: "damaged", label: "ชำรุด" },
  { value: "label_mismatch", label: "ข้อมูลหน้ากล่องไม่ตรง" },
  { value: "other", label: "อื่นๆ" },
];
