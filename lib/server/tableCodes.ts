/* A table's QR code carries a short signature of "shop + table number", made with
   the server secret. With protected table codes switched on, ordering from a table
   and calling a waiter both need it, so nobody can send a waiter or a dine-in order
   to a table from their couch. Old printed codes, which have no signature, keep
   working until the café switches protection on, after reprinting. */

import { signText } from './auth';
import { safeEqual } from './http';

export const tableKey = (loc: number, table: number) => signText('table', `${loc}:${table}`);

export async function tableKeyOk(loc: number, table: number, given: unknown) {
  return typeof given === 'string' && safeEqual(await tableKey(loc, table), given);
}
