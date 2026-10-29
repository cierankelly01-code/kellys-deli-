import { prisma } from "./prisma";
import { recommendBoards, capacity, type RecBoard } from "./recommender";

/**
 * "How much food for N people?" — a real answer from the live menu, using the same
 * recommender as Plan My Event. Shown on the party guide (people and crawlers alike):
 * the specific, quotable numbers an AI assistant can cite when someone asks how much
 * party food to get.
 */
export const GUIDE_HEADCOUNTS = [6, 10, 15, 20, 30, 40, 50];

export interface GuideRow {
  headcount: number;
  boards: Array<{ id: string; name: string; qty: number; feedsEach: number }>;
  feeds: number;
  price: number;
}

export async function headcountGuide(headcounts = GUIDE_HEADCOUNTS): Promise<GuideRow[]> {
  const boards = await prisma.platter.findMany({
    where: { active: true, category: "board", recommendEligible: true, fixedPrice: { not: null }, feedsMin: { not: null }, feedsMax: { not: null } },
  });
  if (!boards.length) return [];
  const rec: RecBoard[] = boards.map((b) => ({
    id: b.id,
    feedsMin: b.feedsMin ?? 0,
    feedsMax: b.feedsMax ?? 0,
    priority: b.recommendPriority,
    price: Number(b.fixedPrice),
  }));
  const byId = new Map(boards.map((b) => [b.id, b]));
  return headcounts
    .map((n) => {
      const lines = recommendBoards(rec, n);
      const rows = lines.map((l) => {
        const b = byId.get(l.boardId)!;
        return { id: b.id, name: b.name, qty: l.qty, feedsEach: capacity({ feedsMin: b.feedsMin ?? 0, feedsMax: b.feedsMax ?? 0 }) };
      });
      return {
        headcount: n,
        boards: rows,
        feeds: rows.reduce((s, r) => s + r.feedsEach * r.qty, 0),
        price: Math.round(lines.reduce((s, l) => s + Number(byId.get(l.boardId)!.fixedPrice) * l.qty, 0) * 100) / 100,
      };
    })
    // Never print a suggestion that doesn't actually feed the number asked for.
    .filter((r) => r.boards.length > 0 && r.feeds >= r.headcount);
}
