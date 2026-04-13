const TZ = 'Asia/Seoul';

const dateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function todayKeyKST(now: Date = new Date()): string {
  return dateFormatter.format(now);
}

export function isValidDeviceToken(token: unknown): token is string {
  return typeof token === 'string' && /^[a-zA-Z0-9_-]{20,100}$/.test(token);
}
