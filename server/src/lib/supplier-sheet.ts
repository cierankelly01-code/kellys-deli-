// Supplier Order Sheet: what to buy from whom, rolled up from customers' orders. This is
// what makes "sell first, buy second" work — the owner orders stock from each supplier
// only once customers have ordered (and, for pre-orders, paid). Pure function, no DB.

export interface SupplierSheetInputLine {
  orderRef: string;
  collectionDate: string; // YYYY-MM-DD
  quantity: number;
  platterId: string;
  name: string;
  variantLabel: string | null;
  unitLabel: string | null;
  supplierName: string | null;
  supplierSku: string | null;
  supplierUrl: string | null;
  unitCost: number;
  leadTimeHours: number | null;
}

export interface SupplierSheetProduct {
  platterId: string;
  name: string; // includes the size/option, e.g. "Wiltshire Ham — 2kg joint"
  unitLabel: string | null;
  sku: string | null;
  url: string | null;
  quantity: number;
  firstCollection: string; // earliest collection date among the orders
  orderFromSupplierBy: string; // firstCollection minus the product's lead time (YYYY-MM-DD)
  estCost: number;
  orderRefs: string[];
}

export interface SupplierSheetGroup {
  supplier: string;
  inHouse: boolean; // no supplier set: made or stocked in the deli
  orderFromSupplierBy: string; // earliest across the group
  estCost: number;
  products: SupplierSheetProduct[];
}

export const IN_HOUSE = "Made in the deli (no supplier set)";
const DEFAULT_SUPPLIER_LEAD_HOURS = 48;

function minusHours(dateStr: string, hours: number): string {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  return new Date(d.getTime() - hours * 3_600_000).toISOString().slice(0, 10);
}

export function buildSupplierSheet(lines: SupplierSheetInputLine[]): SupplierSheetGroup[] {
  const groups = new Map<string, Map<string, SupplierSheetProduct>>();
  for (const l of lines) {
    const supplier = l.supplierName?.trim() || IN_HOUSE;
    if (!groups.has(supplier)) groups.set(supplier, new Map());
    const products = groups.get(supplier)!;
    const lead = l.leadTimeHours ?? DEFAULT_SUPPLIER_LEAD_HOURS;
    const orderBy = minusHours(l.collectionDate, lead);
    const existing = products.get(l.platterId);
    if (existing) {
      existing.quantity += l.quantity;
      existing.estCost = Math.round((existing.estCost + l.unitCost * l.quantity) * 100) / 100;
      if (l.collectionDate < existing.firstCollection) existing.firstCollection = l.collectionDate;
      if (orderBy < existing.orderFromSupplierBy) existing.orderFromSupplierBy = orderBy;
      if (!existing.orderRefs.includes(l.orderRef)) existing.orderRefs.push(l.orderRef);
    } else {
      products.set(l.platterId, {
        platterId: l.platterId,
        name: l.variantLabel ? `${l.name} — ${l.variantLabel}` : l.name,
        unitLabel: l.unitLabel,
        sku: l.supplierSku,
        url: l.supplierUrl,
        quantity: l.quantity,
        firstCollection: l.collectionDate,
        orderFromSupplierBy: orderBy,
        estCost: Math.round(l.unitCost * l.quantity * 100) / 100,
        orderRefs: [l.orderRef],
      });
    }
  }
  const out: SupplierSheetGroup[] = [];
  for (const [supplier, products] of groups) {
    const list = [...products.values()].sort(
      (a, b) => a.orderFromSupplierBy.localeCompare(b.orderFromSupplierBy) || a.name.localeCompare(b.name),
    );
    out.push({
      supplier,
      inHouse: supplier === IN_HOUSE,
      orderFromSupplierBy: list.reduce((m, p) => (p.orderFromSupplierBy < m ? p.orderFromSupplierBy : m), list[0].orderFromSupplierBy),
      estCost: Math.round(list.reduce((s, p) => s + p.estCost, 0) * 100) / 100,
      products: list,
    });
  }
  // Real suppliers first, most urgent first; the in-house list last.
  return out.sort((a, b) => Number(a.inHouse) - Number(b.inHouse) || a.orderFromSupplierBy.localeCompare(b.orderFromSupplierBy));
}
