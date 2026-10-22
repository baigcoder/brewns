import { CtaBand, Eyebrow, Headline } from '@/components/site/InfoBits';
import { SitePage } from '@/components/site/SitePage';
import { publicPageMetadata } from '@/lib/siteMetadata';

export const metadata = publicPageMetadata(
  'Careers · Work at brewns Lahore',
  'Work behind the bar, in the kitchen or on the floor at brewns coffee house in Lahore.',
  '/careers',
);

const TEAMS = [
  ['Behind the bar', 'Baristas who care about the numbers: 92°C, 27 seconds, milk at 65°C, every cup.'],
  ['In the kitchen', 'Cooks for the smash burgers, wood-fired pizza, pasta and paratha rolls next to the coffee.'],
  ['On the floor', 'The people who make a first visit feel like a regular’s, at all three counters.'],
];

const mail = `mailto:hello@brewns.coffee?subject=${encodeURIComponent('Working at brewns')}&body=${encodeURIComponent('Hi brewns team,\n\nI would like to work at brewns.\n\nName:\nMobile:\nWhich counter suits me:\nWhat I would like to do (bar, kitchen, floor):\nA little about me:\n')}`;

export default function CareersPage() {
  return (
    <SitePage current="careers" width={1100}>
      <article className="ip">
        <header className="ip-hero">
          <Eyebrow>Careers</Eyebrow>
          <div className="ip-head">
            <Headline as="h1" main="Make the" script="city’s coffee." />
            <p className="ip-lede">brewns is a small team running three busy counters in Lahore. If you like good coffee, good food and people, we’d like to hear from you.</p>
            <div className="ip-btns">
              <a href={mail} className="ip-btn">
                Write to us →
              </a>
            </div>
          </div>
        </header>

        <section className="ip-sec" aria-labelledby="teams">
          <div className="ip-head">
            <Eyebrow>Where you could work</Eyebrow>
            <h2 id="teams" className="ip-h2">
              Three teams,<span className="ip-script">one cup.</span>
            </h2>
          </div>
          <ul className="ip-grid">
            {TEAMS.map(([t, d]) => (
              <li key={t} className="ip-card">
                <h3>{t}</h3>
                <p>{d}</p>
              </li>
            ))}
          </ul>
        </section>

        <CtaBand title="Sound like you?" script="say hello." body="Tell us your name, your mobile, which counter suits you and what you’d like to do. We read every message." href={mail} label="Write to us" />
      </article>
    </SitePage>
  );
}
