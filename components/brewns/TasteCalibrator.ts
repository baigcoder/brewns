/**
 * "Find Your Pour" Interactive Taste Calibrator
 * A tactile 3-step ritual calibrator that matches the customer's palate
 * to the ideal brewns roast and brew.
 */

import { playSoftClick, playPourDrop, playCupClink } from '@/lib/audio-ritual';

interface CalibratorAnswer {
  method: string;
  profile: string;
  cadence: string;
}

const QUESTIONS = [
  {
    step: 1,
    title: 'HOW DO YOU BREW?',
    subtitle: 'SELECT YOUR MORNING EXTRACTION RITUAL',
    key: 'method',
    options: [
      { id: 'espresso', label: 'ESPRESSO & RISTRETTO', desc: 'Dense, syrupy, concentrated crema' },
      { id: 'filter', label: 'POUR OVER & FILTER', desc: 'Clean, floral, origin-forward extraction' },
      { id: 'milk', label: 'STEAMED MILK / FLAT WHITE', desc: 'Velvety microfoam, sweet caramelization' },
      { id: 'iced', label: 'OVER ARTISAN ICE', desc: 'Slow steeped, cold poured, crisp finish' },
    ],
  },
  {
    step: 2,
    title: 'FLAVOR DESTINATION',
    subtitle: 'WHAT NOTES DOES YOUR PALATE GRAVITATE TOWARD?',
    key: 'profile',
    options: [
      { id: 'caramel', label: 'CARAMEL & ROASTED ALMOND', desc: 'Warm sweetness, round toasted finish' },
      { id: 'fruit', label: 'STONE FRUIT & CITRUS BLOSSOM', desc: 'Vibrant acidity, sparkling clarity' },
      { id: 'cacao', label: 'DARK CHOCOLATE & CACAO', desc: 'Deep bittersweet molasses, full body' },
      { id: 'botanical', label: 'MATCHA, SPICE & CARDAMOM', desc: 'Ceremonial grass, aromatic pastry notes' },
    ],
  },
  {
    step: 3,
    title: 'DAILY CADENCE',
    subtitle: 'WHEN DOES THIS POUR TOUCH YOUR ROUTINE?',
    key: 'cadence',
    options: [
      { id: 'morning', label: 'FIRST CUP AT 07:00', desc: 'The anchor before the city wakes' },
      { id: 'midday', label: 'MIDDAY RESET AT 12:00', desc: 'Sustained clarity between blocks' },
      { id: 'leisure', label: 'AFTERNOON SOUVENIR', desc: 'Sweet, leisurely, paired with a bake' },
    ],
  },
];

const MATCH_MAP: Record<string, { productId: string; matchPercent: number; matchBadge: string; reason: string }> = {
  'espresso|cacao': { productId: 'espresso', matchPercent: 99, matchBadge: 'PERFECT EXTRACTION', reason: 'Pulled tightly at 18g in / 38g out for dark cacao depth.' },
  'milk|caramel': { productId: 'slow-roast', matchPercent: 98, matchBadge: 'HOUSE BENCHMARK', reason: 'Caramelizes naturally in silky milk without turning bitter.' },
  'iced|botanical': { productId: 'iced-matcha', matchPercent: 97, matchBadge: 'CEREMONIAL GRADE', reason: 'Whisked tableside over clear ice spheres.' },
  'iced|caramel': { productId: 'iced-latte', matchPercent: 96, matchBadge: 'COLD COUNTER FAVORITE', reason: 'Double shot over ice topped with cold whole milk.' },
  'milk|botanical': { productId: 'cardamom-bun', matchPercent: 96, matchBadge: 'NORDIC RITUAL', reason: 'Baked fresh with stoneground green cardamom and brown butter.' },
  'filter|fruit': { productId: 'single-origin', matchPercent: 99, matchBadge: 'ORIGIN CLARITY', reason: 'Washed Yirgacheffe heirloom with jasmine florals and sweet peach brightness.' },
  'iced|cacao': { productId: 'nitro-cold-brew', matchPercent: 98, matchBadge: 'NITRO DRAFT', reason: 'Steeped 20 hours and infused with nitrogen for a rich, creamy stout-like head.' },
  'espresso|caramel': { productId: 'cortado', matchPercent: 97, matchBadge: 'BARISTA FAVORITE', reason: 'Equal parts Slow Roast espresso and textured milk in a faceted Gibraltar glass.' },
};

export class TasteCalibrator {
  private overlay: HTMLElement;
  private currentStep = 0;
  private answers: Partial<CalibratorAnswer> = {};
  private onAddMatchToBag: (productId: string) => void;
  private onOpenProduct: (productId: string) => void;

  constructor(
    onAddMatchToBag: (productId: string) => void,
    onOpenProduct: (productId: string) => void
  ) {
    this.onAddMatchToBag = onAddMatchToBag;
    this.onOpenProduct = onOpenProduct;
    this.overlay = document.createElement('div');
    this.overlay.className = 'calibrator-modal';
    this.overlay.hidden = true;
    document.body.appendChild(this.overlay);

    this.overlay.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.closest('.calibrator-close') || target === this.overlay) {
        this.close();
      }
      const optBtn = target.closest('[data-cal-opt]') as HTMLButtonElement;
      if (optBtn) {
        const key = optBtn.dataset.calKey as keyof CalibratorAnswer;
        const id = optBtn.dataset.calOpt;
        if (key && id) {
          playSoftClick();
          this.answers[key] = id;
          if (this.currentStep < QUESTIONS.length - 1) {
            this.currentStep++;
            this.render();
          } else {
            this.currentStep = 3; // Results state
            playCupClink(1.2);
            this.render();
          }
        }
      }
      const addBtn = target.closest('[data-cal-add]') as HTMLElement;
      if (addBtn) {
        const pid = addBtn.dataset.calAdd;
        if (pid) {
          playPourDrop();
          this.onAddMatchToBag(pid);
          this.close();
        }
      }
      const viewBtn = target.closest('[data-cal-view]') as HTMLElement;
      if (viewBtn) {
        const pid = viewBtn.dataset.calView;
        if (pid) {
          this.close();
          this.onOpenProduct(pid);
        }
      }
      const restartBtn = target.closest('[data-cal-restart]') as HTMLElement;
      if (restartBtn) {
        playSoftClick();
        this.currentStep = 0;
        this.answers = {};
        this.render();
      }
    });
  }

  public open() {
    this.currentStep = 0;
    this.answers = {};
    this.overlay.hidden = false;
    this.render();
    playSoftClick();
  }

  public close() {
    this.overlay.hidden = true;
    this.overlay.innerHTML = '';
  }

  private calculateMatch(): { productId: string; matchPercent: number; matchBadge: string; reason: string } {
    const key = `${this.answers.method}|${this.answers.profile}`;
    if (MATCH_MAP[key]) return MATCH_MAP[key];
    if (this.answers.method === 'espresso') {
      return { productId: 'espresso', matchPercent: 97, matchBadge: 'BARISTA DIAL', reason: 'Extracted in 28 seconds with heavy cacao body.' };
    }
    if (this.answers.method === 'iced') {
      return { productId: 'iced-latte', matchPercent: 96, matchBadge: 'ON TAP / ICED', reason: 'Freshly pulled over slow-melting clear ice.' };
    }
    return { productId: 'slow-roast', matchPercent: 98, matchBadge: 'HOUSE ROAST', reason: 'Caramel and roasted almond notes that fit any brew.' };
  }

  private render() {
    if (this.currentStep < 3) {
      const q = QUESTIONS[this.currentStep];
      this.overlay.innerHTML = `
        <div class="calibrator-dialog">
          <button type="button" class="x-btn calibrator-close" aria-label="Close calibrator"></button>
          <div class="calibrator-header">
            <p class="mono-fine" style="color: var(--accent-amber)">// CALIBRATION 0${q.step} OF 03</p>
            <h3 class="calibrator-title">${q.title}</h3>
            <p class="mono-fine" style="color: rgba(255,255,255,0.65)">${q.subtitle}</p>
          </div>
          <div class="calibrator-options">
            ${q.options
              .map(
                (opt) => `
              <button type="button" class="calibrator-opt-card" data-cal-key="${q.key}" data-cal-opt="${opt.id}">
                <div>
                  <span class="calibrator-opt-name">${opt.label}</span>
                  <span class="calibrator-opt-desc">${opt.desc}</span>
                </div>
                <span class="calibrator-opt-arrow">→</span>
              </button>
            `
              )
              .join('')}
          </div>
          <div class="calibrator-footer">
            <div class="calibrator-dots">
              ${[0, 1, 2].map((i) => `<span class="calibrator-dot ${i === this.currentStep ? 'active' : ''}"></span>`).join('')}
            </div>
            <span class="mono-fine" style="color: rgba(255,255,255,0.4)">BREWNS COFFEE CONCIERGE</span>
          </div>
        </div>
      `;
    } else {
      // Results View
      const match = this.calculateMatch();
      const productNames: Record<string, { name: string; price: string }> = {
        'slow-roast': { name: 'SLOW ROAST NO. 4', price: '$18.00' },
        latte: { name: 'HOUSE LATTE', price: '$4.20' },
        espresso: { name: 'SINGLE ORIGIN ESPRESSO', price: '$2.50' },
        'iced-matcha': { name: 'UJI ICED MATCHA', price: '$4.50' },
        'iced-latte': { name: 'HOUSE ICED LATTE', price: '$4.80' },
        'cinnamon-roll': { name: 'CARDAMOM CINNAMON ROLL', price: '$3.80' },
      };
      const p = productNames[match.productId] || { name: 'SLOW ROAST', price: '$18.00' };

      this.overlay.innerHTML = `
        <div class="calibrator-dialog">
          <button type="button" class="x-btn calibrator-close" aria-label="Close"></button>
          <div class="calibrator-header">
            <p class="mono-fine" style="color: var(--accent-amber)">// RITUAL CALIBRATED</p>
            <h3 class="calibrator-title">YOUR PERFECT POUR</h3>
          </div>
          <div class="calibrator-result-card">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span class="chip" style="color: var(--accent-amber); border-color: var(--accent-amber)">${match.matchBadge}</span>
              <span class="mono-fine" style="color: var(--accent-amber); font-weight: 700;">${match.matchPercent}% ACCORD</span>
            </div>
            <div style="margin-top: 1.25rem;">
              <h4 style="font-family: var(--font-geist); font-size: 2rem; font-weight: 700; line-height: 1; text-transform: uppercase;">${p.name}</h4>
              <p class="mono-fine" style="margin-top: 0.5rem; color: #fff; font-size: 1.125rem;">${p.price}</p>
            </div>
            <p style="margin-top: 1rem; color: rgba(255,255,255,0.75); font-size: 0.875rem; line-height: 1.5;">${match.reason}</p>
            <div style="margin-top: 1.75rem; display: flex; flex-wrap: wrap; gap: 0.75rem;">
              <button type="button" class="btn btn-solid" data-cal-add="${match.productId}" style="flex: 1 1 10rem;">
                + ADD TO BAG
              </button>
              <button type="button" class="btn btn-line" data-cal-view="${match.productId}">
                DETAILS →
              </button>
            </div>
          </div>
          <div style="margin-top: 1.5rem; text-align: center;">
            <button type="button" class="mono-fine" data-cal-restart style="color: rgba(255,255,255,0.5); text-decoration: underline;">RECALIBRATE PALATE ↺</button>
          </div>
        </div>
      `;
    }
  }
}
