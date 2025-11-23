// utils/geometry.ts
import type { Point } from './types';

export function expandPolygon(poly: Point[], margin: number): Point[] {
  if (margin === 0) return poly;
  if (poly.length < 3) return poly;

  const result: Point[] = [];

  // 1. Calculate signed area to determine winding order (CCW vs CW)
  let area = 0;
  for (let i = 0; i < poly.length; i++) {
    const j = (i + 1) % poly.length;
    area += (poly[j].x - poly[i].x) * (poly[j].y + poly[i].y);
  }
  const isCCW = area < 0; // Canvas coords: y increases downwards

  for (let i = 0; i < poly.length; i++) {
    const prev = poly[(i - 1 + poly.length) % poly.length];
    const curr = poly[i];
    const next = poly[(i + 1) % poly.length];

    // Edge vectors
    const v1 = { x: curr.x - prev.x, y: curr.y - prev.y };
    const v2 = { x: next.x - curr.x, y: next.y - curr.y };

    // Normalize
    const l1 = Math.hypot(v1.x, v1.y);
    const l2 = Math.hypot(v2.x, v2.y);
    const n1 = { x: v1.x / l1, y: v1.y / l1 };
    const n2 = { x: v2.x / l2, y: v2.y / l2 };

    // Normals (Perpendicular to edges)
    // For CCW (isCCW=true), the standard outward normal is (-dy, dx).
    let normal1 = { x: -n1.y, y: n1.x };
    let normal2 = { x: -n2.y, y: n2.x };

    // Flip if CW to ensure normal points outward
    if (!isCCW) {
      normal1 = { x: n1.y, y: -n1.x };
      normal2 = { x: n2.y, y: -n2.x };
    }

    // Average normal (Bisector direction)
    let bisector = { x: normal1.x + normal2.x, y: normal1.y + normal2.y };
    const bLen = Math.hypot(bisector.x, bisector.y);

    // Miter limit logic (scale factor for sharp corners)
    const dot = normal1.x * normal2.x + normal1.y * normal2.y;
    // k is the length multiplier for miter joints
    const k = Math.sqrt(2 / (1 + dot));

    const dist = margin;

    if (bLen > 0) {
      // --- FIX: Invert the final offset direction ---
      // The previous logic resulted in shrinking, so we flip the displacement sign.
      const scaleFactor = dist * k * -1;

      result.push({
        x: curr.x + (bisector.x / bLen) * scaleFactor,
        y: curr.y + (bisector.y / bLen) * scaleFactor,
      });
    } else {
      result.push(curr);
    }
  }
  return result;
}
