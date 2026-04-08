// Static lookup lists used throughout the app.
// (ERP packing-list mock removed — Item Code is now resolved
// against the `item_master` Supabase table on the /new page.)

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
