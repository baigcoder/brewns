import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { BrewnsApp } from '@/components/brewns/BrewnsApp';

/** The kitchen photos that exist, by dish id, so the page never asks for a missing one. */
function kitchenPhotos() {
  try {
    const files = readdirSync(path.join(process.cwd(), 'public/assets/kitchen'));
    return Object.fromEntries(
      files.filter((f) => /\.(jpe?g|png|webp|avif)$/i.test(f)).map((f) => [f.replace(/\.\w+$/, ''), f]),
    );
  } catch {
    return {};
  }
}

/** The commit this server is running, shown by the local health check. */
function build() {
  try {
    const head = readFileSync(path.join(process.cwd(), '.git/HEAD'), 'utf8').trim();
    const sha = head.startsWith('ref: ') ? readFileSync(path.join(process.cwd(), '.git', head.slice(5)), 'utf8') : head;
    return sha.trim().slice(0, 7);
  } catch {
    return '';
  }
}

export default function Home() {
  const cafeRecording = existsSync(path.join(process.cwd(), 'public/assets/sound/cafe.mp3'));
  return <BrewnsApp kitchenPhotos={kitchenPhotos()} cafeRecording={cafeRecording} build={build()} />;
}
