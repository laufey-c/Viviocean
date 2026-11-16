import React from 'react';
import { formatBounty } from '../game/sim';
import { getTraitLabel } from '../game/worldData';
import type { Pirate } from '../game/types';
import { PirateAvatarSvg } from './PirateAvatarSvg';

interface WantedPosterCardProps {
  pirate: Pirate;
  rank?: number;
  compact?: boolean;
  onFocusPirate?: (pirate: Pirate) => void;
}

export const WantedPosterCard: React.FC<WantedPosterCardProps> = ({
  pirate,
  rank,
  compact = false,
  onFocusPirate,
}) => {
  const traitsSummary = [...pirate.physicalTraits, ...pirate.mentalTraits]
    .map(getTraitLabel)
    .join(' · ');

  return (
    <div className="wanted-parchment relative rounded border-2 border-[#7c562c] p-3 shadow-lg">
      <div className="border border-[#5c3d1e]/40 p-2">
        <div className="flex items-center justify-between border-b border-[#5c3d1e]/40 pb-1">
          <span className="font-display text-sm font-black tracking-[0.18em] text-[#2b1a0d]">
            SE BUSCA
          </span>
          {rank !== undefined && (
            <span className="font-mono-num text-xs font-bold text-[#7c2d12]">
              #{rank}
            </span>
          )}
        </div>

        <div
          className={`mt-2 flex ${
            compact ? 'flex-row items-center gap-3' : 'flex-col items-center text-center gap-2'
          }`}
        >
          <PirateAvatarSvg
            name={pirate.name}
            flagColor={pirate.flagColor}
            flagEmblem={pirate.flagEmblem}
            hatStyle={pirate.hatStyle}
            hatColor={pirate.hatColor}
            race={pirate.race}
            skinTone={pirate.skinTone}
            hairStyle={pirate.hairStyle}
            hairColor={pirate.hairColor}
            bodyBuild={pirate.bodyBuild}
            outfitStyle={pirate.outfitStyle}
            outfitColor={pirate.outfitColor}
            accessory={pirate.accessory}
            accessoryColor={pirate.accessoryColor}
            capeStyle={pirate.capeStyle}
            capeColor={pirate.capeColor}
            weaponStyle={pirate.weaponStyle}
            role={pirate.role}
            hasEquippedWeapon={Boolean(pirate.equipped?.arma)}
            variant="poster"
            size={compact ? 76 : 108}
          />
          <div className="min-w-0 flex-1">
            <div className="font-display truncate text-base font-black tracking-wide text-[#1f1207]">
              {pirate.name}
            </div>
            <div className="truncate text-xs font-semibold text-[#5c3d1e]">
              «{pirate.epithet}» · {pirate.role}
            </div>
            <div className="mt-1 font-mono-num text-sm font-bold text-[#881337]">
              {formatBounty(pirate.bounty)}
            </div>
            <div className="mt-0.5 truncate text-[11px] font-medium text-[#4a3219]">
              {pirate.crewName}
              {pirate.devilFruit ? ` · ${pirate.devilFruit}` : ''}
            </div>
            {traitsSummary && (
              <div className="mt-0.5 truncate text-[10px] font-semibold text-[#6b4423]">
                {traitsSummary}
              </div>
            )}
          </div>
        </div>

        {onFocusPirate && (
          <button
            type="button"
            onClick={() => onFocusPirate(pirate)}
            className="mt-2.5 w-full rounded bg-[#2b1a0d] px-3 py-1.5 text-xs font-semibold text-[#f3e5c8] hover:bg-[#432915] transition-colors cursor-pointer whitespace-nowrap"
          >
            Localizar en el Mar
          </button>
        )}
      </div>
    </div>
  );
};
