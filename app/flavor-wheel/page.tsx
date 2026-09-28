import type { Metadata } from 'next';
import { FlavorMatcher } from '@/components/flavor/FlavorMatcher';
import { SitePage } from '@/components/site/SitePage';

export const metadata: Metadata = {
  title: 'Coffee Flavor Wheel & Bean Matcher · brewns',
  description: 'Interactive tasting notes flavor selector. Pick stone fruit, floral, caramel, or dark cocoa to find your ideal single-origin roast.',
};

export default function FlavorWheelPage() {
  return (
    <SitePage current="flavor-wheel" width={860}>
      <FlavorMatcher />
    </SitePage>
  );
}
