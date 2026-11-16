import React from 'react';
import { formatBounty } from '../game/sim';
import type { Pirate, WorldState } from '../game/types';

interface PauseModalProps {
  world: WorldState;
  activePirate: Pirate | null;
  onResume: () => void;
  onGoMenu: () => void;
  onReturnTitle: () => void;
}

export const PauseModal: React.FC<PauseModalProps> = ({
  world,
  activePirate,
  onResume,
  onGoMenu,
  onReturnTitle,
}) => {
  const playerCount = world.pirates.length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pause-title"
    >
      <div className="w-full max-w-md rounded-xl border border-amber-500/40 bg-[#0b1526] p-6 text-slate-100 shadow-2xl">
        <h2 id="pause-title" className="font-display text-2xl font-black text-amber-300">
          Simulación en Pausa
        </h2>
        <p className="mt-1 text-xs text-slate-400">
          Los vientos del Grand Line esperan tus órdenes.
        </p>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-3">
            <div className="text-[11px] uppercase tracking-wider text-slate-400">Día Actual</div>
            <div className="mt-1 font-mono-num text-xl font-bold text-white">
              Día {world.day}
            </div>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-3">
            <div className="text-[11px] uppercase tracking-wider text-slate-400">Tus Piratas</div>
            <div className="mt-1 font-mono-num text-xl font-bold text-amber-300">
              {playerCount}
            </div>
          </div>
          {activePirate && (
            <div className="col-span-2 rounded-lg border border-slate-800 bg-slate-900/70 p-3">
              <div className="text-[11px] uppercase tracking-wider text-slate-400">
                Personaje Actual
              </div>
              <div className="mt-1 flex items-center justify-between gap-2">
                <span className="truncate text-sm font-bold text-white">{activePirate.name}</span>
                <span className="font-mono-num text-sm font-bold text-amber-300">
                  {formatBounty(activePirate.bounty)}
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 flex flex-col gap-2.5">
          <button
            type="button"
            onClick={onResume}
            className="w-full rounded-lg bg-[#f5b82e] py-2.5 font-display text-sm font-black text-slate-950 hover:bg-amber-300 cursor-pointer"
          >
            Reanudar Navegación
          </button>
          <button
            type="button"
            onClick={onGoMenu}
            className="w-full rounded-lg border border-slate-700 bg-slate-900 py-2.5 text-sm font-semibold text-slate-200 hover:bg-slate-800 cursor-pointer"
          >
            Ir al Menú de Personajes
          </button>
          <button
            type="button"
            onClick={onReturnTitle}
            className="w-full rounded-lg border border-slate-800 py-2 text-xs font-medium text-slate-400 hover:text-white cursor-pointer"
          >
            Volver a Portada
          </button>
        </div>
      </div>
    </div>
  );
};
