export interface ReceiptData {
  brandName: string;
  subhead: string;
  orderNumber: string;
  date: string;
  time: string;
  location: string;
  items: {
    qty: number;
    name: string;
    notes?: string;
    price: number;
  }[];
  tax: number;
  tip: number;
  total: number;
  paymentMethod: string;
  status: string;
  footerNote: string;
  webUrl: string;
}

export const SAMPLE_RECEIPT: ReceiptData = {
  brandName: 'VELDT COFFEE HOUSE',
  subhead: 'SPECIALTY COFFEE & ROASTERY',
  orderNumber: 'ORD #00842',
  date: '20/09/2026',
  time: '08:42 AM',
  location: '139 COFFEE STREET, SF',
  items: [
    { qty: 1, name: 'SLOW ROAST NO. 4 (250G)', notes: 'WHOLE BEAN · HUILA', price: 18.0 },
    { qty: 1, name: 'ATELIER FLAT WHITE', notes: 'ORGANIC WHOLE · 6 OZ', price: 4.8 },
    { qty: 1, name: 'CARDAMOM KNOT', notes: 'WARMED · FRESH BAKED', price: 4.4 },
  ],
  tax: 2.31,
  tip: 3.50,
  total: 33.01,
  paymentMethod: 'APPLE PAY (**** 4108)',
  status: 'NOW BREWING · PREPARING FOR YOU',
  footerNote: 'THANK YOU FOR SUPPORTING INDEPENDENT COFFEE ROASTING.',
  webUrl: 'VELDT.COFFEE',
};
