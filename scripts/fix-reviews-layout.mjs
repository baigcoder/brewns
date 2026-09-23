import fs from 'fs';

// 1. Update app/globals.css
let css = fs.readFileSync('app/globals.css', 'utf8');

// Replace the old reviews CSS block
const oldReviewsCssRegex = /\/\* 7\. New Reviews Section \*\/[\s\S]*?(?=\n\n|$)/;
const newReviewsCss = `/* 7. New Reviews Section */
.reviews {
  position: relative;
  z-index: 10;
  padding: 10.5rem 2.5rem 7rem !important;
  scroll-margin-top: 6rem !important;
  background-color: #11110f !important;
  color: #f4f1eb !important;
  border-top: 1px solid rgba(255, 255, 255, 0.08) !important;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  justify-content: center;
}
.reviews-in {
  max-width: var(--breakpoint-board, 1440px);
  width: 100%;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 3.5rem;
}
.reviews-head {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  max-width: 58rem;
}
.reviews-h2 {
  font-family: var(--font-serif) !important;
  font-size: clamp(2.25rem, 4.2vw, 3.75rem) !important;
  line-height: 1.12 !important;
  letter-spacing: -0.02em !important;
  text-transform: uppercase !important;
  color: #ffffff !important;
  margin: 0 !important;
}
.reviews-meta-bar {
  display: flex;
  align-items: center;
  gap: 1.75rem;
  flex-wrap: wrap;
  font-family: var(--font-space-mono);
  font-size: 0.8125rem;
  letter-spacing: 0.06em;
  color: #c98a4b;
}
.reviews-stars {
  display: inline-flex;
  gap: 0.25rem;
  color: #e59a45;
  font-size: 0.95rem;
  letter-spacing: 0.1em;
}
.reviews-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1.5rem;
  width: 100%;
}
@media (max-width: 1100px) {
  .reviews-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
@media (max-width: 640px) {
  .reviews-grid {
    grid-template-columns: 1fr;
  }
}
.review-card {
  position: relative !important;
  display: flex !important;
  flex-direction: column !important;
  justify-content: space-between !important;
  border: 1px solid rgba(255, 255, 255, 0.12) !important;
  background: rgba(255, 255, 255, 0.03) !important;
  padding: 2.25rem 1.85rem !important;
  border-radius: 4px !important;
  min-height: 25rem !important;
  box-sizing: border-box !important;
  transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.3s ease, box-shadow 0.3s ease !important;
  backdrop-filter: blur(8px) !important;
}
.review-card:hover {
  transform: translateY(-6px) !important;
  border-color: rgba(201, 138, 75, 0.5) !important;
  box-shadow: 0 18px 40px rgba(0, 0, 0, 0.45) !important;
}
.review-card-inner {
  display: flex !important;
  flex-direction: column !important;
  justify-content: space-between !important;
  height: 100% !important;
  width: 100% !important;
  gap: 1.5rem !important;
}
.review-top {
  display: flex !important;
  flex-direction: row !important;
  justify-content: space-between !important;
  align-items: center !important;
  width: 100% !important;
  flex: 0 0 auto !important;
}
.review-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.25rem 0.65rem;
  background: rgba(201, 138, 75, 0.12);
  border: 1px solid rgba(201, 138, 75, 0.3);
  border-radius: 9999px;
  font-family: var(--font-space-mono);
  font-size: 0.625rem;
  letter-spacing: 0.06em;
  color: #c98a4b;
  text-transform: uppercase;
  font-weight: 700;
}
.review-quote {
  font-family: var(--font-serif) !important;
  font-size: 1.125rem !important;
  line-height: 1.55 !important;
  color: #ede9e1 !important;
  font-style: italic !important;
  margin: 0 !important;
  flex: 1 1 auto !important;
  display: block !important;
  width: 100% !important;
}
.review-footer {
  border-top: 1px solid rgba(255, 255, 255, 0.1) !important;
  padding-top: 1.25rem !important;
  display: flex !important;
  flex-direction: column !important;
  gap: 0.35rem !important;
  width: 100% !important;
  flex: 0 0 auto !important;
}
.review-author {
  font-family: var(--font-space-mono) !important;
  font-size: 0.8125rem !important;
  font-weight: 700 !important;
  letter-spacing: 0.06em !important;
  color: #ffffff !important;
  text-transform: uppercase !important;
  display: block !important;
}
.review-role {
  font-family: var(--font-space-mono) !important;
  font-size: 0.6875rem !important;
  color: #8c8881 !important;
  letter-spacing: 0.04em !important;
  display: block !important;
}
.review-fav {
  margin-top: 0.4rem !important;
  font-family: var(--font-space-mono) !important;
  font-size: 0.625rem !important;
  color: #c98a4b !important;
  letter-spacing: 0.06em !important;
  text-transform: uppercase !important;
  display: block !important;
}`;

css = css.replace(oldReviewsCssRegex, newReviewsCss);
fs.writeFileSync('app/globals.css', css);
console.log('Successfully updated app/globals.css with clean reviews layout!');

// 2. Update components/brewns/brewnsMarkup.ts
const fileContent = fs.readFileSync('components/brewns/brewnsMarkup.ts', 'utf8');
const match = fileContent.match(/export const BREWNS_MARKUP =\s*("[\s\S]*");\s*$/);
let markup = JSON.parse(match[1]);

// Replace review cards with clean review-card-inner markup
const oldSectionRegex = /<!-- 6 — Reviews -->[\s\S]*?<\/section>/;
const fixedReviewsMarkup = `<!-- 6 — Reviews -->
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
      <article class="review-card">
        <div class="review-card-inner">
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

      <article class="review-card">
        <div class="review-card-inner">
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

      <article class="review-card">
        <div class="review-card-inner">
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

      <article class="review-card">
        <div class="review-card-inner">
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
</section>`;

markup = markup.replace(oldSectionRegex, fixedReviewsMarkup);
fs.writeFileSync('components/brewns/brewnsMarkup.ts', `export const BREWNS_MARKUP = ${JSON.stringify(markup)};\n`);
console.log('Successfully updated brewnsMarkup.ts with fixed reviews markup!');
