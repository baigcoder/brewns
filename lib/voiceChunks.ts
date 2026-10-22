/* A reply is spoken a sentence or two at a time: the first chunk is voiced and
   playing while the next is still being made, so the caller hears an answer
   almost as soon as it is written. Used by the server (one signed audio URL
   per chunk) and kept here so it can be tested on its own. */

const MIN_CHARS = 24;
const MAX_CHARS = 220;

/** Split a reply into speakable chunks: whole sentences, short ones merged, long ones cut at a comma. */
export function speechChunks(text: string): string[] {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return [];
  // Sentence ends in English and Urdu (۔ ؟), keeping the punctuation with its sentence.
  // "Rs. 6,800" and "Dr. Khan" are not sentence ends.
  const sentences = clean.split(/(?<!\b(?:Rs|Mr|Mrs|Ms|Dr|St|No|vs|approx)\.)(?<=[.!?۔؟]["”’)]*)\s+/i).filter(Boolean);

  const pieces: string[] = [];
  for (const s of sentences) {
    if (s.length <= MAX_CHARS) {
      pieces.push(s);
      continue;
    }
    // A run-on sentence: break after commas, never mid-word.
    let rest = s;
    while (rest.length > MAX_CHARS) {
      const window = rest.slice(0, MAX_CHARS);
      const cut = Math.max(window.lastIndexOf(', '), window.lastIndexOf('، '));
      const at = cut > MIN_CHARS ? cut + 1 : window.lastIndexOf(' ') > MIN_CHARS ? window.lastIndexOf(' ') : MAX_CHARS;
      pieces.push(rest.slice(0, at).trim());
      rest = rest.slice(at).trim();
    }
    if (rest) pieces.push(rest);
  }

  // The first chunk stays short so it can start playing fast; later ones are merged up to a comfortable size.
  const chunks: string[] = [];
  for (const p of pieces) {
    const last = chunks.at(-1);
    const isFirst = chunks.length === 1;
    if (last && (last.length < MIN_CHARS || (!isFirst && last.length + p.length + 1 <= MAX_CHARS * 0.7)) && last.length + p.length + 1 <= MAX_CHARS) {
      chunks[chunks.length - 1] = `${last} ${p}`;
    } else chunks.push(p);
  }
  return chunks;
}
