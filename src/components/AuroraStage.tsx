import { useMemo } from 'react';
import type { CSSProperties } from 'react';
import { mulberry32, type Participant } from '@/lib/draw';

export type AuroraPhase = 'idle' | 'gathering' | 'reveal' | 'settled';

interface Props {
  phase: AuroraPhase;
  participants: Participant[];
  winners: Participant[];
}

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

// ---------- 4-point sparkle ----------

function Sparkle({
  tone = 'gold',
  className,
  style,
}: {
  tone?: 'gold' | 'pale';
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      className={className}
      style={style}
      viewBox="0 0 40 40"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M20 1 L23.6 16.4 L39 20 L23.6 23.6 L20 39 L16.4 23.6 L1 20 L16.4 16.4 Z"
        fill={`url(#star-${tone})`}
      />
    </svg>
  );
}

function AuroraDefs() {
  return (
    <svg className="aurora-defs" aria-hidden="true" width="0" height="0">
      <defs>
        <radialGradient id="star-gold" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#fffef8" />
          <stop offset="0.5" stopColor="#ffe6a8" />
          <stop offset="1" stopColor="#ffc24d" />
        </radialGradient>
        <radialGradient id="star-pale" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.5" stopColor="#d6e6ff" />
          <stop offset="1" stopColor="#9fb8e0" />
        </radialGradient>
      </defs>
    </svg>
  );
}

// ---------- Decorative starfield ----------

function useStarfield() {
  return useMemo(() => {
    const rng = mulberry32(0x1b873593);
    return Array.from({ length: 48 }, () => ({
      x: rng() * 100,
      y: rng() * 92,
      size: 1 + rng() * 1.6,
      o: 0.28 + rng() * 0.5,
      tw: 2.4 + rng() * 3.2,
      twd: rng() * 4,
    }));
  }, []);
}

function Starfield() {
  const stars = useStarfield();
  return (
    <div className="starfield" aria-hidden="true">
      {stars.map((s, i) => {
        const style = {
          left: `${s.x}%`,
          top: `${s.y}%`,
          width: `${s.size}px`,
          height: `${s.size}px`,
          '--o': `${s.o}`,
          '--tw': `${s.tw}s`,
          '--twd': `${s.twd}s`,
        } as CSSProperties;
        return <span key={i} className="star" style={style} />;
      })}
    </div>
  );
}

// ---------- Participant stars (persistent, highlighted in place) ----------

interface StarPos {
  x: number;
  y: number;
  tw: number;
  twd: number;
  cyc: number;
}

// Even, well-spaced scatter via a jittered grid with the central title band
// left empty. Even spacing keeps any 5 winners from crowding each other.
function generateGridPositions(list: Participant[]): StarPos[] {
  const N = list.length;
  const rng = mulberry32((hashParticipants(list) ^ 0x2c1b3c6d) >>> 0);
  const x0 = 6;
  const x1 = 94;
  const y0 = 9;
  const y1 = 85;
  const cols = Math.max(4, Math.round(Math.sqrt(N * 1.9)));
  const rows = Math.max(3, Math.ceil((N + 8) / cols));
  const cw = (x1 - x0) / cols;
  const ch = (y1 - y0) / rows;

  const cells: { cx: number; cy: number }[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cx = x0 + (c + 0.5) * cw;
      const cy = y0 + (r + 0.5) * ch;
      const inCenter = cx > 33 && cx < 67 && cy > 30 && cy < 60;
      if (inCenter) continue;
      cells.push({ cx, cy });
    }
  }
  // Deterministic shuffle so the scatter looks random but is reproducible.
  for (let i = cells.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [cells[i], cells[j]] = [cells[j], cells[i]];
  }

  return list.map((_, i) => {
    const cell = cells[i % cells.length];
    return {
      x: cell.cx + (rng() - 0.5) * cw * 0.6,
      y: cell.cy + (rng() - 0.5) * ch * 0.6,
      tw: 2.5 + rng() * 3,
      twd: rng() * 4,
      cyc: Math.round(rng() * 850),
    };
  });
}

function ParticipantStars({
  participants,
  positions,
  winnerIds,
  phase,
}: {
  participants: Participant[];
  positions: StarPos[];
  winnerIds: Set<string>;
  phase: AuroraPhase;
}) {
  const cycling = phase === 'gathering';
  const revealed = phase === 'reveal' || phase === 'settled';
  return (
    <div
      className={`participant-stars ${cycling ? 'cycling' : ''} ${revealed ? 'revealed' : ''}`}
      aria-hidden="true"
    >
      {participants.map((p, i) => {
        const pos = positions[i];
        const isWinner = winnerIds.has(p.id);
        const stateCls = revealed ? (isWinner ? 'is-winner' : 'is-dim') : '';
        const style = {
          left: `${pos.x}%`,
          top: `${pos.y}%`,
          '--tw': `${pos.tw}s`,
          '--twd': `${pos.twd}s`,
          '--cyc': `${pos.cyc}ms`,
        } as CSSProperties;
        return (
          <div key={p.id} className={`pstar ${stateCls}`} style={style}>
            <span className="pstar-wrap">
              <span className="pstar-halo" />
              <Sparkle tone={revealed && isWinner ? 'gold' : 'pale'} className="pstar-star" />
            </span>
            <span className="pstar-name">{p.name}</span>
          </div>
        );
      })}
    </div>
  );
}

// ---------- Winner constellation (reveal / settled) ----------

function orderConstellationPoints(points: StarPos[]): StarPos[] {
  if (points.length < 2) return points;

  const remaining = [...points];
  const leftmostIndex = remaining.reduce(
    (best, point, index) => (point.x < remaining[best].x ? index : best),
    0
  );
  const ordered = [remaining.splice(leftmostIndex, 1)[0]];

  while (remaining.length > 0) {
    const current = ordered[ordered.length - 1];
    const nearestIndex = remaining.reduce((best, point, index) => {
      const bestPoint = remaining[best];
      const distance = (point.x - current.x) ** 2 + (point.y - current.y) ** 2;
      const bestDistance =
        (bestPoint.x - current.x) ** 2 + (bestPoint.y - current.y) ** 2;
      return distance < bestDistance ? index : best;
    }, 0);
    ordered.push(remaining.splice(nearestIndex, 1)[0]);
  }

  return ordered;
}

function WinnerConstellation({ points }: { points: StarPos[] }) {
  const ordered = useMemo(() => orderConstellationPoints(points), [points]);
  const segments = ordered.slice(1).map((point, index) => ({
    from: ordered[index],
    to: point,
  }));

  return (
    <svg
      className="winner-constellation"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {segments.map(({ from, to }, index) => {
        const style = { '--line-delay': `${180 + index * 180}ms` } as CSSProperties;
        return (
          <g key={`${from.x}-${from.y}-${to.x}-${to.y}`} style={style}>
            <line
              className="constellation-line constellation-line-glow"
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
            />
            <line
              className="constellation-line"
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
            />
          </g>
        );
      })}
    </svg>
  );
}

// ---------- Stage ----------

export default function AuroraStage({ phase, participants, winners }: Props) {
  const positions = useMemo(() => generateGridPositions(participants), [participants]);
  const winnerIds = useMemo(() => new Set(winners.map((w) => w.id)), [winners]);
  const winnerPositions = useMemo(
    () =>
      participants.reduce<StarPos[]>((result, participant, index) => {
        if (winnerIds.has(participant.id)) result.push(positions[index]);
        return result;
      }, []),
    [participants, positions, winnerIds]
  );
  const showTitle = phase === 'idle' || phase === 'gathering';
  const revealed = phase === 'reveal' || phase === 'settled';

  return (
    <div className="aurora-stage">
      <div className={`aurora-sky ${phase !== 'idle' ? 'active' : ''}`} aria-hidden="true">
        <div className="aurora-glow" />
        <div className="aurora-rays" />
        <div className="aurora-rays two" />
      </div>

      <Starfield />
      <AuroraDefs />

      {revealed && winnerPositions.length > 1 && (
        <WinnerConstellation points={winnerPositions} />
      )}

      {participants.length > 0 && (
        <ParticipantStars
          participants={participants}
          positions={positions}
          winnerIds={winnerIds}
          phase={phase}
        />
      )}

      {showTitle && (
        <div className={`aurora-title ${phase === 'gathering' ? 'leaving' : ''}`}>
          <h1>당신을 칭찬하오로라</h1>
          <p>공감을 통해 이벤트를 더욱 빛내준 분들 중, 행운의 주인공 다섯 분을 발표합니다.</p>
        </div>
      )}

    </div>
  );
}
