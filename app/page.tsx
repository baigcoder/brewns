import { existsSync, readdirSync } from 'node:fs';
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

export default function Home() {
  const cafeRecording = existsSync(path.join(process.cwd(), 'public/assets/sound/cafe.mp3'));
  return <BrewnsApp kitchenPhotos={kitchenPhotos()} cafeRecording={cafeRecording} />;
}
