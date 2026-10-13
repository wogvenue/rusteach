// Pure layout for the journey map: regions stacked top to bottom, module nodes on a serpentine
// road. All coordinates are in canvas pixels (x from the canvas' left edge, y from its top).
import { modulesOfTier, tiers } from '../../../lib/content';
import type { Module, Tier } from '../../../types/content';

export const NODE = 84; // node diameter
export const GAP_Y = 150; // vertical distance between consecutive nodes of a region
export const BANNER_TOP = 18; // banner offset inside its band
export const BANNER_H = 140;
export const FIRST_NODE = BANNER_TOP + BANNER_H + 86; // band top -> first node center
export const BAND_TAIL = 96; // last node center -> band bottom
export const EMPTY_BODY = 132; // body height of a region whose modules are not available yet
export const TERMINUS_GAP = 132;
export const LABEL_W = 232;

/** Horizontal offsets (multiples of the amplitude) along the road. */
const WAVE = [0, 1, 0, -1];

export interface NodeLayout {
  module: Module;
  tier: Tier;
  k: number; // global index along the road
  x: number;
  y: number;
  /** Which side of the node its label sits on (the other side is free for Ferris). */
  labelSide: 'left' | 'right';
  /** Gap between node and label, and the label width that still fits inside the canvas (phones). */
  labelGap: number;
  labelW: number;
}

export interface BandLayout {
  tier: Tier;
  index: number; // 1-based region number
  top: number;
  bottom: number;
  nodes: NodeLayout[];
  /** Center y of the "coming soon" placeholder for regions without modules. */
  emptyY?: number;
}

export interface MapLayout {
  width: number;
  height: number;
  center: number;
  amp: number;
  bands: BandLayout[];
  nodes: NodeLayout[];
  terminus: { x: number; y: number };
}

export function computeLayout(width: number): MapLayout {
  const center = width / 2;
  const amp = Math.max(96, Math.min(190, width * 0.26));
  const bands: BandLayout[] = [];
  const nodes: NodeLayout[] = [];
  let y = 0;
  let k = 0;

  tiers.forEach((tier, ti) => {
    const ms = modulesOfTier(tier.id);
    const top = y;
    const band: BandLayout = { tier, index: ti + 1, top, bottom: top, nodes: [] };
    if (!ms.length) {
      band.emptyY = top + BANNER_TOP + BANNER_H + EMPTY_BODY / 2 + 8;
      band.bottom = top + BANNER_TOP + BANNER_H + EMPTY_BODY;
    } else {
      ms.forEach((module, i) => {
        const w = WAVE[k % 4];
        const next = WAVE[(k + 1) % 4];
        const labelSide: 'left' | 'right' = w > 0 ? 'left' : w < 0 ? 'right' : next > 0 ? 'left' : 'right';
        const x = center + w * amp;
        const labelGap = width < 560 ? 12 : 20;
        const room = labelSide === 'left' ? x - NODE / 2 - labelGap : width - (x + NODE / 2 + labelGap);
        const labelW = Math.min(LABEL_W, room);
        const node: NodeLayout = { module, tier, k, x, y: top + FIRST_NODE + i * GAP_Y, labelSide, labelGap, labelW };
        band.nodes.push(node);
        nodes.push(node);
        k++;
      });
      band.bottom = band.nodes[band.nodes.length - 1].y + BAND_TAIL;
    }
    bands.push(band);
    y = band.bottom;
  });

  const terminus = { x: center, y: y + TERMINUS_GAP };
  return { width, height: terminus.y + 150, center, amp, bands, nodes, terminus };
}

/** Smooth S-curve between two road points. */
export function segmentPath(a: { x: number; y: number }, b: { x: number; y: number }): string {
  const dy = b.y - a.y;
  return `M${a.x} ${a.y} C${a.x} ${a.y + dy * 0.5} ${b.x} ${b.y - dy * 0.5} ${b.x} ${b.y}`;
}
