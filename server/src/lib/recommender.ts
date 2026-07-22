// "Plan My Event" headcount recommender. Pure function (no DB) so it's easy to test.
// Given the eligible boards (with their admin-set feeds range + priority) and a headcount,
// returns a combination of boards that covers the headcount with minimal overshoot,
// preferring variety (max 2 of the same board before switching to a different type).

export interface RecBoard {
  id: string;
  feedsMin: number;
  feedsMax: number;
  priority: number; // higher = recommended first (admin-configurable)
  price: number;
}

export interface RecLine {
  boardId: string;
  qty: number;
}

/** A board's feeds midpoint. Kept for display estimates; NOT what we fill against. */
export function midpoint(b: { feedsMin: number; feedsMax: number }): number {
  return (b.feedsMin + b.feedsMax) / 2;
}

/**
 * What a board covers when deciding whether a combination is big enough: the TOP of
 * its printed range, which is the claim on the product card the customer is reading.
 *
 * This used to be midpoint(), which quietly padded quotes. A board labelled
 * "feeds 12-15" scored 13.5, so a 15-person order was told it needed a second board
 * — up to ~45% over the honest price, while the page contradicted its own label.
 */
export function capacity(b: { feedsMin: number; feedsMax: number }): number {
  return b.feedsMax;
}

const MAX_SAME = 2; // variety rule: at most this many of one board before a different type
const MAX_ITER = 1000; // safety cap against a pathological loop (e.g. all capacities 0)

/**
 * Recommend a board combination for `headcount`.
 *
 * Guarantees: total feeds >= headcount whenever the boards can cover it; never
 * under-caters; overshoot stays below the largest eligible board; and no board
 * appears a third time before every other eligible board has been considered (variety).
 *
 * Strategy: sort eligible boards by (priority desc, capacity desc, id asc). Then fill
 * greedily — while there's a gap, if a single board can finish it, take the SMALLEST
 * such board (minimal overshoot); otherwise take the LARGEST board to close the gap
 * fastest. Boards already at the variety cap are held back until every board is capped.
 */
export function recommendBoards(boards: RecBoard[], headcount: number): RecLine[] {
  if (headcount <= 0) return [];
  const eligible = boards
    .filter((b) => capacity(b) > 0)
    .slice()
    .sort((a, b) => b.priority - a.priority || capacity(b) - capacity(a) || (a.id < b.id ? -1 : 1));
  if (eligible.length === 0) return [];

  const counts = new Map<string, number>();
  const order: string[] = []; // boardIds in the sequence they were first added
  let covered = 0;
  let iter = 0;

  while (covered < headcount && iter < MAX_ITER) {
    iter++;
    const gap = headcount - covered;
    // Respect the variety cap; if everything is capped, allow repeats.
    let pool = eligible.filter((b) => (counts.get(b.id) ?? 0) < MAX_SAME);
    if (pool.length === 0) pool = eligible;

    // Prefer the smallest board that finishes the gap on its own (least overshoot).
    const finishers = pool
      .filter((b) => capacity(b) >= gap)
      .sort((a, b) => capacity(a) - capacity(b) || b.priority - a.priority || (a.id < b.id ? -1 : 1));
    const pick =
      finishers.length > 0
        ? finishers[0]
        : // No single board finishes: take the largest to close the gap fastest.
          pool
            .slice()
            .sort((a, b) => capacity(b) - capacity(a) || b.priority - a.priority || (a.id < b.id ? -1 : 1))[0];

    if (!counts.has(pick.id)) order.push(pick.id);
    counts.set(pick.id, (counts.get(pick.id) ?? 0) + 1);
    covered += capacity(pick);
  }

  return order.map((id) => ({ boardId: id, qty: counts.get(id) ?? 0 }));
}

/** What a recommended combination covers, by the top of each board's printed range. */
export function comboFeeds(lines: RecLine[], boards: RecBoard[]): number {
  const byId = new Map(boards.map((b) => [b.id, b]));
  return lines.reduce((sum, l) => {
    const b = byId.get(l.boardId);
    return b ? sum + capacity(b) * l.qty : sum;
  }, 0);
}
