import { describe, it, expect } from "vitest";
import { validateHeader, validateRemainder, type HeaderFormValues } from "./validation";

const baseHeader: HeaderFormValues = {
  qty_per_carton: "",
  width_cm: "",
  length_cm: "",
  height_cm: "",
  gross_weight: "",
  net_weight: "",
  mfg_date: "",
  exp_date: "",
};

describe("validateHeader()", () => {
  it("returns null for fully empty form (nothing to validate yet)", () => {
    expect(validateHeader(baseHeader)).toBeNull();
  });

  it("returns null when all values are within range", () => {
    expect(
      validateHeader({
        qty_per_carton: 90,
        width_cm: 30,
        length_cm: 40,
        height_cm: 20,
        gross_weight: 12.5,
        net_weight: 11.2,
        mfg_date: "2026-01-01",
        exp_date: "2027-01-01",
      })
    ).toBeNull();
  });

  describe("MFG/EXP date ordering", () => {
    it("rejects EXP before MFG", () => {
      const err = validateHeader({ ...baseHeader, mfg_date: "2026-06-01", exp_date: "2026-05-01" });
      expect(err).toBe("EXP Date ต้องไม่น้อยกว่า MFG Date");
    });

    it("accepts EXP equal to MFG (boundary)", () => {
      const err = validateHeader({ ...baseHeader, mfg_date: "2026-06-01", exp_date: "2026-06-01" });
      expect(err).toBeNull();
    });

    it("accepts EXP after MFG", () => {
      const err = validateHeader({ ...baseHeader, mfg_date: "2026-06-01", exp_date: "2028-06-01" });
      expect(err).toBeNull();
    });

    it("skips the check when either date is empty", () => {
      expect(validateHeader({ ...baseHeader, mfg_date: "2026-06-01" })).toBeNull();
      expect(validateHeader({ ...baseHeader, exp_date: "2027-06-01" })).toBeNull();
    });
  });

  describe("numeric field constraints", () => {
    it.each([
      ["qty_per_carton", "จำนวนชิ้น/ลัง"],
      ["width_cm", "กว้าง"],
      ["length_cm", "ยาว"],
      ["height_cm", "สูง"],
      ["gross_weight", "Gross Weight"],
      ["net_weight", "Net Weight"],
    ] as const)("rejects negative %s", (field, label) => {
      const err = validateHeader({ ...baseHeader, [field]: -1 });
      expect(err).toBe(`${label} ต้องไม่ติดลบ`);
    });

    it("rejects values above 999,999 (>)", () => {
      const err = validateHeader({ ...baseHeader, gross_weight: 1_000_000 });
      expect(err).toBe("Gross Weight มีค่ามากเกินไป");
    });

    it("accepts exactly 999,999 at the boundary", () => {
      expect(validateHeader({ ...baseHeader, gross_weight: 999_999 })).toBeNull();
    });

    it("accepts zero (valid edge case — unused dimension)", () => {
      expect(validateHeader({ ...baseHeader, width_cm: 0 })).toBeNull();
    });

    it("accepts string-form numerics (form inputs arrive as strings)", () => {
      expect(validateHeader({ ...baseHeader, qty_per_carton: "90" })).toBeNull();
      expect(validateHeader({ ...baseHeader, qty_per_carton: "-1" })).toBe("จำนวนชิ้น/ลัง ต้องไม่ติดลบ");
    });

    it("skips empty-string fields (not yet entered)", () => {
      expect(
        validateHeader({ ...baseHeader, width_cm: "", length_cm: "", height_cm: "" })
      ).toBeNull();
    });
  });

  describe("date year sanity", () => {
    it("rejects MFG year < 2000", () => {
      const err = validateHeader({ ...baseHeader, mfg_date: "1999-01-01" });
      expect(err).toContain("MFG Date");
      expect(err).toContain("ไม่สมเหตุสมผล");
    });

    it("rejects MFG year > 2100", () => {
      const err = validateHeader({ ...baseHeader, mfg_date: "2101-01-01" });
      expect(err).toContain("MFG Date");
    });

    it("rejects EXP year < 2000", () => {
      const err = validateHeader({ ...baseHeader, exp_date: "1999-01-01" });
      expect(err).toContain("EXP Date");
    });

    it("rejects EXP year > 2100", () => {
      const err = validateHeader({ ...baseHeader, exp_date: "2101-01-01" });
      expect(err).toContain("EXP Date");
    });

    it("accepts year 2000 and 2100 at the boundary", () => {
      expect(validateHeader({ ...baseHeader, mfg_date: "2000-01-01", exp_date: "2100-12-31" })).toBeNull();
    });
  });

  describe("check ordering", () => {
    it("reports EXP<MFG before negative-number errors", () => {
      const err = validateHeader({
        ...baseHeader,
        mfg_date: "2026-06-01",
        exp_date: "2026-05-01",
        gross_weight: -5,
      });
      expect(err).toBe("EXP Date ต้องไม่น้อยกว่า MFG Date");
    });

    it("reports negative numbers before date year sanity", () => {
      const err = validateHeader({
        ...baseHeader,
        gross_weight: -5,
        mfg_date: "1800-01-01",
      });
      expect(err).toBe("Gross Weight ต้องไม่ติดลบ");
    });
  });
});

describe("validateRemainder()", () => {
  it("accepts empty string as 'not recorded'", () => {
    expect(validateRemainder("")).toBeNull();
  });

  it("accepts 0 (no remainder case)", () => {
    expect(validateRemainder("0")).toBeNull();
  });

  it("accepts positive integers", () => {
    expect(validateRemainder("45")).toBeNull();
  });

  it("rejects negative integers", () => {
    expect(validateRemainder("-1")).toBe("จำนวนเศษต้องไม่ติดลบ");
  });

  it("rejects decimals (must be whole pieces)", () => {
    expect(validateRemainder("3.5")).toBe("จำนวนเศษต้องเป็นจำนวนเต็ม");
  });

  it("rejects non-numeric strings", () => {
    expect(validateRemainder("abc")).toBe("จำนวนเศษต้องเป็นตัวเลข");
  });
});
