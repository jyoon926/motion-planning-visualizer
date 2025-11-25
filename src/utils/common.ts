import type { Point } from './types';

export function getKeyString(p: Point): string {
  return `${p.x.toFixed(2)},${p.y.toFixed(2)}`;
}

export function getEdgeKeyString(p1: Point, p2: Point): string {
  return `${p1.x.toFixed(2)},${p1.y.toFixed(2)},${p2.x.toFixed(2)},${p2.y.toFixed(2)}`;
}

export function heuristic(p1: Point, p2: Point): number {
  return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
}

export function dist(p1: Point, p2: Point): number {
  return Math.hypot(p1.x - p2.x, p1.y - p2.y);
}
