import React, { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface HorizontalOptionRailProps {
  label: string;
  rightHint?: React.ReactNode;
  children: React.ReactNode;
  stepPx?: number;
  testId?: string;
  prevAriaLabel?: string;
  nextAriaLabel?: string;
}

export const HorizontalOptionRail: React.FC<HorizontalOptionRailProps> = ({
  label,
  rightHint,
  children,
  stepPx = 190,
  testId,
  prevAriaLabel,
  nextAriaLabel,
}) => {
  const trackRef = useRef<HTMLDivElement>(null);

  const scrollTrack = (direction: -1 | 1) => {
    const el = trackRef.current;
    if (!el) return;
    if (typeof el.scrollBy === 'function') {
      el.scrollBy({ left: direction * stepPx, behavior: 'smooth' });
    } else {
      el.scrollLeft += direction * stepPx;
    }
  };

  return (
    <div className="space-y-1.5" data-testid={testId}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-mono-num text-[11px] font-bold uppercase tracking-wider text-teal-300">
          {label}
        </span>
        {rightHint && <div className="flex items-center gap-1.5">{rightHint}</div>}
      </div>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          data-testid={testId ? `${testId}-prev` : undefined}
          aria-label={prevAriaLabel ?? `Anterior en ${label}`}
          onClick={() => scrollTrack(-1)}
          className="flex h-9 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-700 bg-[#0d1a2e] text-slate-200 hover:border-[#f5b82e] hover:text-[#f5b82e] active:scale-95 transition-colors cursor-pointer"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <div
          ref={trackRef}
          data-testid={testId ? `${testId}-track` : undefined}
          className="flex flex-1 min-w-0 items-stretch gap-2 overflow-x-auto scroll-smooth py-1 px-0.5 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        >
          {children}
        </div>

        <button
          type="button"
          data-testid={testId ? `${testId}-next` : undefined}
          aria-label={nextAriaLabel ?? `Siguiente en ${label}`}
          onClick={() => scrollTrack(1)}
          className="flex h-9 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-700 bg-[#0d1a2e] text-slate-200 hover:border-[#f5b82e] hover:text-[#f5b82e] active:scale-95 transition-colors cursor-pointer"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};
