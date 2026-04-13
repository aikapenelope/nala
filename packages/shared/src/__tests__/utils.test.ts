/**
 * Tests for shared utility functions.
 */

import { describe, it, expect } from "vitest";
import {
  calculateLineTotal,
  calculateSaleTotal,
  usdToBs,
} from "../sales";
import {
  calculateStockSemaphore,
} from "../inventory";
import {
  predictStockDepletion,
  periodChange,
} from "../predictions";
import {
  rankSellers,
} from "../gamification";
import {
  calculateAgingColor,
} from "../customers";

describe("calculateLineTotal", () => {
  it("calculates without discount", () => {
    expect(calculateLineTotal(3, 1.5, 0)).toBe(4.5);
  });

  it("applies percentage discount", () => {
    expect(calculateLineTotal(2, 10, 10)).toBe(18);
  });
});

describe("calculateSaleTotal", () => {
  it("sums items", () => {
    const items = [
      { quantity: 2, unitPrice: 5, discountPercent: 0 },
      { quantity: 1, unitPrice: 3, discountPercent: 0 },
    ];
    expect(calculateSaleTotal(items)).toBe(13);
  });

  it("applies sale-level discount", () => {
    const items = [{ quantity: 1, unitPrice: 100, discountPercent: 0 }];
    expect(calculateSaleTotal(items, 10)).toBe(90);
  });
});

describe("usdToBs", () => {
  it("converts correctly", () => {
    expect(usdToBs(10, 36.5)).toBe(365);
  });
});

describe("calculateStockSemaphore", () => {
  it("returns green for healthy stock", () => {
    expect(calculateStockSemaphore(20, 10, 3, new Date().toISOString())).toBe("green");
  });

  it("returns yellow for low stock", () => {
    expect(calculateStockSemaphore(8, 10, 3, new Date().toISOString())).toBe("yellow");
  });

  it("returns red for critical stock", () => {
    expect(calculateStockSemaphore(2, 10, 3, new Date().toISOString())).toBe("red");
  });

  it("returns gray for dead stock", () => {
    const oldDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    expect(calculateStockSemaphore(50, 10, 3, oldDate)).toBe("gray");
  });
});

describe("predictStockDepletion", () => {
  it("predicts days based on velocity", () => {
    expect(predictStockDepletion(30, 30)).toBe(30);
  });

  it("returns 0 for zero stock", () => {
    expect(predictStockDepletion(0, 10)).toBe(0);
  });

  it("returns null for no sales", () => {
    expect(predictStockDepletion(10, 0)).toBeNull();
  });
});

describe("periodChange", () => {
  it("calculates positive change", () => {
    const result = periodChange(110, 100);
    expect(result.positive).toBe(true);
    expect(result.percent).toBe(10);
  });

  it("calculates negative change", () => {
    const result = periodChange(90, 100);
    expect(result.positive).toBe(false);
    expect(result.percent).toBe(10);
  });
});

describe("rankSellers", () => {
  it("ranks by total descending", () => {
    const sellers = [
      { userId: "a", name: "A", salesCount: 10, totalUsd: 100 },
      { userId: "b", name: "B", salesCount: 5, totalUsd: 200 },
    ];
    const ranked = rankSellers(sellers);
    expect(ranked[0].rank).toBe(1);
    expect(ranked[0].userId).toBe("b");
    expect(ranked[1].rank).toBe(2);
  });
});

describe("calculateAgingColor", () => {
  it("returns green for recent", () => {
    expect(calculateAgingColor(new Date().toISOString())).toBe("green");
  });

  it("returns red for old", () => {
    const old = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
    expect(calculateAgingColor(old)).toBe("red");
  });
});
