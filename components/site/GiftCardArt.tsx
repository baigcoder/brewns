import { money } from '@/lib/catalog';
import './gift-card-art.css';

/** The brewns gift card, drawn in CSS: the picture for gift products, which have no photo. */
export function GiftCardArt({ amount, size = 'card' }: { amount?: number; size?: 'card' | 'large' }) {
  return (
    <span className={`gca gca-${size}`} aria-hidden="true">
      <span className="gca-card">
        <span className="gca-top">
          <span className="gca-mark">brewns<sup>®</sup></span>
          <span className="gca-chip" />
        </span>
        <span className="gca-script">a cup on us.</span>
        <span className="gca-bottom">
          <span className="gca-label">GIFT CARD</span>
          {amount ? <span className="gca-amount">{money(amount)}</span> : null}
        </span>
      </span>
    </span>
  );
}
