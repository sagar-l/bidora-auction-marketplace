'use client';

import { useEffect, useRef, useState } from 'react';

type Mood = 'curious' | 'excited' | 'love';

export function CursorBuddy() {
  const buddyRef = useRef<HTMLButtonElement>(null);
  const [gaze, setGaze] = useState({ x: 0, y: 0 });
  const [mood, setMood] = useState<Mood>('curious');

  useEffect(() => {
    let frame = 0;
    let nextGaze = { x: 0, y: 0 };
    const trackPointer = (event: PointerEvent) => {
      const bounds = buddyRef.current?.getBoundingClientRect();
      if (!bounds) return;
      const dx = event.clientX - (bounds.left + bounds.width / 2);
      const dy = event.clientY - (bounds.top + bounds.height / 2);
      const distance = Math.max(1, Math.hypot(dx, dy));
      nextGaze = { x: (dx / distance) * 3.5, y: (dy / distance) * 3.5 };
      if (!frame) {
        frame = window.requestAnimationFrame(() => {
          setGaze(nextGaze);
          frame = 0;
        });
      }
    };
    window.addEventListener('pointermove', trackPointer, { passive: true });
    return () => {
      window.removeEventListener('pointermove', trackPointer);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  const face = mood === 'love'
    ? <path d="M29 38 Q36 46 43 38" fill="none" stroke="#70234f" strokeWidth="2.5" strokeLinecap="round"/>
    : mood === 'excited'
      ? <path d="M29 37 Q36 47 43 37" fill="none" stroke="#70234f" strokeWidth="2.5" strokeLinecap="round"/>
      : <path d="M30 39 Q36 43 42 39" fill="none" stroke="#70234f" strokeWidth="2.5" strokeLinecap="round"/>;

  return <div className="cursor-buddy-slot">
    <button
      ref={buddyRef}
      type="button"
      className={`cursor-buddy mood-${mood}`}
      aria-label="Bidi the BIDORA cursor buddy. Hover for a reaction and click to make Bidi blush."
      onPointerEnter={() => setMood('excited')}
      onPointerLeave={() => setMood('curious')}
      onClick={() => setMood((current) => current === 'love' ? 'excited' : 'love')}
    >
      <svg className="cursor-buddy-face" viewBox="0 0 72 72" aria-hidden="true">
        <path className="buddy-antenna" d="M36 12V6" stroke="#53c1e5" strokeWidth="3" strokeLinecap="round"/>
        <path className="buddy-spark" d="M36 2.5l1.2 2.3 2.5.4-1.8 1.8.4 2.5-2.3-1.2-2.3 1.2.4-2.5-1.8-1.8 2.5-.4z" fill="#ff2d95"/>
        <rect x="12" y="12" width="48" height="48" rx="18" fill="url(#buddy-gradient)" stroke="#ffffff70" strokeWidth="1.5"/>
        <defs><linearGradient id="buddy-gradient" x1="12" y1="12" x2="60" y2="60" gradientUnits="userSpaceOnUse"><stop stopColor="#6be2f7"/><stop offset="1" stopColor="#fa55ac"/></linearGradient></defs>
        <ellipse className="buddy-blush" cx="23" cy="38" rx="5" ry="2.5" fill="#ff629c" opacity=".65"/>
        <ellipse className="buddy-blush" cx="49" cy="38" rx="5" ry="2.5" fill="#ff629c" opacity=".65"/>
        <ellipse cx="29" cy="31" rx="3.7" ry="4.8" fill="white"/><ellipse cx="43" cy="31" rx="3.7" ry="4.8" fill="white"/>
        <circle cx={29 + gaze.x} cy={31 + gaze.y} r="1.8" fill="#292039"/><circle cx={43 + gaze.x} cy={31 + gaze.y} r="1.8" fill="#292039"/>
        {face}
      </svg>
      <span className="cursor-buddy-copy"><strong>{mood === 'love' ? 'Aww, you’re lovely!' : mood === 'excited' ? 'You found me!' : 'Ooh, what’s shiny?'}</strong><small>Move your cursor. I’m watching!</small></span>
    </button>
  </div>;
}
