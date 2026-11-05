import { BREWNS_MARKUP } from './brewnsMarkup';
import { BrewnsEngineLoader } from './BrewnsEngineLoader';

/* Phones: the hero products start under the hero text. The engine measures that text a moment after load, which moved
   the hero picture and counted as layout shift. This runs as soon as the page is parsed, so the picture is placed once.
   Same measurement as the engine's own (initBrewns.ts, "--hero-copy-end"); the engine keeps it correct on resize. */
const PLACE_HERO = `(function(){var m=document.getElementById('hero-media'),c=document.querySelector('.hero-copy');if(!m||!c||window.innerWidth>639)return;var b=m.offsetParent,t=c.offsetHeight;for(var e=c;e&&e!==b;e=e.offsetParent)t+=e.offsetTop;m.style.setProperty('--hero-copy-end',Math.round(t)+'px')})()`;

/** Keep the large, static café page on the server; only the interaction loader hydrates. */
export function BrewnsApp({ kitchenPhotos, cafeRecording, build }: { kitchenPhotos?: Record<string, string>; cafeRecording?: boolean; build?: string }) {
  return (
    <>
      <div id="brewns-root" dangerouslySetInnerHTML={{ __html: BREWNS_MARKUP }} />
      <script dangerouslySetInnerHTML={{ __html: PLACE_HERO }} />
      <BrewnsEngineLoader kitchenPhotos={kitchenPhotos} cafeRecording={cafeRecording} build={build} />
    </>
  );
}
