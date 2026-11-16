import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  createSeededRng,
  getCharacterSpriteScale,
  getNavigationPathCoords,
  getPirateHeadingXYZ,
  getPiratePositionXYZ,
  latLonToXYZ,
  sampleNavigationPathXYZ,
} from '../game/sim';
import {
  renderPirateSpriteCanvas,
  type PirateSpriteAppearance,
} from '../game/pixelSprite';
import {
  getBossForIsland,
  getMiniBossesForIsland,
  getNpcsForIsland,
  getRegionalWeather,
  getShortStageName,
} from '../game/worldData';
import type { Island, Pirate, WorldEvent } from '../game/types';

export interface CameraTargetRequest {
  lat: number;
  lon: number;
  distance?: number;
  nonce: number;
}

interface GlobeCanvasProps {
  islands: Island[];
  pirates: Pirate[];
  events: WorldEvent[];
  selectedIslandId: string | null;
  selectedPirateId: string | null;
  cameraTarget: CameraTargetRequest | null;
  isTitleScreen: boolean;
  drawerOpen: boolean;
  leftMenuOpen?: boolean;
  characterFocus?: boolean;
  characterSideOpen?: boolean;
  day?: number;
  minuteOfDay?: number;
  onSelectIsland: (islandId: string) => void;
  onSelectPirate: (pirateId: string) => void;
}

const GLOBE_RADIUS = 5.0;

function detectSoftwareWebGL(): boolean {
  try {
    const probeCanvas = document.createElement('canvas');
    const gl = probeCanvas.getContext('webgl2') || probeCanvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

function hashString(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Generates the Vivid Ocean equirectangular pixel-art globe texture.
 * U coordinate alignment matching sim.ts latLonToXYZ:
 *   lon = 0° (Reverse Mountain / Red Line 1) -> u = 0.25
 *   lon = +90° (Paraíso / Mar del Este / Mar del Sur) -> u = 0.50
 *   lon = ±180° (Mariejois / Red Line 2) -> u = 0.75
 *   lon = -90° (Nuevo Mundo / Mar del Norte / Mar del Oeste) -> u = 0.00 / 1.00
 */
function createVividOceanGlobeTexture(): THREE.CanvasTexture {
  const width = 2048;
  const height = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  // Deep crisp ocean background for the Four Seas
  const oceanGrad = ctx.createLinearGradient(0, 0, 0, height);
  oceanGrad.addColorStop(0, '#0f3c75');
  oceanGrad.addColorStop(0.28, '#14539c');
  oceanGrad.addColorStop(0.5, '#196ec2');
  oceanGrad.addColorStop(0.72, '#14539c');
  oceanGrad.addColorStop(1, '#0f3c75');
  ctx.fillStyle = oceanGrad;
  ctx.fillRect(0, 0, width, height);

  // Equator Grand Line & Calm Belt latitude bands
  const latToY = (lat: number) => Math.round(((90 - lat) / 180) * height);
  const calmTopOuter = latToY(21);
  const calmTopInner = latToY(13.5);
  const calmBotInner = latToY(-13.5);
  const calmBotOuter = latToY(-21);

  // Vivid Grand Line inner ocean (brighter cyan-blue strip)
  ctx.fillStyle = '#1878cc';
  ctx.fillRect(0, calmTopInner, width, calmBotInner - calmTopInner);

  // Calm Belts (Franja de Calma: misty turquoise-slate)
  ctx.fillStyle = '#387688';
  ctx.fillRect(0, calmTopOuter, width, calmTopInner - calmTopOuter);
  ctx.fillRect(0, calmBotInner, width, calmBotOuter - calmBotInner);

  // Stepped pixel border foam between Calm Belt & Grand Line / Blues
  ctx.fillStyle = '#4e96a6';
  for (let x = 0; x < width; x += 12) {
    const jitter = (((x * 7) % 3) - 1) * 2;
    ctx.fillRect(x, calmTopOuter + jitter, 12, 4);
    ctx.fillRect(x, calmTopInner + jitter, 12, 4);
    ctx.fillRect(x, calmBotInner + jitter, 12, 4);
    ctx.fillRect(x, calmBotOuter + jitter, 12, 4);
  }

  // Crisp pixel-art water ripples scattered across all seas
  const rng = createSeededRng(77412);
  for (let i = 0; i < 2800; i++) {
    const px = Math.floor(rng() * (width / 4)) * 4;
    const py = Math.floor(rng() * (height / 4)) * 4;
    const isLight = i % 3 === 0;
    ctx.fillStyle = isLight ? 'rgba(125, 211, 252, 0.16)' : 'rgba(9, 32, 68, 0.22)';
    const w = i % 5 === 0 ? 12 : 8;
    ctx.fillRect(px, py, w, 4);
  }

  // Red Line (stepped pixel-art crimson cliffs at u=0.25 and u=0.75)
  const drawPixelRedLine = (uCenter: number) => {
    const cx = Math.round(uCenter * width);
    for (let y = 0; y < height; y += 6) {
      const wobble = Math.round(Math.sin(y * 0.03) * 8 + Math.cos(y * 0.085) * 4);
      const halfW = 28 + Math.round(Math.sin(y * 0.045) * 6);
      ctx.fillStyle = '#631d10';
      ctx.fillRect(cx - halfW + wobble - 4, y, halfW * 2 + 8, 6);
      ctx.fillStyle = '#99371e';
      ctx.fillRect(cx - halfW + wobble, y, halfW * 2, 6);
      ctx.fillStyle = '#c15331';
      ctx.fillRect(cx - Math.floor(halfW * 0.5) + wobble, y, halfW, 6);
    }
  };
  drawPixelRedLine(0.25);
  drawPixelRedLine(0.75);

  // Reverse Mountain (Monte Contracorriente) cyan X-canals at u=0.25, v=0.5
  const rmX = Math.round(0.25 * width);
  const rmY = Math.round(0.5 * height);
  ctx.fillStyle = '#38bdf8';
  for (let d = -52; d <= 52; d += 2) {
    ctx.fillRect(rmX + d - 4, rmY + d - 4, 8, 8);
    ctx.fillRect(rmX - d - 4, rmY + d - 4, 8, 8);
  }
  ctx.fillStyle = '#bae6fd';
  ctx.fillRect(rmX - 10, rmY - 10, 20, 20);

  // Crisp nautical sea names rendered onto the high-res texture so zoomed views stay razor-sharp
  const drawWrappedLabel = (
    text: string,
    lonDeg: number,
    latDeg: number,
    fontSize: number,
    alpha: number
  ) => {
    const u = ((lonDeg / 360 + 0.25) % 1 + 1) % 1;
    const x = Math.round(u * width);
    const y = latToY(latDeg);

    ctx.save();
    ctx.font = `700 ${fontSize}px Cinzel, Georgia, serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (const offset of [-width, 0, width]) {
      const dx = x + offset;
      if (dx < -320 || dx > width + 320) continue;
      ctx.fillStyle = `rgba(4, 12, 26, ${Math.min(0.75, alpha + 0.18)})`;
      ctx.fillText(text, dx + 2, y + 2);
      ctx.fillStyle = `rgba(226, 240, 255, ${alpha})`;
      ctx.fillText(text, dx, y);
    }
    ctx.restore();
  };

  drawWrappedLabel('N U E V O   M U N D O', -92, 0, 26, 0.52);
  drawWrappedLabel('P A R A Í S O', 92, 0, 26, 0.52);
  drawWrappedLabel('M A R   D E L   N O R T E', -90, 46, 22, 0.48);
  drawWrappedLabel('M A R   D E L   O E S T E', -90, -44, 22, 0.48);
  drawWrappedLabel('M A R   D E L   E S T E', 88, 42, 22, 0.48);
  drawWrappedLabel('M A R   D E L   S U R', 88, -42, 22, 0.48);

  for (const lon of [-125, -45, 55, 135]) {
    drawWrappedLabel('F R A N J A   D E   C A L M A', lon, 17.2, 14, 0.46);
    drawWrappedLabel('F R A N J A   D E   C A L M A', lon, -17.2, 14, 0.46);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  return tex;
}

/**
 * Generates a crisp 128x128 pixel-art top-down island sprite with interior roads,
 * Ruinas, Dojo, Jefe Fortress, Taberna, Wooden Pier, and distinct canon biome landmarks
 * so zooming in on the 3D globe clearly reveals the island's interior life.
 */
function createPixelIslandTexture(island: Island): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  const seed = hashString(island.id);
  const rng = createSeededRng(seed);
  const cx = 64;
  const cy = 64;
  const phase1 = rng() * Math.PI * 2;
  const phase2 = rng() * Math.PI * 2;
  const stretchX = 0.88 + rng() * 0.28;
  const stretchY = 0.84 + rng() * 0.26;

  // Build crisp binary island landmass mask
  const land: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));
  const distGrid: number[][] = Array.from({ length: size }, () => Array(size).fill(99));

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x - cx) / stretchX;
      const dy = (y - cy) / stretchY;
      const angle = Math.atan2(dy, dx);
      const r = Math.hypot(dx, dy);
      const maxR =
        36 +
        Math.sin(angle * 3 + phase1) * 5.2 +
        Math.cos(angle * 5 + phase2) * 3.1 +
        (island.biome === 'colosseum' || island.biome === 'candy' ? 4 : 0);
      distGrid[y][x] = r - maxR;
      if (r <= maxR) {
        land[y][x] = true;
      }
    }
  }

  // Layer 1: Shallow turquoise coastal aura + crisp shoreline foam
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = distGrid[y][x];
      if (d > 0 && d <= 12) {
        const alpha = Math.max(0.06, (12 - d) / 12) * 0.44;
        ctx.fillStyle = d <= 2.4 ? 'rgba(186, 230, 253, 0.78)' : `rgba(56, 189, 248, ${alpha.toFixed(2)})`;
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }

  // Layer 2: Base terrain & sandy beach rim
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!land[y][x]) continue;
      const d = distGrid[y][x];
      const isBeach = d > -4.6;
      const noise = ((x * 37 + y * 17 + seed) % 7) / 7;

      if (island.biome === 'fire_ice') {
        const splitX = cx + Math.sin(y * 0.14) * 4;
        if (x < splitX) {
          ctx.fillStyle = isBeach ? '#7c3f28' : noise > 0.6 ? '#431407' : '#281714';
        } else {
          ctx.fillStyle = isBeach ? '#cbd5e1' : noise > 0.55 ? '#f1f5f9' : '#bae6fd';
        }
      } else if (island.biome === 'desert') {
        ctx.fillStyle = isBeach ? '#fde68a' : noise > 0.55 ? '#eab308' : '#d99b43';
      } else if (island.biome === 'candy') {
        ctx.fillStyle = isBeach ? '#f5d0c5' : noise > 0.55 ? '#f9a8d4' : '#f472b6';
      } else if (island.biome === 'sky') {
        ctx.fillStyle = isBeach ? '#cbd5e1' : noise > 0.5 ? '#f8fafc' : '#e2e8f0';
      } else if (island.biome === 'volcano') {
        ctx.fillStyle = isBeach ? '#a1887f' : noise > 0.55 ? '#4a3b37' : '#352a27';
      } else if (island.biome === 'colosseum') {
        ctx.fillStyle = isBeach ? '#e7d09c' : x > cx - 4 && y > cy - 8 ? '#7f4438' : '#4a8f47';
      } else {
        ctx.fillStyle = isBeach ? '#ead196' : noise > 0.58 ? '#4c9f45' : noise > 0.25 ? '#367e37' : '#28632d';
      }
      ctx.fillRect(x, y, 1, 1);
    }
  }

  const pxRect = (x: number, y: number, w: number, h: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  };

  // Layer 2.5: Interior Dirt / Stone Roads Connecting Interior Zones (visible on zoom-in!)
  const roadColor =
    island.biome === 'volcano' || island.biome === 'fire_ice'
      ? '#94a3b8'
      : island.biome === 'marine'
        ? '#e2e8f0'
        : '#ebd094';
  const roadEdge =
    island.biome === 'volcano' || island.biome === 'fire_ice' ? '#334155' : '#946d34';

  pxRect(cx - 24, cy - 16, 48, 4, roadEdge);
  pxRect(cx - 24, cy - 15, 48, 2, roadColor);
  pxRect(cx - 24, cy + 12, 48, 4, roadEdge);
  pxRect(cx - 24, cy + 13, 48, 2, roadColor);
  pxRect(cx - 22, cy - 15, 4, 30, roadEdge);
  pxRect(cx - 21, cy - 15, 2, 30, roadColor);
  pxRect(cx - 2, cy - 17, 4, 32, roadEdge);
  pxRect(cx - 1, cy - 17, 2, 32, roadColor);
  pxRect(cx + 18, cy - 15, 4, 30, roadEdge);
  pxRect(cx + 19, cy - 15, 2, 30, roadColor);

  // Layer 3: Wooden Harbor Pier on south-east coast
  pxRect(cx + 22, cy + 18, 16, 5, '#451a03');
  pxRect(cx + 22, cy + 19, 15, 3, '#b45309');
  pxRect(cx + 25, cy + 17, 2, 7, '#291206');
  pxRect(cx + 33, cy + 17, 2, 7, '#291206');

  // Layer 4: Detailed Interior Buildings (Ruinas, Dojo, Guarida del Jefe, Taberna, Muelle)
  // 4A. Ruinas (North-West: pitched pediment, mossy columns, glowing relic)
  pxRect(cx - 26, cy - 23, 12, 8, '#334155');
  pxRect(cx - 25, cy - 25, 10, 2, '#94a3b8');
  pxRect(cx - 23, cy - 26, 6, 1, '#cbd5e1');
  pxRect(cx - 25, cy - 24, 2, 9, '#cbd5e1');
  pxRect(cx - 17, cy - 24, 2, 9, '#cbd5e1');
  pxRect(cx - 25, cy - 24, 2, 2, '#4d7c0f');
  pxRect(cx - 22, cy - 19, 4, 3, '#facc15');

  // 4B. Dojo (North-Center: tiered shingled roof, timber frame, shoji glow)
  pxRect(cx - 7, cy - 26, 14, 3, '#991b1b');
  pxRect(cx - 5, cy - 28, 10, 2, '#dc2626');
  pxRect(cx - 2, cy - 29, 4, 1, '#facc15');
  pxRect(cx - 6, cy - 23, 12, 7, '#f1f5f9');
  pxRect(cx - 5, cy - 21, 2, 2, '#fde68a');
  pxRect(cx + 3, cy - 21, 2, 2, '#fde68a');
  pxRect(cx - 2, cy - 20, 4, 4, '#78350f');

  // 4C. Guarida del Jefe (North-East: twin watchtowers, dark keep, glowing emblem & braziers)
  pxRect(cx + 14, cy - 24, 13, 9, '#1e293b');
  pxRect(cx + 13, cy - 26, 3, 11, '#334155');
  pxRect(cx + 25, cy - 26, 3, 11, '#334155');
  pxRect(cx + 17, cy - 21, 7, 6, '#450a0a');
  pxRect(cx + 19, cy - 23, 3, 2, '#dc2626');
  pxRect(cx + 19, cy - 20, 3, 2, '#ef4444');
  pxRect(cx + 16, cy - 17, 1, 2, '#f97316');
  pxRect(cx + 24, cy - 17, 1, 2, '#f97316');

  // 4D. Taberna (South-West: pitched shingle roof, chimney, warm mullioned windows, rum barrel)
  pxRect(cx - 26, cy + 13, 13, 9, '#5c3317');
  pxRect(cx - 27, cy + 10, 15, 3, '#b45309');
  pxRect(cx - 24, cy + 8, 9, 2, '#d97706');
  pxRect(cx - 17, cy + 7, 2, 3, '#64748b');
  pxRect(cx - 24, cy + 16, 3, 3, '#fbbf24');
  pxRect(cx - 18, cy + 16, 3, 6, '#291206');
  pxRect(cx - 12, cy + 18, 2, 3, '#92400e');

  // 4E. Muelle Puesto Portuario (South-East: striped harbor awning & lantern)
  pxRect(cx + 15, cy + 13, 11, 7, '#5c3317');
  pxRect(cx + 14, cy + 11, 13, 2, '#0284c7');
  pxRect(cx + 17, cy + 11, 2, 2, '#e0f2fe');
  pxRect(cx + 21, cy + 11, 2, 2, '#e0f2fe');
  pxRect(cx + 16, cy + 15, 3, 2, '#fde68a');
  pxRect(cx + 21, cy + 15, 3, 5, '#291206');

  // Layer 5: Biome-specific Central Pixel-Art Landmarks
  switch (island.biome) {
    case 'colosseum': {
      for (let ay = -11; ay <= 11; ay++) {
        for (let ax = -12; ax <= 12; ax++) {
          const r = Math.hypot(ax * 0.9, ay);
          if (r <= 11 && r >= 6) {
            const seat = (ax + ay) % 3 === 0 ? '#ef4444' : (ax + ay) % 2 === 0 ? '#facc15' : '#94a3b8';
            pxRect(cx + ax, cy + ay, 1, 1, r > 9 ? '#cbd5e1' : seat);
          } else if (r < 6) {
            pxRect(cx + ax, cy + ay, 1, 1, '#e7c791');
          }
        }
      }
      break;
    }

    case 'fire_ice': {
      pxRect(cx - 14, cy - 6, 4, 10, '#f97316');
      pxRect(cx - 12, cy - 2, 6, 4, '#fde047');
      pxRect(cx + 6, cy - 8, 5, 8, '#ffffff');
      pxRect(cx + 10, cy - 3, 5, 6, '#7dd3fc');
      break;
    }

    case 'marine': {
      pxRect(cx - 12, cy - 6, 24, 12, '#f1f5f9');
      pxRect(cx - 10, cy - 9, 20, 4, '#2563eb');
      pxRect(cx - 4, cy - 13, 8, 5, '#e2e8f0');
      pxRect(cx - 2, cy - 4, 4, 8, '#94a3b8');
      break;
    }

    case 'candy': {
      pxRect(cx - 9, cy - 8, 18, 12, '#fce7f3');
      pxRect(cx - 10, cy - 11, 4, 6, '#ec4899');
      pxRect(cx + 6, cy - 11, 4, 6, '#ec4899');
      pxRect(cx - 3, cy - 14, 6, 7, '#db2777');
      break;
    }

    case 'pagoda': {
      pxRect(cx - 8, cy - 6, 16, 10, '#f8fafc');
      pxRect(cx - 11, cy - 6, 22, 3, '#dc2626');
      pxRect(cx - 8, cy - 10, 16, 3, '#dc2626');
      pxRect(cx - 4, cy - 13, 8, 3, '#b91c1c');
      pxRect(cx - 1, cy - 16, 2, 3, '#facc15');
      pxRect(cx - 15, cy + 3, 6, 6, '#f472b6');
      pxRect(cx + 10, cy + 2, 6, 6, '#f472b6');
      break;
    }

    case 'fortress': {
      if (island.id === 'mary-geoise') {
        pxRect(cx - 14, cy - 6, 28, 12, '#f8fafc');
        pxRect(cx - 11, cy - 10, 22, 5, '#fde047');
        pxRect(cx - 4, cy - 15, 8, 9, '#ffffff');
      } else if (island.id === 'egghead') {
        pxRect(cx - 11, cy - 6, 22, 12, '#f1f5f9');
        pxRect(cx - 8, cy - 12, 16, 7, '#ffffff');
        pxRect(cx - 11, cy - 2, 22, 3, '#22d3ee');
      } else {
        const roofColors = ['#fb7185', '#38bdf8', '#fbbf24', '#34d399', '#a78bfa', '#f8fafc'];
        pxRect(cx - 5, cy - 5, 10, 10, '#38bdf8');
        let idx = 0;
        for (let by = -11; by <= 9; by += 5) {
          for (let bx = -11; bx <= 9; bx += 5) {
            if (Math.abs(bx) < 5 && Math.abs(by) < 5) continue;
            pxRect(cx + bx, cy + by, 4, 4, roofColors[(idx + seed) % roofColors.length]);
            idx++;
          }
        }
      }
      break;
    }

    case 'desert': {
      pxRect(cx - 10, cy - 7, 20, 10, '#fef3c7');
      pxRect(cx - 6, cy - 11, 12, 5, '#f59e0b');
      pxRect(cx - 2, cy - 14, 4, 3, '#fde047');
      pxRect(cx - 9, cy + 5, 8, 5, '#38bdf8');
      break;
    }

    case 'volcano': {
      if (island.id === 'onigashima' || island.id === 'hachinosu') {
        pxRect(cx - 10, cy - 9, 20, 14, '#475569');
        pxRect(cx - 7, cy - 5, 4, 4, island.id === 'onigashima' ? '#ef4444' : '#fde047');
        pxRect(cx + 3, cy - 5, 4, 4, island.id === 'onigashima' ? '#ef4444' : '#fde047');
        pxRect(cx - 6, cy + 5, 12, 4, '#cbd5e1');
      } else {
        pxRect(cx - 8, cy - 8, 16, 13, '#29201e');
        pxRect(cx - 5, cy - 6, 10, 8, '#ef4444');
        pxRect(cx - 3, cy - 4, 6, 4, '#fde047');
      }
      break;
    }

    case 'treasure': {
      if (island.id === 'elbaph') {
        // Colossal Treasure Tree Adam + Shrunk Pines + Viking A-Frame Village (matching Elbaph canon/ref)
        // Shrunk dark pine clusters
        pxRect(cx - 14, cy + 5, 4, 4, '#0f3d23');
        pxRect(cx + 12, cy + 4, 5, 5, '#0f3d23');
        pxRect(cx + 13, cy + 5, 3, 3, '#14532d');
        // Viking A-frame thatched huts & glowing campfire on left
        pxRect(cx - 14, cy - 4, 5, 4, '#b45309');
        pxRect(cx - 12, cy - 2, 2, 2, '#fb923c');
        pxRect(cx - 7, cy - 7, 5, 4, '#92400e');
        pxRect(cx - 5, cy - 5, 2, 2, '#fb923c');
        pxRect(cx - 10, cy + 1, 3, 2, '#ea580c'); // Campfire
        // Massive Adam Tree trunk + flared roots + lit golden window specks
        pxRect(cx + 1, cy - 4, 7, 13, '#5c3317');
        pxRect(cx - 1, cy + 7, 11, 3, '#451a03');
        pxRect(cx + 3, cy + 6, 3, 3, '#1c0d06');
        pxRect(cx + 2, cy + 1, 1, 1, '#fde047');
        pxRect(cx + 5, cy - 2, 1, 1, '#fde047');
        // Vast tiered emerald canopy + tiny canopy huts + rope ladders
        pxRect(cx - 9, cy - 15, 25, 11, '#0f3d23');
        pxRect(cx - 6, cy - 18, 19, 9, '#15803d');
        pxRect(cx - 2, cy - 20, 11, 4, '#22c55e');
        pxRect(cx - 5, cy - 15, 3, 3, '#0d9488');
        pxRect(cx + 3, cy - 18, 3, 3, '#7c3aed');
        pxRect(cx + 9, cy - 14, 3, 3, '#dc2626');
        pxRect(cx - 6, cy - 5, 1, 11, '#92400e');
        pxRect(cx + 12, cy - 5, 1, 11, '#92400e');
      } else {
        pxRect(cx - 6, cy - 6, 12, 9, '#d97706');
        pxRect(cx - 3, cy - 3, 6, 4, '#fde047');
        pxRect(cx - 14, cy - 4, 5, 5, '#15803d');
        pxRect(cx + 9, cy + 2, 5, 5, '#22c55e');
      }
      break;
    }

    case 'sky': {
      pxRect(cx - 10, cy - 4, 20, 8, '#ffffff');
      pxRect(cx - 5, cy - 11, 10, 8, '#fef08a');
      pxRect(cx - 3, cy - 14, 6, 3, '#eab308');
      break;
    }

    default: {
      // Village Windmill + cozy cottages
      pxRect(cx - 10, cy - 5, 6, 6, '#f8fafc');
      pxRect(cx - 10, cy - 7, 6, 2, '#ef4444');
      pxRect(cx + 4, cy - 3, 6, 5, '#fef3c7');
      pxRect(cx + 4, cy - 5, 6, 2, '#3b82f6');
      pxRect(cx - 2, cy - 10, 4, 7, '#e2e8f0');
      pxRect(cx - 6, cy - 11, 12, 2, '#f59e0b');
      pxRect(cx - 1, cy - 15, 2, 10, '#f59e0b');
      pxRect(cx - 12, cy + 4, 5, 5, '#16a34a');
      pxRect(cx + 7, cy + 5, 5, 5, '#22c55e');
      break;
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  return tex;
}

/**
 * Generates a crisp 16x16 pixel-art Jolly Roger skull texture for pirate sails.
 */
function createJollyRogerSailTexture(flagColor: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 16;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  ctx.fillStyle = flagColor;
  ctx.fillRect(0, 0, 16, 16);

  // Dark border hem
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(0, 0, 16, 1);
  ctx.fillRect(0, 15, 16, 1);

  // Tiny pixel skull
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(5, 4, 6, 5);
  ctx.fillRect(6, 9, 4, 2);
  ctx.fillRect(3, 10, 2, 2);
  ctx.fillRect(11, 10, 2, 2);
  ctx.fillRect(3, 4, 2, 2);
  ctx.fillRect(11, 4, 2, 2);

  // Eyes & teeth
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(6, 6, 1, 2);
  ctx.fillRect(9, 6, 1, 2);
  ctx.fillRect(7, 9, 2, 1);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  return tex;
}

/**
 * Generates a 32x16 translucent pixel-art cloud sprite.
 */
function createPixelCloudTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 16;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  ctx.fillStyle = 'rgba(226, 240, 255, 0.85)';
  ctx.fillRect(6, 6, 20, 6);
  ctx.fillRect(9, 3, 12, 4);
  ctx.fillRect(3, 8, 26, 4);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
  ctx.fillRect(10, 4, 10, 5);
  ctx.fillRect(6, 7, 18, 3);
  ctx.fillStyle = 'rgba(148, 186, 224, 0.55)';
  ctx.fillRect(5, 11, 22, 2);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  return tex;
}

/**
 * Builds a curved pixel-art island decal group + optional 3D Rainbow Arc & hit sphere.
 */
function createIslandMesh(
  island: Island,
  disposeQueue: Array<{ dispose: () => void }>
): THREE.Group {
  const group = new THREE.Group();
  group.userData = { islandId: island.id };

  const baseScale = island.scale ?? 1.0;
  const patchSize = 0.6 * baseScale;
  const tex = createPixelIslandTexture(island);
  disposeQueue.push(tex);

  // Curved tangent grid so the pixel-art island hugs the sphere curvature smoothly even at max zoom
  const patchGeo = new THREE.PlaneGeometry(patchSize, patchSize, 4, 4);
  const posAttr = patchGeo.attributes.position;
  for (let i = 0; i < posAttr.count; i++) {
    const lx = posAttr.getX(i);
    const ly = posAttr.getY(i);
    // PlaneGeometry is in XY; rotate X by -PI/2 so it lies in XZ, then project onto sphere radius
    const r = Math.hypot(lx, ly);
    const arcDrop = Math.sqrt(Math.max(0, GLOBE_RADIUS * GLOBE_RADIUS - r * r)) - GLOBE_RADIUS;
    posAttr.setZ(i, arcDrop + 0.015);
  }
  patchGeo.computeVertexNormals();
  disposeQueue.push(patchGeo);

  const patchMat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    alphaTest: 0.03,
    depthWrite: false,
  });
  disposeQueue.push(patchMat);

  const patchMesh = new THREE.Mesh(patchGeo, patchMat);
  patchMesh.rotation.x = -Math.PI / 2;
  patchMesh.userData = { islandId: island.id };
  group.add(patchMesh);

  // Optional 3D Multi-Color Rainbow Arc over iconic islands (Wano / Jaya / Elbaph)
  if (island.hasRainbow) {
    const rainbowColors = [0xff4b4b, 0xff9f1c, 0xfde047, 0x22c55e, 0x38bdf8, 0xa855f7];
    const rainbowGroup = new THREE.Group();
    rainbowColors.forEach((col, idx) => {
      const rGeo = new THREE.TorusGeometry(0.36 - idx * 0.013, 0.0085, 6, 28, Math.PI);
      const rMat = new THREE.MeshBasicMaterial({
        color: col,
        transparent: true,
        opacity: 0.88,
      });
      disposeQueue.push(rGeo, rMat);
      const arc = new THREE.Mesh(rGeo, rMat);
      rainbowGroup.add(arc);
    });
    rainbowGroup.scale.setScalar(0.75 * baseScale);
    rainbowGroup.position.y = 0.025;
    rainbowGroup.rotation.y = 0.08;
    group.add(rainbowGroup);
  }

  // Clickable hit collider sphere
  const hitGeo = new THREE.SphereGeometry(0.28 * baseScale, 8, 8);
  const hitMat = new THREE.MeshBasicMaterial({ visible: false });
  disposeQueue.push(hitGeo, hitMat);
  const hitMesh = new THREE.Mesh(hitGeo, hitMat);
  hitMesh.userData = { islandId: island.id };
  group.add(hitMesh);

  return group;
}

function createShipMesh(
  pirate: Pirate,
  sailTexCache: Map<string, THREE.CanvasTexture>,
  disposeQueue: Array<{ dispose: () => void }>
): THREE.Group {
  const group = new THREE.Group();
  group.userData = { pirateId: pirate.id };

  const hullGeo = new THREE.BoxGeometry(0.068, 0.036, 0.16);
  const hullMat = new THREE.MeshStandardMaterial({
    color: 0x5c3317,
    roughness: 0.8,
    metalness: 0.06,
  });
  const hull = new THREE.Mesh(hullGeo, hullMat);
  hull.position.y = 0.022;
  group.add(hull);

  const deckGeo = new THREE.BoxGeometry(0.056, 0.012, 0.13);
  const deckMat = new THREE.MeshStandardMaterial({ color: 0xb47b44, roughness: 0.75 });
  const deck = new THREE.Mesh(deckGeo, deckMat);
  deck.position.y = 0.042;
  group.add(deck);

  const mastGeo = new THREE.CylinderGeometry(0.006, 0.008, 0.17, 6);
  const mastMat = new THREE.MeshStandardMaterial({ color: 0xd6b078, roughness: 0.8 });
  const mast = new THREE.Mesh(mastGeo, mastMat);
  mast.position.set(0, 0.11, 0.01);
  group.add(mast);

  let sailTex = sailTexCache.get(pirate.flagColor);
  if (!sailTex) {
    sailTex = createJollyRogerSailTexture(pirate.flagColor);
    sailTexCache.set(pirate.flagColor, sailTex);
    disposeQueue.push(sailTex);
  }

  const sailGeo = new THREE.PlaneGeometry(0.115, 0.115);
  const sailMat = new THREE.MeshBasicMaterial({
    map: sailTex,
    side: THREE.DoubleSide,
  });
  const sail = new THREE.Mesh(sailGeo, sailMat);
  sail.position.set(0, 0.135, 0.024);
  group.add(sail);

  disposeQueue.push(hullGeo, hullMat, deckGeo, deckMat, mastGeo, mastMat, sailGeo, sailMat);

  if (pirate.isPlayerOwned) {
    const ringGeo = new THREE.RingGeometry(0.125, 0.16, 20);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xfacc15,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.95,
    });
    disposeQueue.push(ringGeo, ringMat);
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.012;
    group.add(ring);
    group.userData.ringMesh = ring;
  }

  const hitGeo = new THREE.SphereGeometry(0.18, 6, 6);
  const hitMat = new THREE.MeshBasicMaterial({ visible: false });
  disposeQueue.push(hitGeo, hitMat);
  const hit = new THREE.Mesh(hitGeo, hitMat);
  hit.userData = { pirateId: pirate.id };
  group.add(hit);

  return group;
}

export const GlobeCanvas: React.FC<GlobeCanvasProps> = ({
  islands,
  pirates,
  events,
  selectedIslandId,
  selectedPirateId,
  cameraTarget,
  isTitleScreen,
  drawerOpen,
  leftMenuOpen = false,
  characterFocus = false,
  characterSideOpen = true,
  day = 1,
  minuteOfDay = 480,
  onSelectIsland,
  onSelectPirate,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const labelLayerRef = useRef<HTMLDivElement | null>(null);
  const interiorLabelLayerRef = useRef<HTMLDivElement | null>(null);

  const piratesRef = useRef<Pirate[]>(pirates);
  const islandsRef = useRef<Island[]>(islands);
  const eventsRef = useRef<WorldEvent[]>(events);
  const selectedIslandIdRef = useRef<string | null>(selectedIslandId);
  const selectedPirateIdRef = useRef<string | null>(selectedPirateId);
  const isTitleRef = useRef<boolean>(isTitleScreen);
  const drawerOpenRef = useRef<boolean>(drawerOpen);
  const leftMenuOpenRef = useRef<boolean>(leftMenuOpen);
  const characterFocusRef = useRef<boolean>(characterFocus);
  const characterSideOpenRef = useRef<boolean>(characterSideOpen);
  const dayRef = useRef<number>(day);
  const minuteRef = useRef<number>(minuteOfDay);
  const onSelectIslandRef = useRef(onSelectIsland);
  const onSelectPirateRef = useRef(onSelectPirate);
  const flyTargetRef = useRef<{ vec: THREE.Vector3; active: boolean }>({
    vec: new THREE.Vector3(),
    active: false,
  });

  piratesRef.current = pirates;
  islandsRef.current = islands;
  eventsRef.current = events;
  selectedIslandIdRef.current = selectedIslandId;
  selectedPirateIdRef.current = selectedPirateId;
  isTitleRef.current = isTitleScreen;
  drawerOpenRef.current = drawerOpen;
  leftMenuOpenRef.current = leftMenuOpen;
  characterFocusRef.current = characterFocus;
  characterSideOpenRef.current = characterSideOpen;
  dayRef.current = day;
  minuteRef.current = minuteOfDay;
  onSelectIslandRef.current = onSelectIsland;
  onSelectPirateRef.current = onSelectPirate;

  useEffect(() => {
    if (!cameraTarget) return;
    const [x, y, z] = latLonToXYZ(
      cameraTarget.lat,
      cameraTarget.lon,
      cameraTarget.distance ?? 9.2
    );
    flyTargetRef.current.vec.set(x, y, z);
    flyTargetRef.current.active = true;
  }, [cameraTarget]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const disposeQueue: Array<{ dispose: () => void }> = [];
    const sailTexCache = new Map<string, THREE.CanvasTexture>();

    const isSoftwareGl = detectSoftwareWebGL();
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x060d18);

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 120);
    // Start looking toward Nuevo Mundo & Paraíso so Dressrosa / Wano / Rainbow are visible right away
    const [initX, initY, initZ] = latLonToXYZ(10, -78, 14.5);
    camera.position.set(initX, initY, initZ);

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = false;
    container.appendChild(renderer.domElement);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    const hemiLight = new THREE.HemisphereLight(0xdbeafe, 0x0b1a33, 1.15);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xfff4df, 1.9);
    sunLight.position.set(12, 10, 14);
    scene.add(sunLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.65);
    rimLight.position.set(-14, -6, -12);
    scene.add(rimLight);

    // Starfield (automatically culled when zoomed close to optimize GPU fill)
    const starCount = 900;
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const u = Math.sin(i * 12.9898) * 43758.5453;
      const v = Math.cos(i * 78.233) * 19341.123;
      const theta = Math.abs(u) * Math.PI * 2;
      const phi = Math.acos(2 * (Math.abs(v) % 1) - 1);
      const r = 36 + (i % 16);
      starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPositions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      starPositions[i * 3 + 2] = r * Math.cos(phi);
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    const starMat = new THREE.PointsMaterial({
      color: 0xe2e8f0,
      size: 0.16,
      transparent: true,
      opacity: 0.8,
    });
    const stars = new THREE.Points(starGeo, starMat);
    scene.add(stars);
    disposeQueue.push(starGeo, starMat);

    // Vivid Ocean Pixel-Art Globe
    const globeTex = createVividOceanGlobeTexture();
    const globeGeo = new THREE.SphereGeometry(GLOBE_RADIUS, 72, 54);
    const globeMat = new THREE.MeshStandardMaterial({
      map: globeTex,
      roughness: 0.52,
      metalness: 0.08,
    });
    const globeMesh = new THREE.Mesh(globeGeo, globeMat);
    scene.add(globeMesh);
    disposeQueue.push(globeTex, globeGeo, globeMat);

    // Subtle Atmospheric Rim
    const atmoGeo = new THREE.SphereGeometry(GLOBE_RADIUS * 1.028, 48, 32);
    const atmoMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.09,
      side: THREE.BackSide,
    });
    const atmoMesh = new THREE.Mesh(atmoGeo, atmoMat);
    scene.add(atmoMesh);
    disposeQueue.push(atmoGeo, atmoMat);

    // Low-profile 3D Red Line Rock Ridges (lon = 0° and lon = 180°)
    const ridgeGroup = new THREE.Group();
    const ridgeMat = new THREE.MeshStandardMaterial({
      color: 0xa43f23,
      roughness: 0.88,
      metalness: 0.04,
    });
    const ridgeGeo = new THREE.DodecahedronGeometry(0.18, 0);
    disposeQueue.push(ridgeGeo, ridgeMat);
    for (const lon of [0, 180]) {
      for (let lat = -80; lat <= 80; lat += 9) {
        if (lon === 0 && Math.abs(lat) < 7) continue;
        const [rx, ry, rz] = latLonToXYZ(lat, lon, GLOBE_RADIUS - 0.04);
        const ridge = new THREE.Mesh(ridgeGeo, ridgeMat);
        ridge.position.set(rx, ry, rz);
        ridge.scale.set(1.0, 0.65, 1.0);
        ridgeGroup.add(ridge);
      }
    }
    scene.add(ridgeGroup);

    // Selection Ring Marker
    const selRingGeo = new THREE.RingGeometry(0.41, 0.445, 32);
    const selRingMat = new THREE.MeshBasicMaterial({
      color: 0xfacc15,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.82,
    });
    disposeQueue.push(selRingGeo, selRingMat);
    const selectionRing = new THREE.Mesh(selRingGeo, selRingMat);
    selectionRing.visible = false;
    scene.add(selectionRing);

    // Populate Pixel-Art Islands
    const islandGroups = new Map<string, THREE.Group>();
    const interactables: THREE.Object3D[] = [];
    const _up = new THREE.Vector3(0, 1, 0);
    const _normal = new THREE.Vector3();

    islandsRef.current.forEach((isl) => {
      const meshGroup = createIslandMesh(isl, disposeQueue);
      const [ix, iy, iz] = latLonToXYZ(isl.lat, isl.lon, GLOBE_RADIUS);
      meshGroup.position.set(ix, iy, iz);
      _normal.set(ix, iy, iz).normalize();
      meshGroup.quaternion.setFromUnitVectors(_up, _normal);
      scene.add(meshGroup);
      islandGroups.set(isl.id, meshGroup);
      interactables.push(meshGroup);
    });

    // Drifting Pixel Clouds (fade & hide automatically on zoom-in)
    const cloudTex = createPixelCloudTexture();
    const cloudGeo = new THREE.PlaneGeometry(0.95, 0.48);
    const cloudMat = new THREE.MeshBasicMaterial({
      map: cloudTex,
      transparent: true,
      opacity: 0.78,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    disposeQueue.push(cloudTex, cloudGeo, cloudMat);

    const cloudsGroup = new THREE.Group();
    const cloudData: Array<{ mesh: THREE.Mesh; lat: number; lon: number; speed: number }> = [];
    const cloudRng = createSeededRng(99103);
    for (let i = 0; i < 14; i++) {
      const mesh = new THREE.Mesh(cloudGeo, cloudMat);
      const lat = (cloudRng() - 0.5) * 115;
      const lon = (cloudRng() - 0.5) * 360;
      const scale = 0.75 + cloudRng() * 0.65;
      mesh.scale.set(scale, scale, 1);
      cloudsGroup.add(mesh);
      cloudData.push({ mesh, lat, lon, speed: 0.45 + cloudRng() * 0.6 });
    }
    scene.add(cloudsGroup);

    // Active Event Vertical Light Beacons (pool of 4)
    const beaconPool: Array<{
      group: THREE.Group;
      coneMat: THREE.MeshBasicMaterial;
      gemMat: THREE.MeshBasicMaterial;
    }> = [];
    const beaconConeGeo = new THREE.CylinderGeometry(0.10, 0.02, 0.68, 12, 1, true);
    beaconConeGeo.translate(0, 0.34, 0);
    const beaconGemGeo = new THREE.OctahedronGeometry(0.055, 0);
    disposeQueue.push(beaconConeGeo, beaconGemGeo);

    for (let i = 0; i < 4; i++) {
      const coneMat = new THREE.MeshBasicMaterial({
        color: 0xef4444,
        transparent: true,
        opacity: 0.24,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const gemMat = new THREE.MeshBasicMaterial({ color: 0xfca5a5 });
      disposeQueue.push(coneMat, gemMat);

      const bGroup = new THREE.Group();
      const cone = new THREE.Mesh(beaconConeGeo, coneMat);
      const gem = new THREE.Mesh(beaconGemGeo, gemMat);
      gem.position.y = 0.08;
      bGroup.add(cone);
      bGroup.add(gem);
      bGroup.visible = false;
      scene.add(bGroup);
      beaconPool.push({ group: bGroup, coneMat, gemMat });
    }

    // Crisp Outlined DOM Island Labels + Zoomed Weather Pill
    const islandLabelEls = new Map<string, HTMLButtonElement>();
    let zoomWeatherEl: HTMLDivElement | null = null;
    if (labelLayerRef.current) {
      labelLayerRef.current.innerHTML = '';
      islandsRef.current.forEach((isl) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = isl.name;
        btn.className =
          'absolute -translate-x-1/2 -translate-y-full px-1 py-0.5 text-[12px] font-bold tracking-wide text-white bg-transparent border-0 pointer-events-auto whitespace-nowrap hover:text-amber-300 transition-colors cursor-pointer';
        btn.style.textShadow =
          '-1.5px -1.5px 0 #050e1c, 1.5px -1.5px 0 #050e1c, -1.5px 1.5px 0 #050e1c, 1.5px 1.5px 0 #050e1c, 0 2px 6px rgba(0,0,0,0.95)';
        btn.style.display = 'none';
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          onSelectIslandRef.current(isl.id);
        });
        labelLayerRef.current!.appendChild(btn);
        islandLabelEls.set(isl.id, btn);
      });

      zoomWeatherEl = document.createElement('div');
      zoomWeatherEl.dataset.testid = 'globe-zoom-weather';
      zoomWeatherEl.className =
        'pointer-events-none absolute -translate-x-1/2 px-2 py-0.5 text-[10px] font-black border bg-[#081221]/92 whitespace-nowrap';
      zoomWeatherEl.style.display = 'none';
      labelLayerRef.current.appendChild(zoomWeatherEl);
    }

    // Dynamic Ship Meshes pool
    const shipGroups = new Map<string, THREE.Group>();

    // Zero-GC 3D Weather Particle Pool for Zoomed Island Climate
    const WEATHER_PT_COUNT = 72;
    const weatherPtBase = new Float32Array(WEATHER_PT_COUNT * 3);
    const weatherPtPos = new Float32Array(WEATHER_PT_COUNT * 3);
    const wRng = createSeededRng(334455);
    for (let i = 0; i < WEATHER_PT_COUNT; i++) {
      weatherPtBase[i * 3] = (wRng() - 0.5) * 0.9;
      weatherPtBase[i * 3 + 1] = 0.04 + wRng() * 0.42;
      weatherPtBase[i * 3 + 2] = (wRng() - 0.5) * 0.9;
    }
    const weatherGeo = new THREE.BufferGeometry();
    weatherGeo.setAttribute('position', new THREE.BufferAttribute(weatherPtPos, 3));
    const weatherMat = new THREE.PointsMaterial({
      color: 0x7dd3fc,
      size: 0.032,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    });
    const weatherPoints = new THREE.Points(weatherGeo, weatherMat);
    weatherPoints.visible = false;
    scene.add(weatherPoints);
    disposeQueue.push(weatherGeo, weatherMat);

    // Active Voyage Center-Route Path Arc (pre-allocated 48-point line, zero-GC in loop)
    const ROUTE_PTS = 48;
    const routePositions = new Float32Array(ROUTE_PTS * 3);
    const routeGeo = new THREE.BufferGeometry();
    routeGeo.setAttribute('position', new THREE.BufferAttribute(routePositions, 3));
    const routeMat = new THREE.LineBasicMaterial({
      color: 0xfacc15,
      transparent: true,
      opacity: 0.78,
    });
    const routeLine = new THREE.Line(routeGeo, routeMat);
    routeLine.visible = false;
    scene.add(routeLine);
    disposeQueue.push(routeGeo, routeMat);
    let lastRouteKey = '';

    // Zoom-LOD Interior Pixel Sprites & Pooled Micro-Badges
    const spriteTexCache = new Map<string, THREE.CanvasTexture>();
    const getCharacterBillboardTex = (
      appearance: PirateSpriteAppearance,
      facing: 'right' | 'left'
    ): THREE.CanvasTexture => {
      const key = `${appearance.name}|${appearance.race ?? 'humano'}|${appearance.hatStyle}|${appearance.hatColor ?? ''}|${appearance.skinTone ?? ''}|${appearance.hairStyle ?? ''}|${appearance.hairColor ?? ''}|${appearance.bodyBuild ?? ''}|${appearance.outfitStyle ?? ''}|${appearance.outfitColor ?? ''}|${appearance.accessory ?? ''}|${appearance.accessoryColor ?? ''}|${appearance.capeStyle ?? 'none'}|${appearance.capeColor ?? ''}|${appearance.weaponStyle ?? 'none'}|${appearance.role ?? ''}|${appearance.hasEquippedWeapon ? '1' : '0'}|${facing}`;
      const existing = spriteTexCache.get(key);
      if (existing) return existing;
      const canvas = renderPirateSpriteCanvas(appearance, 2, facing);
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.magFilter = THREE.NearestFilter;
      tex.minFilter = THREE.NearestFilter;
      tex.generateMipmaps = false;
      spriteTexCache.set(key, tex);
      disposeQueue.push(tex);
      return tex;
    };

    interface InteriorEntry {
      sprite: THREE.Sprite;
      label: string;
      kind: 'boss' | 'miniboss' | 'npc' | 'player';
    }
    interface InteriorCacheItem {
      group: THREE.Group;
      playerSig: string;
      entries: InteriorEntry[];
    }
    const islandInteriorCache = new Map<string, InteriorCacheItem>();

    const interiorBadgePool: HTMLButtonElement[] = [];
    if (interiorLabelLayerRef.current) {
      interiorLabelLayerRef.current.innerHTML = '';
      for (let i = 0; i < 24; i++) {
        const badge = document.createElement('button');
        badge.type = 'button';
        badge.className =
          'absolute -translate-x-1/2 -translate-y-full px-1 py-0 text-[9px] font-black leading-tight border pointer-events-auto whitespace-nowrap cursor-pointer';
        badge.style.display = 'none';
        interiorLabelLayerRef.current.appendChild(badge);
        interiorBadgePool.push(badge);
      }
    }

    const rebuildIslandInterior = (isl: Island, dockedPlayers: Pirate[]): InteriorCacheItem => {
      const parentGrp = islandGroups.get(isl.id)!;
      let cached = islandInteriorCache.get(isl.id);
      if (!cached) {
        const g = new THREE.Group();
        parentGrp.add(g);
        cached = { group: g, playerSig: '', entries: [] };
        islandInteriorCache.set(isl.id, cached);
      } else {
        while (cached.group.children.length > 0) {
          const child = cached.group.children.pop()!;
          if (child instanceof THREE.Sprite) {
            child.material.dispose();
          }
        }
        cached.entries = [];
      }

      const baseScale = isl.scale ?? 1.0;
      const patchSize = 0.6 * baseScale;
      // Base retro scale; individual characters scale via getCharacterSpriteScale(race, isl.id)
      const baseSpriteH = Math.min(0.088, 0.064 * Math.sqrt(baseScale));

      const addSprite = (
        appearance: PirateSpriteAppearance,
        uNorm: number,
        vNorm: number,
        facing: 'right' | 'left',
        label: string,
        kind: 'boss' | 'miniboss' | 'npc' | 'player'
      ) => {
        const tex = getCharacterBillboardTex(appearance, facing);
        const mat = new THREE.SpriteMaterial({
          map: tex,
          transparent: true,
          alphaTest: 0.15,
          depthWrite: false,
        });
        disposeQueue.push(mat);
        const sprite = new THREE.Sprite(mat);
        const charScale = getCharacterSpriteScale(appearance.race, isl.id);
        const charH = baseSpriteH * charScale;
        const charW = charH * (22 / 24);
        const lx = uNorm * patchSize;
        const lz = vNorm * patchSize;
        const r = Math.hypot(lx, lz);
        const arcDrop = Math.sqrt(Math.max(0, GLOBE_RADIUS * GLOBE_RADIUS - r * r)) - GLOBE_RADIUS;
        sprite.position.set(lx, arcDrop + 0.02 + charH * 0.44, lz);
        sprite.scale.set(charW, charH, 1);
        sprite.center.set(0.5, 0.15);
        sprite.userData = { islandId: isl.id };
        cached!.group.add(sprite);
        cached!.entries.push({ sprite, label, kind });
      };

      const boss = getBossForIsland(isl);
      addSprite(
        {
          name: boss.name,
          flagColor: boss.outfitColor,
          race: boss.race,
          hatStyle: boss.hatStyle,
          hatColor: boss.hatColor,
          skinTone: boss.skinTone,
          hairStyle: boss.hairStyle,
          hairColor: boss.hairColor,
          bodyBuild: boss.bodyBuild ?? 'robust',
          outfitStyle: boss.outfitStyle ?? 'coat',
          outfitColor: boss.outfitColor,
          accessory: boss.accessory,
          accessoryColor: boss.accessoryColor,
          capeStyle: boss.capeStyle,
          capeColor: boss.capeColor,
          weaponStyle: boss.weaponStyle,
        },
        0.16,
        -0.11,
        'left',
        `JEFE: ${getShortStageName(boss.name)}`,
        'boss'
      );

      const miniBosses = getMiniBossesForIsland(isl);
      const mbSlots: Array<[number, number]> = [
        [0.16, 0.04],
        [-0.14, 0.02],
        [0.01, 0.04],
      ];
      miniBosses.forEach((mb, idx) => {
        const [u, v] = mbSlots[idx % mbSlots.length];
        addSprite(
          {
            name: mb.name,
            flagColor: mb.outfitColor,
            race: mb.race,
            hatStyle: mb.hatStyle,
            hatColor: mb.hatColor,
            skinTone: mb.skinTone,
            hairStyle: mb.hairStyle,
            hairColor: mb.hairColor,
            bodyBuild: mb.bodyBuild,
            outfitStyle: mb.outfitStyle ?? 'coat',
            outfitColor: mb.outfitColor,
            accessory: mb.accessory,
            accessoryColor: mb.accessoryColor,
            capeStyle: mb.capeStyle,
            capeColor: mb.capeColor,
            weaponStyle: mb.weaponStyle,
          },
          u,
          v,
          'left',
          `SUB: ${getShortStageName(mb.name)}`,
          'miniboss'
        );
      });

      const npcs = getNpcsForIsland(isl);
      const npcSlots: Array<[number, number]> = [
        [-0.17, -0.02],
        [-0.08, -0.11],
        [0.07, -0.11],
        [0.0, 0.12],
        [-0.08, 0.02],
        [0.09, 0.02],
      ];
      npcs.forEach((q, idx) => {
        const [u, v] = npcSlots[idx % npcSlots.length];
        addSprite(
          {
            name: q.npcName,
            flagColor: q.outfitColor,
            race: q.race,
            hatStyle: q.hatStyle,
            hatColor: q.hatColor,
            skinTone: q.skinTone,
            hairStyle: q.hairStyle,
            hairColor: q.hairColor,
            bodyBuild: q.bodyBuild,
            outfitStyle: q.outfitStyle,
            outfitColor: q.outfitColor,
            accessory: q.accessory,
            accessoryColor: q.accessoryColor,
            capeStyle: q.capeStyle,
            capeColor: q.capeColor,
            weaponStyle: q.weaponStyle,
          },
          u,
          v,
          u > 0 ? 'left' : 'right',
          `! ${getShortStageName(q.npcName)}`,
          'npc'
        );
      });

      const playerSlots: Array<[number, number]> = [
        [-0.02, 0.07],
        [0.06, 0.09],
        [-0.1, 0.09],
      ];
      dockedPlayers.slice(0, 3).forEach((p, idx) => {
        const [u, v] = playerSlots[idx % playerSlots.length];
        addSprite(
          {
            name: p.name,
            flagColor: p.flagColor,
            race: p.race,
            hatStyle: p.hatStyle,
            hatColor: p.hatColor,
            skinTone: p.skinTone,
            hairStyle: p.hairStyle,
            hairColor: p.hairColor,
            bodyBuild: p.bodyBuild,
            outfitStyle: p.outfitStyle,
            outfitColor: p.outfitColor,
            accessory: p.accessory,
            accessoryColor: p.accessoryColor,
            capeStyle: p.capeStyle,
            capeColor: p.capeColor,
            weaponStyle: p.weaponStyle,
            role: p.role,
            hasEquippedWeapon: Boolean(p.equipped?.arma),
          },
          u,
          v,
          'right',
          `@${p.name}`,
          'player'
        );
      });

      cached.playerSig = dockedPlayers
        .map(
          (p) =>
            `${p.id}:${p.race ?? 'humano'}:${p.hatStyle}:${p.hatColor ?? ''}:${p.hairStyle}:${p.hairColor}:${p.outfitStyle}:${p.outfitColor}:${p.accessory}:${p.accessoryColor ?? ''}:${p.capeStyle ?? 'none'}:${p.capeColor ?? ''}:${p.weaponStyle ?? 'none'}:${p.equipped?.arma ?? ''}`
        )
        .join('|');
      return cached;
    };

    // OrbitControls (allows close zoom right onto island interior sprites & buildings)
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enablePan = false;
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.06;
    controls.rotateSpeed = 0.65;
    controls.zoomSpeed = 0.9;
    controls.minDistance = 5.75;
    controls.maxDistance = 18.5;

    controls.addEventListener('start', () => {
      flyTargetRef.current.active = false;
    });

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let pointerDownPos = { x: 0, y: 0 };

    const onPointerDown = (e: PointerEvent) => {
      pointerDownPos = { x: e.clientX, y: e.clientY };
    };

    const onPointerUp = (e: PointerEvent) => {
      const distMoved = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
      if (distMoved > 6) return;

      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);

      const hits = raycaster.intersectObjects(interactables, true);
      if (hits.length > 0) {
        let obj: THREE.Object3D | null = hits[0].object;
        while (obj) {
          if (obj.userData?.pirateId) {
            onSelectPirateRef.current(obj.userData.pirateId);
            return;
          }
          if (obj.userData?.islandId) {
            onSelectIslandRef.current(obj.userData.islandId);
            return;
          }
          obj = obj.parent;
        }
      }
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointerup', onPointerUp);

    // Drawer-safe & Left-Side Character-Panel-safe camera framing offset
    let currentOffsetMode = '';
    const applyFramingOffset = (w: number, h: number) => {
      const mode = isTitleRef.current
        ? 'title'
        : leftMenuOpenRef.current && w >= 1024
        ? 'leftMenu'
        : characterFocusRef.current
        ? w >= 1024
          ? characterSideOpenRef.current
            ? 'characterSideDesktop'
            : 'center'
          : characterSideOpenRef.current
          ? 'characterSideMobile'
          : 'center'
        : drawerOpenRef.current && w >= 1024
        ? 'drawer'
        : 'center';
      if (mode === currentOffsetMode) return;
      currentOffsetMode = mode;
      if (mode === 'title') {
        camera.setViewOffset(w, h, -w * 0.16, 0, w, h);
      } else if (mode === 'leftMenu') {
        camera.setViewOffset(w, h, -w * 0.17, 0, w, h);
      } else if (mode === 'characterSideDesktop') {
        // Shift focused island/ship into the open right/center viewport away from the left Character Panel
        camera.setViewOffset(w, h, -w * 0.145, 0, w, h);
      } else if (mode === 'characterSideMobile') {
        // Lift focused island/ship slightly above compact bottom mobile sheet
        camera.setViewOffset(w, h, 0, h * 0.15, w, h);
      } else if (mode === 'drawer') {
        camera.setViewOffset(w, h, w * 0.13, 0, w, h);
      } else {
        camera.clearViewOffset();
      }
      camera.updateProjectionMatrix();
    };

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      currentOffsetMode = '';
      applyFramingOffset(w, h);
      renderer.setSize(w, h);
      controls.update();
      renderer.render(scene, camera);
    };
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    // Zero-GC scratch objects
    const _shipPos = new THREE.Vector3();
    const _nextPos = new THREE.Vector3();
    const _camDir = new THREE.Vector3();
    const _projVec = new THREE.Vector3();
    const _lookMat = new THREE.Matrix4();
    const _targetPos = new THREE.Vector3();
    const _zAxis = new THREE.Vector3(0, 0, 1);
    const _bgDeep = new THREE.Color(0x060d18);
    const _bgHumid = new THREE.Color(0x030812);
    const _bgWork = new THREE.Color(0x060d18);
    const _rimFar = new THREE.Color(0x38bdf8);
    const _rimHumid = new THREE.Color(0x0e7490);

    let frameId = 0;
    let lastTime = performance.now();
    let disposed = false;

    function afterDraw(cb: () => void) {
      if (disposed) return;
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    const tick = () => {
      if (disposed) return;
      const now = performance.now();
      const rawDt = (now - lastTime) / 1000;
      lastTime = now;
      const dt = Math.min(rawDt, 0.05);

      if (isTitleRef.current && !flyTargetRef.current.active) {
        const angle = dt * 0.13;
        const x = camera.position.x;
        const z = camera.position.z;
        camera.position.x = x * Math.cos(angle) - z * Math.sin(angle);
        camera.position.z = x * Math.sin(angle) + z * Math.cos(angle);
      }

      if (flyTargetRef.current.active) {
        const factor = 1 - Math.exp(-5.5 * dt);
        camera.position.lerp(flyTargetRef.current.vec, factor);
        if (camera.position.distanceTo(flyTargetRef.current.vec) < 0.08) {
          flyTargetRef.current.active = false;
        }
      }

      controls.update();

      const camDist = camera.position.length();
      _camDir.copy(camera.position).normalize();

      // Zoom-linked humid & slightly darker close-up atmosphere
      const zoomT = THREE.MathUtils.clamp((8.8 - camDist) / (8.8 - 5.75), 0, 1);
      _bgWork.copy(_bgDeep).lerp(_bgHumid, zoomT);
      (scene.background as THREE.Color).copy(_bgWork);
      hemiLight.intensity = 1.15 - zoomT * 0.28;
      sunLight.intensity = 1.9 - zoomT * 0.28;
      rimLight.intensity = 0.65 + zoomT * 0.25;
      rimLight.color.copy(_rimFar).lerp(_rimHumid, zoomT);
      globeMat.color.setRGB(1 - zoomT * 0.22, 1 - zoomT * 0.14, 1 - zoomT * 0.08);

      // Zoom Optimization 1: Cull far starfield when zoomed close onto the ocean
      stars.visible = camDist > 10.2;

      // Zoom Optimization 2: Fade out drifting clouds when zooming in so island pixel details stay crisp
      if (camDist <= 8.2) {
        cloudsGroup.visible = false;
      } else {
        cloudsGroup.visible = true;
        cloudMat.opacity = Math.min(0.78, ((camDist - 8.2) / 2.6) * 0.78);
        for (let c = 0; c < cloudData.length; c++) {
          const cd = cloudData[c];
          cd.lon = ((cd.lon + cd.speed * dt + 180) % 360) - 180;
          const [cx, cy, cz] = latLonToXYZ(cd.lat, cd.lon, GLOBE_RADIUS + 0.24);
          cd.mesh.position.set(cx, cy, cz);
          _normal.set(cx, cy, cz).normalize();
          cd.mesh.quaternion.setFromUnitVectors(_zAxis, _normal);
        }
      }

      // Zoom Optimization 3: Frustum & hemisphere culling for ships
      const currentPirates = piratesRef.current;
      const currentIslands = islandsRef.current;

      const activeShipIds = new Set<string>();
      for (let i = 0; i < currentPirates.length; i++) {
        activeShipIds.add(currentPirates[i].id);
      }
      for (const [pid, oldShip] of shipGroups.entries()) {
        if (!activeShipIds.has(pid)) {
          scene.remove(oldShip);
          const idx = interactables.indexOf(oldShip);
          if (idx !== -1) interactables.splice(idx, 1);
          shipGroups.delete(pid);
        }
      }

      for (let i = 0; i < currentPirates.length; i++) {
        const p = currentPirates[i];

        let ship = shipGroups.get(p.id);
        if (!ship) {
          ship = createShipMesh(p, sailTexCache, disposeQueue);
          scene.add(ship);
          shipGroups.set(p.id, ship);
          interactables.push(ship);
        }

        const [sx, sy, sz] = getPiratePositionXYZ(p, currentIslands, GLOBE_RADIUS + 0.045);
        _shipPos.set(sx, sy, sz);
        _normal.copy(_shipPos).normalize();

        // Hide back-hemisphere ships to optimize rendering when zoomed
        if (_normal.dot(_camDir) < -0.08) {
          ship.visible = false;
          continue;
        }
        ship.visible = true;

        if (!p.sailingToIslandId) {
          const angle = (i % 8) * (Math.PI / 4);
          _nextPos.set(-_normal.z, 0, _normal.x);
          if (_nextPos.lengthSq() < 0.001) _nextPos.set(1, 0, 0);
          _nextPos.normalize();
          const tangentB = _projVec.crossVectors(_normal, _nextPos).normalize();
          _shipPos.addScaledVector(_nextPos, Math.cos(angle) * 0.24);
          _shipPos.addScaledVector(tangentB, Math.sin(angle) * 0.24);
          _shipPos.normalize().multiplyScalar(GLOBE_RADIUS + 0.035);
        } else {
          const bob = Math.sin(now * 0.005 + i) * 0.012;
          _shipPos.normalize().multiplyScalar(GLOBE_RADIUS + 0.038 + bob);
        }

        ship.position.copy(_shipPos);
        _normal.copy(_shipPos).normalize();
        const ringMesh = ship.userData.ringMesh as THREE.Object3D | undefined;
        if (ringMesh) {
          ringMesh.visible = camDist >= 7.6;
        }

        if (p.sailingToIslandId) {
          const heading = getPirateHeadingXYZ(p, currentIslands, GLOBE_RADIUS + 0.038);
          if (heading) {
            _targetPos.set(heading[0], heading[1], heading[2]);
            _lookMat.lookAt(_targetPos, _shipPos, _normal);
            ship.quaternion.setFromRotationMatrix(_lookMat);
          }
        } else {
          ship.quaternion.setFromUnitVectors(_up, _normal);
        }
      }

      // Update active sailing route arc (passes visibly through world center when crossing seas)
      const sailingPirate =
        currentPirates.find((x) => x.id === selectedPirateIdRef.current && x.sailingToIslandId) ??
        currentPirates.find((x) => x.sailingToIslandId);
      if (sailingPirate && sailingPirate.sailingToIslandId) {
        const routeKey = `${sailingPirate.islandId}->${sailingPirate.sailingToIslandId}`;
        if (routeKey !== lastRouteKey) {
          lastRouteKey = routeKey;
          const fromIsl =
            currentIslands.find((i) => i.id === sailingPirate.islandId) ?? currentIslands[0];
          const toIsl =
            currentIslands.find((i) => i.id === sailingPirate.sailingToIslandId) ?? fromIsl;
          const coords = getNavigationPathCoords(fromIsl, toIsl);
          for (let k = 0; k < ROUTE_PTS; k++) {
            const t = k / (ROUTE_PTS - 1);
            const [rx, ry, rz] = sampleNavigationPathXYZ(coords, t, GLOBE_RADIUS + 0.028);
            routePositions[k * 3] = rx;
            routePositions[k * 3 + 1] = ry;
            routePositions[k * 3 + 2] = rz;
          }
          routeGeo.attributes.position.needsUpdate = true;
        }
        routeLine.visible = true;
      } else {
        routeLine.visible = false;
      }

      // Active Event Light Beacons (top 4 recent events on unique islands)
      const recentEventIslands = new Map<string, WorldEvent>();
      const evs = eventsRef.current;
      for (let i = 0; i < evs.length && recentEventIslands.size < beaconPool.length; i++) {
        if (!recentEventIslands.has(evs[i].islandId)) {
          recentEventIslands.set(evs[i].islandId, evs[i]);
        }
      }
      const eventEntries = Array.from(recentEventIslands.entries());
      for (let b = 0; b < beaconPool.length; b++) {
        const poolItem = beaconPool[b];
        if (b >= eventEntries.length) {
          poolItem.group.visible = false;
          continue;
        }
        const [evIslId, ev] = eventEntries[b];
        const grp = islandGroups.get(evIslId);
        if (!grp) {
          poolItem.group.visible = false;
          continue;
        }
        _normal.copy(grp.position).normalize();
        if (_normal.dot(_camDir) < -0.05) {
          poolItem.group.visible = false;
          continue;
        }
        poolItem.group.visible = true;
        poolItem.group.position.copy(grp.position);
        poolItem.group.quaternion.setFromUnitVectors(_up, _normal);
        const colHex =
          ev.type === 'duel'
            ? 0xef4444
            : ev.type === 'devil_fruit' || ev.type === 'treasure'
            ? 0xfacc15
            : 0x38bdf8;
        poolItem.coneMat.color.setHex(colHex);
        poolItem.gemMat.color.setHex(colHex);
        poolItem.coneMat.opacity = camDist < 8.5 ? 0.12 : 0.24;
      }

      // Highlight selected island or pirate (hidden when zoomed close into island interior)
      if (camDist < 7.6) {
        selectionRing.visible = false;
      } else if (selectedIslandIdRef.current) {
        const isl = currentIslands.find((x) => x.id === selectedIslandIdRef.current);
        if (isl) {
          const [rx, ry, rz] = latLonToXYZ(isl.lat, isl.lon, GLOBE_RADIUS + 0.03);
          selectionRing.position.set(rx, ry, rz);
          selectionRing.scale.setScalar(0.72 * (isl.scale ?? 1.0));
          _normal.set(rx, ry, rz).normalize();
          selectionRing.quaternion.setFromUnitVectors(_zAxis, _normal);
          selectionRing.visible = true;
        }
      } else if (selectedPirateIdRef.current && shipGroups.has(selectedPirateIdRef.current)) {
        const s = shipGroups.get(selectedPirateIdRef.current)!;
        selectionRing.position.copy(s.position).normalize().multiplyScalar(GLOBE_RADIUS + 0.03);
        selectionRing.scale.setScalar(1);
        _normal.copy(s.position).normalize();
        selectionRing.quaternion.setFromUnitVectors(_zAxis, _normal);
        selectionRing.visible = true;
      } else {
        selectionRing.visible = false;
      }

      // Update floating island labels with zoom LOD & screen-space de-overlap
      const canvasW = renderer.domElement.clientWidth;
      const canvasH = renderer.domElement.clientHeight;
      applyFramingOffset(canvasW, canvasH);
      const minLabelX =
        leftMenuOpenRef.current && canvasW >= 1024
          ? 630
          : characterFocusRef.current && characterSideOpenRef.current && canvasW >= 1024
          ? 440
          : 48;
      const maxLabelX = drawerOpenRef.current && canvasW >= 1024 ? canvasW - 430 : canvasW - 32;
      const maxLabelY =
        characterFocusRef.current && characterSideOpenRef.current && canvasW < 1024
          ? canvasH * 0.56
          : canvasH - 52;

      // Zoom-LOD Interior Characters & Micro-Labels inside close islands (camDist < 7.8)
      const activeCloseIslandIds = new Set<string>();
      const showInteriorSprites = !isTitleRef.current && camDist < 7.8;
      const showInteriorLabels = !isTitleRef.current && camDist < 6.85;
      let nextBadgeIdx = 0;
      let primaryCloseIsland: Island | null = null;

      if (showInteriorSprites) {
        const closeCandidates: Array<{ isl: Island; facing: number }> = [];
        for (let i = 0; i < currentIslands.length; i++) {
          const isl = currentIslands[i];
          const grp = islandGroups.get(isl.id);
          if (!grp) continue;
          _normal.copy(grp.position).normalize();
          const facing = _normal.dot(_camDir);
          if (facing > 0.72) {
            closeCandidates.push({ isl, facing });
          }
        }
        closeCandidates.sort((a, b) => b.facing - a.facing);
        if (closeCandidates.length > 0) {
          primaryCloseIsland = closeCandidates[0].isl;
        }

        const interiorPlaced: Array<{ x: number; y: number; w: number }> = [];
        for (let c = 0; c < Math.min(2, closeCandidates.length); c++) {
          const { isl } = closeCandidates[c];
          activeCloseIslandIds.add(isl.id);
          const dockedPlayers = currentPirates.filter(
            (p) => p.islandId === isl.id && !p.sailingToIslandId
          );
          const sig = dockedPlayers
            .map(
              (p) =>
                `${p.id}:${p.race ?? 'humano'}:${p.hatStyle}:${p.hatColor ?? ''}:${p.hairStyle}:${p.hairColor}:${p.outfitStyle}:${p.outfitColor}:${p.accessory}:${p.accessoryColor ?? ''}:${p.capeStyle ?? 'none'}:${p.capeColor ?? ''}:${p.weaponStyle ?? 'none'}:${p.equipped?.arma ?? ''}`
            )
            .join('|');
          let cached = islandInteriorCache.get(isl.id);
          if (!cached || cached.playerSig !== sig) {
            cached = rebuildIslandInterior(isl, dockedPlayers);
          }
          cached.group.visible = true;

          if (showInteriorLabels) {
            for (let e = 0; e < cached.entries.length && nextBadgeIdx < interiorBadgePool.length; e++) {
              const entry = cached.entries[e];
              entry.sprite.getWorldPosition(_projVec);
              _projVec.project(camera);
              if (_projVec.z < -1 || _projVec.z > 1) continue;
              const bx = (_projVec.x * 0.5 + 0.5) * canvasW;
              const by = (-_projVec.y * 0.5 + 0.5) * canvasH - 10;
              if (bx < minLabelX || bx > maxLabelX || by < 48 || by > maxLabelY) continue;
              const estW = Math.max(36, entry.label.length * 5.2);
              const collides = interiorPlaced.some(
                (r) => Math.abs(r.x - bx) < (r.w + estW) * 0.45 && Math.abs(r.y - by) < 13
              );
              if (collides) continue;
              interiorPlaced.push({ x: bx, y: by, w: estW });

              const badge = interiorBadgePool[nextBadgeIdx++];
              badge.textContent = entry.label;
              badge.style.display = 'block';
              badge.style.left = `${bx}px`;
              badge.style.top = `${by}px`;
              badge.onclick = (ev) => {
                ev.stopPropagation();
                onSelectIslandRef.current(isl.id);
              };

              if (entry.kind === 'boss') {
                badge.style.backgroundColor = 'rgba(76, 5, 25, 0.95)';
                badge.style.borderColor = '#fb7185';
                badge.style.color = '#ffe4e6';
              } else if (entry.kind === 'miniboss') {
                badge.style.backgroundColor = 'rgba(67, 20, 7, 0.94)';
                badge.style.borderColor = '#fb923c';
                badge.style.color = '#ffedd5';
              } else if (entry.kind === 'player') {
                badge.style.backgroundColor = 'rgba(11, 21, 38, 0.96)';
                badge.style.borderColor = '#facc15';
                badge.style.color = '#fef08a';
              } else {
                badge.style.backgroundColor = 'rgba(251, 191, 36, 0.95)';
                badge.style.borderColor = '#fef3c7';
                badge.style.color = '#0f172a';
              }
            }
          }
        }
      }

      // Regional Weather 3D Particles & HUD Badge above Primary Zoomed Island
      let weatherShown = false;
      if (!isTitleRef.current && camDist < 8.4 && primaryCloseIsland) {
        const grp = islandGroups.get(primaryCloseIsland.id);
        if (grp) {
          const wx = getRegionalWeather(primaryCloseIsland, dayRef.current, minuteRef.current);
          const selPirate = currentPirates.find((p) => p.id === selectedPirateIdRef.current) ?? currentPirates[0];
          const fruitDebuffActive =
            Boolean(selPirate?.devilFruit) && wx.affectsDevilFruit;

          if (wx.type !== 'despejado') {
            weatherPoints.visible = true;
            weatherPoints.position.copy(grp.position);
            weatherPoints.quaternion.copy(grp.quaternion);
            const tSec = now * 0.001;
            const colorHex =
              wx.type === 'lluvia'
                ? 0x7dd3fc
                : wx.type === 'tormenta'
                ? 0xa5b4fc
                : wx.type === 'nieve'
                ? 0xf8fafc
                : wx.type === 'viento'
                ? 0x5eead4
                : wx.type === 'calor'
                ? 0xfb923c
                : 0xcbd5e1;
            weatherMat.color.setHex(colorHex);
            weatherMat.size = wx.type === 'niebla' ? 0.055 : 0.028;
            const scaleSpread = Math.min(1.8, Math.max(0.85, (primaryCloseIsland.scale ?? 1.0) * 0.85));

            for (let k = 0; k < WEATHER_PT_COUNT; k++) {
              const bx = weatherPtBase[k * 3] * scaleSpread;
              const by = weatherPtBase[k * 3 + 1];
              const bz = weatherPtBase[k * 3 + 2] * scaleSpread;
              if (wx.type === 'viento' || wx.type === 'niebla') {
                const drift = ((bx + tSec * 0.35 + 0.5) % 1.0) - 0.5;
                weatherPtPos[k * 3] = drift * scaleSpread;
                weatherPtPos[k * 3 + 1] = by * 0.55;
                weatherPtPos[k * 3 + 2] = bz;
              } else if (wx.type === 'calor') {
                const rise = (by + tSec * 0.14) % 0.42;
                weatherPtPos[k * 3] = bx;
                weatherPtPos[k * 3 + 1] = 0.04 + rise;
                weatherPtPos[k * 3 + 2] = bz;
              } else {
                const speedY = wx.type === 'nieve' ? 0.18 : 0.62;
                const fall = 0.44 - ((tSec * speedY + by) % 0.42);
                weatherPtPos[k * 3] = bx;
                weatherPtPos[k * 3 + 1] = fall;
                weatherPtPos[k * 3 + 2] = bz;
              }
            }
            weatherGeo.attributes.position.needsUpdate = true;
          } else {
            weatherPoints.visible = false;
          }

          if (zoomWeatherEl) {
            _projVec.copy(grp.position).multiplyScalar(1.032);
            _projVec.project(camera);
            if (_projVec.z >= -1 && _projVec.z <= 1) {
              const wxX = (_projVec.x * 0.5 + 0.5) * canvasW;
              const wxY = (-_projVec.y * 0.5 + 0.5) * canvasH;
              if (wxX >= minLabelX && wxX <= maxLabelX && wxY >= 60 && wxY <= maxLabelY) {
                const yLift = camDist < 6.85 ? 58 : 34;
                zoomWeatherEl.style.display = 'block';
                zoomWeatherEl.style.left = `${wxX}px`;
                zoomWeatherEl.style.top = `${Math.max(54, wxY - yLift)}px`;
                zoomWeatherEl.style.borderColor = fruitDebuffActive ? '#fb7185' : wx.color;
                zoomWeatherEl.style.color = fruitDebuffActive ? '#fecdd3' : wx.color;
                zoomWeatherEl.textContent = fruitDebuffActive
                  ? `Clima: ${wx.label} · Debuff Fruta`
                  : `Clima: ${wx.label}`;
                weatherShown = true;
              }
            }
          }
        }
      } else {
        weatherPoints.visible = false;
      }
      if (!weatherShown && zoomWeatherEl) {
        zoomWeatherEl.style.display = 'none';
      }

      for (const [islId, cached] of islandInteriorCache.entries()) {
        if (!activeCloseIslandIds.has(islId)) {
          cached.group.visible = false;
        }
      }
      for (let b = nextBadgeIdx; b < interiorBadgePool.length; b++) {
        interiorBadgePool[b].style.display = 'none';
      }

      if (!isTitleRef.current) {
        const placedRects: Array<{ x: number; y: number; w: number }> = [];
        // Sort so selected island & higher-tier islands win label placement when zoomed out
        const sortedIslands = [...currentIslands].sort((a, b) => {
          if (a.id === selectedIslandIdRef.current) return -1;
          if (b.id === selectedIslandIdRef.current) return 1;
          return b.dangerTier - a.dangerTier;
        });

        for (let i = 0; i < sortedIslands.length; i++) {
          const isl = sortedIslands[i];
          const el = islandLabelEls.get(isl.id);
          if (!el) continue;
          const grp = islandGroups.get(isl.id);
          if (!grp) continue;

          _normal.copy(grp.position).normalize();
          const facing = _normal.dot(_camDir);
          const isSelected = isl.id === selectedIslandIdRef.current;
          const showThreshold = camDist < 10.6 ? 0.22 : 0.48;

          if (facing > showThreshold || (isSelected && facing > 0.08)) {
            _projVec.copy(grp.position).multiplyScalar(1.032);
            _projVec.project(camera);
            if (_projVec.z >= -1 && _projVec.z <= 1) {
              const px = (_projVec.x * 0.5 + 0.5) * canvasW;
              const py = (-_projVec.y * 0.5 + 0.5) * canvasH;
              if (px >= minLabelX && px <= maxLabelX && py >= 46 && py <= maxLabelY) {
                const estWidth = Math.max(70, isl.name.length * 6.5);
                const overlaps =
                  !isSelected &&
                  placedRects.some(
                    (r) => Math.abs(r.x - px) < (r.w + estWidth) * 0.48 && Math.abs(r.y - py) < 22
                  );

                if (!overlaps) {
                  placedRects.push({ x: px, y: py, w: estWidth });
                  el.style.display = 'block';
                  el.style.left = `${px}px`;
                  const yLift = activeCloseIslandIds.has(isl.id)
                    ? camDist < 6.85
                      ? 84
                      : 60
                    : camDist < 9.5
                      ? 30
                      : 18;
                  el.style.top = `${Math.max(44, py - yLift)}px`;
                  el.style.color = isSelected ? '#fde047' : '#ffffff';
                  el.style.fontSize = camDist < 9.0 ? '13px' : '11.5px';
                  continue;
                }
              }
            }
          }
          el.style.display = 'none';
        }
      } else {
        islandLabelEls.forEach((el) => {
          el.style.display = 'none';
        });
      }

      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    };

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }
    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      controls.dispose();
      disposeQueue.forEach((item) => item.dispose());
      renderer.dispose();
      if (renderer.domElement.parentElement === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div className="relative w-full h-full overflow-hidden">
      <div
        ref={mountRef}
        data-testid="globe-canvas-mount"
        className="w-full h-full cursor-grab active:cursor-grabbing"
      />
      <div
        ref={interiorLabelLayerRef}
        data-testid="globe-interior-labels"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      />
      <div
        ref={labelLayerRef}
        className="pointer-events-none absolute inset-0 overflow-hidden"
      />
    </div>
  );
};
