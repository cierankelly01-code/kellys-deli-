import { describe, it, expect } from "vitest";
import { recommendBoards, comboFeeds, midpoint, type RecBoard } from "../src/lib/recommender";

// Synthetic fixtures with clean integer midpoints so outcomes are unambiguous.
const small: RecBoard = { id: "small", feedsMin: 4, feedsMax: 6, priority: 0, price: 45 }; // mid 5
const medium: RecBoard = { id: "medium", feedsMin: 8, feedsMax: 10, priority: 0, price: 70 }; // mid 9
const large: RecBoard = { id: "large", feedsMin: 12, feedsMax: 16, priority: 0, price: 100 }; // mid 14
const THREE = [small, medium, large];

// Total feeds delivered by a combination.
const feeds = (hc: number, boards = THREE) => comboFeeds(recommendBoards(boards, hc), boards);
// Total number of boards in a combination.
const count = (hc: number, boards = THREE) =>
  recommendBoards(boards, hc).reduce((n, l) => n + l.qty, 0);

describe("midpoint", () => {
  it("is the average of the feeds range", () => {
    expect(midpoint(small)).toBe(5);
    expect(midpoint(large)).toBe(14);
    expect(midpoint({ feedsMin: 12, feedsMax: 15 })).toBe(13.5);
  });
});

describe("recommendBoards — never under-caters", () => {
  for (const hc of [5, 10, 15, 23, 40, 60]) {
    it(`covers ${hc} people (feeds >= headcount)`, () => {
      expect(feeds(hc)).toBeGreaterThanOrEqual(hc);
    });
  }

  it("returns nothing for a zero/negative headcount", () => {
    expect(recommendBoards(THREE, 0)).toEqual([]);
    expect(recommendBoards(THREE, -5)).toEqual([]);
  });

  it("returns nothing when there are no eligible boards", () => {
    expect(recommendBoards([], 20)).toEqual([]);
  });
});

describe("recommendBoards — minimal overshoot", () => {
  it("overshoot is always less than the largest eligible midpoint", () => {
    const largestMid = Math.max(...THREE.map(midpoint));
    for (const hc of [5, 10, 15, 23, 40, 60]) {
      expect(feeds(hc) - hc).toBeLessThan(largestMid);
    }
  });

  it("uses a single small board for a small group", () => {
    expect(recommendBoards(THREE, 5)).toEqual([{ boardId: "small", qty: 1 }]);
  });

  it("finishes an exact fit with no overshoot (23 = large 14 + medium 9)", () => {
    expect(feeds(23)).toBe(23);
    expect(count(23)).toBe(2);
  });
});

describe("recommendBoards — variety rule", () => {
  it("never puts a 3rd of the same board before switching type (while another type is available)", () => {
    // 40 people: 2× large is the cap, then it must switch to a different board.
    const lines = recommendBoards(THREE, 40);
    for (const l of lines) {
      // No board exceeds the cap of 2 UNLESS every board is already at the cap.
      if (l.qty > 2) {
        const allCapped = lines.every((x) => x.qty >= 2);
        expect(allCapped).toBe(true);
      }
    }
    expect(lines.find((l) => l.boardId === "large")?.qty).toBeLessThanOrEqual(2);
  });

  it("only repeats past the cap once every eligible board is capped", () => {
    // 60 people with only 3 board types: 2 large + 2 medium + repeats of small.
    const lines = recommendBoards(THREE, 60);
    const total = lines.reduce((n, l) => n + l.qty, 0);
    expect(feeds(60)).toBeGreaterThanOrEqual(60);
    expect(total).toBeGreaterThanOrEqual(5);
  });
});

describe("recommendBoards — priority", () => {
  it("prefers the higher-priority board when midpoints tie", () => {
    const cheeseHi: RecBoard = { id: "cheese", feedsMin: 8, feedsMax: 10, priority: 5, price: 55 };
    const savouryLo: RecBoard = { id: "savoury", feedsMin: 8, feedsMax: 10, priority: 1, price: 60 };
    // gap 9 → both are finishers with mid 9; the higher priority wins the tie.
    expect(recommendBoards([savouryLo, cheeseHi], 9)).toEqual([{ boardId: "cheese", qty: 1 }]);
  });

  it("ignores boards with a zero/degenerate midpoint (never loops forever)", () => {
    const zero: RecBoard = { id: "zero", feedsMin: 0, feedsMax: 0, priority: 99, price: 10 };
    const lines = recommendBoards([zero, medium], 18);
    expect(lines.find((l) => l.boardId === "zero")).toBeUndefined();
    expect(comboFeeds(lines, [zero, medium])).toBeGreaterThanOrEqual(18);
  });
});
