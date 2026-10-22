'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { CHAPTERS, FILM, clockTime } from '@/lib/howItWorks';
import './film-player.css';

/** The "How brewns works" film with its chapters. Nothing loads or plays until
    asked; a chapter (or a ?t=16 link) jumps straight to its moment, with sound. */
export function FilmPlayer() {
  const video = useRef<HTMLVideoElement>(null);
  const [started, setStarted] = useState(false);
  const [now, setNow] = useState(0);

  const play = (at?: number) => {
    const v = video.current;
    if (!v) return;
    if (at !== undefined) v.currentTime = at;
    setStarted(true);
    v.play().catch(() => {});
  };

  // A shared link like /how-it-works?t=39 opens at that chapter, ready to play.
  useEffect(() => {
    const t = Number(new URLSearchParams(window.location.search).get('t'));
    if (t > 0 && t < FILM.seconds && video.current) {
      video.current.preload = 'metadata';
      video.current.currentTime = t;
      setNow(t);
    }
  }, []);

  const active = CHAPTERS.findLastIndex((c) => c.at <= now + 0.25);

  return (
    <div className="fp">
      <div className="fp-frame">
        <video
          ref={video}
          className="fp-video"
          controls={started}
          playsInline
          preload="none"
          poster={FILM.poster}
          aria-label={`${FILM.title}, a ${FILM.seconds}-second film`}
          onPlay={() => setStarted(true)}
          onTimeUpdate={(e) => setNow(e.currentTarget.currentTime)}
        >
          <source src={FILM.sources.large.webm} type="video/webm" media="(min-width: 900px)" />
          <source src={FILM.sources.large.mp4} type="video/mp4" media="(min-width: 900px)" />
          <source src={FILM.sources.small.webm} type="video/webm" />
          <source src={FILM.sources.small.mp4} type="video/mp4" />
          <track kind="captions" src={FILM.captions} srcLang="en" label="English" />
        </video>
        {!started && (
          <button type="button" className="fp-play" onClick={() => play()}>
            <span className="fp-play-ico" aria-hidden="true" />
            <span className="fp-play-txt">
              Play the film <small>{clockTime(FILM.seconds)} · sound on</small>
            </span>
          </button>
        )}
      </div>

      <ol className="fp-chapters" aria-label="Chapters">
        {CHAPTERS.map((c, i) => (
          <li key={c.at} className={started && i === active ? 'on' : undefined}>
            <button type="button" className="fp-jump" onClick={() => play(c.at)} aria-label={`Play from ${clockTime(c.at)}: ${c.title}`}>
              <span className="fp-at">{clockTime(c.at)}</span>
              <span className="fp-title">{c.title}</span>
            </button>
            <p>{c.body}</p>
            {c.href ? (
              <Link href={c.href} className="fp-more">
                {c.label} →
              </Link>
            ) : null}
          </li>
        ))}
      </ol>
    </div>
  );
}
