/* The sections a café brand needs beyond the menu and the shop: where to find
   us, the loyalty club, and "good to know" (questions, events and catering, the
   newsletter). brewnsMarkup.ts places them in the page; initBrewns.ts fills in
   the parts that change (open or closed, the club card, the forms). */

import { FAQ, FAQ_TOPICS } from '@/lib/faq';
import { CAFE_PHONE, CAFES, mapEmbedUrl, mapsUrl } from '@/lib/locations';
import { CLUB } from './club';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* The counters: pick one, see it on the map, order pickup from it. The first is shown to begin with;
   initBrewns swaps the panel and paints each counter's real status (open, pickup time, paused). */
const first = CAFES[0];
export const LOCATIONS_MARKUP = `
<section aria-label="Our locations" id="locations" data-header-theme="light" class="light where">
  <div class="swirl-frame fade-top" data-swirl="rtl"><span class="swirl-box"><span class="swirl-mask mask"><span class="swirl-fill"></span></span></span></div>
  <div class="where-in">
    <div class="where-head">
      <h2 class="where-h2" data-iv="rise" data-y="24">FIND YOUR<br>COUNTER.</h2>
      <p class="where-lede" data-iv="rise" data-y="16" data-d="100">Same beans, same 92&#176;C, in three corners of Lahore, open every day from 07:00 to 21:00. Pick a counter to see it on the map, then order ahead for pickup.</p>
    </div>
    <div class="where-body">
      <div class="where-list" role="tablist" aria-label="Our counters" aria-orientation="vertical">${CAFES.map(
        (c, i) =>
          `<button type="button" role="tab" class="where-shop" id="where-tab-${i}" aria-controls="where-panel" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}" data-where="${i}" data-iv="rise" data-y="16" data-d="${140 + i * 70}"><span class="where-name">${esc(c.name)}</span><span class="where-area">${esc(c.area)} &#183; ${esc(c.nickname)}</span><span class="where-status" data-where-status="${i}">Open every day 07:00&#8211;21:00</span></button>`,
      ).join('')}</div>
      <div class="where-panel" id="where-panel" role="tabpanel" aria-labelledby="where-tab-0" data-iv="rise" data-y="24" data-d="200">
        <div class="where-map"><iframe title="Map of ${esc(first.name)}" src="${mapEmbedUrl(first)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe></div>
        <div class="where-info">
          <p class="where-blurb" data-where-blurb>${esc(first.blurb)}</p>
          <ul class="where-features" data-where-features>${first.features.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>
          <div class="where-actions"><button type="button" class="where-cta" data-where-order>ORDER PICKUP HERE <span aria-hidden="true">&#8594;</span></button><a class="where-cta ghost" data-where-dir href="${mapsUrl(first)}" target="_blank" rel="noopener noreferrer">DIRECTIONS <span aria-hidden="true">&#8599;</span></a><a class="where-cta ghost" href="tel:${CAFE_PHONE.replace(/\s/g, '')}">CALL</a></div>
        </div>
      </div>
    </div>
  </div>
</section>
`;

export const CLUB_MARKUP = `
<!-- brewns Club -->
<section aria-label="brewns Club" id="club" data-header-theme="dark" class="club">
  <div aria-hidden="true" class="club-glow"></div>
  <div class="club-in">
    <div class="club-copy">
      <h2 class="club-h2" data-iv="rise" data-y="24">EVERY TENTH<br>CUP IS ON US.</h2>
      <p class="club-lede" data-iv="rise" data-y="16" data-d="100">A stamp for every drink, and the tenth one is free. Join with your mobile number; sign in and your card follows you to any phone and all three counters.</p>
      <p class="club-now" id="club-now" hidden></p>
      <ul class="club-perks">
        <li data-iv="rise" data-y="14" data-d="180"><b>1</b><span>stamp for every drink: coffee, matcha and coolers.</span></li>
        <li data-iv="rise" data-y="14" data-d="240"><b>${CLUB.stampsPerReward}th</b><span>drink free, anything up to Rs ${CLUB.rewardCap.toLocaleString('en-US')}.</span></li>
        <li data-iv="rise" data-y="14" data-d="300"><b>2&#215;</b><span>stamps before ${String(CLUB.earlyUntilMin / 60).padStart(2, '0')}:00, at every counter.</span></li>
        <li data-iv="rise" data-y="14" data-d="360"><b>+1</b><span>free drink the week of your birthday.</span></li>
      </ul>
    </div>
    <div class="club-side" id="club-side" data-iv="rise" data-y="30" data-d="200"></div>
  </div>
</section>
`;

const faqItems = FAQ.map(
  (f, i) =>
    `<details class="faq-item" data-topic="${f.topic}"${i === 0 ? ' open' : ''}><summary><span class="faq-q">${esc(f.q)}</span><span class="faq-plus" aria-hidden="true"></span></summary><div class="faq-a"><p>${esc(f.a)}</p></div></details>`,
).join('');

const faqTopics = [['all', 'ALL'], ...Object.entries(FAQ_TOPICS)]
  .map(([key, label], i) => `<button type="button" class="faq-topic" data-faq-topic="${key}" aria-pressed="${i === 0}">${label}</button>`)
  .join('');

export const HELP_MARKUP = `
<!-- Good to know: questions, events and catering, the newsletter -->
<section aria-label="Good to know" id="faq" data-header-theme="light" class="help">
  <div class="help-in">
    <div class="help-main">
      <p class="help-eyebrow" data-iv="rise" data-y="10"><span class="sl">//</span><span class="sls"> </span>GOOD TO KNOW</p>
      <h2 class="help-h2" data-iv="rise" data-y="24" data-d="80">QUESTIONS,<br>ANSWERED.</h2>
      <div class="faq-topics" role="group" aria-label="Filter questions by topic" data-iv="rise" data-y="14" data-d="160">${faqTopics}</div>
      <div class="faq-list" id="faq-list" data-iv="rise" data-y="20" data-d="220">${faqItems}</div>
      <p class="help-more" data-iv="rise" data-y="12" data-d="260">Still wondering? <a href="mailto:hello@brewns.coffee">hello@brewns.coffee</a> or <a href="tel:+924212345678">+92 42 1234 5678</a>, 07:00 to 21:00.</p>
    </div>
    <aside class="events" aria-label="Events and catering" data-iv="rise" data-y="30" data-d="200">
      <p class="events-eyebrow"><span class="sl">//</span><span class="sls"> </span>EVENTS &amp; CATERING</p>
      <h3 class="events-h">COFFEE FOR THIRTY, OR THREE HUNDRED.</h3>
      <ul class="events-list">
        <li><b>EVENT COFFEE BAR</b><span>Our baristas and an espresso bar at your mehndi, launch or conference.</span></li>
        <li><b>OFFICE COFFEE</b><span>Boxes of coffee and pastries for the morning meeting, delivered hot.</span></li>
        <li><b>PRIVATE EVENINGS</b><span>A brewns shop for your group: birthdays, book clubs, team nights.</span></li>
        <li><b>WHOLESALE BEANS</b><span>Slow Roast for your café, hotel or office machine, roasted weekly.</span></li>
      </ul>
      <button type="button" class="btn btn-dark events-cta" data-enquiry="event">PLAN AN EVENT <svg viewBox="0 0 12.2137 13.2551" fill="none" aria-hidden="true"><path d="M11.9501 7.26396C12.3016 6.91249 12.3016 6.34264 11.9501 5.99117L6.22254 0.263604C5.87107 -0.0878682 5.30122 -0.0878682 4.94975 0.263604C4.59828 0.615076 4.59828 1.18492 4.94975 1.5364L10.0409 6.62756L4.94975 11.7187C4.59828 12.0702 4.59828 12.6401 4.94975 12.9915C5.30122 13.343 5.87107 13.343 6.22254 12.9915L11.9501 7.26396ZM0 6.62756V7.52756H11.3137V6.62756V5.72756H0V6.62756Z" fill="currentColor"/></svg></button>
      <p class="events-links"><button type="button" data-enquiry="wholesale">WHOLESALE ENQUIRY</button><span aria-hidden="true"> · </span><button type="button" data-enquiry="careers">WORK WITH US</button></p>
    </aside>
  </div>
  <div class="pour" data-iv="rise" data-y="20" data-d="120">
    <div class="pour-copy">
      <p class="pour-eyebrow"><span class="dot" data-pulse></span>THE POUR · A NEWSLETTER</p>
      <h3 class="pour-h">ONE EMAIL A MONTH. NEW ROASTS, SEASONAL DRINKS, FIRST DIBS ON EVENTS.</h3>
    </div>
    <form class="pour-form" id="pour-form" novalidate>
      <label class="pour-field"><span class="mono-fine">YOUR EMAIL</span><input type="email" name="email" autocomplete="email" maxlength="80" placeholder="you@example.com" required></label>
      <button type="submit" class="btn btn-dark">SUBSCRIBE</button>
      <p class="pour-msg mono-fine" id="pour-msg" role="status">NOTHING ELSE, AND YOU CAN LEAVE ANY TIME. <a href="/privacy">PRIVACY</a></p>
    </form>
  </div>
</section>
`;
