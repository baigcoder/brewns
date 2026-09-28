import { FlavorMatcher } from '@/components/flavor/FlavorMatcher';
import { SitePage } from '@/components/site/SitePage';
import { publicPageMetadata } from '@/lib/siteMetadata';

export const metadata = publicPageMetadata(
  'Coffee Flavor Wheel & Bean Matcher · brewns',
  'Interactive tasting notes flavor selector. Pick stone fruit, floral, caramel, or dark cocoa to find your ideal single-origin roast.',
  '/flavor-wheel',
);

export default function FlavorWheelPage() {
  return (
    <SitePage current="flavor-wheel" width={1120}>
      <FlavorMatcher />
    </SitePage>
  );
}
