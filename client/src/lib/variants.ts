// Sizes & options — turning a flat board list into one tile per product.
//
// The shop used to show a separate tile for every size, so "Smoked Salmon" appeared twice
// (£22.50 for 2-4, £42 for 10-15) and the customer had to work out that they were the same
// board. Boards that share a `variantGroup` are now one product: the shop shows the leading
// variant, and the size is chosen on the product page.
import type { Platter } from "./api";

export interface ProductGroup {
  /** The variant that fronts the shop tile — its photo, name and description. */
  lead: Platter;
  /** Every variant in the group, cheapest-price-last ordering preserved from the admin. */
  variants: Platter[];
  /** Lowest price across the group — what "From £x" quotes. */
  fromPrice: number;
  /** True when there is a real choice to make, i.e. the tile should send you to the page. */
  hasChoice: boolean;
}

const priceOf = (p: Platter): number => p.fixedPrice ?? p.fromPrice ?? 0;

/**
 * Collapse a board list into product groups, preserving the incoming order: a group appears
 * where its leading variant appeared, so the owner's sortOrder still controls the shop.
 */
export function groupVariants(boards: Platter[]): ProductGroup[] {
  const groups = new Map<string, Platter[]>();
  const order: string[] = [];

  for (const b of boards) {
    // Ungrouped boards each get a unique key so they pass through as groups of one.
    const key = b.variantGroup || `solo:${b.id}`;
    if (!groups.has(key)) {
      groups.set(key, []);
      order.push(key);
    }
    groups.get(key)!.push(b);
  }

  return order.map((key) => {
    const variants = [...groups.get(key)!].sort(
      (a, b) => a.variantOrder - b.variantOrder || priceOf(b) - priceOf(a),
    );
    return {
      lead: variants[0],
      variants,
      fromPrice: Math.min(...variants.map(priceOf)),
      hasChoice: variants.length > 1,
    };
  });
}

const SIZE_WORDS = /\b(small|medium|large|regular|mini|party|sharing|individual|half|full)\b/i;

/**
 * What to call the picker. Groups are usually sizes, but the label is free text so the owner
 * can also run "same board, different topping" — in which case "Choose your size" would be a lie.
 */
export function pickerHeading(variants: Platter[]): string {
  const labels = variants.map((v) => v.variantLabel ?? "");
  return labels.every((l) => SIZE_WORDS.test(l)) ? "Choose your size" : "Choose your option";
}

/**
 * How many the group feeds, as one span: sizes feeding "2-4" and "10-15" become "2-15".
 * Built from the numbers rather than the strings, because the variants are ordered largest
 * first — joining them as written produced the backwards "feeds 12-15 – 4-6".
 */
export function groupServes(variants: Platter[]): string | null {
  const written = variants.map((v) => v.serves).filter((s): s is string => !!s);
  if (written.length === 0) return null;
  if (new Set(written).size === 1) return written[0]; // every size feeds the same — say it once

  const numbers = written.flatMap((s) => (s.match(/\d+/g) ?? []).map(Number));
  if (numbers.length === 0) return written[0];
  const low = Math.min(...numbers);
  const high = Math.max(...numbers);
  return low === high ? String(low) : `${low}-${high}`;
}
