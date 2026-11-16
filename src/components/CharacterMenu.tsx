import React, { useState } from 'react';
import type { User } from 'firebase/auth';
import {
  Anchor,
  Compass,
  Edit3,
  LogIn,
  LogOut,
  Plus,
  ShieldCheck,
  Trash2,
  UserCheck,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { formatBounty, getSeaBadgeColor } from '../game/sim';
import { getFactionInfo, getTraitLabel } from '../game/worldData';
import type { Island, Pirate } from '../game/types';
import { PirateAvatarSvg } from './PirateAvatarSvg';

interface CharacterMenuProps {
  pirates: Pirate[];
  islands: Island[];
  user: User | null;
  authBusy: boolean;
  authNotice: string | null;
  muted: boolean;
  onCreateNew: () => void;
  onSelectCharacter: (pirate: Pirate) => void;
  onEditCharacter: (pirate: Pirate) => void;
  onDeleteCharacter: (pirateId: string) => void;
  onAuthAction: () => void;
  onToggleMute: () => void;
  onReturnTitle: () => void;
}

export const CharacterMenu: React.FC<CharacterMenuProps> = ({
  pirates,
  islands,
  user,
  authBusy,
  authNotice,
  muted,
  onCreateNew,
  onSelectCharacter,
  onEditCharacter,
  onDeleteCharacter,
  onAuthAction,
  onToggleMute,
  onReturnTitle,
}) => {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  return (
    <div className="pointer-events-none fixed inset-0 z-20 flex flex-col justify-between p-3 sm:p-5">
      {/* Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="pointer-events-auto flex items-center gap-3 rounded-xl border border-amber-500/30 bg-[#081221]/95 px-3.5 py-2 shadow-xl">
          <button
            type="button"
            onClick={onReturnTitle}
            className="font-display text-sm font-black tracking-wide text-amber-300 hover:text-amber-200 cursor-pointer whitespace-nowrap"
          >
            VIVID OCEAN
          </button>
          <span aria-hidden="true" className="text-slate-600">·</span>
          <span className="font-mono-num text-xs font-semibold text-slate-300 whitespace-nowrap">
            Menú de Personajes ({pirates.length})
          </span>
        </div>

        <div className="pointer-events-auto flex items-center gap-2 rounded-xl border border-amber-500/25 bg-[#081221]/95 px-2.5 py-1.5 shadow-xl">
          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onToggleMute();
            }}
            aria-label={muted ? 'Activar sonido [M]' : 'Silenciar sonido [M]'}
            className="rounded-lg p-1.5 text-slate-200 hover:bg-slate-800 cursor-pointer shrink-0"
          >
            {muted ? <VolumeX className="h-4 w-4 text-rose-400" /> : <Volume2 className="h-4 w-4" />}
          </button>

          <button
            type="button"
            disabled={authBusy}
            onClick={onAuthAction}
            className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-100 hover:border-amber-400 cursor-pointer disabled:opacity-60 whitespace-nowrap"
          >
            {user ? (
              <>
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                <span className="max-w-[140px] truncate">
                  {user.displayName || user.email || 'Cuenta Google'}
                </span>
                <LogOut className="h-3.5 w-3.5 text-slate-400 ml-0.5" />
              </>
            ) : (
              <>
                <LogIn className="h-3.5 w-3.5 text-amber-300" />
                <span>{authBusy ? 'Conectando...' : 'Entrar con Google'}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Character Hub Panel */}
      <div className="flex flex-1 items-start sm:items-center pt-3 overflow-hidden">
        <section
          aria-label="Menú de tus personajes"
          className="pointer-events-auto flex max-h-[calc(100vh-110px)] w-full max-w-xl flex-col rounded-2xl border border-amber-500/30 bg-[#081221]/95 text-slate-100 shadow-2xl overflow-hidden"
        >
          {/* Header + Create CTA */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-[#0b172a] px-4 py-3.5 sm:px-5">
            <div>
              <h2 className="font-display text-lg sm:text-xl font-black text-amber-300">
                Tus Personajes
              </h2>
              <p className="text-xs text-slate-400">
                Elige un personaje para entrar en su mundo o crea uno nuevo.
              </p>
            </div>

            <button
              type="button"
              onClick={onCreateNew}
              className="flex items-center gap-2 rounded-xl bg-[#f5b82e] px-4 py-2.5 text-xs sm:text-sm font-black text-slate-950 shadow-[0_6px_20px_rgba(245,184,46,0.3)] hover:bg-amber-300 active:scale-[0.98] transition-all cursor-pointer whitespace-nowrap"
            >
              <Plus className="h-4 w-4 stroke-[3]" />
              <span>Nuevo personaje</span>
            </button>
          </div>

          {/* Google Account Persistence Banner */}
          <div className="border-b border-slate-800/90 bg-[#0a1628] px-4 py-2.5 sm:px-5">
            {user ? (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <UserCheck className="h-4 w-4 text-emerald-400 shrink-0" />
                  <div className="min-w-0 text-xs">
                    <span className="font-bold text-emerald-300">Cuenta guardada con Google: </span>
                    <span className="text-slate-300 truncate">{user.email || user.displayName}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onAuthAction}
                  className="rounded-lg border border-slate-700 px-2.5 py-1 text-[11px] font-semibold text-slate-300 hover:border-rose-400/60 hover:text-rose-200 cursor-pointer whitespace-nowrap"
                >
                  Cerrar sesión
                </button>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <p className="text-xs text-slate-300">
                  Guarda tus personajes en tu cuenta de Google.
                </p>
                <button
                  type="button"
                  disabled={authBusy}
                  onClick={onAuthAction}
                  className="flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-amber-400/50 bg-amber-400/10 px-3 py-1.5 text-xs font-bold text-amber-300 hover:bg-amber-400/20 cursor-pointer disabled:opacity-60 whitespace-nowrap"
                >
                  <LogIn className="h-3.5 w-3.5" />
                  <span>{authBusy ? 'Conectando...' : 'Guardar con Google'}</span>
                </button>
              </div>
            )}
            {authNotice && (
              <p role="status" className="mt-1.5 text-[11px] text-amber-200">
                {authNotice}
              </p>
            )}
          </div>

          {/* Character List */}
          <div className="flex-1 overflow-y-auto nautical-scroll p-4 sm:p-5 space-y-3">
            {pirates.length === 0 ? (
              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 text-center space-y-3">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-300">
                  <Anchor className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-display text-base font-black text-white">
                    Aún no tienes ningún personaje
                  </h3>
                  <p className="mt-1 text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                    En Vivid Ocean no existen bots: solo navegan tus propios personajes. Crea el primero
                    para comenzar su travesía.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onCreateNew}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#f5b82e] px-5 py-2.5 text-sm font-black text-slate-950 hover:bg-amber-300 cursor-pointer"
                >
                  <Plus className="h-4 w-4 stroke-[3]" />
                  <span>Crear primer personaje</span>
                </button>
              </div>
            ) : (
              pirates.map((p) => {
                const currIsland = islands.find((i) => i.id === p.islandId);
                const destIsland = p.sailingToIslandId
                  ? islands.find((i) => i.id === p.sailingToIslandId)
                  : null;
                const confirming = confirmDeleteId === p.id;
                const factionInfo = getFactionInfo(p.faction);
                const hasCrew = Boolean(p.crewName && p.crewName !== 'Sin tripulación');

                return (
                  <div
                    key={p.id}
                    className="rounded-xl border border-amber-500/35 bg-[#0d1a2e]/90 p-3.5 transition-colors hover:border-amber-400/60"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3.5">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="shrink-0 rounded-xl border border-slate-700/80 bg-[#081221] p-1.5">
                          <PirateAvatarSvg
                            name={p.name}
                            flagColor={p.flagColor}
                            hatStyle={p.hatStyle}
                            hatColor={p.hatColor}
                            race={p.race}
                            skinTone={p.skinTone}
                            hairStyle={p.hairStyle}
                            hairColor={p.hairColor}
                            bodyBuild={p.bodyBuild}
                            outfitStyle={p.outfitStyle}
                            outfitColor={p.outfitColor}
                            accessory={p.accessory}
                            accessoryColor={p.accessoryColor}
                            capeStyle={p.capeStyle}
                            capeColor={p.capeColor}
                            weaponStyle={p.weaponStyle}
                            role={p.role}
                            hasEquippedWeapon={Boolean(p.equipped?.arma)}
                            variant="stage"
                            size={64}
                          />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-display truncate text-base font-black text-amber-300">
                              {p.name}
                            </span>
                            <span
                              className="rounded px-1.5 py-0.5 text-[10px] font-bold"
                              style={{
                                backgroundColor: `${factionInfo.badgeColor}22`,
                                color: factionInfo.badgeColor,
                              }}
                            >
                              {factionInfo.label}
                            </span>
                            <span
                              className="rounded px-1.5 py-0.5 text-[10px] font-bold"
                              style={{
                                backgroundColor: `${getSeaBadgeColor(p.originSea)}22`,
                                color: getSeaBadgeColor(p.originSea),
                              }}
                            >
                              {p.originSea}
                            </span>
                          </div>

                          <div className="truncate text-xs text-slate-300">
                            «{p.epithet}» · {hasCrew ? `${p.crewName} (${p.role})` : 'Sin tripulación'}
                          </div>

                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs font-mono-num">
                            <span className="font-bold text-amber-300">
                              {formatBounty(p.bounty)}
                            </span>
                            <span className="text-slate-600">·</span>
                            <span className="text-emerald-300">{p.berries} monedones</span>
                            <span className="text-slate-600">·</span>
                            <span className="text-slate-300">
                              {p.wins}V / {p.losses}D
                            </span>
                          </div>

                          <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-400">
                            <Compass className="h-3 w-3 text-sky-400 shrink-0" />
                            <span className="truncate">
                              {destIsland
                                ? `Rumbo a ${destIsland.name}`
                                : `En ${currIsland?.name ?? 'alta mar'}`}
                              {p.devilFruit ? ` · ${p.devilFruit}` : ''}
                            </span>
                          </div>
                          <div className="mt-0.5 truncate text-[10px] text-slate-500">
                            {[...p.physicalTraits, ...p.mentalTraits].map(getTraitLabel).join(' · ')}
                          </div>
                        </div>
                      </div>

                      <div className="flex sm:flex-col items-center sm:items-end justify-end gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => onSelectCharacter(p)}
                          className="rounded-lg bg-[#f5b82e] px-3.5 py-2 text-xs font-black text-slate-950 hover:bg-amber-300 transition-colors cursor-pointer whitespace-nowrap"
                        >
                          Ver personaje
                        </button>

                        {confirming ? (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setConfirmDeleteId(null);
                                onDeleteCharacter(p.id);
                              }}
                              aria-label={`Confirmar borrar a ${p.name}`}
                              className="rounded-lg bg-rose-600 px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-rose-500 cursor-pointer whitespace-nowrap"
                            >
                              Confirmar
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-[11px] font-semibold text-slate-300 hover:bg-slate-800 cursor-pointer"
                            >
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => onEditCharacter(p)}
                              aria-label={`Editar a ${p.name}`}
                              className="flex items-center gap-1 rounded-lg border border-teal-400/40 bg-teal-950/40 px-2.5 py-1.5 text-[11px] font-semibold text-teal-200 hover:bg-teal-900/50 cursor-pointer whitespace-nowrap"
                            >
                              <Edit3 className="h-3 w-3" />
                              <span>Editar</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(p.id)}
                              aria-label={`Borrar a ${p.name}`}
                              className="flex items-center gap-1 rounded-lg border border-rose-500/40 bg-rose-950/30 px-2.5 py-1.5 text-[11px] font-semibold text-rose-300 hover:bg-rose-900/50 cursor-pointer whitespace-nowrap"
                            >
                              <Trash2 className="h-3 w-3" />
                              <span>Borrar</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>
    </div>
  );
};
