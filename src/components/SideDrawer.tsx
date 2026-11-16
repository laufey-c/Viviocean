import React, { useState } from 'react';
import { Anchor, Compass, Coins, Flame, MessageCircle, Newspaper, ScrollText, Shield, Swords, X } from 'lucide-react';
import { formatBounty, formatShortBounty, getSeaBadgeColor } from '../game/sim';
import { getTraitLabel } from '../game/worldData';
import type {
  ChatMessage,
  Directive,
  Island,
  Pirate,
  WorldEvent,
} from '../game/types';
import { WantedPosterCard } from './WantedPosterCard';

export type DrawerTab = 'noticias' | 'tablones' | 'chat' | 'cofre';

interface SideDrawerProps {
  activeTab: DrawerTab;
  events: WorldEvent[];
  pirates: Pirate[];
  islands: Island[];
  chatMessages: ChatMessage[];
  isSignedIn: boolean;
  onSelectTab: (tab: DrawerTab) => void;
  onClose: () => void;
  onFocusIsland: (islandId: string) => void;
  onFocusPirate: (pirate: Pirate) => void;
  onChangeDirective: (pirateId: string, directive: Directive) => void;
  onSendChat: (text: string) => void;
  onOpenCreatePirate: () => void;
}

const DIRECTIVES: Array<{ id: Directive; label: string }> = [
  { id: 'libre', label: 'Libre' },
  { id: 'tesoros', label: 'Tesoros' },
  { id: 'duelos', label: 'Duelos' },
  { id: 'grand_line', label: 'Grand Line' },
  { id: 'descansar', label: 'Descansar' },
];

export const SideDrawer: React.FC<SideDrawerProps> = ({
  activeTab,
  events,
  pirates,
  islands,
  chatMessages,
  isSignedIn,
  onSelectTab,
  onClose,
  onFocusIsland,
  onFocusPirate,
  onChangeDirective,
  onSendChat,
  onOpenCreatePirate,
}) => {
  const [newsFilter, setNewsFilter] = useState<'importante' | 'mio' | 'portada'>('importante');
  const [boardView, setBoardView] = useState<'piratas' | 'tripulaciones'>('piratas');
  const [chatInput, setChatInput] = useState('');

  const myPirates = pirates.filter((p) => p.isPlayerOwned);
  const filteredEvents =
    newsFilter === 'mio'
      ? events.filter((ev) => ev.isPlayerRelated)
      : events;

  const sortedByBounty = [...pirates].sort((a, b) => b.bounty - a.bounty);

  // Aggregate crew rankings
  const crewTotals = new Map<string, { name: string; totalBounty: number; members: number }>();
  pirates.forEach((p) => {
    const existing = crewTotals.get(p.crewName) ?? {
      name: p.crewName,
      totalBounty: 0,
      members: 0,
    };
    existing.totalBounty += p.bounty;
    existing.members += 1;
    crewTotals.set(p.crewName, existing);
  });
  const sortedCrews = Array.from(crewTotals.values()).sort(
    (a, b) => b.totalBounty - a.totalBounty
  );

  const renderEventIcon = (type: WorldEvent['type']) => {
    switch (type) {
      case 'duel':
        return <Swords className="h-3.5 w-3.5 text-rose-400 shrink-0" />;
      case 'treasure':
        return <Coins className="h-3.5 w-3.5 text-amber-400 shrink-0" />;
      case 'devil_fruit':
        return <Flame className="h-3.5 w-3.5 text-purple-400 shrink-0" />;
      case 'voyage':
        return <Compass className="h-3.5 w-3.5 text-sky-400 shrink-0" />;
      case 'launch':
        return <Anchor className="h-3.5 w-3.5 text-amber-300 shrink-0" />;
      default:
        return <Anchor className="h-3.5 w-3.5 text-emerald-400 shrink-0" />;
    }
  };

  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = chatInput.trim();
    if (!trimmed) return;
    onSendChat(trimmed);
    setChatInput('');
  };

  return (
    <aside
      aria-label="Panel del mundo pirata"
      className="pointer-events-auto flex h-full w-full sm:w-[390px] flex-col rounded-xl border border-amber-500/25 bg-[#081221]/95 text-slate-100 shadow-2xl overflow-hidden"
    >
      {/* Top Tabs */}
      <div className="flex items-center justify-between border-b border-slate-800 px-3 py-2.5 bg-[#0b172a]">
        <div className="flex items-center gap-1" role="tablist" aria-label="Secciones del diario">
          {(
            [
              { id: 'noticias', label: 'Noticias', icon: Newspaper },
              { id: 'tablones', label: 'Tablones', icon: ScrollText },
              { id: 'chat', label: 'Chat', icon: MessageCircle },
              { id: 'cofre', label: 'Cofre', icon: Shield },
            ] as const
          ).map((t) => {
            const Icon = t.icon;
            const isActive = activeTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => onSelectTab(t.id)}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  isActive
                    ? 'bg-amber-400 text-slate-950'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar panel"
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Body */}
      {activeTab === 'noticias' && (
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-800/80 px-3 py-2">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setNewsFilter('importante')}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold cursor-pointer transition-colors ${
                  newsFilter === 'importante'
                    ? 'bg-slate-100 text-slate-950'
                    : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                Lo importante
              </button>
              <button
                type="button"
                onClick={() => setNewsFilter('mio')}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold cursor-pointer transition-colors ${
                  newsFilter === 'mio'
                    ? 'bg-slate-100 text-slate-950'
                    : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                Lo mío ({myPirates.length})
              </button>
            </div>
            <button
              type="button"
              onClick={() => setNewsFilter('portada')}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold cursor-pointer transition-colors ${
                newsFilter === 'portada'
                  ? 'bg-amber-400 text-slate-950'
                  : 'text-amber-300 hover:bg-slate-800'
              }`}
            >
              Portada
            </button>
          </div>

          <div className="flex-1 overflow-y-auto nautical-scroll p-3 space-y-2">
            {newsFilter === 'portada' ? (
              <div className="space-y-3">
                <div className="wanted-parchment rounded border-2 border-[#7c562c] p-3.5 shadow">
                  <div className="border-b-2 border-[#2b1a0d] pb-1.5 text-center">
                    <div className="font-display text-lg font-black tracking-wider text-[#1f1207]">
                      EL MORGAN DIARIO
                    </div>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-[#5c3d1e]">
                      Edición Especial del Grand Line
                    </div>
                  </div>
                  {events[0] && (
                    <div className="mt-2.5">
                      <div className="text-[11px] font-bold uppercase text-[#881337]">
                        Última Hora · {events[0].sea}
                      </div>
                      <p className="mt-1 text-sm font-bold leading-snug text-[#1f1207]">
                        {events[0].message}
                      </p>
                      <button
                        type="button"
                        onClick={() => onFocusIsland(events[0].islandId)}
                        className="mt-2.5 rounded bg-[#2b1a0d] px-3 py-1 text-xs font-semibold text-[#f3e5c8] hover:bg-[#432915] cursor-pointer"
                      >
                        Ir al lugar de los hechos
                      </button>
                    </div>
                  )}
                </div>

                {sortedByBounty[0] && (
                  <WantedPosterCard
                    pirate={sortedByBounty[0]}
                    rank={1}
                    onFocusPirate={onFocusPirate}
                  />
                )}
              </div>
            ) : filteredEvents.length === 0 ? (
              <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-5 text-center">
                <p className="text-xs text-slate-400">
                  Aún no hay noticias de tus piratas. Crea un personaje para verlo zarpar y pelear en el mar.
                </p>
                <button
                  type="button"
                  onClick={onOpenCreatePirate}
                  className="mt-3 rounded-lg bg-amber-400 px-3.5 py-1.5 text-xs font-bold text-slate-950 hover:bg-amber-300 cursor-pointer"
                >
                  Crear Pirata
                </button>
              </div>
            ) : (
              filteredEvents.map((ev) => (
                <button
                  key={ev.id}
                  type="button"
                  onClick={() => onFocusIsland(ev.islandId)}
                  className={`w-full text-left rounded-lg border p-2.5 transition-colors cursor-pointer ${
                    ev.isPlayerRelated
                      ? 'border-amber-400/50 bg-amber-950/25 hover:bg-amber-950/40'
                      : 'border-slate-800/90 bg-slate-900/55 hover:bg-slate-800/75'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 text-[11px] font-medium">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {renderEventIcon(ev.type)}
                      <span
                        className="truncate font-semibold"
                        style={{ color: getSeaBadgeColor(ev.sea) }}
                      >
                        {ev.sea}
                      </span>
                      <span aria-hidden="true" className="text-slate-600">·</span>
                      <span className="font-mono-num text-slate-400">
                        D{ev.day} {ev.timeLabel}
                      </span>
                    </div>
                    {ev.bountyDelta > 0 && (
                      <span className="font-mono-num text-[11px] font-bold text-amber-300 shrink-0">
                        +{formatShortBounty(ev.bountyDelta)}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-slate-200">
                    {ev.message}
                  </p>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {activeTab === 'tablones' && (
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex items-center gap-1.5 border-b border-slate-800/80 px-3 py-2">
            <button
              type="button"
              onClick={() => setBoardView('piratas')}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold cursor-pointer ${
                boardView === 'piratas'
                  ? 'bg-amber-400 text-slate-950'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              Carteles Se Busca
            </button>
            <button
              type="button"
              onClick={() => setBoardView('tripulaciones')}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold cursor-pointer ${
                boardView === 'tripulaciones'
                  ? 'bg-amber-400 text-slate-950'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              Tripulaciones
            </button>
          </div>

          <div className="flex-1 overflow-y-auto nautical-scroll p-3 space-y-2.5">
            {boardView === 'piratas'
              ? sortedByBounty.slice(0, 15).map((p, idx) => (
                  <WantedPosterCard
                    key={p.id}
                    pirate={p}
                    rank={idx + 1}
                    compact
                    onFocusPirate={onFocusPirate}
                  />
                ))
              : sortedCrews.map((c, idx) => (
                  <div
                    key={c.name}
                    className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono-num text-xs font-bold text-amber-400">
                          #{idx + 1}
                        </span>
                        <span className="truncate text-sm font-bold text-white">{c.name}</span>
                      </div>
                      <div className="mt-0.5 text-[11px] text-slate-400">
                        {c.members} {c.members === 1 ? 'integrante' : 'integrantes'}
                      </div>
                    </div>
                    <div className="font-mono-num text-xs font-bold text-amber-300 shrink-0">
                      {formatShortBounty(c.totalBounty)}
                    </div>
                  </div>
                ))}
          </div>
        </div>
      )}

      {activeTab === 'chat' && (
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="border-b border-slate-800/80 px-3 py-2 text-[11px] text-slate-400">
            Red Den Den Mushi · {isSignedIn ? 'Conectado a Firebase' : 'Modo local (inicia sesión para sincronizar)'}
          </div>
          <div className="flex-1 overflow-y-auto nautical-scroll p-3 space-y-2">
            {chatMessages.map((m) => (
              <div
                key={m.id}
                className={`rounded-lg border p-2.5 ${
                  m.isMine
                    ? 'border-amber-400/40 bg-amber-950/25'
                    : 'border-slate-800 bg-slate-900/60'
                }`}
              >
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold text-amber-300">{m.senderName}</span>
                  <span className="text-slate-400">{m.sea}</span>
                </div>
                <p className="mt-1 text-xs text-slate-200 break-words">{m.text}</p>
              </div>
            ))}
          </div>
          <form onSubmit={handleChatSubmit} className="border-t border-slate-800 p-2.5 flex gap-2">
            <label htmlFor="den-den-chat" className="sr-only">
              Mensaje de taberna
            </label>
            <input
              id="den-den-chat"
              type="text"
              maxLength={280}
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Envía un mensaje por Den Den Mushi..."
              className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-white focus:border-amber-400 focus:outline-none"
            />
            <button
              type="submit"
              className="rounded-lg bg-amber-400 px-3 py-1.5 text-xs font-bold text-slate-950 hover:bg-amber-300 cursor-pointer whitespace-nowrap"
            >
              Enviar
            </button>
          </form>
        </div>
      )}

      {activeTab === 'cofre' && (
        <div className="flex-1 overflow-y-auto nautical-scroll p-3 space-y-3">
          {myPirates.length === 0 ? (
            <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-5 text-center">
              <p className="text-sm font-semibold text-white">Tu cofre aún está vacío</p>
              <p className="mt-1 text-xs text-slate-400">
                Crea tu primer pirata y suéltalo a navegar por el Grand Line para acumular Berries y Frutas del Diablo.
              </p>
              <button
                type="button"
                onClick={onOpenCreatePirate}
                className="mt-4 rounded-lg bg-amber-400 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-amber-300 cursor-pointer"
              >
                + Nuevo personaje
              </button>
            </div>
          ) : (
            myPirates.map((p) => {
              const currIsl = islands.find((i) => i.id === p.islandId);
              const destIsl = p.sailingToIslandId
                ? islands.find((i) => i.id === p.sailingToIslandId)
                : null;
              return (
                <div
                  key={p.id}
                  className="rounded-lg border border-amber-500/40 bg-slate-900/80 p-3 space-y-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-display truncate text-base font-black text-amber-300">
                        {p.name}
                      </div>
                      <div className="text-xs text-slate-300">
                        «{p.epithet}» · {p.crewName}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onFocusPirate(p)}
                      className="rounded bg-slate-800 px-2.5 py-1 text-[11px] font-semibold text-amber-300 hover:bg-slate-700 cursor-pointer whitespace-nowrap"
                    >
                      Seguir
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded bg-[#0b1526] p-1.5">
                      <div className="text-[10px] text-slate-400">Recompensa</div>
                      <div className="font-mono-num text-xs font-bold text-amber-300">
                        {formatShortBounty(p.bounty)}
                      </div>
                    </div>
                    <div className="rounded bg-[#0b1526] p-1.5">
                      <div className="text-[10px] text-slate-400">Monedones</div>
                      <div className="font-mono-num text-xs font-bold text-emerald-300">
                        {p.berries}
                      </div>
                    </div>
                    <div className="rounded bg-[#0b1526] p-1.5">
                      <div className="text-[10px] text-slate-400">Duelos</div>
                      <div className="font-mono-num text-xs font-bold text-white">
                        {p.wins}V / {p.losses}D
                      </div>
                    </div>
                  </div>

                  <div className="text-xs text-slate-300">
                    {destIsl
                      ? `Navegando rumbo a ${destIsl.name}`
                      : `Atracado en ${currIsl?.name ?? 'alta mar'}`}
                    {p.devilFruit ? ` · Poder: ${p.devilFruit}` : ''}
                  </div>

                  <div className="text-[11px] text-slate-400">
                    <span className="text-amber-300 font-semibold">Físico:</span>{' '}
                    {p.physicalTraits.map(getTraitLabel).join(' · ')}
                    <span className="mx-1.5 text-slate-600">/</span>
                    <span className="text-sky-300 font-semibold">Destreza:</span>{' '}
                    {p.mentalTraits.map(getTraitLabel).join(' · ')}
                  </div>

                  <div>
                    <div className="text-[11px] font-semibold text-slate-400 mb-1">
                      Directiva de Rumbo
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {DIRECTIVES.map((dir) => (
                        <button
                          key={dir.id}
                          type="button"
                          onClick={() => onChangeDirective(p.id, dir.id)}
                          className={`rounded px-2 py-1 text-[11px] font-semibold cursor-pointer transition-colors ${
                            p.directive === dir.id
                              ? 'bg-amber-400 text-slate-950'
                              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                          }`}
                        >
                          {dir.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </aside>
  );
};
