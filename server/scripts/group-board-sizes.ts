/**
 * One-off: group the boards that were entered as separate products per size.
 *
 * The catalogue had two rows for each topping board — a 2-4 and a 10-15 — so the shop
 * showed the same board twice and the customer had to spot that themselves. This points
 * both rows at one variantGroup, keyed on the larger board's id, so they collapse into a
 * single tile with a size picker. Nothing is deleted and no price changes; run it again
 * safely (it re-applies the same values).
 *
 *   npx tsx scripts/group-board-sizes.ts          # show what it would do
 *   npx tsx scripts/group-board-sizes.ts --apply  # write it
 */
import { prisma } from "../src/lib/prisma";

/** [large board id, small board id]. The large one leads the shop tile. */
const PAIRS: { name: string; large: string; small: string }[] = [
  { name: "Smoked Salmon, Cream Cheese, Dill and Capers", large: "cmrvxiqce0005nw0wikmbfqll", small: "cmrvwv0i20002nw0wgd3bmunq" },
  { name: "Prosciutto, Mascarpone, Peach and Thyme", large: "cmrvxqgqy0007nw0wwou0dnqe", small: "cmrvxl8pi0006nw0wzq87ndpx" },
  { name: "Ricotta, Pesto, Tomatoes", large: "cmrvy2fjv0009nw0wuq340d7a", small: "cmrvxt2y00008nw0wzdtoprin" },
  { name: "Wild Mushroom, Cream Cheese, Garlic and Thyme", large: "cmrvy6irc000bnw0wyepdgiwc", small: "cmrvy3xsx000anw0wyhb7ljrd" },
];

/** The plain platters: one product in three sizes (matches the seed). */
const PLATTERS = [
  { id: "board-large-platter", label: "Large — feeds 12-15", order: 0 },
  { id: "board-medium-platter", label: "Medium — feeds 8-10", order: 1 },
  { id: "board-small-platter", label: "Small — feeds 4-6", order: 2 },
];

/** Test rows that reached the live shop and are orderable by customers. */
const HIDE = ["cmrvwimyt0001nw0wishsuofp", "cmrb7cvk60000l50450tsmg7h"];

const apply = process.argv.includes("--apply");
const label = (serves: string | null, size: "Large" | "Small") => (serves ? `${size} — feeds ${serves}` : size);

async function main() {
  const plan: { id: string; name: string; change: string }[] = [];

  for (const pair of PAIRS) {
    const [large, small] = await Promise.all([
      prisma.platter.findUnique({ where: { id: pair.large } }),
      prisma.platter.findUnique({ where: { id: pair.small } }),
    ]);
    if (!large || !small) {
      console.warn(`! skipping "${pair.name}" — a row is missing (large:${!!large} small:${!!small})`);
      continue;
    }
    // Grouping shouldn't quietly demote a board out of the Signature section, so the lead
    // keeps signature status if either size had it.
    const tier = large.tier === "signature" || small.tier === "signature" ? "signature" : large.tier;

    plan.push({ id: large.id, name: large.name, change: `leads group, ${label(large.serves, "Large")}, tier ${tier ?? "gallery"}` });
    plan.push({ id: small.id, name: small.name, change: `joins "${large.name}", ${label(small.serves, "Small")}` });

    if (apply) {
      await prisma.platter.update({
        where: { id: large.id },
        data: { variantGroup: large.id, variantLabel: label(large.serves, "Large"), variantOrder: 0, tier },
      });
      await prisma.platter.update({
        where: { id: small.id },
        data: { variantGroup: large.id, variantLabel: label(small.serves, "Small"), variantOrder: 1 },
      });
    }
  }

  for (const p of PLATTERS) {
    const row = await prisma.platter.findUnique({ where: { id: p.id } });
    if (!row) { console.warn(`! missing ${p.id}`); continue; }
    plan.push({ id: p.id, name: row.name, change: `${p.label} (order ${p.order})` });
    if (apply) {
      await prisma.platter.update({
        where: { id: p.id },
        data: { variantGroup: "board-large-platter", variantLabel: p.label, variantOrder: p.order },
      });
    }
  }

  for (const id of HIDE) {
    const row = await prisma.platter.findUnique({ where: { id } });
    if (!row) { console.warn(`! missing ${id}`); continue; }
    plan.push({ id, name: row.name, change: row.active ? "hidden from the shop (not deleted)" : "already hidden" });
    if (apply && row.active) await prisma.platter.update({ where: { id }, data: { active: false } });
  }

  console.log(apply ? "APPLIED:" : "DRY RUN — nothing written. Re-run with --apply:");
  for (const p of plan) console.log(`  ${p.name.padEnd(48)} ${p.change}`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
