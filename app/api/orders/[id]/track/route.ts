import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/server/storage';
import { statusToStage } from '@/lib/orderFlow';
import { LOCS, LOC_TITLES } from '@/lib/catalog';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();
  const order = db.orders[id];

  if (!order) {
    return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
  }

  const stage = statusToStage(order.type, order.status);

  return NextResponse.json({
    order: {
      id: order.id,
      seq: order.seq,
      status: order.status,
      type: order.type,
      stage,
      loc: order.loc,
      locName: LOC_TITLES[order.loc] || LOCS[order.loc]?.[0],
      area: order.area,
      address: order.address,
      table: order.table,
      name: order.name,
      note: order.note,
      placed: order.placed,
      target: order.target,
      pay: order.pay,
      paid: order.paid,
      items: order.items,
      totals: order.totals,
      rider: order.riderName
        ? {
            name: order.riderName,
            phone: order.riderPhone,
            plate: order.riderPlate,
          }
        : null,
      messages: order.messages || [],
      waiterCall: order.waiterCall,
    },
  });
}
