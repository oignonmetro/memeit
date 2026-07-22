import { useEffect, useState } from 'react';

export function useCountdown(deadline: number | null | undefined, totalSec: number) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!deadline) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [deadline]);

  if (!deadline) return { remainingSec: 0, pct: 0 };
  const remainingMs = Math.max(0, deadline - now);
  const remainingSec = Math.ceil(remainingMs / 1000);
  const pct = totalSec > 0 ? Math.min(100, Math.max(0, (remainingMs / (totalSec * 1000)) * 100)) : 0;
  return { remainingSec, pct };
}
