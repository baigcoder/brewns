/* Sample data generator for brewns: seeds all roles and live realistic orders
   so the dashboard can be previewed immediately. */

import { mutateDb, type StaffUser, type Order, type WaiterCall } from './storage';
import { hashPassword } from './auth';

export function seedSampleData(): void {
  const defaultPasswordHash = hashPassword('brewns123');

  const staffList: StaffUser[] = [
    {
      id: 'usr_owner',
      name: 'Hassan Baig',
      email: 'owner@brewns.pk',
      phone: '0300 8472910',
      role: 'owner',
      shops: [0, 1, 2],
      active: true,
      passwordHash: defaultPasswordHash,
      createdAt: Date.now() - 30 * 86400000,
    },
    {
      id: 'usr_manager',
      name: 'Zainab Tariq',
      email: 'manager@brewns.pk',
      phone: '0321 4455667',
      role: 'manager',
      shops: [0, 1, 2],
      active: true,
      passwordHash: defaultPasswordHash,
      createdAt: Date.now() - 20 * 86400000,
    },
    {
      id: 'usr_cashier',
      name: 'Bilal Khan',
      email: 'cashier@brewns.pk',
      phone: '0333 1122334',
      role: 'cashier',
      shops: [0],
      active: true,
      passwordHash: defaultPasswordHash,
      createdAt: Date.now() - 15 * 86400000,
    },
    {
      id: 'usr_barista',
      name: 'Hamza Sheikh',
      email: 'barista@brewns.pk',
      phone: '0301 9988776',
      role: 'barista',
      shops: [0],
      active: true,
      passwordHash: defaultPasswordHash,
      createdAt: Date.now() - 10 * 86400000,
    },
    {
      id: 'usr_chef',
      name: 'Chef Usman',
      email: 'chef@brewns.pk',
      phone: '0345 5566778',
      role: 'chef',
      shops: [0],
      active: true,
      passwordHash: defaultPasswordHash,
      createdAt: Date.now() - 10 * 86400000,
    },
    {
      id: 'usr_waiter',
      name: 'Ali Raza',
      email: 'waiter@brewns.pk',
      phone: '0312 3344556',
      role: 'waiter',
      shops: [0],
      active: true,
      passwordHash: defaultPasswordHash,
      createdAt: Date.now() - 8 * 86400000,
    },
    {
      id: 'usr_rider',
      name: 'Kamran Akmal',
      email: 'rider@brewns.pk',
      phone: '0305 7788990',
      role: 'rider',
      shops: [0, 1],
      active: true,
      riderPlate: 'LEN-8492',
      passwordHash: defaultPasswordHash,
      createdAt: Date.now() - 5 * 86400000,
    },
  ];

  const now = Date.now();

  const orders: Order[] = [
    {
      id: 'BRW-0026',
      seq: 26,
      placed: now - 8 * 60000,
      target: now + 12 * 60000,
      type: 'delivery',
      loc: 0,
      area: 0, // Gulberg
      address: 'House 14-B, Main Boulevard, Gulberg III',
      table: null,
      name: 'Ayesha Malik',
      phone: '0300 4567890',
      email: 'ayesha.m@gmail.com',
      note: 'Gate code 4921, please call on arrival',
      pay: 1, // card
      paid: true,
      status: 'preparing',
      items: [
        {
          id: 'latte',
          name: 'LATTE',
          sel: { size: 1, milk: 1, temp: 0 }, // 12 oz, oat milk, hot
          qty: 2,
          unitPrice: 1100,
          station: 'bar',
          done: true,
        },
        {
          id: 'smash-burger',
          name: 'CLASSIC SMASH BURGER',
          sel: { meal: 1, extra: 1 },
          qty: 1,
          unitPrice: 1950,
          station: 'kitchen',
          done: false,
        },
      ],
      stationStatus: { bar: 'ready', kitchen: 'preparing' },
      totals: { sub: 4150, discount: 0, fee: 0, rate: 0.05, tax: 208, total: 4358 },
      promo: null,
      riderId: 'usr_rider',
      riderName: 'Kamran Akmal',
      riderPhone: '0305 7788990',
      riderPlate: 'LEN-8492',
      waiterCall: false,
      messages: [
        {
          id: 'msg_1',
          sender: 'customer',
          name: 'Ayesha Malik',
          text: 'Can you please make sure the fries are crispy?',
          time: now - 6 * 60000,
        },
        {
          id: 'msg_2',
          sender: 'staff',
          name: 'Chef Usman (chef)',
          text: 'Absolutely Ayesha, dropping fresh fries right before packing!',
          time: now - 4 * 60000,
        },
      ],
      history: [
        { action: 'placed', actor: 'Ayesha Malik (Online)', time: now - 8 * 60000 },
        { action: 'accept', actor: 'Bilal Khan (cashier)', time: now - 7 * 60000 },
        { action: 'assign_rider', actor: 'Bilal Khan (cashier)', time: now - 7 * 60000, note: 'Assigned to Kamran Akmal' },
        { action: 'start', actor: 'Chef Usman (chef)', time: now - 5 * 60000 },
      ],
    },
    {
      id: 'BRW-0027',
      seq: 27,
      placed: now - 15 * 60000,
      target: now - 3 * 60000,
      type: 'dinein',
      loc: 0,
      area: null,
      address: '',
      table: 'T-04',
      name: 'Omer Farooq',
      phone: '0321 8887766',
      email: '',
      note: 'Extra napkins please',
      pay: 0, // cash
      paid: false,
      status: 'ready',
      items: [
        {
          id: 'cortado',
          name: 'CORTADO',
          sel: { shots: 0, milk: 0, temp: 0 },
          qty: 2,
          unitPrice: 850,
          station: 'bar',
          done: true,
        },
        {
          id: 'cinnamon-roll',
          name: 'CINNAMON ROLL',
          sel: { warm: 1, glaze: 1 },
          qty: 2,
          unitPrice: 800,
          station: 'bar',
          done: true,
        },
      ],
      stationStatus: { bar: 'ready', kitchen: 'ready' },
      totals: { sub: 3300, discount: 330, fee: 0, rate: 0.16, tax: 475, total: 3445 },
      promo: 'BREWNS10',
      riderId: null,
      riderName: null,
      riderPhone: null,
      riderPlate: null,
      waiterCall: true,
      messages: [],
      history: [
        { action: 'placed', actor: 'Omer Farooq (Table QR)', time: now - 15 * 60000 },
        { action: 'accept', actor: 'Bilal Khan (cashier)', time: now - 14 * 60000 },
        { action: 'ready', actor: 'Hamza Sheikh (barista)', time: now - 6 * 60000 },
      ],
    },
    {
      id: 'BRW-0028',
      seq: 28,
      placed: now - 3 * 60000,
      target: now + 9 * 60000,
      type: 'pickup',
      loc: 0,
      area: null,
      address: '',
      table: null,
      name: 'Sara Ahmed',
      phone: '0332 9900112',
      email: 'sara@live.com',
      note: 'Less ice in matcha',
      pay: 2, // JazzCash
      paid: true,
      status: 'placed',
      items: [
        {
          id: 'iced-matcha',
          name: 'ICED MATCHA',
          sel: { size: 1, milk: 0, sweet: 1 },
          qty: 1,
          unitPrice: 1350,
          station: 'bar',
          done: false,
        },
        {
          id: 'cardamom-bun',
          name: 'CARDAMOM BUN',
          sel: { serve: 1 },
          qty: 1,
          unitPrice: 750,
          station: 'bar',
          done: false,
        },
      ],
      stationStatus: { bar: 'pending', kitchen: 'ready' },
      totals: { sub: 2100, discount: 0, fee: 0, rate: 0.05, tax: 105, total: 2205 },
      promo: null,
      riderId: null,
      riderName: null,
      riderPhone: null,
      riderPlate: null,
      waiterCall: false,
      messages: [],
      history: [
        { action: 'placed', actor: 'Sara Ahmed (Online)', time: now - 3 * 60000 },
      ],
    },
    {
      id: 'BRW-0025',
      seq: 25,
      placed: now - 45 * 60000,
      target: now - 15 * 60000,
      type: 'delivery',
      loc: 0,
      area: 0,
      address: '22 Tipu Block, New Garden Town',
      table: null,
      name: 'Danish Ali',
      phone: '0315 2233445',
      email: '',
      note: '',
      pay: 0,
      paid: true,
      status: 'delivered',
      items: [
        {
          id: 'margherita-pizza',
          name: 'MARGHERITA PIZZA',
          sel: { size: 1 },
          qty: 1,
          unitPrice: 1650,
          station: 'kitchen',
          done: true,
        },
      ],
      stationStatus: { bar: 'ready', kitchen: 'ready' },
      totals: { sub: 1650, discount: 0, fee: 200, rate: 0.16, tax: 264, total: 2114 },
      promo: null,
      riderId: 'usr_rider',
      riderName: 'Kamran Akmal',
      riderPhone: '0305 7788990',
      riderPlate: 'LEN-8492',
      waiterCall: false,
      messages: [],
      history: [
        { action: 'placed', actor: 'Danish Ali (Online)', time: now - 45 * 60000 },
        { action: 'accept', actor: 'Bilal Khan (cashier)', time: now - 43 * 60000 },
        { action: 'ready', actor: 'Chef Usman (chef)', time: now - 28 * 60000 },
        { action: 'dispatch', actor: 'Kamran Akmal (rider)', time: now - 25 * 60000 },
        { action: 'deliver', actor: 'Kamran Akmal (rider)', time: now - 8 * 60000 },
      ],
    },
  ];

  const waiterCalls: WaiterCall[] = [
    {
      id: 'call_1',
      shop: 0,
      table: 'T-04',
      type: 'assistance',
      status: 'active',
      createdAt: now - 4 * 60000,
    },
  ];

  mutateDb((d) => {
    staffList.forEach((s) => {
      d.staff[s.id] = s;
    });

    orders.forEach((o) => {
      d.orders[o.id] = o;
    });

    waiterCalls.forEach((w) => {
      d.waiterCalls[w.id] = w;
    });

    d.orderSeq = 28;
  });
}
