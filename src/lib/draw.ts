export interface Participant {
  id: string;
  name: string;
  department?: string;
  count: number;
}

export interface ParsedNames {
  participants: Participant[];
  warnings: string[];
}

export function parseCsv(input: string): ParsedNames {
  const warnings: string[] = [];
  const rows = input
    .split(/\r?\n/)
    .map((row) => row.trim())
    .filter((row) => row.length > 0 && !row.startsWith('#'));

  if (rows.length === 0) {
    return { participants: [], warnings: ['입력된 데이터가 없습니다.'] };
  }

  const firstCols = splitRow(rows[0]);
  const looksLikeHeader =
    firstCols.length >= 2 &&
    firstCols.some((c) => /name|이름/i.test(c)) &&
    firstCols.some((c) => /count|횟수|cnt/i.test(c));

  const dataRows = looksLikeHeader ? rows.slice(1) : rows;
  const seen = new Map<string, Participant>();

  dataRows.forEach((row, idx) => {
    const cols = splitRow(row);
    const name = cols[0];
    if (!name) {
      warnings.push(`${idx + 1}행: 이름이 비어 있습니다 → "${row}"`);
      return;
    }
    // A bare name (one column) counts as a single entry — lets operators
    // paste a plain one-name-per-line roster with no department or count.
    let department: string | undefined;
    let count: number;
    if (cols.length === 1) {
      department = undefined;
      count = 1;
    } else {
      const hasDept = cols.length >= 3;
      department = hasDept ? cols[1] : undefined;
      const countRaw = hasDept ? cols[2] : cols[1];
      count = Number(countRaw.replace(/[^\d.-]/g, ''));
      if (!Number.isFinite(count) || count <= 0) {
        warnings.push(`${idx + 1}행: 횟수 형식이 올바르지 않습니다 → "${row}"`);
        return;
      }
    }
    const key = `${name}__${department ?? ''}`;
    const existing = seen.get(key);
    if (existing) {
      existing.count += count;
    } else {
      seen.set(key, {
        id: `p${idx}`,
        name,
        department,
        count,
      });
    }
  });

  return { participants: Array.from(seen.values()), warnings };
}

function splitRow(row: string): string[] {
  const delim = row.includes('\t') ? '\t' : ',';
  return row.split(delim).map((c) => c.trim().replace(/^["']|["']$/g, ''));
}

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Draw weighting. Earned tickets set the base odds, but we soften the curve so
// colleagues with fewer tickets still get a fair shot: every entry gets a
// +DRAW_BIAS "bonus ticket" for the draw only (the ticket counts shown on
// screen stay as-earned). Higher bias = flatter odds. At bias 1 the 5-vs-1
// ticket gap narrows from 5× to 3×, and a 1-ticket holder's win chance rises
// while a 5-ticket holder's drops a little.
export const DRAW_BIAS = 1;

export function drawWeight(count: number): number {
  return count + DRAW_BIAS;
}

export function weightedPick(
  participants: Participant[],
  rand: () => number
): Participant | null {
  if (participants.length === 0) return null;
  const total = participants.reduce((sum, p) => sum + drawWeight(p.count), 0);
  if (total <= 0) return null;
  let r = rand() * total;
  for (const p of participants) {
    r -= drawWeight(p.count);
    if (r <= 0) return p;
  }
  return participants[participants.length - 1];
}

// Draw `count` distinct winners in one pass (sampling without replacement).
// Each round removes the picked entry from the pool, so nobody wins twice.
// Weighting still applies per round via weightedPick — with everyone on a
// single entry (count 1) this reduces to equal odds, which is the default for
// the 공감 draw. Returns fewer than `count` only if the pool is smaller.
export function pickWinners(
  participants: Participant[],
  count: number,
  rand: () => number
): Participant[] {
  const pool = participants.slice();
  const winners: Participant[] = [];
  const n = Math.min(Math.max(0, Math.floor(count)), pool.length);
  for (let i = 0; i < n; i++) {
    const picked = weightedPick(pool, rand);
    if (!picked) break;
    winners.push(picked);
    const idx = pool.indexOf(picked);
    if (idx >= 0) pool.splice(idx, 1);
  }
  return winners;
}

export const DEMO_CSV = `이름,부서,응모권
유동찬, 게임개발팀, 5
임지영, 디지털혁신팀, 4
문종인, 디지털혁신팀, 3
정애림, 디지털혁신팀, 2
심애림, 디지털혁신팀, 2
박소미, 경영지원팀, 1
최경규, 콘텐츠제작팀, 1
박세호, 국내영업팀,1
임승현, 재무팀, 1
박소연, 오더운영팀, 1`;
