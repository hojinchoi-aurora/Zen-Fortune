import { useMemo } from 'react';
import type { CSSProperties } from 'react';
import { mulberry32, type Participant } from '@/lib/draw';

export type HeartsPhase = 'idle' | 'gathering' | 'reveal' | 'settled';

interface Props {
  phase: HeartsPhase;
  participants: Participant[];
  winners: Participant[];
}

const HEART_VARIANTS = 5;

function hashParticipants(list: Participant[]): number {
  let h = 2166136261 >>> 0;
  for (const p of list) {
    for (let i = 0; i < p.name.length; i++) {
      h = Math.imul(h ^ p.name.charCodeAt(i), 16777619) >>> 0;
    }
    h = Math.imul(h ^ p.count, 16777619) >>> 0;
  }
  return h;
}

// ---------- Shared heart shape ----------

function Heart({
  variant,
  className,
  style,
}: {
  variant: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      className={className}
      style={style}
      viewBox="0 0 32 30"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M16 28.8C16 28.8 2.5 20.6 2.5 11.2C2.5 6.5 6 3 10.3 3C13 3 15 4.6 16 6.6C17 4.6 19 3 21.7 3C26 3 29.5 6.5 29.5 11.2C29.5 20.6 16 28.8 16 28.8Z"
        fill={`url(#hg${variant % HEART_VARIANTS})`}
      />
      <ellipse cx="11" cy="10.5" rx="3.4" ry="2.3" fill="#ffffff" opacity="0.42" />
    </svg>
  );
}

function HeartDefs() {
  return (
    <svg className="hearts-defs" aria-hidden="true" width="0" height="0">
      <defs>
        <linearGradient id="hg0" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffc0d6" />
          <stop offset="1" stopColor="#ff5f95" />
        </linearGradient>
        <linearGradient id="hg1" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffcbae" />
          <stop offset="1" stopColor="#ff6f66" />
        </linearGradient>
        <linearGradient id="hg2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffe9ad" />
          <stop offset="1" stopColor="#ffb020" />
        </linearGradient>
        <linearGradient id="hg3" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#a7f2db" />
          <stop offset="1" stopColor="#33c6a6" />
        </linearGradient>
        <linearGradient id="hg4" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#d8bdf5" />
          <stop offset="1" stopColor="#9257e0" />
        </linearGradient>
      </defs>
    </svg>
  );
}

// ---------- Floating name hearts (idle) ----------

interface FloatPos {
  x: number;
  y: number;
  size: number;
  dur: number;
  delay: number;
  rise: number;
  variant: number;
  gdelay: number;
  gdur: number;
}

function generateFloatPositions(participants: Participant[]): FloatPos[] {
  const rng = mulberry32((hashParticipants(participants) ^ 0x9e3779b9) >>> 0);
  return participants.map(() => {
    // Keep the central title band clear.
    let x = 50;
    let y = 40;
    for (let tries = 0; tries < 14; tries++) {
      x = 6 + rng() * 88;
      y = 12 + rng() * 74;
      const inCenter = x > 30 && x < 70 && y > 26 && y < 60;
      if (!inCenter) break;
    }
    return {
      x,
      y,
      size: 26 + rng() * 16,
      dur: 5 + rng() * 3,
      delay: rng() * 3,
      rise: 10 + rng() * 12,
      variant: Math.floor(rng() * HEART_VARIANTS),
      gdelay: rng() * 280,
      gdur: 1200 + rng() * 520,
    };
  });
}

function FloatingHearts({
  participants,
  gathering,
}: {
  participants: Participant[];
  gathering: boolean;
}) {
  const positions = useMemo(
    () => generateFloatPositions(participants),
    [participants]
  );
  return (
    <div className={`float-hearts ${gathering ? 'gathering' : ''}`} aria-hidden="true">
      {participants.map((p, i) => {
        const f = positions[i];
        const style = {
          left: `${f.x}%`,
          top: `${f.y}%`,
          '--dur': `${f.dur}s`,
          '--delay': `${f.delay}s`,
          '--rise': `${f.rise}px`,
          '--gdelay': `${f.gdelay}ms`,
          '--gdur': `${f.gdur}ms`,
        } as CSSProperties;
        return (
          <div key={p.id} className="float-heart" style={style}>
            <Heart variant={f.variant} className="hs" style={{ width: `${f.size}px` }} />
            <span className="nm">{p.name}</span>
          </div>
        );
      })}
    </div>
  );
}

// ---------- Heart flood (gathering swell) ----------

function useFlood() {
  return useMemo(() => {
    const rng = mulberry32(0x51ed270b);
    return Array.from({ length: 42 }, () => ({
      x: 2 + rng() * 96,
      size: 14 + rng() * 18,
      delay: rng() * 1800,
      dur: 1600 + rng() * 900,
      sway: -70 + rng() * 140,
      rot: -30 + rng() * 60,
      op: 0.55 + rng() * 0.4,
      variant: Math.floor(rng() * HEART_VARIANTS),
    }));
  }, []);
}

function HeartFlood() {
  const items = useFlood();
  return (
    <div className="heart-flood" aria-hidden="true">
      {items.map((h, i) => {
        const style = {
          '--x': `${h.x}%`,
          '--size': `${h.size}px`,
          '--delay': `${h.delay}ms`,
          '--dur': `${h.dur}ms`,
          '--sway': `${h.sway}px`,
          '--rot': `${h.rot}deg`,
          '--op': `${h.op}`,
        } as CSSProperties;
        return <Heart key={i} variant={h.variant} className="flood-heart" style={style} />;
      })}
    </div>
  );
}

// ---------- Burst particles (reveal moment) ----------

function useBurst() {
  return useMemo(() => {
    const rng = mulberry32(0x2545f491);
    const N = 26;
    return Array.from({ length: N }, (_, i) => {
      const ang = (i / N) * Math.PI * 2 + rng() * 0.4;
      const dist = 170 + rng() * 220;
      return {
        tx: Math.cos(ang) * dist,
        ty: Math.sin(ang) * dist,
        size: 12 + rng() * 12,
        delay: rng() * 140,
        variant: Math.floor(rng() * HEART_VARIANTS),
      };
    });
  }, []);
}

function Burst() {
  const items = useBurst();
  return (
    <div className="burst" aria-hidden="true">
      {items.map((b, i) => {
        const style = {
          '--tx': `${b.tx}px`,
          '--ty': `${b.ty}px`,
          '--size': `${b.size}px`,
          '--delay': `${b.delay}ms`,
        } as CSSProperties;
        return <Heart key={i} variant={b.variant} className="p" style={style} />;
      })}
    </div>
  );
}

// ---------- Winner row ----------

function WinnerRow({ winners }: { winners: Participant[] }) {
  return (
    <div className="winner-row">
      {winners.map((w, i) => {
        const style = { '--wdelay': `${i * 70}ms` } as CSSProperties;
        return (
          <div key={w.id} className="winner" style={style}>
            <span className="heart-wrap">
              <Heart variant={i} className="hs" />
            </span>
            <span className="nm">{w.name}</span>
            {w.department && <span className="dept">{w.department}</span>}
          </div>
        );
      })}
    </div>
  );
}

// ---------- Stage ----------

export default function HeartsStage({ phase, participants, winners }: Props) {
  const showFloat = phase === 'idle' || phase === 'gathering';
  const showWinners = phase === 'reveal' || phase === 'settled';
  return (
    <div className="hearts-stage">
      <div className="hearts-aurora" aria-hidden="true" />
      <HeartDefs />

      {showFloat && participants.length > 0 && (
        <FloatingHearts participants={participants} gathering={phase === 'gathering'} />
      )}

      {phase === 'gathering' && <HeartFlood />}

      {showFloat && (
        <div className={`hearts-title ${phase === 'gathering' ? 'leaving' : ''}`}>
          <h1>당신을 칭찬하오로라</h1>
          <p>공감을 남겨주신 분들께 드리는 행운의 추첨</p>
        </div>
      )}

      {showWinners && <WinnerRow winners={winners} />}
      {phase === 'reveal' && <Burst />}

      {showWinners && (
        <div className="hearts-caption">
          <span className="cap-eyebrow">Congratulations</span>
          <span className="cap-text">축하합니다 · 행운의 {winners.length}분</span>
        </div>
      )}
    </div>
  );
}
