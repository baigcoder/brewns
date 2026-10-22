import Link from 'next/link';
import type { ReactNode } from 'react';
import './info-page.css';

/** "// LABEL", the site's mono eyebrow. */
export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="ip-eyebrow">
      <b>{'//'}</b>
      {children}
    </p>
  );
}

/** A big uppercase headline with a script second line, like the home page. */
export function Headline({ as: Tag = 'h2', main, script }: { as?: 'h1' | 'h2'; main: ReactNode; script?: string }) {
  return (
    <Tag className={Tag === 'h1' ? 'ip-h1' : 'ip-h2'}>
      {main}
      {script ? <span className="ip-script">{script}</span> : null}
    </Tag>
  );
}

/** The amber closing band that ends every story page with one clear next step. */
export function CtaBand({ title, script, body, href, label }: { title: string; script: string; body: string; href: string; label: string }) {
  return (
    <section className="ip-cta" aria-label={title}>
      <Headline main={title} script={script} />
      <p>{body}</p>
      <Link href={href} className="ip-btn">
        {label} →
      </Link>
    </section>
  );
}
