export interface HeaderFormValues {
  qty_per_carton: string | number | "";
  width_cm: string | number | "";
  length_cm: string | number | "";
  height_cm: string | number | "";
  gross_weight: string | number | "";
  net_weight: string | number | "";
  mfg_date: string;
  exp_date: string;
}

const HEADER_NUM_FIELDS = [
  { key: "qty_per_carton", label: "จำนวนชิ้น/ลัง" },
  { key: "width_cm", label: "กว้าง" },
  { key: "length_cm", label: "ยาว" },
  { key: "height_cm", label: "สูง" },
  { key: "gross_weight", label: "Gross Weight" },
  { key: "net_weight", label: "Net Weight" },
] as const;

export const HEADER_NUMBER_MAX = 999_999;

/**
 * Validates the GR document header form. Returns a Thai-language error message
 * or `null` if the form is valid. Order of checks matches the UI so messages
 * surface consistently.
 */
export function validateHeader(f: HeaderFormValues): string | null {
  if (f.mfg_date && f.exp_date && new Date(f.exp_date) < new Date(f.mfg_date)) {
    return "EXP Date ต้องไม่น้อยกว่า MFG Date";
  }

  for (const nf of HEADER_NUM_FIELDS) {
    const v = f[nf.key];
    if (v === "" || v == null) continue;
    const n = Number(v);
    if (!Number.isFinite(n)) continue;
    if (n < 0) return `${nf.label} ต้องไม่ติดลบ`;
    if (n > HEADER_NUMBER_MAX) return `${nf.label} มีค่ามากเกินไป`;
  }

  if (f.mfg_date) {
    const y = new Date(f.mfg_date).getFullYear();
    if (y < 2000 || y > 2100) {
      return "MFG Date ดูไม่สมเหตุสมผล — ตรวจสอบปีอีกครั้ง";
    }
  }
  if (f.exp_date) {
    const y = new Date(f.exp_date).getFullYear();
    if (y < 2000 || y > 2100) {
      return "EXP Date ดูไม่สมเหตุสมผล — ตรวจสอบปีอีกครั้ง";
    }
  }

  return null;
}

/**
 * Validates the remainder-pieces input. Accepts empty string (no remainder
 * recorded) and returns an error string for non-integer or negative inputs.
 * Returns `null` when valid; consumers persist `null` for empty and a
 * non-negative integer otherwise.
 */
export function validateRemainder(raw: string): string | null {
  if (raw === "") return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return "จำนวนเศษต้องเป็นตัวเลข";
  if (n < 0) return "จำนวนเศษต้องไม่ติดลบ";
  if (!Number.isInteger(n)) return "จำนวนเศษต้องเป็นจำนวนเต็ม";
  return null;
}
