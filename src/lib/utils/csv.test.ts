import { describe, it, expect } from "vitest";
import { buildCsv, csvFilename } from "./csv";

describe("buildCsv — escaping", () => {
  it("wraps every cell in quotes", () => {
    const csv = buildCsv(["A", "B"], [["x", "y"]]);
    expect(csv).toContain('"x","y"');
    expect(csv).toContain('"A","B"');
  });

  it("escapes a comma inside a cell without breaking columns", () => {
    const csv = buildCsv(["Name"], [["Satin Dress, Black"]]);
    const lines = csv.replace(/^﻿/, "").split("\r\n");
    expect(lines[1]).toBe('"Satin Dress, Black"');
  });

  it("doubles internal quotes", () => {
    const csv = buildCsv(["Note"], [['Staff said "urgent"']]);
    const lines = csv.replace(/^﻿/, "").split("\r\n");
    expect(lines[1]).toBe('"Staff said ""urgent"""');
  });

  it("preserves a newline inside a cell inside its quoted field", () => {
    const csv = buildCsv(["Note"], [["Line one\nLine two"]]);
    const lines = csv.replace(/^﻿/, "").split("\r\n");
    // The embedded \n stays literally inside the quoted cell — it must not become a new CSV row.
    expect(lines).toHaveLength(2);
    expect(lines[1]).toBe('"Line one\nLine two"');
  });

  it("renders null/undefined cells as an empty quoted string, not the literal word 'null'", () => {
    const csv = buildCsv(["A", "B"], [[null, undefined]]);
    const lines = csv.replace(/^﻿/, "").split("\r\n");
    expect(lines[1]).toBe('"",""');
  });

  it("renders numbers as plain digits", () => {
    const csv = buildCsv(["Qty"], [[42]]);
    const lines = csv.replace(/^﻿/, "").split("\r\n");
    expect(lines[1]).toBe('"42"');
  });

  it("renders currency symbols (₹, BHD figures) correctly — UTF-8, no mangling", () => {
    const csv = buildCsv(["Cost"], [["₹1,500.00"]]);
    expect(csv).toContain("₹1,500.00");
  });

  it("prepends a UTF-8 byte-order mark so Excel opens non-ASCII text correctly", () => {
    const csv = buildCsv(["A"], [["x"]]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
  });

  it("joins rows with CRLF (the CSV-spec line ending)", () => {
    const csv = buildCsv(["A"], [["1"], ["2"]]);
    const withoutBom = csv.slice(1);
    expect(withoutBom.split("\r\n")).toHaveLength(3);
  });
});

describe("csvFilename", () => {
  it("matches the required <prefix>-YYYY-MM-DD.csv convention", () => {
    const date = new Date("2026-08-19T10:00:00Z");
    expect(csvFilename("product-catalog", date)).toBe("product-catalog-2026-08-19.csv");
    expect(csvFilename("stock-management", date)).toBe("stock-management-2026-08-19.csv");
  });
});
