import fs from 'fs';

// Extract the existing raw string content from brewnsMarkup.ts
const fileContent = fs.readFileSync('components/brewns/brewnsMarkup.ts', 'utf8');
const match = fileContent.match(/export const BREWNS_MARKUP =\s*("[\s\S]*");\s*$/);
if (!match) {
  console.error('Could not match BREWNS_MARKUP export in components/brewns/brewnsMarkup.ts');
  process.exit(1);
}

let markup = JSON.parse(match[1]);

// 1. Header Navigation - Add Reviews link
if (!markup.includes('href="#reviews"')) {
  markup = markup.replace(
    '<li><a href="#locations" data-ul>Locations</a></li>\n    </ul>',
    '<li><a href="#locations" data-ul>Locations</a></li>\n      <li><a href="#reviews" data-ul>Reviews</a></li>\n    </ul>'
  );
  markup = markup.replace(
    '<a href="#locations"><span>04</span>Locations</a>\n  </nav>',
    '<a href="#locations"><span>04</span>Locations</a>\n    <a href="#reviews"><span>05</span>Reviews</a>\n  </nav>'
  );
}

// 2. Hero Section - Add 3D Drag hint and Quick Add on Hero Card
if (!markup.includes('hero-drag-hint')) {
  markup = markup.replace(
    '<span aria-hidden="true" class="hero-handle" id="hero-handle"></span>',
    '<span aria-hidden="true" class="hero-handle" id="hero-handle"></span>\n      <span class="hero-drag-hint" id="hero-drag-hint"><span aria-hidden="true">✦</span> DRAG 360° TO EXPLORE</span>'
  );
}
if (!markup.includes('hero-card-quick-add')) {
  markup = markup.replace(
    '<ul data-card="meta"></ul>\n      </div>',
    '<ul data-card="meta"></ul>\n        <button type="button" class="hero-card-quick-add" id="hero-quick-add" aria-label="Quick add Slow Roast whole bean to bag"><span>+ QUICK ADD</span><span>$18.00</span></button>\n      </div>'
  );
}

// 3. Locations Section - Remove data-dr from hours to prevent overlap bugs
markup = markup.replace(
    '<p class="locs-hours" data-iv="print" data-c="46,26" data-d="280" style="clip-path:inset(0 100% 0 0)"><span class="blk" data-dr data-d="360">OPEN DAILY</span><span class="blk" data-dr data-d="360">07:00 - 21:00</span></p>',
    '<p class="locs-hours" data-iv="print" data-c="46,26" data-d="280" style="clip-path:inset(0 100% 0 0)"><span class="blk">OPEN DAILY</span><span class="blk">07:00 - 21:00</span></p>'
);

// 4. Philosophy Section - Swiss Editorial Seals
markup = markup.replace(
  '<ul class="phil-claims">\n      <li data-iv="print" data-c="80,26" data-d="340" style="clip-path:inset(0 100% 0 0)">Good coffee.</li>\n      <li data-iv="print" data-c="80,26" data-d="430" style="clip-path:inset(0 100% 0 0)">NO CEREMONY.</li>\n      <li data-iv="print" data-c="80,26" data-d="520" style="clip-path:inset(0 100% 0 0)">NO WAITING.</li>\n    </ul>',
  `<ul class="phil-claims">
      <li data-iv="print" data-c="80,26" data-d="340" style="clip-path:inset(0 100% 0 0)"><span class="phil-claim-item"><span class="phil-claim-num">01</span> GOOD COFFEE.</span></li>
      <li data-iv="print" data-c="80,26" data-d="430" style="clip-path:inset(0 100% 0 0)"><span class="phil-claim-item"><span class="phil-claim-num">02</span> NO CEREMONY.</span></li>
      <li data-iv="print" data-c="80,26" data-d="520" style="clip-path:inset(0 100% 0 0)"><span class="phil-claim-item"><span class="phil-claim-num">03</span> NO WAITING.</span></li>
    </ul>`
);

// 5. Add NEW REVIEWS SECTION
const reviewsMarkup = `
<!-- 6 — Reviews -->
<section aria-label="Customer Reviews and Press Acclaims" id="reviews" data-header-theme="dark" class="reviews">
  <div class="reviews-in">
    <div class="reviews-head">
      <p class="t-eyebrow" data-iv="print" data-c="46,26" style="clip-path:inset(0 100% 0 0)"><span class="sl">//</span><span class="sls"> </span>06 COMMUNITY &amp; ACCLAIMS</p>
      <h2 class="reviews-h2" data-te="lines" data-margin="0px 0px -20% 0px">PRAISE FROM THE DAILY RITUAL.</h2>
      <div class="reviews-meta-bar">
        <span class="reviews-stars" aria-label="5 out of 5 stars">★★★★★</span>
        <span>4.9 / 5.0 RATING · 1,420+ VERIFIED PATRONS</span>
        <span>SAN FRANCISCO, CA</span>
      </div>
    </div>
    <div class="reviews-grid">
      <article class="review-card lean">
        <div>
          <div class="review-top">
            <span class="review-badge">✦ CRITIC'S PICK</span>
            <span class="reviews-stars">★★★★★</span>
          </div>
          <blockquote class="review-quote">"The Slow Roast is simply transcendent. Perfectly balanced acidity with velvety caramel undertones that linger for minutes."</blockquote>
          <footer class="review-footer">
            <cite class="review-author">SF Coffee Digest</cite>
            <span class="review-role">Specialty Roasters Review · 2026</span>
            <span class="review-fav">Favorite: Slow Roast Whole Bean</span>
          </footer>
        </div>
      </article>

      <article class="review-card lean">
        <div>
          <div class="review-top">
            <span class="review-badge">● VALENCIA REGULAR</span>
            <span class="reviews-stars">★★★★★</span>
          </div>
          <blockquote class="review-quote">"Skip the line is genuinely real. I place my order walking up Valencia, and my iced matcha is freshly whisked the second I step in."</blockquote>
          <footer class="review-footer">
            <cite class="review-author">Elena Vance</cite>
            <span class="review-role">Daily Patron · 140+ Orders Ahead</span>
            <span class="review-fav">Favorite: Iced Matcha Latte</span>
          </footer>
        </div>
      </article>

      <article class="review-card lean">
        <div>
          <div class="review-top">
            <span class="review-badge">✦ BEST PAIRING</span>
            <span class="reviews-stars">★★★★★</span>
          </div>
          <blockquote class="review-quote">"Their cardamom glazed cinnamon roll paired with the single-origin pourover is the undisputed highlight of my Saturday mornings."</blockquote>
          <footer class="review-footer">
            <cite class="review-author">Eater SF</cite>
            <span class="review-role">Weekend Ritual Guide</span>
            <span class="review-fav">Favorite: Cardamom Cinnamon Roll</span>
          </footer>
        </div>
      </article>

      <article class="review-card lean">
        <div>
          <div class="review-top">
            <span class="review-badge">● DOWNTOWN REGULAR</span>
            <span class="reviews-stars">★★★★★</span>
          </div>
          <blockquote class="review-quote">"Hands down the most thoughtful coffee ritual in the city. The space feels like an architectural sanctuary, and the espresso has zero bitterness."</blockquote>
          <footer class="review-footer">
            <cite class="review-author">Marcus Sterling</cite>
            <span class="review-role">Coffee Street Resident</span>
            <span class="review-fav">Favorite: Single Shot Espresso</span>
          </footer>
        </div>
      </article>
    </div>
  </div>
</section>
`;

if (!markup.includes('id="reviews"')) {
  markup = markup.replace(
    '<!-- 6 — Order -->',
    `${reviewsMarkup}\n<!-- 7 — Order -->`
  );
}

// 6. Footer Hours - Remove data-dr to prevent overlapping digits
markup = markup.replace(
  '<p class="ftr-addr h"><span data-rise data-d="500"><span data-dr data-d="560">OPEN DAILY</span></span><span data-rise data-d="570"><span data-dr data-d="630">07:00 - 21:00</span></span></p>',
  '<p class="ftr-addr h"><span data-rise data-d="500"><span>OPEN DAILY</span></span><span data-rise data-d="570"><span>07:00 - 21:00</span></span></p>'
);

const newFileContent = `export const BREWNS_MARKUP = ${JSON.stringify(markup)};\n`;
fs.writeFileSync('components/brewns/brewnsMarkup.ts', newFileContent);
console.log('Successfully updated brewnsMarkup.ts with all section enhancements and reviews!');
