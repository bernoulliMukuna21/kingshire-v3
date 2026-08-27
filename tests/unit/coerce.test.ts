import { describe, it, expect } from "vitest";
import { coerceNumeric, coerceNumericList } from "@/lib/db/coerce";

describe("coerceNumeric", () => {
  it("converts numeric-string columns to numbers so math is safe", () => {
    const row = { amount: "30.50", fee: "2.30", title: "x" };
    const out = coerceNumeric(row, ["amount", "fee"]);
    expect(out.amount).toBe(30.5);
    expect(out.fee).toBe(2.3);
    expect(out.amount + out.fee).toBe(32.8);
    expect(out.title).toBe("x");
  });

  it("leaves already-numeric values and untouched keys alone", () => {
    const row = { amount: 12, note: "keep" };
    const out = coerceNumeric(row, ["amount"]);
    expect(out.amount).toBe(12);
    expect(out.note).toBe("keep");
  });

  it("does not coerce empty strings to 0", () => {
    const row = { amount: "" };
    expect(coerceNumeric(row, ["amount"]).amount).toBe("");
  });

  it("coerces every row in a list", () => {
    const rows = [{ amount: "1" }, { amount: "2.5" }];
    const out = coerceNumericList(rows, ["amount"]);
    expect(out.map((r) => r.amount)).toEqual([1, 2.5]);
  });
});
