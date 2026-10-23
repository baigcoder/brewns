/* Three bands that tell the "why" between the menu and the order: what sets
   brewns apart (a grid of six), the three steps from bean to cup (a sticky
   scroll), and the bean subscription. brewnsMarkup.ts places them in the page;
   initBrewns.ts lights the active pillar as it scrolls past. */

import { catalogItem, money } from '@/lib/catalog';
import { ANNOUNCEMENT } from '@/lib/siteNav';
import { SPOTLIGHT } from '@/lib/spotlight';

const ARROW = `<svg viewBox="0 0 12.2137 13.2551" fill="none" aria-hidden="true"><path d="M11.9501 7.26396C12.3016 6.91249 12.3016 6.34264 11.9501 5.99117L6.22254 0.263604C5.87107 -0.0878682 5.30122 -0.0878682 4.94975 0.263604C4.59828 0.615076 4.59828 1.18492 4.94975 1.5364L10.0409 6.62756L4.94975 11.7187C4.59828 12.0702 4.59828 12.6401 4.94975 12.9915C5.30122 13.343 5.87107 13.343 6.22254 12.9915L11.9501 7.26396ZM0 6.62756V7.52756H11.3137V6.62756V5.72756H0V6.62756Z" fill="currentColor"/></svg>`;

const icon = (d: string) =>
  `<svg class="why-ico" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;

const WHY = [
  ['ROASTED IN LAHORE', 'Small batches every week, so the bag in your hands is never more than days old.', '<ellipse cx="24" cy="24" rx="11" ry="16" transform="rotate(30 24 24)"/><path d="M17 33c6-4 8-14 14-18"/>'],
  ['92&#176;C &#183; 27 SEC', 'Every shot pulled to the same numbers at every counter, checked through the day.', '<circle cx="24" cy="26" r="14"/><path d="M24 26V17M20 6h8M24 6v6"/>'],
  ['4 MIN DOOR TO CUP', 'Order ahead and the cup is poured to meet you, not left waiting on the counter.', '<path d="M10 18h26v10a12 12 0 0 1-12 12h-2a12 12 0 0 1-12-12z"/><path d="M36 21h2a5 5 0 0 1 0 10h-3M17 6c-2 3 2 5 0 8M24 6c-2 3 2 5 0 8M31 6c-2 3 2 5 0 8"/>'],
  ['TRACEABLE BEANS', 'A house blend of Colombia and Ethiopia, plus a washed Yirgacheffe from 2,100 m.', '<path d="M24 42s-13-11-13-22a13 13 0 0 1 26 0c0 11-13 22-13 22z"/><circle cx="24" cy="20" r="5"/>'],
  ['GENTLER ON THE CITY', 'Plant-based lids, recycled paper sleeves and valved bags you can reuse.', '<path d="M12 36c0-14 10-24 26-24 0 16-10 26-24 26"/><path d="M12 36l14-14"/>'],
  ['A CARD THAT REMEMBERS', 'A stamp for every drink, a free one every ten, kept safe in your account.', '<rect x="7" y="12" width="34" height="24" rx="4"/><circle cx="16" cy="24" r="3"/><circle cx="24" cy="24" r="3"/><circle cx="32" cy="24" r="3"/>'],
];

export const WHY_MARKUP = `
<!-- Why brewns -->
<section aria-label="Why brewns" id="why" data-header-theme="dark" class="why">
  <div class="why-in">
    <div class="why-head">
      <p class="why-eyebrow" data-iv="rise" data-y="10"><span class="sl">//</span><span class="sls"> </span>WHY BREWNS</p>
      <h2 class="why-h2" data-iv="rise" data-y="24" data-d="80">SMALL DETAILS.<br><span class="why-script">done properly.</span></h2>
    </div>
    <ul class="why-grid">${WHY.map(
      ([t, d, path], i) =>
        `<li class="why-card" data-iv="rise" data-y="24" data-d="${120 + i * 70}">${icon(path)}<span class="why-n">0${i + 1}</span><h3>${t}</h3><p>${d}</p></li>`,
    ).join('')}</ul>
  </div>
</section>
`;

const PILLARS = [
  ['01', 'SOURCED', 'with names attached.', 'We buy from washing stations we can name, not from a sack labelled &#8220;arabica&#8221;. Colombia and Ethiopia in the house blend; a washed heirloom from Yirgacheffe on its own.', '/assets/menu/bag-yirgacheffe.webp', 'A brewns Ethiopia Yirgacheffe bag', 'ORIGIN &#183; 2,100 M'],
  ['02', 'ROASTED', 'every single week.', 'Slow Roast goes a shade past medium so the sugars caramelise without tipping into bitter. Small batches, every week, packed the same day in a valved bag.', '/assets/menu/bag-slow-roast.webp', 'A brewns Slow Roast bag', 'MEDIUM &#183; WEEKLY'],
  ['03', 'BREWED', 'to the same numbers.', '92&#176;C, 27 seconds, milk to 65&#176;C so it stays sweet. The recipe is the same at every counter, so a latte in Gulberg tastes like a latte in Johar Town.', '/assets/menu/cup-latte.webp', 'A brewns latte in a takeaway cup', '92&#176;C &#183; 27 SEC'],
];

export const PILLARS_MARKUP = `
<!-- Bean to cup: three pillars that pin while you scroll -->
<section aria-label="From bean to cup" id="pillars" data-header-theme="light" class="pillars" data-pillar="0">
  <div class="pillars-in">
    <div class="pillars-stage" aria-hidden="true">
      <div class="pillars-sticky">
        <span class="pillars-ring"></span>
        ${PILLARS.map(([n, , , , src, alt, tag], i) => `<figure class="pillars-fig" data-i="${i}"><img src="${src}" alt="${alt}" loading="lazy" decoding="async" width="520" height="640"><figcaption><span>${n}</span>${tag}</figcaption></figure>`).join('')}
        <ol class="pillars-dots">${PILLARS.map((_, i) => `<li data-i="${i}"></li>`).join('')}</ol>
      </div>
    </div>
    <div class="pillars-steps">
      <p class="pillars-eyebrow" data-iv="rise" data-y="10"><span class="sl">//</span><span class="sls"> </span>FROM BEAN TO CUP</p>
      ${PILLARS.map(
        ([n, word, script, body, src], i) =>
          `<article class="pillars-step" data-i="${i}"><img class="pillars-mob" src="${src}" alt="" loading="lazy" decoding="async" width="520" height="640"><p class="pillars-n">${n} / 03</p><h2 class="pillars-h">${word}<span class="pillars-script">${script}</span></h2><p class="pillars-body">${body}</p>${
            i === 0 ? `<a href="/about" class="pillars-link">OUR STORY ${ARROW}</a>` : i === 1 ? `<a href="#shop/slow-roast" class="pillars-link" data-go="product:slow-roast">SHOP THE BEANS ${ARROW}</a>` : `<a href="/locations" class="pillars-link">VISIT A COUNTER ${ARROW}</a>`
          }</article>`,
      ).join('')}
    </div>
  </div>
</section>
`;

export const SUBSCRIBE_MARKUP = `
<!-- Bean subscription -->
<section aria-label="Bean subscription" id="subscribe" data-header-theme="light" class="subband">
  <svg class="subband-tear" viewBox="0 0 1440 28" preserveAspectRatio="none" aria-hidden="true"><path d="M0 28V12l40 6 34-10 46 9 38-12 52 11 30-8 48 10 44-11 36 9 50-7 40 10 34-12 46 11 42-9 38 8 52-10 30 9 48-8 44 11 36-12 50 9 40-6 34 10 46-11 38 8 52-9 30 10 48-7 44 9 36-11 50 8 40-9 32 12V28z" fill="currentColor"/></svg>
  <div class="subband-in">
    <div class="subband-copy">
      <p class="subband-eyebrow" data-iv="rise" data-y="10"><span class="sl">//</span><span class="sls"> </span>SUBSCRIBE &amp; SAVE</p>
      <h2 class="subband-h2" data-iv="rise" data-y="24" data-d="80">COFFEE ON<br><span class="subband-script">your schedule.</span></h2>
      <p class="subband-lede" data-iv="rise" data-y="16" data-d="160">Pick a bag, pick every two or four weeks, and the beans arrive roasted that week. Ten percent comes off every delivery, automatically.</p>
      <div class="subband-ctas" data-iv="rise" data-y="14" data-d="220">
        <a href="#shop/slow-roast" class="btn btn-dark" data-go="product:slow-roast:plan=1">START A SUBSCRIPTION ${ARROW}</a>
        <a href="/subscribe" class="subband-more">HOW IT WORKS ${ARROW}</a>
      </div>
    </div>
    <ul class="subband-perks">
      <li data-iv="rise" data-y="20" data-d="160"><b>10%</b><span>OFF EVERY BAG</span><p>Taken off at checkout, on every delivery.</p></li>
      <li data-iv="rise" data-y="20" data-d="230"><b>2 / 4</b><span>WEEKS, YOUR CALL</span><p>Match the cadence to how much you brew.</p></li>
      <li data-iv="rise" data-y="20" data-d="300"><b>7</b><span>DAYS FROM ROAST</span><p>Roasted the week it leaves the shop.</p></li>
      <li data-iv="rise" data-y="20" data-d="370"><b>3</b><span>COUNTERS OR YOUR DOOR</span><p>Collect in store or have it delivered in Lahore.</p></li>
    </ul>
  </div>
</section>
`;

const SPOT_ITEMS = SPOTLIGHT.ids.map((id) => catalogItem(id)).filter((p) => p !== undefined);

export const SPOTLIGHT_MARKUP = `
<!-- This season: a few things to try -->
<section aria-label="${SPOTLIGHT.eyebrow}" id="season" data-header-theme="light" class="season">
  <div class="season-in">
    <div class="season-head">
      <p class="season-eyebrow" data-iv="rise" data-y="10"><span class="dot" data-pulse></span>${SPOTLIGHT.eyebrow.toUpperCase()}</p>
      <h2 class="season-h2" data-iv="rise" data-y="24" data-d="80">${SPOTLIGHT.title.toUpperCase()}<span class="season-script">${SPOTLIGHT.script}</span></h2>
      <p class="season-lede" data-iv="rise" data-y="16" data-d="160">${SPOTLIGHT.lede}</p>
    </div>
    <ul class="season-grid">${SPOT_ITEMS.map(
      (p, i) =>
        `<li data-iv="rise" data-y="30" data-d="${160 + i * 90}"><a href="/shop/${p.id}" class="season-card">${p.tag ? `<span class="season-tag">${p.tag}</span>` : ''}<span class="season-img">${p.photo ? `<img src="/assets/${p.photo}" alt="${p.alt || p.name}" loading="lazy" decoding="async" width="420" height="520">` : ''}</span><span class="season-body"><b>${p.name}</b><span>${(p.notes || []).slice(0, 2).join(' · ')}</span><span class="season-price">${money(p.price)} ${ARROW}</span></span></a></li>`,
    ).join('')}</ul>
  </div>
</section>
`;

/** The line across the top of the home page, as on every other page. */
export const NOTE_MARKUP = `<p class="gh-note home-note"><span>${ANNOUNCEMENT.text}</span><span class="gh-note-more">${ANNOUNCEMENT.more}</span><a href="${ANNOUNCEMENT.href}">${ANNOUNCEMENT.cta} →</a></p>`;

/* The brewns tour: a narrated walk through the real site, right after the hero:
   the menu and 3D products, ordering ahead and live tracking, the club and the
   extras, Sarah on the phone, and the staff console. Subtitled, because it plays
   muted while in view; "Sound on" starts it again from the top with the
   voice-over (see initBrewns). Nothing loads until it is near the screen. */
export const FILM_MARKUP = `
<section aria-label="The brewns tour" id="film" data-header-theme="dark" class="film">
  <div class="film-in">
    <div class="film-head" data-iv="rise" data-y="16">
      <p class="film-eyebrow"><span aria-hidden="true"></span>The brewns tour · 1 min 45</p>
      <h2 class="film-h">See how brewns works, <em>front to back.</em></h2>
    </div>
    <figure class="film-frame" data-iv="rise" data-y="24" data-d="120">
      <video class="film-video" id="film-video" muted playsinline loop preload="none" poster="/assets/film/brewns-tour-poster.webp" aria-label="The brewns tour, recorded on the real site: the menu and 3D products, a product page, ordering ahead with a printed receipt and live tracking, the club card, brew timer, subscriptions, gift cards and table bookings, a table booked with Sarah the AI concierge, and the staff console: sales, the till, the kitchen screen, tables, deliveries, staff sign-up and approval, and access by role."></video>
      <button type="button" class="film-toggle" id="film-toggle" aria-label="Play the film" data-state="paused"><span class="film-ico" aria-hidden="true"></span></button>
      <button type="button" class="film-sound" id="film-sound" aria-pressed="false"><span class="film-eq" aria-hidden="true"><i></i><i></i><i></i><i></i></span><span class="film-sound-l">Sound on</span></button>
    </figure>
  </div>
</section>
`;
