import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DEMO_CSV,
  type Participant,
  mulberry32,
  parseCsv,
  pickWinners,
} from '@/lib/draw';
import HeartsStage, { type HeartsPhase } from '@/components/HeartsStage';
import '@/styles/draw.css';
import '@/styles/hearts.css';

// Balloons lift and the flood swells before names land.
const GATHER_MS = 2200;
// Hold the celebratory burst before settling.
const REVEAL_MS = 1600;

function hashStr(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  }
  return h >>> 0;
}

export default function HeartsDraw() {
  const [participants, setParticipants] = useState<Participant[]>(() => {
    return parseCsv(DEMO_CSV).participants;
  });
  const [warnings, setWarnings] = useState<string[]>([]);
  const [csvText, setCsvText] = useState(DEMO_CSV);
  const [seedText, setSeedText] = useState(() => String(Date.now()));
  const [winnerCount, setWinnerCount] = useState(5);
  const [phase, setPhase] = useState<HeartsPhase>('idle');
  const [winners, setWinners] = useState<Participant[]>([]);
  const [opOpen, setOpOpen] = useState(false);

  const phaseTimers = useRef<number[]>([]);

  const clearTimers = useCallback(() => {
    phaseTimers.current.forEach((id) => window.clearTimeout(id));
    phaseTimers.current = [];
  }, []);

  useEffect(() => () => clearTimers(), [clearTimers]);

  const drawCount = useMemo(
    () => Math.min(Math.max(1, winnerCount), participants.length || 1),
    [winnerCount, participants.length]
  );

  const startDraw = useCallback(() => {
    if (phase !== 'idle' || participants.length === 0) return;

    const seedNum =
      Number(seedText) && Number.isFinite(Number(seedText))
        ? Number(seedText)
        : hashStr(seedText || String(Date.now()));
    const rand = mulberry32(seedNum);
    const picked = pickWinners(participants, drawCount, rand);
    if (picked.length === 0) return;
    setWinners(picked);

    clearTimers();
    setPhase('gathering');

    phaseTimers.current.push(
      window.setTimeout(() => setPhase('reveal'), GATHER_MS)
    );
    phaseTimers.current.push(
      window.setTimeout(() => setPhase('settled'), GATHER_MS + REVEAL_MS)
    );
  }, [phase, participants, seedText, drawCount, clearTimers]);

  const resetDraw = useCallback(() => {
    clearTimers();
    setPhase('idle');
    setWinners([]);
    setSeedText(String(Date.now()));
  }, [clearTimers]);

  const loadCsv = useCallback(() => {
    const result = parseCsv(csvText);
    setWarnings(result.warnings);
    if (result.participants.length === 0) return;
    clearTimers();
    setParticipants(result.participants);
    setWinners([]);
    setPhase('idle');
  }, [csvText, clearTimers]);

  const loadDemo = useCallback(() => {
    setCsvText(DEMO_CSV);
    const result = parseCsv(DEMO_CSV);
    setWarnings(result.warnings);
    clearTimers();
    setParticipants(result.participants);
    setWinners([]);
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
    <div className="hearts-root">
      <div className="hearts-chrome-top">
        <div className="hearts-eyebrow">
          <span className="dot" />
          당신을 칭찬하오로라
        </div>
        <div className="hearts-brand">Aurora World</div>
      </div>

      <HeartsStage phase={phase} participants={participants} winners={winners} />

      <div className="hearts-chrome-bottom">
        <div className="hearts-stat">
          <span className="hearts-stat-label">공감 참여자</span>
          <span className="hearts-stat-value">
            {participants.length}
            <span className="unit">명</span>
          </span>
        </div>

        <div className={`hearts-hint ${phase === 'idle' ? 'pulse' : ''}`}>
          {phase === 'idle' && (
            <>
              <kbd>Space</kbd> 추첨 시작
            </>
          )}
          {phase === 'gathering' && <>공감을 모으는 중…</>}
          {(phase === 'reveal' || phase === 'settled') && (
            <>
              축하합니다 · <kbd>R</kbd> 다시 뽑기
            </>
          )}
        </div>

        <div className="hearts-stat" style={{ textAlign: 'right' }}>
          <span className="hearts-stat-label">뽑을 인원</span>
          <span className="hearts-stat-value">
            {drawCount}
            <span className="unit">명</span>
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
        winnerCount={winnerCount}
        onWinnerCountChange={setWinnerCount}
        warnings={warnings}
        count={participants.length}
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
  winnerCount: number;
  onWinnerCountChange: (n: number) => void;
  warnings: string[];
  count: number;
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
            <span className="l">공감 참여자</span>
            <span className="v">{props.count}명</span>
          </div>
          <div className="op-summary-cell">
            <span className="l">뽑을 인원</span>
            <span className="v">{props.winnerCount}명</span>
          </div>
        </div>

        <div>
          <label className="op-field-label" htmlFor="op-winners">
            뽑을 인원 (당첨자 수)
          </label>
          <div className="op-seed">
            <input
              id="op-winners"
              type="number"
              min={1}
              max={20}
              value={props.winnerCount}
              onChange={(e) =>
                props.onWinnerCountChange(
                  Math.max(1, Math.min(20, Number(e.target.value) || 1))
                )
              }
            />
          </div>
        </div>

        <div>
          <label className="op-field-label" htmlFor="op-csv">
            참가자 명단 (이름, 부서, 응모 횟수)
          </label>
          <textarea
            id="op-csv"
            className="op-textarea"
            value={props.csvText}
            onChange={(e) => props.onCsvChange(e.target.value)}
            spellCheck={false}
            placeholder={`이름,부서,횟수\n김도윤,프로덕트,1\n이서연,디자인,1`}
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
            <kbd>Space</kbd>·<kbd>Enter</kbd> 추첨 시작 / 다시 뽑기
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
            칭찬 글에 <b>공감·댓글</b>을 남겨주신 분들 중 <b>{props.winnerCount}명</b>을 중복
            없이 무작위로 뽑아요. 기본은 동일 확률이며, 명단의 횟수를 늘리면 그만큼 응모권이
            많아집니다. 시드를 저장해두면 결과를 그대로 재현할 수 있어요.
          </div>
        </div>
      </div>
    </aside>
  );
}
