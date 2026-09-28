import { BREWNS_MARKUP } from './brewnsMarkup';
import { BrewnsEngineLoader } from './BrewnsEngineLoader';

/** Keep the large, static café page on the server; only the interaction loader hydrates. */
export function BrewnsApp({ kitchenPhotos, cafeRecording, build }: { kitchenPhotos?: Record<string, string>; cafeRecording?: boolean; build?: string }) {
  return (
    <>
      <div id="brewns-root" dangerouslySetInnerHTML={{ __html: BREWNS_MARKUP }} />
      <BrewnsEngineLoader kitchenPhotos={kitchenPhotos} cafeRecording={cafeRecording} build={build} />
    </>
  );
}
