/* "Your usual": what a customer keeps ordering, worked out from their past
   orders. The same item with the same options counts as one thing; the ones
   ordered most often (and, on a tie, most recently) come first. Pure, so the
   account page and the tests share it. */

export type UsualSource = { placed: number; status: string; items: { id: string; qty: number; sel: Record<string, number>; name: string; opts?: string }[] };
export type Usual = { id: string; sel: Record<string, number>; name: string; opts: string; times: number; qty: number; last: number };

const selKey = (sel: Record<string, number>) =>
  JSON.stringify(
    Object.keys(sel || {})
      .sort()
      .map((k) => [k, sel[k]]),
  );

/** The customer's most-ordered lines, at most `limit`, needing at least `min` separate orders. Cancelled orders don't count. */
export function usualOf(orders: UsualSource[], limit = 3, min = 2): Usual[] {
  const by = new Map<string, Usual>();
  for (const o of orders) {
    if (o.status === 'cancelled') continue;
    const seen = new Set<string>();
    for (const it of o.items) {
      const key = `${it.id}|${selKey(it.sel)}`;
      const hit = by.get(key) || { id: it.id, sel: it.sel, name: it.name, opts: it.opts || '', times: 0, qty: 0, last: 0 };
      if (!seen.has(key)) hit.times++;
      seen.add(key);
      hit.qty += it.qty;
      hit.last = Math.max(hit.last, o.placed);
      by.set(key, hit);
    }
  }
  return [...by.values()]
    .filter((u) => u.times >= min)
    .sort((a, b) => b.times - a.times || b.last - a.last)
    .slice(0, limit);
}
