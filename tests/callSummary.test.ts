import { describe, expect, it } from 'bun:test';
import { emptySummary, noteAction, noteTool, summaryRows } from '@/components/brewns/callSummary';

const nameOf = (id: string) => ({ burger: 'Smash Burger', latte: 'Iced Latte' })[id] || '';

describe('call summary', () => {
  it('builds the bag up from add_to_bag calls, adding repeats', () => {
    let s = noteTool(emptySummary(), 'add_to_bag', { items: [{ id: 'burger', qty: 1 }] }, nameOf);
    s = noteTool(s, 'add_to_bag', { items: [{ id: 'burger', qty: 1 }, { id: 'latte', qty: 2 }] }, nameOf);
    expect(s.items).toEqual([{ id: 'burger', name: 'Smash Burger', qty: 2 }, { id: 'latte', name: 'Iced Latte', qty: 2 }]);
  });

  it('does not count a live bag line twice when the server confirms it', () => {
    let s = noteTool(emptySummary(), 'add_to_bag', { items: [{ id: 'latte', qty: 1 }] }, nameOf);
    s = noteAction(s, { type: 'ADD_TO_BAG', data: { items: [{ id: 'latte', qty: 1, name: 'ICED LATTE' }] } }, nameOf, true);
    expect(s.items[0].qty).toBe(1);
    // On the step-by-step line only the action arrives, so it counts.
    expect(noteAction(emptySummary(), { type: 'ADD_TO_BAG', data: { items: [{ id: 'latte', qty: 1 }] } }, nameOf, false).items[0].qty).toBe(1);
  });

  it('takes the whole order, mode and address from place_order', () => {
    const s = noteTool(emptySummary(), 'place_order', { items: [{ id: 'burger', qty: 3 }], mode: 'delivery', address: 'House 12, Block C, Gulberg' }, nameOf);
    expect(summaryRows(s, 'en')).toEqual([
      ['About', 'Delivery'],
      ['Items', '3× Smash Burger'],
      ['Address', 'House 12, Block C, Gulberg'],
    ]);
  });

  it('shows a pickup counter, a complaint and a placed order', () => {
    let s = noteTool(emptySummary('complaint'), 'request_callback', { reason: 'Cold burger on order 25' }, nameOf);
    expect(summaryRows(s, 'en')).toEqual([['About', 'Complaint'], ['Issue', 'Cold burger on order 25']]);
    s = noteAction(emptySummary(), { type: 'ORDER_PLACED', data: { order: { number: 25, mode: 'pickup', loc: 0, items: [{ id: 'latte', qty: 1, name: 'ICED LATTE' }] } } }, nameOf, true);
    expect(summaryRows(s, 'en').at(-2)).toEqual(['Counter', 'MM Alam Road']);
    expect(summaryRows(s, 'en').at(-1)).toEqual(['Status', 'Order #00025 placed']);
  });
});
