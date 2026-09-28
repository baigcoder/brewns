import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { Metadata } from 'next';
import './sections.css';
import { BrewnsApp } from '@/components/brewns/BrewnsApp';
import { publicPageMetadata } from '@/lib/siteMetadata';

export const metadata: Metadata = publicPageMetadata(
  'brewns — Specialty Coffee House in Lahore',
  'Specialty coffee house in Lahore. Carefully sourced beans, thoughtfully brewed. Order ahead and skip the line at MM Alam Road, DHA Phase 5 and Johar Town, open daily 07:00–21:00.',
  '/',
);

const DEFAULT_KITCHEN_PHOTOS: Record<string, string> = {
  'alfredo-pasta': 'alfredo-pasta.webp',
  'arrabbiata-pasta': 'arrabbiata-pasta.webp',
  'bbq-burger': 'bbq-burger.webp',
  'behari-roll': 'behari-roll.webp',
  'chicken-tenders': 'chicken-tenders.webp',
  'crispy-wrap': 'crispy-wrap.webp',
  'fajita-pizza': 'fajita-pizza.webp',
  'garlic-bread': 'garlic-bread.webp',
  'lime-soda': 'lime-soda.webp',
  'mango-smoothie': 'mango-smoothie.webp',
  'margherita-pizza': 'margherita-pizza.webp',
  'mint-margarita': 'mint-margarita.webp',
  'peach-iced-tea': 'peach-iced-tea.webp',
  'pepperoni-pizza': 'pepperoni-pizza.webp',
  'pesto-pasta': 'pesto-pasta.webp',
  'smash-burger': 'smash-burger.webp',
  'tikka-roll': 'tikka-roll.webp',
  'truffle-fries': 'truffle-fries.webp',
  'zinger-burger': 'zinger-burger.webp',
};

/** The kitchen photos that exist, by dish id, so the page never asks for a missing one. */
let cachedPhotos: Record<string, string> | null = null;
function kitchenPhotos() {
  if (cachedPhotos !== null) return cachedPhotos;
  try {
    const files = readdirSync(path.join(process.cwd(), 'public/assets/kitchen'));
    const discovered = Object.fromEntries(
      files.filter((f) => /\.(jpe?g|png|webp|avif)$/i.test(f)).map((f) => [f.replace(/\.\w+$/, ''), f]),
    );
    cachedPhotos = Object.keys(discovered).length > 0 ? discovered : DEFAULT_KITCHEN_PHOTOS;
    return cachedPhotos;
  } catch {
    cachedPhotos = DEFAULT_KITCHEN_PHOTOS;
    return cachedPhotos;
  }
}

/** The commit this server is running, shown by the local health check. */
let cachedBuild: string | null = null;
function build() {
  if (cachedBuild !== null) return cachedBuild;
  try {
    const head = readFileSync(path.join(process.cwd(), '.git/HEAD'), 'utf8').trim();
    const sha = head.startsWith('ref: ') ? readFileSync(path.join(process.cwd(), '.git', head.slice(5)), 'utf8') : head;
    cachedBuild = sha.trim().slice(0, 7);
    return cachedBuild;
  } catch {
    return '';
  }
}

let cachedCafeRecording: boolean | null = null;
function getCafeRecording() {
  if (cachedCafeRecording !== null) return cachedCafeRecording;
  try {
    cachedCafeRecording = existsSync(path.join(process.cwd(), 'public/assets/sound/cafe.mp3'));
    return cachedCafeRecording;
  } catch {
    return false;
  }
}

export default function Home() {
  return <BrewnsApp kitchenPhotos={kitchenPhotos()} cafeRecording={getCafeRecording()} build={build()} />;
}
