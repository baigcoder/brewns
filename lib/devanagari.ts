/* Spoken Urdu and spoken Hindi are the same sounds, so speech recognition
   often writes an Urdu speaker's words in Devanagari (Hindi script). This turns
   that into Urdu letters straight away, so a caption never shows Hindi; the
   server then tidies the spelling (/api/voice/urdu). It is letter by letter,
   the way Urdu is written: no short vowels, nasal ں at the end of a word. */

const DEVANAGARI = /[ऀ-ॿ]/;
export const hasDevanagari = (text: string) => DEVANAGARI.test(text);

const CONSONANTS: Record<string, string> = {
  क: 'ک', ख: 'کھ', ग: 'گ', घ: 'گھ', ङ: 'ن',
  च: 'چ', छ: 'چھ', ज: 'ج', झ: 'جھ', ञ: 'ن',
  ट: 'ٹ', ठ: 'ٹھ', ड: 'ڈ', ढ: 'ڈھ', ण: 'ن',
  त: 'ت', थ: 'تھ', द: 'د', ध: 'دھ', न: 'ن',
  प: 'پ', फ: 'پھ', ब: 'ب', भ: 'بھ', म: 'م',
  य: 'ی', र: 'ر', ल: 'ل', व: 'و',
  श: 'ش', ष: 'ش', स: 'س', ह: 'ہ', ळ: 'ل',
};
/** With a nukta (़) these are the Perso-Arabic sounds. */
const NUKTA: Record<string, string> = { क: 'ق', ख: 'خ', ग: 'غ', ज: 'ز', झ: 'ژ', ड: 'ڑ', ढ: 'ڑھ', फ: 'ف', य: 'ی' };
/** A vowel letter at the start of a word. */
const VOWEL_START: Record<string, string> = { अ: 'ا', आ: 'آ', इ: 'ا', ई: 'ای', उ: 'ا', ऊ: 'او', ए: 'ای', ऐ: 'ای', ओ: 'او', औ: 'او', ऋ: 'ر' };
/** A vowel letter after another vowel, inside a word. */
const VOWEL_MID: Record<string, string> = { अ: 'ا', आ: 'ا', इ: 'ئ', ई: 'ئی', उ: 'ؤ', ऊ: 'ؤ', ए: 'ئ', ऐ: 'ئ', ओ: 'و', औ: 'و', ऋ: 'ر' };
const PUNCT: Record<string, string> = { '।': '۔', '॥': '۔', '?': '؟', ',': '،', ';': '؛' };

const isConsonant = (c: string) => c in CONSONANTS;
const isLetter = (c: string | undefined) => !!c && /[ऀ-ॿ]/.test(c) && c !== '।' && c !== '॥';

function word(w: string) {
  const s = [...w.normalize('NFD')];
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    const last = !isLetter(s[i + 1]);
    const nasal = s[i + 1] === 'ं' || s[i + 1] === 'ँ';
    if (isConsonant(c)) {
      if (s[i + 1] === '़') {
        out += NUKTA[c] ?? CONSONANTS[c];
        i++;
      } else out += CONSONANTS[c];
      continue;
    }
    switch (c) {
      case 'ा': out += 'ا'; break;
      case 'ि': if (!isLetter(s[i + 1])) out += 'ی'; break;
      case 'ी': out += 'ی'; break;
      case 'ु': if (!isLetter(s[i + 1])) out += 'و'; break;
      case 'ू': case 'ो': case 'ौ': out += 'و'; break;
      // ہے at the end of a word, ی inside one and before a nasal (ہیں، میں).
      case 'े': case 'ै': out += last && !nasal ? 'ے' : 'ی'; break;
      case 'ृ': out += 'ر'; break;
      case 'ं': case 'ँ': out += isLetter(s[i + 1]) ? 'ن' : 'ں'; break;
      case 'ः': out += 'ہ'; break;
      case '्': case '़': break;
      default:
        if (c in VOWEL_START) out += !out ? VOWEL_START[c] : (c === 'ए' || c === 'ऐ') && last ? 'ئے' : VOWEL_MID[c];
        else if (c >= '०' && c <= '९') out += String(c.charCodeAt(0) - 0x0966);
        else out += c;
    }
  }
  return out;
}

/** Devanagari → Urdu script; anything else (English words, numbers) is left as it is. */
export function toUrduScript(text: string) {
  if (!hasDevanagari(text)) return text;
  return text
    .split(/([ऀ-ॿ]+)/)
    .map((part) => (hasDevanagari(part) ? word(part) : part.replace(/[।॥?,;]/g, (p) => PUNCT[p] ?? p)))
    .join('')
    .replace(/[।॥]/g, '۔');
}
