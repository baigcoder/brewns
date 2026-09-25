/* The questions people ask at the counter. Shown in the "Good to know" section
   and given to search engines as FAQ structured data (app/layout.tsx), so the
   two always match. Hours, delivery and payment answers restate the checkout's
   numbers in initBrewns.ts (OPEN_MIN, DELIVERY, PAY, TAX): change both. */

export type Faq = { q: string; a: string; topic: 'visit' | 'food' | 'order' | 'club' };

export const FAQ_TOPICS: Record<Faq['topic'], string> = {
  visit: 'VISITING',
  food: 'FOOD & DRINK',
  order: 'ORDERING',
  club: 'CLUB & GIFTS',
};

export const FAQ: Faq[] = [
  {
    topic: 'visit',
    q: 'When are you open?',
    a: 'All three shops, MM Alam Road, CCA DHA Phase 5 and Main Boulevard Johar Town, are open every day from 07:00 to 21:00, Sundays included. Hours change for Ramadan and some public holidays; we post them here and on Instagram first.',
  },
  {
    topic: 'visit',
    q: 'Can I work from the café?',
    a: 'Yes. Every shop has free Wi-Fi and charging points, and laptops are welcome all day. On busy weekend afternoons we may ask big laptop tables to share with groups looking for a seat.',
  },
  {
    topic: 'visit',
    q: 'Is there parking?',
    a: 'All three shops have parking close by: street and valet parking on MM Alam Road, the CCA parking in DHA Phase 5, and parking in front of the Johar Town shop on Main Boulevard.',
  },
  {
    topic: 'visit',
    q: 'Can I book a table, or the whole shop?',
    a: 'Tables are first come, first served. For groups of ten or more, birthdays, meetings or a private evening, send us an event enquiry below and we will hold the space for you.',
  },
  {
    topic: 'food',
    q: 'Is the food halal?',
    a: 'Yes. All the meat in our kitchen, from the smash burger to the pepperoni, comes from halal suppliers, and we are happy to show their certificates at the counter.',
  },
  {
    topic: 'food',
    q: 'Do you have dairy-free, vegan or gluten-free options?',
    a: 'Any milk drink can be made with oat or almond milk for Rs 150 more, and the matcha financier is made without wheat flour. Our kitchen handles wheat, milk, eggs, nuts and sesame, so tell the barista about any allergy and we will check every ingredient with you.',
  },
  {
    topic: 'food',
    q: 'How fresh are the beans?',
    a: 'We roast in small batches every week and print the roast date on the back of every bag. Filter coffee tastes best within five weeks of that date, espresso from about a week after it.',
  },
  {
    topic: 'order',
    q: 'Where do you deliver, and what does it cost?',
    a: 'We deliver to Gulberg, Model Town, Garden Town, DHA Phases 1 to 8, Johar Town and WAPDA Town from the nearest shop, usually in 30 to 45 minutes. The minimum order is Rs 1,000, delivery costs Rs 150 to Rs 300 by area, and it is free over Rs 3,000.',
  },
  {
    topic: 'order',
    q: 'How can I pay?',
    a: 'Cash, card, or JazzCash and Easypaisa through our Raast QR, at the counter or to the rider. Nothing is charged online. Punjab sales tax is 16% on cash bills and 5% when you pay by card or wallet.',
  },
  {
    topic: 'order',
    q: 'Can I change or cancel an order?',
    a: 'Until the barista starts making it, yes: open your order and tap Cancel order, or message the café from the order page. Once it is being made we cannot cancel it, but we can usually change the milk or the time.',
  },
  {
    topic: 'club',
    q: 'How does the brewns Club work?',
    a: 'Join with your name and mobile and you get a welcome stamp. Every drink you order earns a stamp, or two before 09:00, and ten stamps make any drink free, up to Rs 1,500. Add your birthday and there is a free drink in your birthday week too.',
  },
  {
    topic: 'club',
    q: 'Do gift cards expire?',
    a: 'Never. A gift card works at all three shops, the balance carries over between visits, and if the email is lost any barista can look it up by name.',
  },
];
