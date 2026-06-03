import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { mulberry32, type Participant } from '@/lib/draw';

// Cup latte-surface center within the source video (1280x720).
// Measured from the final frame where the tumbler holds steady with finished latte art.
const CUP_X_IN_VIDEO = 640;
const CUP_Y_IN_VIDEO = 345;
const VIDEO_W = 1280;
const VIDEO_H = 720;
const VIDEO_AR = VIDEO_W / VIDEO_H;

export type CafePhase =
  | 'idle'
  | 'sucking'
  | 'playing'
  | 'reveal'
  | 'settled';

interface Props {
  phase: CafePhase;
  participants: Participant[];
  winner: Participant | null;
}

export default function CafeStage({ phase, participants, winner }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cupPos, setCupPos] = useState<{ x: number; y: number; scale: number }>(
    { x: 50, y: 50, scale: 1 }
  );

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (phase === 'idle' || phase === 'sucking') {
      v.pause();
      try { v.currentTime = 0; } catch {}
    } else if (phase === 'playing') {
      try { v.currentTime = 0; } catch {}
      const playPromise = v.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => {});
      }
    } else if (phase === 'reveal' || phase === 'settled') {
      try { v.currentTime = Math.max(0, (v.duration || 8) - 0.05); } catch {}
      v.pause();
    }
  }, [phase]);

  // Compute cup overlay position based on the rendered video box.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const compute = () => {
      const rect = v.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const viewportAR = rect.width / rect.height;
      // object-fit: cover behavior
      let renderedW: number;
      let renderedH: number;
      let offsetX: number;
      let offsetY: number;
      if (viewportAR > VIDEO_AR) {
        renderedW = rect.width;
        renderedH = rect.width / VIDEO_AR;
        offsetX = 0;
        offsetY = (rect.height - renderedH) / 2;
      } else {
        renderedH = rect.height;
        renderedW = rect.height * VIDEO_AR;
        offsetX = (rect.width - renderedW) / 2;
        offsetY = 0;
      }
      const cupX = (CUP_X_IN_VIDEO / VIDEO_W) * renderedW + offsetX;
      const cupY = (CUP_Y_IN_VIDEO / VIDEO_H) * renderedH + offsetY;
      const scale = renderedW / VIDEO_W;
      setCupPos({ x: cupX, y: cupY, scale });
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(v);
    window.addEventListener('resize', compute);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', compute);
    };
  }, []);

  return (
    <div className="cafe-stage-v2">
      {/* Background video */}
      <video
        ref={videoRef}
        className="cafe-video"
        src="/cafe-scene.mp4"
        muted
        playsInline
        preload="auto"
        poster="/tumbler-idle.png"
      />

      {/* Idle poster overlays the first frame so the lounge shot greets viewers
          before Space is pressed. Stays through the sucking phase, then fades
          out as the video starts. */}
      <img
        className={`cafe-idle-poster ${phase === 'idle' || phase === 'sucking' ? 'on' : ''}`}
        src="/tumbler-idle.png"
        alt=""
        aria-hidden="true"
      />

      {/* Floating participant names — drift around the lounge, then get
          sucked into the bean hopper when the draw starts. */}
      {(phase === 'idle' || phase === 'sucking') && participants.length > 0 && (
        <IdleNames participants={participants} sucking={phase === 'sucking'} />
      )}

      {/* Mask the bottom-right Veo watermark */}
      <div className="veo-mask" aria-hidden="true" />

      {/* Subtle vignette so foreground text reads better */}
      <div className="cafe-vignette" aria-hidden="true" />

      {/* Latte foam name overlay — appears starting late in playback */}
      {winner && (phase === 'playing' || phase === 'reveal' || phase === 'settled') && (
        <FoamNameOverlay
          name={winner.name}
          active
          held={phase === 'reveal' || phase === 'settled'}
          cupPos={cupPos}
        />
      )}

      {/* Reveal caption (after video) */}
      {(phase === 'reveal' || phase === 'settled') && winner && (
        <RevealCaption winner={winner} />
      )}
    </div>
  );
}

// ---------- Idle floating names (suck into beans on draw) ----------

interface NamePosition {
  x: number;
  y: number;
  driftX: number;
  driftY: number;
  floatDur: number;
  floatDelay: number;
  suckDelay: number;
  rotation: number;
  fontScale: number;
}

// Orbit centered on the grinder. Names sit on two arcs (left/right of the
// machine), spanning ±55° from horizontal. The vertical axis stays empty so
// the grinder is clearly surrounded but not overlapped.
const ORBIT_CENTER_X = 50;
const ORBIT_CENTER_Y = 48;
const ORBIT_RX_MIN = 32;
const ORBIT_RX_MAX = 42;
const ORBIT_RY_MIN = 30;
const ORBIT_RY_MAX = 38;
const ARC_HALF_DEG = 38;

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

function generateNamePositions(participants: Participant[]): NamePosition[] {
  const rng = mulberry32(hashParticipants(participants));
  const N = participants.length;
  const perSide = Math.ceil(N / 2);
  // Pre-decide which side each index lives on, alternating then shuffled in
  // pairs so the deterministic seed still spreads them across both arcs.
  const sides = participants.map((_, i) => (i % 2 === 0 ? 1 : -1));
  return participants.map((_, i) => {
    const side = sides[i]; // +1 = right of machine, -1 = left
    const sideIdx = Math.floor(i / 2);
    // Evenly distribute angle within the arc, with a small jitter for
    // organic feel.
    const t = perSide <= 1 ? 0.5 : sideIdx / (perSide - 1);
    const arcSpread = ARC_HALF_DEG * 2;
    const baseAngleDeg = -ARC_HALF_DEG + t * arcSpread;
    const jitterDeg = -6 + rng() * 12;
    const angle = ((baseAngleDeg + jitterDeg) * Math.PI) / 180;

    const rx = ORBIT_RX_MIN + rng() * (ORBIT_RX_MAX - ORBIT_RX_MIN);
    const ry = ORBIT_RY_MIN + rng() * (ORBIT_RY_MAX - ORBIT_RY_MIN);

    const x = ORBIT_CENTER_X + side * Math.cos(angle) * rx;
    const y = ORBIT_CENTER_Y + Math.sin(angle) * ry;

    return {
      x,
      y,
      driftX: -8 + rng() * 16,
      driftY: -6 + rng() * 12,
      floatDur: 4.5 + rng() * 3.5,
      floatDelay: rng() * 3,
      suckDelay: rng() * 320,
      rotation: -5 + rng() * 10,
      fontScale: 0.94 + rng() * 0.18,
    };
  });
}

function IdleNames({
  participants,
  sucking,
}: {
  participants: Participant[];
  sucking: boolean;
}) {
  const positions = useMemo(
    () => generateNamePositions(participants),
    [participants]
  );
  return (
    <div className={`idle-names ${sucking ? 'sucking' : ''}`} aria-hidden="true">
      {participants.map((p, i) => {
        const pos = positions[i];
        const style = {
          left: `${pos.x}%`,
          top: `${pos.y}%`,
          '--drift-x': `${pos.driftX}px`,
          '--drift-y': `${pos.driftY}px`,
          '--float-dur': `${pos.floatDur}s`,
          '--float-delay': `${pos.floatDelay}s`,
          '--suck-delay': `${pos.suckDelay}ms`,
          '--rotation': `${pos.rotation}deg`,
          fontSize: `calc(clamp(17px, 1.55vw, 22px) * ${pos.fontScale})`,
        } as CSSProperties;
        return (
          <span key={p.id} className="idle-name" style={style}>
            {p.name}
          </span>
        );
      })}
    </div>
  );
}

// ---------- Foam name overlay ----------

function FoamNameOverlay({
  name,
  active,
  held,
  cupPos,
}: {
  name: string;
  active: boolean;
  held: boolean;
  cupPos: { x: number; y: number; scale: number };
}) {
  // Size mask and font in proportion to the video's render scale,
  // so the overlay matches the cup regardless of viewport size.
  // The visible latte-art ellipse spans ~320x110 px in video coords.
  const maskW = 300 * cupPos.scale;
  const maskH = 90 * cupPos.scale;
  const fontSize = 64 * cupPos.scale;
  const style: CSSProperties = {
    left: `${cupPos.x}px`,
    top: `${cupPos.y}px`,
    width: `${maskW}px`,
    height: `${maskH}px`,
  };
  return (
    <div
      className={`foam-overlay ${active ? 'on' : ''} ${held ? 'held' : ''}`}
      aria-hidden="true"
    >
      <div className="foam-cup-area" style={style}>
        <span className="foam-mask" />
        <span className="foam-name" style={{ fontSize: `${fontSize}px` }}>
          {name}
        </span>
      </div>
    </div>
  );
}

// ---------- Reveal caption ----------

function RevealCaption({ winner }: { winner: Participant }) {
  return (
    <div className="reveal-caption">
      <div className="reveal-eyebrow">Prize Winner</div>
      <div className="reveal-line">
        <b className="reveal-name-inline">
          {winner.name}
          <span className="reveal-honorific">님</span>
        </b>
        {winner.department && (
          <span className="reveal-dept-inline">{winner.department}</span>
        )}
      </div>
      <div className="reveal-note">
        당첨을 축하드립니다 · 응모권 <b>{winner.count}장</b>
      </div>
    </div>
  );
}
