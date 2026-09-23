import fs from 'fs';

const cssToAppend = `
/* ═══════════ Dev Indicator & Watermark Suppression ═══════════ */
nextjs-portal,
[data-nextjs-toast],
#next-logo,
[data-nextjs-route-announcer],
[data-nextjs-dialog-overlay] {
  display: none !important;
  opacity: 0 !important;
  pointer-events: none !important;
  visibility: hidden !important;
}

/* ═══════════ Section-Wide Enhancements ═══════════ */

/* 1. Hero 3D Studio & Card Polish */
.hero-card {
  z-index: 25 !important;
  backdrop-filter: blur(12px) !important;
  background: rgba(17, 17, 15, 0.88) !important;
  border: 1px solid rgba(255, 255, 255, 0.16) !important;
  box-shadow: 0 16px 36px rgba(0, 0, 0, 0.45) !important;
}
.hero-drag-hint {
  position: absolute;
  bottom: 2.25rem;
  left: 50%;
  transform: translateX(-50%);
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.45rem 0.95rem;
  background: rgba(17, 17, 15, 0.8);
  border: 1px solid rgba(201, 138, 75, 0.35);
  border-radius: 9999px;
  font-family: var(--font-space-mono);
  font-size: 0.6875rem;
  letter-spacing: 0.08em;
  color: #c98a4b;
  pointer-events: none;
  backdrop-filter: blur(8px);
  z-index: 20;
  transition: opacity 0.4s ease;
}
.hero-card-quick-add {
  margin-top: 0.75rem;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.45rem 0.75rem;
  background: #ffffff;
  color: #11110f;
  font-family: var(--font-space-mono);
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  border: none;
  cursor: pointer;
  transition: background 0.2s ease, transform 0.15s ease;
}
.hero-card-quick-add:hover {
  background: #c98a4b;
  color: #ffffff;
  transform: translateY(-1px);
}

/* 2. Menu Section Polish */
.card {
  transition: border-color 0.25s ease, box-shadow 0.25s ease !important;
}
.card:hover {
  border-color: rgba(17, 17, 17, 0.6) !important;
  box-shadow: 0 14px 30px rgba(0, 0, 0, 0.08) !important;
}
.card-btn-add {
  margin-top: 0.4rem;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.35rem 0.6rem;
  background: rgba(17, 17, 17, 0.05);
  border: 1px solid rgba(17, 17, 17, 0.2);
  font-family: var(--font-space-mono);
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: var(--foreground-inverse);
  cursor: pointer;
  transition: all 0.2s ease;
}
.card-btn-add:hover {
  background: var(--foreground-inverse);
  color: var(--background);
}

/* 3. Shop Card 01 Bestseller Unclipped Bag */
.shop-grid > li:first-child .shop-media {
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  overflow: visible !important;
}
.shop-grid > li:first-child .shop-media img {
  object-fit: contain !important;
  max-height: 82% !important;
  transform: translateY(-12px) scale(0.95) !important;
}

/* 4. Locations & Badges */
.loc-badge {
  white-space: nowrap !important;
  font-size: 0.6875rem !important;
  letter-spacing: 0.04em !important;
}

/* 5. Order Section Containment */
.order {
  overflow: clip !important;
  position: relative !important;
}

/* 6. Philosophy Swiss Editorial Seals */
.phil-claims {
  display: flex !important;
  gap: 1.5rem !important;
  flex-wrap: wrap !important;
}
.phil-claim-item {
  display: inline-flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.6rem 1.25rem;
  border: 1px solid rgba(255, 255, 255, 0.18);
  background: rgba(255, 255, 255, 0.03);
  font-family: var(--font-space-mono);
  font-size: 0.75rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #ece8e1;
  backdrop-filter: blur(4px);
}
.phil-claim-num {
  color: #c98a4b;
  font-weight: 700;
}

/* 7. New Reviews Section */
.reviews {
  position: relative;
  z-index: 10;
  padding: 7rem 2.5rem 6rem;
  background-color: #11110f;
  color: #f4f1eb;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}
.reviews-in {
  max-width: var(--breakpoint-board, 1440px);
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
  font-family: var(--font-serif);
  font-size: clamp(2.5rem, 5vw, 4.75rem);
  line-height: 1.05;
  letter-spacing: -0.02em;
  text-transform: uppercase;
  color: #ffffff;
}
.reviews-meta-bar {
  display: flex;
  align-items: center;
  gap: 2rem;
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
}
.reviews-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1.25rem;
}
@media (max-width: 1024px) {
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
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.025);
  padding: 1.85rem 1.6rem;
  border-radius: 2px;
  transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.3s ease, box-shadow 0.3s ease;
  backdrop-filter: blur(4px);
}
.review-card:hover {
  transform: translateY(-5px);
  border-color: rgba(201, 138, 75, 0.45);
  box-shadow: 0 16px 36px rgba(0, 0, 0, 0.35);
}
.review-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.25rem;
}
.review-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.2rem 0.55rem;
  background: rgba(201, 138, 75, 0.12);
  border: 1px solid rgba(201, 138, 75, 0.25);
  border-radius: 9999px;
  font-family: var(--font-space-mono);
  font-size: 0.625rem;
  letter-spacing: 0.06em;
  color: #c98a4b;
  text-transform: uppercase;
}
.review-quote {
  font-family: var(--font-serif);
  font-size: 1.125rem;
  line-height: 1.48;
  color: #ece8e1;
  font-style: italic;
  margin-bottom: 2rem;
  flex: 1;
}
.review-footer {
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  padding-top: 1.1rem;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}
.review-author {
  font-family: var(--font-space-mono);
  font-size: 0.8125rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: #ffffff;
  text-transform: uppercase;
}
.review-role {
  font-family: var(--font-space-mono);
  font-size: 0.6875rem;
  color: #8c8881;
  letter-spacing: 0.04em;
}
.review-fav {
  margin-top: 0.4rem;
  font-family: var(--font-space-mono);
  font-size: 0.625rem;
  color: #c98a4b;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
`;

let css = fs.readFileSync('app/globals.css', 'utf8');
if (!css.includes('Dev Indicator & Watermark Suppression')) {
  css += cssToAppend;
  fs.writeFileSync('app/globals.css', css);
  console.log('Successfully appended enhancements to app/globals.css');
} else {
  console.log('globals.css already contains enhancements');
}
