import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';

/**
 * Wraps a dismissible banner/prompt so it animates closed (height collapse +
 * fade) before unmounting. The collapse is a pure CSS transition, so the
 * global prefers-reduced-motion / .reduce-motion rules shorten it
 * automatically; the unmount delay is skipped entirely in that case.
 */
export function Collapsible({
  open,
  children,
}: {
  open: boolean;
  children: ReactNode;
}) {
  const [render, setRender] = useState(open);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (open) {
      setRender(true);
      setClosing(false);
      return;
    }
    if (!render) return;
    setClosing(true);
    const reduced = document.documentElement.classList.contains('reduce-motion');
    const id = window.setTimeout(
      () => {
        setRender(false);
        setClosing(false);
      },
      reduced ? 0 : 200
    );
    return () => window.clearTimeout(id);
  }, [open, render]);

  if (!render) return null;

  return (
    <div
      className={`grid transition-[grid-template-rows,opacity,transform] duration-200 ease-out ${
        closing
          ? 'grid-rows-[0fr] opacity-0 -translate-y-1'
          : 'grid-rows-[1fr] opacity-100 translate-y-0'
      }`}
    >
      <div className="overflow-hidden min-h-0">{children}</div>
    </div>
  );
}
