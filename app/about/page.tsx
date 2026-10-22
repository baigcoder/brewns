import Image from 'next/image';
import Link from 'next/link';
import { CtaBand, Eyebrow, Headline } from '@/components/site/InfoBits';
import { SitePage } from '@/components/site/SitePage';
import { CAFES } from '@/lib/locations';
import { publicPageMetadata } from '@/lib/siteMetadata';

export const metadata = publicPageMetadata(
  'Our Story · brewns Lahore',
  'How brewns started: one question about why good coffee takes so long, one recipe measured every time, and three counters across Lahore.',
  '/about',
);

const CHAPTERS = [
  ['The question', 'Good coffee, without the queue.', 'Hassan Baig, a software engineer from Lahore, wanted a place where a properly made cup didn’t cost you a queue. Somewhere you could sit for an hour, or be back out the door in four minutes.'],
  ['The cup', 'One recipe, measured every time.', 'Slow Roast, a house blend of Colombian and Ethiopian beans, washed and medium roasted in small weekly batches. Every shot pulled at 92°C for 27 seconds; milk steamed to 65°C so it stays sweet.'],
  ['The rooms', 'Three counters across Lahore.', 'MM Alam Road, CCA in DHA Phase 5 and Main Boulevard in Johar Town. Warm light, green corners, leather sofas and a bar you can watch, with a kitchen next to the coffee.'],
  ['The no-wait part', 'Built in-house, like the coffee.', 'Order ahead for pickup or delivery and follow every stage from the bar to your hands. The club card lives in your account. All of it engineered in-house so the team can spend its time on the cup.'],
];

const PROCESS = [
  ['01', 'Sourced', 'Washing stations we can name, in Colombia and Ethiopia.'],
  ['02', 'Roasted', 'Small batches in Lahore, every week, packed the same day.'],
  ['03', 'Dialled', 'Dose weighed, shot timed: 92°C, 27 seconds, every time.'],
  ['04', 'Handed over', 'Poured to meet you. About four minutes door to cup.'],
];

export default function AboutPage() {
  return (
    <SitePage current="about" width={1120}>
      <article className="ip">
        <header className="ip-hero">
          <Eyebrow>Our story</Eyebrow>
          <div className="ip-hero-row">
            <div className="ip-head">
              <Headline as="h1" main="One question." script="three counters." />
              <p className="ip-lede">Lahore is never short of good company or strong opinions. What it was short of was a specialty coffee you didn’t have to wait for. brewns started with one question: why should a good cup take so long?</p>
              <div className="ip-btns">
                <Link href="/locations" className="ip-btn">
                  Find a counter →
                </Link>
                <Link href="/#menu" className="ip-btn ghost">
                  See the menu
                </Link>
              </div>
            </div>
            <Image className="ip-hero-img" src="/assets/menu/cup-latte.webp" alt="A brewns latte in a takeaway cup" width={520} height={640} loading="eager" />
          </div>
        </header>

        <dl className="ip-stats" aria-label="brewns in numbers">
          <div><dt>Counters in Lahore</dt><dd>03</dd></div>
          <div><dt>Hours open, daily</dt><dd>14</dd></div>
          <div><dt>Door to cup</dt><dd>4 min</dd></div>
          <div><dt>Every shot</dt><dd>27 s</dd></div>
          <div><dt>Stamps to a free drink</dt><dd>10</dd></div>
        </dl>

        <section className="ip-sec" aria-labelledby="chapters">
          <div className="ip-head">
            <Eyebrow>The brewns story</Eyebrow>
            <h2 id="chapters" className="ip-h2">
              Four chapters,<span className="ip-script">briefly.</span>
            </h2>
          </div>
          <ol className="ip-time">
            {CHAPTERS.map(([when, title, body], i) => (
              <li key={when}>
                <span className="when">
                  0{i + 1} {"//"} {when}
                </span>
                <h3>{title}</h3>
                <p>{body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="ip-split" aria-label="The founder">
          <Image src="/assets/founder/hassan-baig.webp" alt="Hassan Baig, founder of brewns" width={480} height={600} />
          <div className="ip-head">
            <Eyebrow>Meet the founder</Eyebrow>
            <h2 className="ip-h2">Hassan Baig</h2>
            <blockquote>Good coffee should be easy to get and hard to forget.</blockquote>
            <p className="ip-lede">A software engineer from Lahore, Hassan built brewns to bring specialty coffee and a no-waiting experience together. He engineered the site himself: ordering ahead, live order tracking, receipts and the café sound in the header.</p>
          </div>
        </section>

        <section className="ip-sec" aria-labelledby="process">
          <div className="ip-head">
            <Eyebrow>From bean to cup</Eyebrow>
            <h2 id="process" className="ip-h2">
              Four steps,<span className="ip-script">no shortcuts.</span>
            </h2>
          </div>
          <ul className="ip-grid">
            {PROCESS.map(([n, t, d], i) => (
              <li key={n} className={`ip-card${i === 3 ? ' feature' : ''}`}>
                <span className="ip-n">{n}</span>
                <h3>{t}</h3>
                <p>{d}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="ip-sec" aria-labelledby="cafes">
          <div className="ip-head">
            <Eyebrow>The cafés</Eyebrow>
            <h2 id="cafes" className="ip-h2">
              Same cup,<span className="ip-script">three rooms.</span>
            </h2>
          </div>
          <ul className="ip-grid">
            {CAFES.map((c, i) => (
              <li key={c.id} className="ip-card">
                <span className="ip-n">0{i + 1} · {c.nickname}</span>
                <h3>{c.name}</h3>
                <p>{c.area}</p>
                <Link href={`/locations#${c.id}`} className="ip-more">
                  Visit →
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <CtaBand title="Skip the line" script="next time." body="Order ahead for pickup or delivery and your cup is poured to meet you." href="/#order" label="Order ahead" />
      </article>
    </SitePage>
  );
}
