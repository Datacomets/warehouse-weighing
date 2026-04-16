import { describe, it, expect } from "vitest";
import { parseWeight } from "./scaleParser";

describe("parseWeight() — real-world scale protocols", () => {
  it("parses Generic ASCII: 'ST,GS,  0.450 kg'", () => {
    expect(parseWeight("ST,GS,  0.450 kg\r\n")).toBe(0.45);
  });

  it("parses A&D: 'ST,+  0.4500  g'", () => {
    expect(parseWeight("ST,+  0.4500  g\r\n")).toBe(0.45);
  });

  it("parses Ohaus: '   0.450 kg'", () => {
    expect(parseWeight("   0.450 kg\r\n")).toBe(0.45);
  });

  it("parses Mettler Toledo: 'S S     0.450 kg'", () => {
    expect(parseWeight("S S     0.450 kg\r\n")).toBe(0.45);
  });

  it("parses heavy load: '   12345.678 kg'", () => {
    expect(parseWeight("   12345.678 kg\r\n")).toBe(12345.678);
  });

  it("parses integer weight without decimal: '123 g'", () => {
    expect(parseWeight("123 g")).toBe(123);
  });
});

describe("parseWeight() — control char handling", () => {
  it("strips STX/ETX and other control bytes", () => {
    expect(parseWeight("\x02ST,GS,  1.234 kg\x03")).toBe(1.234);
  });

  it("keeps \\r \\n \\t (not stripped)", () => {
    // These are whitespace-equivalent; trim() handles them
    expect(parseWeight("\t1.5 kg\n")).toBe(1.5);
  });

  it("returns null for control-chars-only input", () => {
    expect(parseWeight("\x00\x01\x02")).toBeNull();
  });
});

describe("parseWeight() — extracts FIRST number in the line", () => {
  it("ignores trailing numbers (unit suffix 'kg' has no digits)", () => {
    expect(parseWeight("  1.5 kg")).toBe(1.5);
  });

  it("takes the first numeric group when multiple exist", () => {
    // 'S S 0.450 kg ref:001' → takes 0.450, ignores 001
    expect(parseWeight("S S 0.450 kg ref:001")).toBe(0.45);
  });
});

describe("parseWeight() — rejects invalid / non-stable readings", () => {
  it("returns null for empty string", () => {
    expect(parseWeight("")).toBeNull();
  });

  it("returns null for whitespace-only", () => {
    expect(parseWeight("   \r\n\t")).toBeNull();
  });

  it("returns null for lines without numbers", () => {
    expect(parseWeight("kg")).toBeNull();
    expect(parseWeight("ERROR")).toBeNull();
    expect(parseWeight("OL")).toBeNull(); // overload indicator
  });

  it("returns null for zero (scale not stable)", () => {
    expect(parseWeight("0.000 kg")).toBeNull();
    expect(parseWeight("0")).toBeNull();
  });

  it("returns null for negative weight (tare / error condition)", () => {
    expect(parseWeight("-1.5 kg")).toBeNull();
    expect(parseWeight("ST,-  0.45 kg")).toBeNull();
  });
});

describe("parseWeight() — sign + spacing edge cases", () => {
  it("handles '+' prefix with internal whitespace", () => {
    // A&D style: +  0.4500
    expect(parseWeight("+  0.4500")).toBe(0.45);
  });

  it("handles leading space before sign", () => {
    expect(parseWeight("   +0.5 kg")).toBe(0.5);
  });

  it("handles sign with no space after", () => {
    expect(parseWeight("+1.25 kg")).toBe(1.25);
  });
});
