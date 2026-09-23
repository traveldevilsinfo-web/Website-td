"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Msg = { text: string; href: string };

/** Sale/announcement strip. Rotates messages every 4.5s (paused on hover / reduced motion). */
export function TopBar({ messages, bg, fg }: { messages: Msg[]; bg: string; fg: string }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (messages.length < 2 || paused || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setI((n) => (n + 1) % messages.length), 4500);
    return () => clearInterval(t);
  }, [messages.length, paused]);

  const m = messages[i];
  if (!m) return null;
  const external = /^https?:\/\//.test(m.href);
  const content = <span key={i} className="word-in">{m.text}</span>;
  const cls = "relative z-10 flex h-9 items-center justify-center px-10 text-center text-[13px] font-bold leading-tight sm:h-[2.625rem] sm:text-sm";

  return (
    <div className="topbar relative overflow-hidden" style={{ background: bg, color: fg }}
      onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} role="region" aria-label="Announcements">
      {m.href ? (
        external
          ? <a href={m.href} target="_blank" rel="noopener noreferrer" className={cls}>{content}</a>
          : <Link href={m.href} className={cls}>{content}</Link>
      ) : (
        <p className={cls}>{content}</p>
      )}
      {messages.length > 1 && (
        <div className="absolute right-3 top-1/2 z-10 hidden -translate-y-1/2 gap-1 sm:flex" aria-hidden>
          {messages.map((_, n) => (
            <span key={n} className="size-1.5 rounded-full transition-opacity" style={{ background: fg, opacity: n === i ? 0.9 : 0.35 }} />
          ))}
        </div>
      )}
    </div>
  );
}
