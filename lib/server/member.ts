/* A customer's favourites and saved addresses, kept apart from the account record
   so saving a heart can never overwrite a club stamp (or the other way round). */

import { emptyMember, type Member } from '@/lib/member';
import { kv } from './store';

export const memberKey = (uid: string) => `member:${uid}`;

export const readMember = async (uid: string): Promise<Member> => ({ ...emptyMember(), ...((await kv.get<Partial<Member>>(memberKey(uid))) || {}) });

/** Removes them with the account: nothing about the customer is left behind. */
export const deleteMember = (uid: string) => kv.del(memberKey(uid));
