/* Where every page links to: the header across the top and the footer columns.
   One list, so every page of the site offers the same way around. The home
   page's own header and footer (initBrewns.ts, brewnsMarkup.ts) mirror it. */

export type NavLink = { href: string; label: string };

export const HEADER_LINKS: NavLink[] = [
  { href: '/#menu', label: 'Menu' },
  { href: '/shop', label: 'Shop' },
  { href: '/coffee', label: 'Our Coffee' },
  { href: '/locations', label: 'Locations' },
  { href: '/about', label: 'Our Story' },
  { href: '/journal', label: 'Journal' },
];

export const FOOTER_COLUMNS: [string, NavLink[]][] = [
  ['Shop', [
    { href: '/shop', label: 'All products' },
    { href: '/shop#beans', label: 'Coffee beans' },
    { href: '/subscribe', label: 'Subscribe & save' },
    { href: '/gift-cards', label: 'Gift cards' },
    { href: '/shop#merch', label: 'Merch' },
  ]],
  ['Visit', [
    { href: '/locations', label: 'Locations' },
    { href: '/reserve', label: 'Book a table' },
    { href: '/#menu', label: 'Café menu' },
    { href: '/#order', label: 'Order ahead' },
    { href: '/#faq', label: 'Events & catering' },
  ]],
  ['brewns', [
    { href: '/about', label: 'Our story' },
    { href: '/coffee', label: 'Our coffee' },
    { href: '/journal', label: 'Journal' },
    { href: '/#club', label: 'brewns Club' },
    { href: '/careers', label: 'Careers' },
  ]],
  ['Help', [
    { href: '/contact', label: 'Contact us' },
    { href: '/delivery', label: 'Delivery' },
    { href: '/refunds', label: 'Refunds & cancellations' },
    { href: '/brew-timer', label: 'Brew timer' },
    { href: '/flavor-wheel', label: 'Flavour matcher' },
  ]],
];

export const LEGAL_LINKS: NavLink[] = [
  { href: '/privacy', label: 'Privacy' },
  { href: '/terms', label: 'Terms' },
  { href: '/refunds', label: 'Refunds' },
  { href: '/delivery', label: 'Delivery' },
];

/** The line across the top of every page. Change it here for a new offer. */
export const ANNOUNCEMENT = { text: 'Free delivery over Rs 3,000', more: 'Beans roasted every week in Lahore', href: '/delivery', cta: 'Delivery areas' };
