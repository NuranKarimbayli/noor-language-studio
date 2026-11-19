import { useMemo } from 'react';

interface CelebrationBurstProps {
  active: boolean;
}

const CONFETTI_COLORS = [
  '#B45309',
  '#F59E0B',
  '#10B981',
  '#059669',
  '#D97706',
  '#78716C',
];

export function CelebrationBurst({ active }: CelebrationBurstProps) {
  const pieces = useMemo(
    () =>
      Array.from({ length: 24 }, (_, idx) => {
        const left = 6 + ((idx * 37) % 88);
        const delay = (idx % 6) * 0.07;
        const duration = 1.45 + (idx % 4) * 0.22;
        const size = idx % 3 === 0 ? 8 : 6;
        const rotate = (idx * 47) % 360;
        const color = CONFETTI_COLORS[idx % CONFETTI_COLORS.length];
        const isCircle = idx % 4 === 0;
        return { id: idx, left, delay, duration, size, rotate, color, isCircle };
      }),
    []
  );

  if (!active) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 top-0 h-52 overflow-hidden rounded-t-2xl"
    >
      {pieces.map((p) => (
        <span
          key={p.id}
          className="celebration-piece absolute -top-3"
          style={{
            left: `${p.left}%`,
            width: `${p.size}px`,
            height: `${p.isCircle ? p.size : p.size * 1.6}px`,
            backgroundColor: p.color,
            borderRadius: p.isCircle ? '9999px' : '2px',
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            transform: `rotate(${p.rotate}deg)`,
          }}
        />
      ))}
    </div>
  );
}
