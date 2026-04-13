import { useEffect, useState, useCallback } from 'react';

type Fortune = {
  quoteId: number;
  quote: string;
  drink: string | null;
  drinkNote: string | null;
  todayKey: string;
  alreadyLiked: boolean;
};

const DEVICE_KEY = 'zen-fortune-device-token';
const LIKE_DAY_KEY = 'zen-fortune-liked-day';

function createDeviceToken(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID().replace(/-/g, '');
  }
  return (
    'zf_' +
    Math.random().toString(36).slice(2) +
    Math.random().toString(36).slice(2) +
    Date.now().toString(36)
  );
}

function getDeviceToken(): string {
  let token = localStorage.getItem(DEVICE_KEY);
  if (!token || token.length < 20) {
    token = createDeviceToken();
    localStorage.setItem(DEVICE_KEY, token);
  }
  return token;
}

function todayKeyKST(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function formatQuote(text: string): string {
  return text.replace(/([.,，。!?])\s*/g, '$1\n').trim();
}

export default function FortuneClient() {
  const [fortune, setFortune] = useState<Fortune | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [liked, setLiked] = useState(false);
  const [likeBusy, setLikeBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const token = getDeviceToken();
      const res = await fetch(`/api/fortune?token=${encodeURIComponent(token)}`, {
        cache: 'no-store',
      });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as Fortune;
      setFortune(data);
      setLiked(data.alreadyLiked || localStorage.getItem(LIKE_DAY_KEY) === data.todayKey);
    } catch (err: any) {
      console.error(err);
      setError('문구를 불러오지 못했어요. 잠시 후 다시 시도해주세요.');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!fortune) return;
    const dayAtMount = fortune.todayKey;
    const t = setInterval(() => {
      if (todayKeyKST() !== dayAtMount) load();
    }, 60_000);
    return () => clearInterval(t);
  }, [load, fortune?.todayKey]);

  const onLike = async () => {
    if (!fortune || liked || likeBusy) return;
    setLikeBusy(true);
    setLiked(true);
    try {
      const token = getDeviceToken();
      const res = await fetch('/api/like', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token, quoteId: fortune.quoteId }),
      });
      if (!res.ok) throw new Error(await res.text());
      localStorage.setItem(LIKE_DAY_KEY, fortune.todayKey);
    } catch (err) {
      console.error(err);
      setLiked(false);
    } finally {
      setLikeBusy(false);
    }
  };

  if (error) {
    return <div className="state-msg">{error}</div>;
  }

  if (!fortune) {
    return <div className="state-msg">당신을 위한 문구 준비 중…</div>;
  }

  return (
    <>
      <p className="quote">{formatQuote(fortune.quote)}</p>

      {fortune.drink && (
        <div className="pairing">
          <div className="pairing-copy">
            <span className="pairing-label">Today&apos;s Pairing</span>
            <span className="pairing-name">{fortune.drink}</span>
            {fortune.drinkNote && <span className="pairing-note">{fortune.drinkNote}</span>}
          </div>
          <div className="pairing-mark" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 10h14v4a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5v-4Z" />
              <path d="M17 11h2a2 2 0 0 1 0 4h-2" />
              <path d="M7 3c.8 1.2.8 2.4 0 3.6" />
              <path d="M11 3c.8 1.2.8 2.4 0 3.6" />
            </svg>
          </div>
        </div>
      )}

      <button
        type="button"
        className={`like-btn${liked ? ' is-liked' : ''}`}
        onClick={onLike}
        disabled={liked || likeBusy}
        aria-label={liked ? '좋아요 완료' : '좋아요'}
      >
        {liked ? (
          <span className="like-clover" aria-hidden="true">🍀</span>
        ) : (
          <>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21.2l7.8-7.8 1-1a5.5 5.5 0 0 0 0-7.8Z" />
            </svg>
            <span>좋아요</span>
          </>
        )}
      </button>
    </>
  );
}
