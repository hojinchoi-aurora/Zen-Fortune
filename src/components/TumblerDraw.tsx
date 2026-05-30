import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DEMO_CSV,
  type Participant,
  mulberry32,
  parseCsv,
  weightedPick,
} from '@/lib/draw';
import CafeStage, { type CafePhase } from '@/components/CafeStage';
import '@/styles/draw.css';

type Phase = CafePhase;

// Names get sucked into the bean hopper before the brew starts.
const SUCK_MS = 1200;
// Video is ~10s; reveal phase pads the on-screen caption hold time.
const VIDEO_MS = 10000;
const REVEAL_MS = 1800;

function hashStr(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  }
  return h >>> 0;
}

export default function TumblerDraw() {
  const [participants, setParticipants] = useState<Participant[]>(() => {
    return parseCsv(DEMO_CSV).participants;
  });
  const [warnings, setWarnings] = useState<string[]>([]);
  const [csvText, setCsvText] = useState(DEMO_CSV);
  const [seedText, setSeedText] = useState(() => String(Date.now()));
  const [phase, setPhase] = useState<Phase>('idle');
  const [winner, setWinner] = useState<Participant | null>(null);
  const [opOpen, setOpOpen] = useState(false);

  const phaseTimers = useRef<number[]>([]);

  const clearTimers = useCallback(() => {
    phaseTimers.current.forEach((id) => window.clearTimeout(id));
    phaseTimers.current = [];
  }, []);

  useEffect(() => () => clearTimers(), [clearTimers]);

  const totalCount = useMemo(
    () => participants.reduce((s, p) => s + p.count, 0),
    [participants]
  );

  const startDraw = useCallback(() => {
    if (phase !== 'idle' || participants.length === 0) return;

    const seedNum =
      Number(seedText) && Number.isFinite(Number(seedText))
        ? Number(seedText)
        : hashStr(seedText || String(Date.now()));
    const rand = mulberry32(seedNum);
    const picked = weightedPick(participants, rand);
    if (!picked) return;
    setWinner(picked);

    clearTimers();
    setPhase('sucking');

    phaseTimers.current.push(
      window.setTimeout(() => setPhase('playing'), SUCK_MS)
    );
    phaseTimers.current.push(
      window.setTimeout(() => setPhase('reveal'), SUCK_MS + VIDEO_MS)
    );
    phaseTimers.current.push(
      window.setTimeout(() => setPhase('settled'), SUCK_MS + VIDEO_MS + REVEAL_MS)
    );
  }, [phase, participants, seedText, clearTimers]);

  const resetDraw = useCallback(() => {
    clearTimers();
    setPhase('idle');
    setWinner(null);
    setSeedText(String(Date.now()));
  }, [clearTimers]);

  const loadCsv = useCallback(() => {
    const result = parseCsv(csvText);
    setWarnings(result.warnings);
    if (result.participants.length === 0) return;
    clearTimers();
    setParticipants(result.participants);
    setWinner(null);
    setPhase('idle');
  }, [csvText, clearTimers]);

  const loadDemo = useCallback(() => {
    setCsvText(DEMO_CSV);
    const result = parseCsv(DEMO_CSV);
    setWarnings(result.warnings);
    clearTimers();
    setParticipants(result.participants);
    setWinner(null);
    setPhase('idle');
  }, [clearTimers]);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        (e.key === 'E' || e.key === 'e') &&
        e.shiftKey &&
        (e.metaKey || e.ctrlKey)
      ) {
        e.preventDefault();
        setOpOpen((o) => !o);
        return;
      }
      if (e.key === 'Escape' && opOpen) {
        setOpOpen(false);
        return;
      }

      const target = e.target as HTMLElement | null;
      const typingTag =
        target && ['INPUT', 'TEXTAREA'].includes(target.tagName);
      if (opOpen || typingTag) return;

      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        if (phase === 'idle') startDraw();
        else if (phase === 'settled' || phase === 'reveal') resetDraw();
      }
      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        resetDraw();
      }
      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        toggleFullscreen();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [opOpen, phase, startDraw, resetDraw, toggleFullscreen]);

  return (
    <div className="draw-root">
      {/* Top chrome */}
      <div className="draw-chrome-top">
        <div className="draw-eyebrow">
          <span className="draw-eyebrow-rule" />
          <span className="draw-eyebrow-text">Townhall · Tumbler Draw</span>
        </div>
        <span className="draw-brand">Roastery Zen</span>
      </div>

      {/* Cafe scene (video + overlays) */}
      <CafeStage phase={phase} participants={participants} winner={winner} />

      {/* Bottom chrome */}
      <div className="draw-chrome-bottom">
        <div className="draw-stat">
          <span className="draw-stat-label">Today&apos;s Orders</span>
          <span className="draw-stat-value">
            {participants.length}
            <span className="unit">명</span>
          </span>
        </div>
        <div className="draw-hint pulse">
          {phase === 'idle' && (
            <>
              <kbd>Space</kbd> 한 잔 내리기
            </>
          )}
          {phase === 'sucking' && <>원두를 채우는 중…</>}
          {phase === 'playing' && <>한 잔 내리는 중…</>}
          {phase === 'reveal' && <>축하합니다 ☕</>}
          {phase === 'settled' && (
            <>
              <kbd>R</kbd> 다음 손님
            </>
          )}
        </div>
        <div className="draw-stat" style={{ textAlign: 'right' }}>
          <span className="draw-stat-label">Total Tickets</span>
          <span className="draw-stat-value">
            {totalCount}
            <span className="unit">장</span>
          </span>
        </div>
      </div>

      <OperatorPanel
        open={opOpen}
        onClose={() => setOpOpen(false)}
        csvText={csvText}
        onCsvChange={setCsvText}
        onLoad={loadCsv}
        onLoadDemo={loadDemo}
        seedText={seedText}
        onSeedChange={setSeedText}
        onReseed={() => setSeedText(String(Date.now()))}
        warnings={warnings}
        count={participants.length}
        totalCount={totalCount}
        onReset={resetDraw}
      />
    </div>
  );
}

// ---------- Operator panel ----------

function OperatorPanel(props: {
  open: boolean;
  onClose: () => void;
  csvText: string;
  onCsvChange: (s: string) => void;
  onLoad: () => void;
  onLoadDemo: () => void;
  seedText: string;
  onSeedChange: (s: string) => void;
  onReseed: () => void;
  warnings: string[];
  count: number;
  totalCount: number;
  onReset: () => void;
}) {
  return (
    <aside className={`op-panel ${props.open ? 'open' : ''}`} aria-hidden={!props.open}>
      <div className="op-panel-head">
        <div className="op-panel-title">
          <b>운영자 패널</b>
          <span>Operator Console</span>
        </div>
        <button
          className="op-panel-close"
          onClick={props.onClose}
          aria-label="패널 닫기"
          type="button"
        >
          ✕
        </button>
      </div>
      <div className="op-panel-body">
        <div className="op-summary">
          <div className="op-summary-cell">
            <span className="l">참가자</span>
            <span className="v">{props.count}명</span>
          </div>
          <div className="op-summary-cell">
            <span className="l">응모권 합계</span>
            <span className="v">{props.totalCount}장</span>
          </div>
        </div>

        <div>
          <label className="op-field-label" htmlFor="op-csv">
            참가자 명단 (이름, 부서, 응모권 장수)
          </label>
          <textarea
            id="op-csv"
            className="op-textarea"
            value={props.csvText}
            onChange={(e) => props.onCsvChange(e.target.value)}
            spellCheck={false}
            placeholder={`이름,부서,응모권\n김도윤,프로덕트,3\n이서연,디자인,5`}
          />
          {props.warnings.length > 0 && (
            <div className="op-warn">
              일부 행을 건너뛰었어요
              <ul>
                {props.warnings.slice(0, 4).map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
                {props.warnings.length > 4 && (
                  <li>그 외 {props.warnings.length - 4}건…</li>
                )}
              </ul>
            </div>
          )}
        </div>

        <div className="op-row">
          <button className="op-btn primary" onClick={props.onLoad} type="button">
            명단 적용
          </button>
          <button className="op-btn" onClick={props.onLoadDemo} type="button">
            데모 데이터
          </button>
        </div>

        <div>
          <label className="op-field-label" htmlFor="op-seed">
            추첨 시드 (재현용)
          </label>
          <div className="op-seed">
            <input
              id="op-seed"
              type="text"
              value={props.seedText}
              onChange={(e) => props.onSeedChange(e.target.value)}
              spellCheck={false}
            />
            <button className="op-btn" onClick={props.onReseed} type="button">
              랜덤 시드
            </button>
          </div>
        </div>

        <div className="op-row">
          <button className="op-btn danger" onClick={props.onReset} type="button">
            화면 초기화
          </button>
        </div>

        <div className="op-help">
          <b>단축키</b>
          <div style={{ marginTop: 8, lineHeight: '20px' }}>
            <kbd>Space</kbd>·<kbd>Enter</kbd> 한 잔 내리기 / 다음 손님
            <br />
            <kbd>R</kbd> 초기화
            <br />
            <kbd>F</kbd> 전체화면
            <br />
            <kbd>⌘/Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>E</kbd> 이 패널 토글
            <br />
            <kbd>Esc</kbd> 패널 닫기
          </div>
          <div style={{ marginTop: 14 }}>
            가중치는 <b>응모권 장수</b>입니다 (1~5). 장수가 많을수록 당첨 확률이 비례해
            높아져요. 시드를 저장해두면 추후 결과를 재현할 수 있습니다.
          </div>
        </div>
      </div>
    </aside>
  );
}
