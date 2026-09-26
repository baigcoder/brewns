import { NextRequest, NextResponse } from 'next/server';
import { getDb, mutateDb } from '@/lib/server/storage';
import { getCurrentStaff } from '@/lib/server/auth';

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

  return NextResponse.json({ messages: order.messages || [] });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { text, senderName } = await req.json();

  if (!text || !text.trim()) {
    return NextResponse.json({ error: 'Message cannot be empty.' }, { status: 400 });
  }

  const staffCtx = await getCurrentStaff();
  const db = getDb();
  const order = db.orders[id];
  if (!order) {
    return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
  }

  const isStaff = !!staffCtx;
  const senderType = isStaff ? (staffCtx.user.role === 'rider' ? 'rider' : 'staff') : 'customer';
  const name = isStaff
    ? `${staffCtx.user.name} (${staffCtx.user.role})`
    : (senderName || order.name || 'Customer');

  const message = {
    id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    sender: senderType as 'customer' | 'staff' | 'rider',
    name,
    text: String(text).trim(),
    time: Date.now(),
  };

  mutateDb((d) => {
    const o = d.orders[id];
    if (o) {
      if (!o.messages) o.messages = [];
      o.messages.push(message);
    }
  });

  return NextResponse.json({ message });
}
