import type { Point } from './types';

export function getKeyString(p: Point): string {
  return `${p.x.toFixed(2)},${p.y.toFixed(2)}`;
}

export function getEdgeKeyString(p1: Point, p2: Point): string {
  const p1_first = `${p1.x.toFixed(2)},${p1.y.toFixed(2)},${p2.x.toFixed(2)},${p2.y.toFixed(2)}`;
  const p2_first = `${p2.x.toFixed(2)},${p2.y.toFixed(2)},${p1.x.toFixed(2)},${p1.y.toFixed(2)}`;
  if (p1.x < p2.x){
    return p1_first;
  } else if (p1.x === p2.x){
    if (p1.y < p2.y){
      return p1_first;
    } else {
      return p2_first;
    }
  } else {
    return p2_first;
  }
}

export function heuristic(p1: Point, p2: Point): number {
  return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
}

export function dist(p1: Point, p2: Point): number {
  return Math.hypot(p1.x - p2.x, p1.y - p2.y);
}
