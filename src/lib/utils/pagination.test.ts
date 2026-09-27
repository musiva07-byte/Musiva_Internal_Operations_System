/**
 * Tests for the Product Catalog pagination helpers — added so staff can jump directly to a
 * page instead of clicking Next repeatedly, and so a mistyped "Go to page" value never
 * navigates somewhere invalid.
 */
import { describe, it, expect } from "vitest";
import { getPageNumbers, parseGoToPage } from "./pagination";

describe("getPageNumbers", () => {
  it("shows every page when there are 7 or fewer, regardless of current page", () => {
    expect(getPageNumbers(1, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(getPageNumbers(3, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(getPageNumbers(5, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(getPageNumbers(1, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("shows leading/trailing ellipsis for many pages with current page in the middle", () => {
    // Matches the exact example from the task: "Previous 1 ... 4 5 6 ... 20 Next"
    expect(getPageNumbers(5, 20)).toEqual([1, "ellipsis", 4, 5, 6, "ellipsis", 20]);
  });

  it("only shows a trailing ellipsis when current page is near the start", () => {
    expect(getPageNumbers(1, 20)).toEqual([1, 2, "ellipsis", 20]);
  });

  it("only shows a leading ellipsis when current page is near the end", () => {
    expect(getPageNumbers(20, 20)).toEqual([1, "ellipsis", 19, 20]);
  });

  it("never produces duplicate page numbers at the boundary between window and edge", () => {
    // current=3 on a 20-page catalog: window is 2..4, rangeStart(2) is not > 2, so no leading
    // ellipsis and no duplicate "2".
    expect(getPageNumbers(3, 20)).toEqual([1, 2, 3, 4, "ellipsis", 20]);
  });
});

describe("parseGoToPage", () => {
  it("accepts a valid in-range page", () => {
    expect(parseGoToPage("5", 20)).toEqual({ ok: true, page: 5 });
  });

  it("accepts the first and last page", () => {
    expect(parseGoToPage("1", 20)).toEqual({ ok: true, page: 1 });
    expect(parseGoToPage("20", 20)).toEqual({ ok: true, page: 20 });
  });

  it("rejects a blank value", () => {
    expect(parseGoToPage("", 20).ok).toBe(false);
    expect(parseGoToPage("   ", 20).ok).toBe(false);
  });

  it("rejects zero and negative numbers", () => {
    expect(parseGoToPage("0", 20).ok).toBe(false);
    expect(parseGoToPage("-3", 20).ok).toBe(false);
  });

  it("rejects a page number beyond the total page count", () => {
    const result = parseGoToPage("999", 20);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("Enter a page between 1 and 20.");
    }
  });

  it("rejects non-integer and non-numeric input", () => {
    expect(parseGoToPage("2.5", 20).ok).toBe(false);
    expect(parseGoToPage("abc", 20).ok).toBe(false);
  });
});
