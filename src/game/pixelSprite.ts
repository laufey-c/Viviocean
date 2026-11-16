import { getDefaultAppearance } from './worldData';
import type {
  AccessoryStyle,
  BodyBuild,
  CapeStyle,
  HairStyle,
  HatStyle,
  OutfitStyle,
  PirateRace,
  PirateRole,
  WeaponStyle,
} from './types';

export const PIXEL_SPRITE_W = 22;
export const PIXEL_SPRITE_H = 24;
const OUTLINE = '#110c18';

export interface PirateSpriteAppearance {
  name: string;
  flagColor: string;
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
}

export interface PixelRun {
  x: number;
  y: number;
  w: number;
  fill: string;
}

function parseHex(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return [120, 120, 140];
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
}

function toHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return `#${clamp(r).toString(16).padStart(2, '0')}${clamp(g).toString(16).padStart(2, '0')}${clamp(b).toString(16).padStart(2, '0')}`;
}

/**
 * Crisp 2-tone 16-bit palette shading (never pure black so outline stays readable).
 */
function shadeColor(hex: string, factor: number, coolShift = 10): string {
  const [r, g, b] = parseHex(hex);
  return toHex(
    Math.max(28, r * factor - coolShift * 0.35),
    Math.max(24, g * factor - coolShift * 0.2),
    Math.max(36, b * factor + coolShift * 0.4)
  );
}

function highlightColor(hex: string, boost = 30): string {
  const [r, g, b] = parseHex(hex);
  return toHex(r + boost * 1.05, g + boost, b + boost * 0.8);
}

function liftDarkBase(hex: string): string {
  const [r, g, b] = parseHex(hex);
  const lum = (r * 0.299 + g * 0.587 + b * 0.114) | 0;
  if (lum < 48) {
    return toHex(Math.max(42, r + 22), Math.max(38, g + 20), Math.max(54, b + 28));
  }
  return hex;
}

/**
 * Builds crisp merged horizontal pixel runs on a 22x24 chibi retro 16-bit sprite grid.
 */
export function buildPirateSpriteRuns(input: PirateSpriteAppearance): PixelRun[] {
  const {
    name,
    flagColor,
    hatStyle,
    hatColor,
    race = 'humano',
    skinTone,
    hairStyle,
    hairColor,
    bodyBuild,
    outfitStyle,
    outfitColor,
    accessory,
    accessoryColor,
    capeStyle = 'none',
    capeColor,
    weaponStyle,
    role,
    hasEquippedWeapon,
  } = input;

  const defaults = getDefaultAppearance(name || 'Pirata', flagColor);
  const skin = skinTone || defaults.skinTone;
  const skinShadow = shadeColor(skin, 0.78, 8);
  const rawHair = hairColor || defaults.hairColor;
  const hair = liftDarkBase(rawHair);
  const hairDark = shadeColor(hair, 0.72, 10);
  const hairLight = highlightColor(hair, 28);
  const resolvedHair = hairStyle || defaults.hairStyle;
  const build = bodyBuild || defaults.bodyBuild;
  const outfit = outfitStyle || defaults.outfitStyle;
  const mainCloth = liftDarkBase(outfitColor || defaults.outfitColor);
  const clothDark = shadeColor(mainCloth, 0.7, 12);
  const clothLight = highlightColor(mainCloth, 26);
  const resolvedAccessory = accessory ?? 'none';

  const resolvedCape = capeStyle ?? 'none';
  const defaultCapeHex =
    resolvedCape === 'justice_coat'
      ? '#f1f5f9'
      : resolvedCape === 'feather_boa'
        ? '#ec4899'
        : resolvedCape === 'raijin_drums'
          ? '#fde047'
          : resolvedCape === 'coat_cape'
            ? '#15803d'
            : mainCloth;
  const capeMain = liftDarkBase(capeColor || defaultCapeHex);
  const capeDark = shadeColor(capeMain, 0.72, 12);
  const capeLight = highlightColor(capeMain, 26);

  const customHat = hatColor ? liftDarkBase(hatColor) : undefined;
  const customAcc = accessoryColor ? liftDarkBase(accessoryColor) : undefined;

  const grid: Array<Array<string | null>> = Array.from({ length: PIXEL_SPRITE_H }, () =>
    Array<string | null>(PIXEL_SPRITE_W).fill(null)
  );
  const solidMask: boolean[][] = Array.from({ length: PIXEL_SPRITE_H }, () =>
    Array<boolean>(PIXEL_SPRITE_W).fill(false)
  );

  const px = (x: number, y: number, color: string, isSolid = true) => {
    const ix = Math.round(x);
    const iy = Math.round(y);
    if (ix < 0 || ix >= PIXEL_SPRITE_W || iy < 0 || iy >= PIXEL_SPRITE_H) return;
    grid[iy][ix] = color;
    if (isSolid) solidMask[iy][ix] = true;
  };

  const rect = (x: number, y: number, w: number, h: number, color: string, isSolid = true) => {
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        px(x + dx, y + dy, color, isSolid);
      }
    }
  };

  const isRobust = build === 'robust';
  const isSlim = build === 'slim';

  const torsoX = isRobust ? 7 : isSlim ? 9 : 8;
  const torsoW = isRobust ? 8 : isSlim ? 4 : 6;
  const torsoRight = torsoX + torsoW - 1;

  const pantsBase =
    outfit === 'marine'
      ? '#e2e8f0'
      : outfit === 'coat'
        ? '#2563eb'
        : outfit === 'suit' || outfit === 'striped'
          ? '#1e293b'
          : outfit === 'kimono'
            ? clothDark
            : outfit === 'vest'
              ? '#334155'
              : '#28456e';
  const pantsDark = shadeColor(pantsBase, 0.72, 10);

  const sashColor =
    outfit === 'coat'
      ? '#facc15'
      : outfit === 'kimono'
        ? '#be123c'
        : outfit === 'vest'
          ? '#dc2626'
          : outfit === 'suit' || outfit === 'striped'
            ? '#d97706'
            : outfit === 'marine'
              ? '#eab308'
              : '#d97706';

  const sleeveBase =
    outfit === 'vest'
      ? skin
      : outfit === 'marine'
        ? '#f1f5f9'
        : mainCloth;
  const sleeveDark =
    outfit === 'vest'
      ? skinShadow
      : outfit === 'marine'
        ? '#94a3b8'
        : clothDark;

  const bootBase = outfit === 'coat' ? '#7c3f1d' : '#3b2820';

  // 0. Back Race Anatomy (drawn behind back/body so wings, tail, dorsal fin hug behind shoulders)
  if (race === 'skypiea') {
    rect(4, 12, 2, 4, '#f8fafc');
    px(3, 13, '#e2e8f0');
    px(3, 14, '#cbd5e1');
    rect(15, 12, 2, 3, '#cbd5e1');
  } else if (race === 'lunaria') {
    rect(3, 11, 3, 5, '#334155');
    px(2, 12, '#475569');
    px(3, 16, '#1e293b');
    rect(15, 11, 2, 4, '#1e293b');
    // Lunaria back flame
    px(6, 10, '#fb923c');
    px(6, 9, '#fde047');
    px(5, 10, '#ea580c');
  } else if (race === 'gyojin') {
    // Dorsal fin behind back/neck
    px(5, 10, shadeColor(skin, 0.76, 12));
    rect(4, 11, 2, 3, shadeColor(skin, 0.68, 12));
    px(3, 12, highlightColor(skin, 18));
  } else if (race === 'mink') {
    // Fluffy tail behind lower back
    rect(4, 16, 2, 2, hairDark);
    px(3, 15, hair);
    px(4, 15, hairLight);
  }

  // 0b. Back Cape / Draped Shoulder Coat / Raijin Drums (behind torso & arms)
  if (resolvedCape === 'cape') {
    rect(5, 13, 12, 6, capeDark);
    rect(6, 13, 10, 6, capeMain);
    rect(5, 19, 3, 1, capeDark);
    rect(13, 19, 3, 1, capeDark);
  } else if (resolvedCape === 'coat_cape' || resolvedCape === 'justice_coat') {
    // Iconic One Piece Captain / Admiral overcoat billowing behind shoulders
    rect(4, 13, 14, 6, capeDark);
    rect(5, 13, 12, 6, capeMain);
    rect(4, 15, 1, 4, capeMain);
    rect(17, 15, 1, 3, capeDark);
    rect(4, 19, 4, 1, capeDark);
    rect(14, 19, 3, 1, capeDark);
  } else if (resolvedCape === 'feather_boa') {
    // Fluffy flamingo plume mantle flaring behind shoulders
    rect(4, 12, 14, 5, capeMain);
    px(3, 13, capeLight);
    px(3, 15, capeDark);
    px(18, 13, capeLight);
    px(18, 15, capeDark);
    rect(5, 17, 12, 2, capeDark);
    px(6, 12, capeLight);
    px(15, 12, capeLight);
  } else if (resolvedCape === 'raijin_drums') {
    // Enel's floating circle of 4 Raijin drums behind shoulders & crown
    rect(3, 8, 2, 2, capeMain);
    px(3, 8, capeLight);
    rect(17, 8, 2, 2, capeMain);
    px(18, 8, capeLight);
    rect(2, 12, 2, 2, capeMain);
    px(2, 12, capeLight);
    rect(18, 12, 2, 2, capeMain);
    px(19, 12, capeLight);
    px(5, 9, capeDark);
    px(16, 9, capeDark);
  } else if (resolvedCape === 'sash_cloak') {
    rect(5, 13, 6, 6, capeMain);
    rect(4, 15, 3, 4, capeDark);
    px(4, 19, capeDark);
  }

  // 1. Back-flowing Hair (anchored behind back & shoulders)
  if (hatStyle !== 'afro') {
    if (resolvedHair === 'long') {
      // Drapes cleanly across the full upper/mid back behind torso & arms
      rect(6, 8, 8, 10, hairDark);
      rect(7, 9, 6, 9, hair);
      rect(8, 17, 4, 2, hairDark);
    } else if (resolvedHair === 'mane') {
      // Wide beastly mane flowing behind shoulders & back
      rect(5, 7, 11, 10, hairDark);
      rect(6, 8, 9, 9, hair);
      px(5, 15, hairDark);
      px(15, 14, hairDark);
    } else if (resolvedHair === 'ponytail') {
      // Anchored behind back of head so only the curved tip peeks out on one side
      px(6, 8, hairDark);
      rect(5, 8, 1, 3, hair);
      px(4, 9, hairDark);
      px(4, 10, hair);
      px(4, 11, hairDark);
    } else if (resolvedHair === 'twintails') {
      // Balanced tails anchored closely behind both temples/cheeks
      rect(5, 9, 1, 4, hair);
      px(4, 10, hairDark);
      px(4, 11, hair);
      rect(15, 9, 1, 3, hairDark);
    } else if (resolvedHair === 'curly') {
      rect(5, 7, 2, 5, hairDark);
      px(5, 8, hair);
    }
  }

  // Optional back-role prop
  if (role === 'Navegante') {
    rect(4, 10, 1, 8, '#38bdf8');
    px(4, 9, '#fde047');
  } else if (role === 'Músico') {
    rect(4, 12, 2, 2, '#14b8a6');
    px(5, 11, '#5eead4');
  }

  // 2. Compact Legs & Boots
  if (isRobust) {
    rect(7, 18, 3, 2, pantsDark);
    rect(7, 20, 3, 1, bootBase);
    rect(12, 18, 3, 2, pantsBase);
    rect(12, 20, 3, 1, bootBase);
  } else if (isSlim) {
    rect(9, 18, 2, 2, pantsDark);
    rect(9, 20, 2, 1, bootBase);
    rect(12, 18, 2, 2, pantsBase);
    rect(12, 20, 2, 1, bootBase);
  } else {
    rect(8, 18, 2, 2, pantsDark);
    rect(8, 20, 2, 1, bootBase);
    rect(12, 18, 2, 2, pantsBase);
    rect(12, 20, 2, 1, bootBase);
  }

  if (outfit === 'coat' && !isRobust) {
    const lx = isSlim ? 9 : 8;
    const rx = 12;
    rect(lx, 18, 2, 1, pantsDark);
    rect(rx, 18, 2, 1, pantsBase);
    rect(lx, 19, 2, 1, skinShadow);
    rect(rx, 19, 2, 1, skin);
    rect(lx, 20, 2, 1, bootBase);
    rect(rx, 20, 2, 1, bootBase);
  }

  if (outfit === 'kimono') {
    rect(torsoX, 18, torsoW, 1, clothDark);
    rect(torsoX + 1, 18, Math.max(2, torsoW - 2), 1, mainCloth);
  }

  // 3. Compact Torso
  if (outfit === 'shirt') {
    rect(torsoX, 14, torsoW, 3, mainCloth);
    rect(torsoX, 14, 1, 3, clothDark);
    rect(torsoRight - 1, 14, 2, 1, skin);
    rect(torsoX, 17, torsoW, 1, sashColor);
  } else if (outfit === 'striped') {
    // Bold vertical alternating stripes (e.g. Crocodile orange + black lines, Buggy red/white, Kizaru yellow/amber)
    for (let dx = 0; dx < torsoW; dx++) {
      const stripeCol = dx % 2 === 0 ? mainCloth : '#231f2e';
      rect(torsoX + dx, 14, 1, 3, stripeCol);
    }
    px(torsoX + Math.floor(torsoW / 2), 14, clothLight);
    rect(torsoX, 17, torsoW, 1, sashColor);
  } else if (outfit === 'suit') {
    rect(torsoX, 14, torsoW, 3, mainCloth);
    rect(torsoX, 14, 1, 3, clothDark);
    const vCenter = torsoX + Math.floor(torsoW / 2);
    rect(vCenter, 14, 2, 2, '#f1f5f9');
    px(vCenter, 15, '#dc2626');
    rect(torsoX, 17, torsoW, 1, clothDark);
    px(vCenter, 17, '#facc15');
  } else if (outfit === 'coat') {
    rect(torsoX, 14, torsoW, 3, mainCloth);
    rect(torsoX, 14, 1, 3, clothDark);
    rect(torsoX + 1, 14, 1, 2, clothLight);
    const chestW = isRobust ? 3 : 2;
    const chestX = torsoX + Math.floor((torsoW - chestW) / 2) + 1;
    rect(chestX, 14, Math.min(chestW, torsoRight - chestX), 3, skin);
    rect(torsoX, 17, torsoW, 1, sashColor);
    px(torsoX, 17, shadeColor(sashColor, 0.72, 6));
  } else if (outfit === 'vest') {
    rect(torsoX, 14, torsoW, 3, mainCloth);
    rect(torsoX, 14, 1, 3, clothDark);
    px(torsoRight - 1, 14, skin);
    rect(torsoX, 17, torsoW, 1, sashColor);
  } else if (outfit === 'kimono') {
    rect(torsoX, 14, torsoW, 3, mainCloth);
    rect(torsoX, 14, 1, 3, clothDark);
    px(torsoRight - 1, 14, clothLight);
    rect(torsoX, 16, torsoW, 2, sashColor);
    px(torsoX, 16, shadeColor(sashColor, 0.72, 6));
  } else if (outfit === 'marine') {
    rect(torsoX, 14, torsoW, 3, '#f1f5f9');
    rect(torsoX, 14, 1, 3, '#cbd5e1');
    px(torsoX, 14, mainCloth);
    px(torsoRight, 14, mainCloth);
    px(torsoRight - 1, 14, mainCloth);
    px(torsoRight - 1, 15, mainCloth);
    rect(torsoX, 17, torsoW, 1, '#e2e8f0');
    px(torsoX + 1, 16, '#eab308');
  }

  // Giant warrior shoulder armor trim
  if (race === 'gigante') {
    px(torsoX - 1, 13, '#64748b');
    px(torsoRight + 1, 13, '#475569');
  }

  // 4. Outstretched Chibi Arms
  if (isRobust) {
    rect(5, 13, 2, 2, mainCloth);
    rect(5, 15, 2, 2, sleeveBase);
    rect(5, 17, 2, 1, skin);

    rect(torsoRight + 1, 14, 2, 2, sleeveDark);
    rect(torsoRight + 1, 16, 2, 1, skinShadow);
  } else {
    px(torsoX - 1, 14, sleeveBase);
    px(torsoX - 2, 15, sleeveBase);
    px(torsoX - 1, 15, sleeveDark);
    px(torsoX - 2, 16, skin);
    px(torsoRight + 1, 14, sleeveDark);
    px(torsoRight + 2, 15, sleeveDark);
    px(torsoRight + 2, 16, skinShadow);
  }

  // 4b. Front Shoulder Cape Drape & Lapels (sits cleanly over shoulders without hiding center torso)
  if (resolvedCape === 'cape') {
    px(torsoX - 1, 13, capeLight);
    px(torsoX, 14, capeMain);
    px(torsoRight + 1, 13, capeMain);
  } else if (resolvedCape === 'coat_cape') {
    rect(torsoX - 1, 13, 2, 2, capeLight);
    px(torsoRight, 13, capeMain);
    px(torsoRight + 1, 14, capeDark);
  } else if (resolvedCape === 'justice_coat') {
    px(torsoX - 1, 13, '#facc15');
    px(torsoX, 14, capeLight);
    px(torsoRight + 1, 13, '#eab308');
    px(torsoRight, 14, capeMain);
  } else if (resolvedCape === 'feather_boa') {
    rect(torsoX - 1, 13, 2, 1, capeLight);
    rect(torsoRight, 13, 2, 1, capeLight);
  } else if (resolvedCape === 'sash_cloak') {
    rect(torsoX - 1, 13, 3, 1, capeLight);
    px(torsoX + 1, 14, capeMain);
  }

  // Foreground Role Prop or Canon / Equipped Weapon Accent
  const activeWeapon: WeaponStyle =
    weaponStyle && weaponStyle !== 'none'
      ? weaponStyle
      : role === 'Espadachín' || hasEquippedWeapon
        ? 'sword'
        : 'none';

  if (activeWeapon === 'hook') {
    // Golden Hook replacing front/left hand (Crocodile)
    px(torsoX - 2, 16, '#eab308');
    px(torsoX - 3, 16, '#facc15');
    px(torsoX - 3, 15, '#fef08a');
    px(torsoX - 2, 14, '#facc15');
  } else if (activeWeapon === 'trident') {
    rect(torsoRight + 2, 10, 1, 8, '#475569');
    px(torsoRight + 1, 10, '#cbd5e1');
    px(torsoRight + 3, 10, '#cbd5e1');
    px(torsoRight + 2, 9, '#f8fafc');
  } else if (activeWeapon === 'kanabo') {
    rect(torsoRight + 2, 11, 2, 6, '#334155');
    px(torsoRight + 2, 12, '#94a3b8');
    px(torsoRight + 3, 14, '#94a3b8');
    px(torsoRight + 2, 17, '#7c3f1d');
  } else if (activeWeapon === 'axe') {
    rect(torsoRight + 2, 12, 1, 6, '#7c3f1d');
    rect(torsoRight + 3, 12, 2, 3, '#cbd5e1');
    px(torsoRight + 4, 13, '#f8fafc');
  } else if (activeWeapon === 'mace') {
    rect(torsoRight + 2, 12, 1, 5, '#475569');
    rect(torsoRight + 2, 11, 2, 2, '#94a3b8');
    px(torsoRight + 3, 11, '#f8fafc');
  } else if (activeWeapon === 'jitte') {
    rect(torsoRight + 2, 11, 1, 6, '#cbd5e1');
    px(torsoRight + 3, 14, '#eab308');
    px(torsoRight + 2, 10, '#f8fafc');
  } else if (activeWeapon === 'sword') {
    px(torsoX - 3, 16, '#334155');
    px(torsoX - 2, 17, '#facc15');
    px(torsoRight + 2, 17, '#334155');
    px(torsoRight + 3, 18, '#94a3b8');
  } else if (role === 'Artillero') {
    px(torsoX - 1, 16, '#b45309');
  } else if (role === 'Médico') {
    px(torsoX - 1, 16, '#f8fafc');
    px(torsoX - 1, 17, '#ef4444');
  }

  rect(7, 13, 8, 1, OUTLINE);

  // 5. OVERSIZED CHIBI HEAD & FACE
  rect(7, 7, 8, 6, skin);
  px(6, 10, skin);
  px(6, 11, skinShadow);
  rect(14, 8, 1, 5, skinShadow);
  px(13, 12, skinShadow);
  px(7, 12, skinShadow);

  // Gyojin cheek gill lines
  if (race === 'gyojin') {
    const gillColor = shadeColor(skin, 0.56, 14);
    px(7, 10, gillColor);
    px(7, 11, gillColor);
  }

  // 1x2 Vertical Black Eyes
  rect(10, 10, 1, 2, OUTLINE);
  rect(13, 10, 1, 2, OUTLINE);

  // 6. HAIR LAYER
  if (hatStyle === 'afro') {
    const afroMain = customHat || '#2b2d42';
    const afroLight = highlightColor(afroMain, 24);
    const afroDark = shadeColor(afroMain, 0.72, 10);
    rect(6, 2, 10, 5, afroMain);
    rect(5, 3, 12, 4, afroMain);
    rect(7, 2, 6, 2, afroLight);
    rect(6, 6, 2, 3, afroDark);
  } else {
    if (resolvedHair === 'spiky') {
      rect(6, 5, 9, 3, hair);
      rect(7, 4, 2, 1, hairLight);
      rect(11, 4, 2, 1, hairLight);
      rect(6, 7, 2, 3, hairDark);
      px(8, 8, hair);
      px(9, 9, hair);
      px(11, 8, hair);
      px(12, 8, hairDark);
      px(14, 8, hairDark);
    } else if (resolvedHair === 'short') {
      rect(6, 5, 9, 3, hair);
      rect(8, 4, 5, 1, hairLight);
      rect(6, 7, 2, 3, hairDark);
      rect(9, 8, 3, 1, hair);
      px(10, 9, hair);
      px(11, 9, hairDark);
    } else if (resolvedHair === 'ponytail') {
      rect(6, 5, 9, 3, hair);
      rect(8, 4, 6, 1, hairLight);
      rect(6, 7, 2, 2, hairDark);
      px(9, 8, hair);
      px(12, 8, hair);
    } else if (resolvedHair === 'long') {
      rect(6, 5, 9, 3, hair);
      rect(8, 4, 5, 1, hairLight);
      rect(6, 7, 1, 5, hairDark);
      rect(7, 7, 1, 4, hair);
      rect(14, 7, 1, 4, hairDark);
      px(9, 8, hairLight);
    } else if (resolvedHair === 'curly') {
      rect(5, 5, 10, 3, hair);
      rect(7, 4, 6, 1, hairLight);
      rect(6, 7, 2, 3, hairDark);
      px(8, 8, hairLight);
      px(11, 8, hair);
      px(13, 8, hairLight);
    } else if (resolvedHair === 'bob') {
      rect(6, 5, 9, 3, hair);
      rect(8, 4, 5, 1, hairLight);
      rect(6, 7, 2, 5, hairDark);
      rect(8, 8, 5, 1, hair);
      rect(14, 7, 1, 3, hair);
    } else if (resolvedHair === 'slick') {
      rect(6, 5, 9, 3, hair);
      rect(7, 4, 6, 1, hairLight);
      rect(6, 7, 1, 3, hairDark);
      px(10, 8, hairDark);
      px(12, 7, hairLight);
      px(14, 7, hairDark);
    } else if (resolvedHair === 'mohawk') {
      rect(9, 2, 3, 3, hairLight);
      rect(8, 4, 5, 2, hair);
      rect(7, 6, 7, 1, hairDark);
      px(6, 7, hairDark);
      px(14, 7, hairDark);
    } else if (resolvedHair === 'twintails') {
      rect(6, 5, 9, 3, hair);
      rect(8, 4, 5, 1, hairLight);
      px(6, 7, hairDark);
      px(9, 8, hairLight);
      px(13, 8, hair);
      px(14, 7, hairDark);
    } else if (resolvedHair === 'topknot') {
      rect(9, 2, 3, 2, hairDark);
      rect(10, 1, 2, 1, hairLight);
      rect(8, 4, 5, 1, hair);
      rect(6, 5, 9, 3, hair);
      rect(6, 7, 1, 3, hairDark);
      px(14, 7, hairDark);
    } else if (resolvedHair === 'mane') {
      rect(5, 5, 10, 3, hair);
      rect(7, 4, 6, 1, hairLight);
      rect(6, 7, 2, 4, hairDark);
      px(9, 8, hair);
      px(12, 8, hairLight);
      rect(14, 7, 1, 3, hairDark);
    }
  }

  // 7. FACIAL ACCESSORIES (all support custom accessoryColor)
  if (resolvedAccessory === 'scar') {
    const sc = customAcc || '#b91c1c';
    const scHi = highlightColor(sc, 20);
    px(9, 10, scHi);
    px(10, 12, sc);
    px(11, 11, scHi);
    px(12, 11, sc);
  } else if (resolvedAccessory === 'cross_scar') {
    const sc = customAcc || '#b91c1c';
    const scDark = shadeColor(sc, 0.72, 6);
    rect(9, 11, 5, 1, sc);
    px(11, 10, scDark);
    px(12, 12, scDark);
  } else if (resolvedAccessory === 'glasses') {
    const lens = customAcc || '#38bdf8';
    rect(9, 10, 5, 1, OUTLINE);
    px(10, 10, lens);
    px(13, 10, lens);
  } else if (resolvedAccessory === 'sunglasses') {
    const lens = customAcc || '#fb7185';
    const lensDark = shadeColor(lens, 0.7, 8);
    rect(9, 10, 6, 2, OUTLINE);
    px(10, 10, lens);
    px(11, 10, lensDark);
    px(13, 10, lens);
  } else if (resolvedAccessory === 'eyepatch') {
    const patch = customAcc || '#24293d';
    rect(7, 9, 8, 1, OUTLINE);
    rect(12, 10, 2, 2, patch);
  } else if (resolvedAccessory === 'beard') {
    const bd = customAcc || hairDark;
    const bdDark = shadeColor(bd, 0.75, 8);
    rect(9, 12, 6, 1, bd);
    rect(10, 13, 4, 1, bdDark);
  } else if (resolvedAccessory === 'mustache') {
    const mu = customAcc || hair;
    const muLight = highlightColor(mu, 20);
    px(9, 11, muLight);
    rect(10, 12, 4, 1, mu);
    px(14, 11, muLight);
  } else if (resolvedAccessory === 'goatee') {
    const gt = customAcc || hairDark;
    rect(11, 12, 2, 1, gt);
    px(12, 13, shadeColor(gt, 0.76, 8));
  } else if (resolvedAccessory === 'cigar') {
    const cig = customAcc || '#92400e';
    rect(12, 12, 3, 1, cig);
    px(15, 12, '#f97316');
    px(16, 11, '#cbd5e1');
  } else if (resolvedAccessory === 'clown_nose') {
    const cn = customAcc || '#ef4444';
    rect(11, 10, 2, 2, cn);
    px(11, 10, highlightColor(cn, 42));
  } else if (resolvedAccessory === 'scarf') {
    const sf = customAcc || '#334155';
    const sfDark = shadeColor(sf, 0.72, 10);
    rect(8, 12, 7, 2, sf);
    rect(7, 13, 8, 1, sfDark);
  } else if (resolvedAccessory === 'mask') {
    const mk = customAcc || '#475569';
    rect(8, 9, 7, 3, mk);
    px(10, 10, OUTLINE);
    px(13, 10, OUTLINE);
  } else if (resolvedAccessory === 'bandage') {
    const bg = customAcc || '#f1f5f9';
    const bgDark = shadeColor(bg, 0.8, 6);
    rect(7, 9, 8, 3, bg);
    rect(7, 10, 8, 1, bgDark);
  } else if (resolvedAccessory === 'earrings') {
    const er = customAcc || '#facc15';
    const erDark = shadeColor(er, 0.75, 4);
    px(6, 11, er);
    px(6, 12, erDark);
    px(14, 12, er);
  }

  // 8. HATS (all support custom hatColor)
  if (hatStyle === 'straw') {
    const stMain = customHat || '#facc15';
    const stLight = highlightColor(stMain, 24);
    const stDark = shadeColor(stMain, 0.74, 6);
    const stMid = shadeColor(stMain, 0.88, 4);
    rect(8, 2, 5, 1, stLight);
    rect(7, 3, 7, 2, stMain);
    px(13, 3, stDark);
    px(13, 4, stDark);
    rect(7, 5, 7, 1, '#dc2626');
    rect(5, 6, 12, 1, stMid);
    px(5, 6, stDark);
    px(16, 6, stDark);
    rect(5, 7, 12, 1, OUTLINE);
  } else if (hatStyle === 'tricorn') {
    const trMain = customHat || '#293042';
    const trLight = highlightColor(trMain, 26);
    const trDark = shadeColor(trMain, 0.72, 10);
    rect(8, 1, 6, 3, trMain);
    rect(9, 1, 4, 1, trLight);
    rect(8, 4, 6, 1, '#38bdf8');
    px(10, 4, '#fde047');
    rect(5, 5, 12, 1, trDark);
    rect(5, 6, 12, 1, OUTLINE);
  } else if (hatStyle === 'bicorn') {
    const biMain = customHat || '#293042';
    const biLight = highlightColor(biMain, 24);
    const biDark = shadeColor(biMain, 0.74, 10);
    rect(7, 1, 8, 3, biMain);
    rect(9, 1, 4, 1, biLight);
    rect(9, 2, 4, 1, '#facc15');
    rect(4, 4, 14, 2, biDark);
    px(4, 4, biMain);
    px(17, 4, biMain);
    rect(4, 6, 14, 1, OUTLINE);
  } else if (hatStyle === 'tophat') {
    const thMain = customHat || '#1e293b';
    const thLight = highlightColor(thMain, 24);
    const thDark = shadeColor(thMain, 0.7, 10);
    rect(7, 1, 7, 3, thMain);
    rect(8, 1, 4, 1, thLight);
    rect(7, 4, 7, 1, '#dc2626');
    rect(5, 5, 11, 1, thDark);
    rect(5, 6, 11, 1, OUTLINE);
  } else if (hatStyle === 'bandana') {
    const bdMain = customHat || mainCloth;
    const bdLight = highlightColor(bdMain, 26);
    const bdDark = shadeColor(bdMain, 0.72, 10);
    rect(7, 4, 7, 1, bdLight);
    rect(6, 5, 9, 2, bdMain);
    rect(4, 5, 2, 1, bdDark);
    rect(4, 7, 2, 1, bdMain);
    rect(6, 7, 9, 1, OUTLINE);
  } else if (hatStyle === 'marine') {
    const mrMain = customHat || '#f1f5f9';
    const mrLight = highlightColor(mrMain, 18);
    rect(8, 2, 6, 1, mrLight);
    rect(7, 3, 8, 2, mrMain);
    rect(7, 5, 8, 1, '#2563eb');
    rect(11, 6, 6, 1, '#1e40af');
    rect(7, 6, 4, 1, OUTLINE);
    rect(11, 7, 6, 1, OUTLINE);
  } else if (hatStyle === 'crown') {
    const crMain = customHat || '#eab308';
    const crLight = highlightColor(crMain, 28);
    px(7, 2, crLight);
    rect(10, 1, 2, 3, crLight);
    px(13, 2, crLight);
    rect(7, 4, 7, 2, crMain);
    px(10, 4, '#dc2626');
    rect(7, 6, 7, 1, OUTLINE);
  } else if (hatStyle === 'viking') {
    const vkMain = customHat || '#64748b';
    const vkLight = highlightColor(vkMain, 24);
    const vkDark = shadeColor(vkMain, 0.72, 8);
    rect(7, 4, 8, 2, vkMain);
    rect(8, 4, 5, 1, vkLight);
    rect(6, 6, 10, 1, vkDark);
    px(5, 4, '#fef3c7');
    px(5, 3, '#f8fafc');
    px(6, 2, '#f8fafc');
    px(16, 4, '#fef3c7');
    px(16, 3, '#f8fafc');
    px(15, 2, '#f8fafc');
  } else if (hatStyle === 'hood') {
    const hdMain = customHat || mainCloth;
    const hdDark = shadeColor(hdMain, 0.72, 10);
    rect(6, 4, 10, 3, hdMain);
    rect(5, 5, 2, 4, hdDark);
    px(15, 5, hdDark);
  }

  // 8b. Top Head Race Details (drawn cleanly on crown/temples)
  if (race === 'oni') {
    // Curved Oni horns rising visibly from temples
    px(7, 5, '#e2e8f0');
    px(6, 4, '#fef3c7');
    px(6, 3, '#cbd5e1');
    px(14, 5, '#e2e8f0');
    px(15, 4, '#fef3c7');
    px(15, 3, '#cbd5e1');
  } else if (race === 'gigante' && hatStyle === 'none') {
    // Elbaph Viking iron helm + sweeping curved ivory horns
    rect(8, 4, 6, 1, '#94a3b8');
    rect(7, 5, 8, 1, '#64748b');
    px(6, 5, '#475569');
    px(15, 5, '#475569');
    px(5, 4, '#e2e8f0');
    px(5, 3, '#fef3c7');
    px(6, 2, '#f8fafc');
    px(16, 4, '#e2e8f0');
    px(16, 3, '#fef3c7');
    px(15, 2, '#f8fafc');
  } else if (race === 'gigante') {
    // Broad horned crest peeking above headgear
    px(5, 4, '#fef3c7');
    px(5, 3, '#f8fafc');
    px(16, 4, '#fef3c7');
    px(16, 3, '#f8fafc');
  } else if (race === 'mink' && hatStyle === 'none') {
    px(7, 4, hairDark);
    px(7, 3, hairLight);
    px(13, 4, hairDark);
    px(13, 3, hairLight);
  } else if (race === 'skypiea' && hatStyle === 'none') {
    px(8, 3, '#f8fafc');
    px(13, 3, '#f8fafc');
  }

  // 9. AUTO-GENERATE CRISP 1PX BLACK PIXEL OUTLINE
  const finalGrid: Array<Array<string | null>> = grid.map((row) => [...row]);
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  for (let y = 0; y < PIXEL_SPRITE_H; y++) {
    for (let x = 0; x < PIXEL_SPRITE_W; x++) {
      if (grid[y][x] !== null) continue;
      for (const [dx, dy] of dirs) {
        const nx = x + dx;
        const ny = y + dy;
        if (
          nx >= 0 &&
          nx < PIXEL_SPRITE_W &&
          ny >= 0 &&
          ny < PIXEL_SPRITE_H &&
          solidMask[ny][nx]
        ) {
          finalGrid[y][x] = OUTLINE;
          break;
        }
      }
    }
  }

  // 10. Merge horizontal runs
  const runs: PixelRun[] = [];
  for (let y = 0; y < PIXEL_SPRITE_H; y++) {
    let x = 0;
    while (x < PIXEL_SPRITE_W) {
      const col = finalGrid[y][x];
      if (!col) {
        x++;
        continue;
      }
      let w = 1;
      while (x + w < PIXEL_SPRITE_W && finalGrid[y][x + w] === col) {
        w++;
      }
      runs.push({ x, y, w, fill: col });
      x += w;
    }
  }

  return runs;
}

/**
 * Renders a PirateSpriteAppearance onto a crisp transparent HTMLCanvasElement
 * for Three.js 3D globe zoom-in billboards.
 */
export function renderPirateSpriteCanvas(
  input: PirateSpriteAppearance,
  pixelScale = 2,
  facing: 'right' | 'left' = 'right'
): HTMLCanvasElement {
  const runs = buildPirateSpriteRuns(input);
  const canvas = document.createElement('canvas');
  canvas.width = PIXEL_SPRITE_W * pixelScale;
  canvas.height = PIXEL_SPRITE_H * pixelScale;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  ctx.fillStyle = 'rgba(17, 12, 24, 0.35)';
  ctx.fillRect(7 * pixelScale, 22 * pixelScale, 8 * pixelScale, 1 * pixelScale);

  for (const r of runs) {
    ctx.fillStyle = r.fill;
    const drawX = facing === 'left' ? PIXEL_SPRITE_W - r.x - r.w : r.x;
    ctx.fillRect(drawX * pixelScale, r.y * pixelScale, r.w * pixelScale, pixelScale);
  }
  return canvas;
}
