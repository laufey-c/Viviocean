import React, { useMemo } from 'react';
import {
  PIXEL_SPRITE_H,
  PIXEL_SPRITE_W,
  buildPirateSpriteRuns,
} from '../game/pixelSprite';
import type {
  AccessoryStyle,
  BodyBuild,
  CapeStyle,
  FlagEmblem,
  HairStyle,
  HatStyle,
  OutfitStyle,
  PirateRace,
  PirateRole,
  WeaponStyle,
} from '../game/types';

export interface PirateAvatarSvgProps {
  name: string;
  flagColor: string;
  flagEmblem?: FlagEmblem;
  hatStyle: HatStyle;
  hatColor?: string;
  race?: PirateRace;
  skinTone?: string;
  hairStyle?: HairStyle;
  hairColor?: string;
  bodyBuild?: BodyBuild;
  outfitStyle?: OutfitStyle;
  outfitColor?: string;
  accessory?: AccessoryStyle;
  accessoryColor?: string;
  capeStyle?: CapeStyle;
  capeColor?: string;
  weaponStyle?: WeaponStyle;
  role?: PirateRole;
  hasEquippedWeapon?: boolean;
  facing?: 'right' | 'left';
  variant?: 'stage' | 'poster';
  size?: number;
  className?: string;
}

/**
 * Chibi 16-bit Pixel Art Character Sprite on a crisp 22x24 grid:
 * - Oversized chibi head + compact stubby body
 * - Thick crisp 1px black pixel outline & 1x2 vertical black eyes
 * - Zero anti-aliasing, blur, or gradients
 */
export const PirateAvatarSvg: React.FC<PirateAvatarSvgProps> = ({
  name,
  flagColor,
  hatStyle,
  hatColor,
  race,
  skinTone,
  hairStyle,
  hairColor,
  bodyBuild,
  outfitStyle,
  outfitColor,
  accessory,
  accessoryColor,
  capeStyle,
  capeColor,
  weaponStyle,
  role,
  hasEquippedWeapon,
  facing = 'right',
  variant = 'stage',
  size = 112,
  className = '',
}) => {
  const runs = useMemo(
    () =>
      buildPirateSpriteRuns({
        name,
        flagColor,
        hatStyle,
        hatColor,
        race,
        skinTone,
        hairStyle,
        hairColor,
        bodyBuild,
        outfitStyle,
        outfitColor,
        accessory,
        accessoryColor,
        capeStyle,
        capeColor,
        weaponStyle,
        role,
        hasEquippedWeapon,
      }),
    [
      name,
      flagColor,
      hatStyle,
      hatColor,
      race,
      skinTone,
      hairStyle,
      hairColor,
      bodyBuild,
      outfitStyle,
      outfitColor,
      accessory,
      accessoryColor,
      capeStyle,
      capeColor,
      weaponStyle,
      role,
      hasEquippedWeapon,
    ]
  );

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${PIXEL_SPRITE_W} ${PIXEL_SPRITE_H}`}
      shapeRendering="crispEdges"
      style={{
        imageRendering: 'pixelated',
        transform: facing === 'left' ? 'scaleX(-1)' : undefined,
      }}
      className={`shrink-0 select-none ${
        variant === 'poster' ? 'bg-[#cbd5e1] border-2 border-[#3a2614]' : ''
      } ${className}`}
      aria-hidden="true"
    >
      {/* Crisp stepped pixel ground shadow beneath boots */}
      <rect x={7} y={22} width={8} height={1} fill="rgba(17, 12, 24, 0.25)" />
      {runs.map((r, idx) => (
        <rect key={idx} x={r.x} y={r.y} width={r.w} height={1} fill={r.fill} />
      ))}
    </svg>
  );
};
