import { describe, expect, it } from "vitest";
import { parsePagination } from "../src/http/pagination";

const opts = { defaultPageSize: 20, maxPageSize: 100 };

describe("parsePagination", () => {
  it("defaults page to 1 and pageSize to the configured default", () => {
    expect(parsePagination({}, opts)).toEqual({ page: 1, pageSize: 20, limit: 20, offset: 0 });
  });

  it("computes offset from page and pageSize", () => {
    expect(parsePagination({ page: 3, pageSize: 10 }, opts)).toEqual({
      page: 3,
      pageSize: 10,
      limit: 10,
      offset: 20,
    });
  });

  it("clamps a requested pageSize above the max, regardless of what the client asks for", () => {
    expect(parsePagination({ pageSize: 999999 }, opts)).toMatchObject({ pageSize: 100, limit: 100 });
  });

  it("ignores invalid/negative page and pageSize values and falls back to defaults", () => {
    expect(parsePagination({ page: -5, pageSize: "not-a-number" }, opts)).toEqual({
      page: 1,
      pageSize: 20,
      limit: 20,
      offset: 0,
    });
  });

  it("treats a zero or negative pageSize as invalid, not as 'unbounded'", () => {
    expect(parsePagination({ pageSize: 0 }, opts).pageSize).toBe(20);
    expect(parsePagination({ pageSize: -1 }, opts).pageSize).toBe(20);
  });
});
