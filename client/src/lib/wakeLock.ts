// Keeps the screen awake while a game is active. Without this, phones that go
// to sleep during a hands-off phase (e.g. watching memes during reveal) stop
// running their setInterval tick — and since round transitions are driven
// entirely by connected clients' local timers, the whole room can stall until
// someone's screen wakes back up.
let sentinel: WakeLockSentinel | null = null;
let wanted = false;

async function acquire() {
  if (!wanted || sentinel || !('wakeLock' in navigator)) return;
  try {
    sentinel = await navigator.wakeLock.request('screen');
    sentinel.addEventListener('release', () => {
      sentinel = null;
    });
  } catch {
    // Not available (permissions, unsupported browser, etc.) — degrade silently,
    // the visibilitychange catch-up tick still helps once the screen comes back.
  }
}

function onVisibilityChange() {
  if (document.visibilityState === 'visible') acquire();
}

export function requestWakeLock() {
  wanted = true;
  document.addEventListener('visibilitychange', onVisibilityChange);
  acquire();
}

export function releaseWakeLock() {
  wanted = false;
  document.removeEventListener('visibilitychange', onVisibilityChange);
  sentinel?.release().catch(() => {});
  sentinel = null;
}
