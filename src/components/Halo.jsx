// The halo. Inline so it scales and needs no path juggling under a base path.
export function Halo({ size = 64, className = '' }) {
  const id = 'halo' + size;
  return (
    <svg className={'halo ' + className} width={size} height={size * 0.42} viewBox="0 0 320 134" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffe9a8" />
          <stop offset="45%" stopColor="#f6c452" />
          <stop offset="100%" stopColor="#d79a1f" />
        </linearGradient>
      </defs>
      <ellipse cx="160" cy="70" rx="138" ry="48" fill="none" stroke={`url(#${id})`} strokeWidth="22" />
      <ellipse cx="160" cy="63" rx="138" ry="48" fill="none" stroke="#fff6dc" strokeWidth="4" opacity=".6" />
    </svg>
  );
}
