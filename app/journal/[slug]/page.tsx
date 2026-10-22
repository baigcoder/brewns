import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Eyebrow } from '@/components/site/InfoBits';
import { SitePage } from '@/components/site/SitePage';
import { POSTS, postBySlug, postDate } from '@/lib/journal';
import { publicPageMetadata } from '@/lib/siteMetadata';

export const dynamicParams = false;

export function generateStaticParams() {
  return POSTS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const post = postBySlug((await params).slug);
  if (!post) return {};
  return publicPageMetadata(`${post.title} · brewns Journal`, post.excerpt, `/journal/${post.slug}`);
}

export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const post = postBySlug((await params).slug);
  if (!post) notFound();
  const more = POSTS.filter((p) => p.slug !== post.slug).slice(0, 2);
  return (
    <SitePage current="journal" width={1000}>
      <article className="ip">
        <header className="ip-hero">
          <Link href="/journal" className="ip-back">
            ← The journal
          </Link>
          <Eyebrow>{post.kicker}</Eyebrow>
          <div className="ip-hero-row">
            <div className="ip-head">
              <h1 className="ip-h1" style={{ fontSize: 'clamp(2.4rem, 6vw, 4.5rem)' }}>
                {post.title}
              </h1>
              <p className="ip-meta">
                {postDate(post.date)} · {post.minutes} min read · brewns team
              </p>
              <p className="ip-lede">{post.excerpt}</p>
            </div>
            <Image className="ip-hero-img" src={post.image} alt={post.imageAlt} width={400} height={480} loading="eager" />
          </div>
        </header>

        <div className="ip-article">
          {post.body.map((para) => (
            <p key={para.slice(0, 32)}>{para}</p>
          ))}
          {post.cta ? (
            <div className="ip-btns">
              <Link href={post.cta.href} className="ip-btn">
                {post.cta.label} →
              </Link>
            </div>
          ) : null}
        </div>

        <section className="ip-sec" aria-label="Keep reading">
          <Eyebrow>Keep reading</Eyebrow>
          <div className="ip-posts">
            {more.map((p) => (
              <Link key={p.slug} href={`/journal/${p.slug}`} className="ip-post">
                <span className="ip-post-img">
                  <Image src={p.image} alt={p.imageAlt} width={300} height={360} loading="lazy" />
                </span>
                <span className="ip-post-body">
                  <span className="ip-meta">
                    <b>{p.kicker}</b> · {p.minutes} min
                  </span>
                  <h3>{p.title}</h3>
                  <p>{p.excerpt}</p>
                </span>
              </Link>
            ))}
          </div>
        </section>
      </article>
    </SitePage>
  );
}
