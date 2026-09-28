import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { BrewnsApp } from '@/components/brewns/BrewnsApp';

/** The kitchen photos that exist, by dish id, so the page never asks for a missing one. */
let cachedPhotos: Record<string, string> | null = null;
function kitchenPhotos() {
  if (cachedPhotos !== null) return cachedPhotos;
  try {
    const files = readdirSync(path.join(process.cwd(), 'public/assets/kitchen'));
    cachedPhotos = Object.fromEntries(
      files.filter((f) => /\.(jpe?g|png|webp|avif)$/i.test(f)).map((f) => [f.replace(/\.\w+$/, ''), f]),
    );
    return cachedPhotos;
  } catch {
    return {};
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
