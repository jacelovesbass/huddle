import { useEffect, useState } from 'react';

const BUILD = import.meta.env.VITE_BUILD || 'dev';

/**
 * An installed web app caches hard, so someone can sit on yesterday's copy for
 * days without knowing. Poll a tiny file that the deploy stamps with the build
 * it published, and offer a reload when it moves. Reloading via a changed URL,
 * because a plain reload can be served the cached page again.
 */
export function UpdateBanner() {
  const [stale, setStale] = useState(false);

  useEffect(() => {
    if (BUILD === 'dev') return;
    let alive = true;

    const check = async () => {
      if (document.hidden) return;
      try {
        const r = await fetch(`version.json?t=${Date.now()}`, { cache: 'no-store' });
        const { build } = await r.json();
        if (alive && build && build !== BUILD) setStale(true);
      } catch { /* offline, try again later */ }
    };

    check();
    const timer = setInterval(check, 120000);
    document.addEventListener('visibilitychange', check);
    return () => {
      alive = false;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', check);
    };
  }, []);

  if (!stale) return null;
  return (
    <button className="update" onClick={() => {
      location.replace(`${location.pathname}?v=${Date.now()}${location.hash}`);
    }}>
      A newer version is ready. Tap to update.
    </button>
  );
}
