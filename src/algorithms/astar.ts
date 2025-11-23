import { getKeyString, heuristic } from '../utils/common';
import type { Point } from '../utils/types';

interface StarNode {
  pnt: Point;
  f: number;
  g: number;
  h: number;
  parent: Point;
}

export function runAStar(start: Point, goal: Point, graph: Map<string, Point[]>): Point[] {
  if (graph.size < 2) return [];

  const open = new Map<string, StarNode>();
  const closed = new Map<string, StarNode>();

  open.set(getKeyString(start), {
    pnt: start,
    f: 0,
    g: 0,
    h: heuristic(start, goal),
    parent: start,
  });

  // Removed detailed loop emissions. Just calculate.
  while (open.size > 0) {
    let lowestF = Infinity;
    let current: StarNode | null = null;
    let currentKey = '';

    for (const [key, node] of open.entries()) {
      if (node.f < lowestF) {
        lowestF = node.f;
        current = node;
        currentKey = key;
      }
    }

    if (!current) break;

    if (getKeyString(current.pnt) === getKeyString(goal)) {
      return constructPath(current, closed);
    }

    open.delete(currentKey);
    closed.set(currentKey, current);

    const neighbors = graph.get(currentKey) || [];

    for (const neighbor of neighbors) {
      const neighborKey = getKeyString(neighbor);
      if (closed.has(neighborKey)) continue;

      const tentativeG = current.g + heuristic(current.pnt, neighbor);
      const existingNode = open.get(neighborKey);

      if (!existingNode || tentativeG < existingNode.g) {
        open.set(neighborKey, {
          pnt: neighbor,
          f: tentativeG + heuristic(neighbor, goal),
          g: tentativeG,
          h: heuristic(neighbor, goal),
          parent: current.pnt,
        });
      }
    }
  }

  return [];
}

function constructPath(current: StarNode, closed: Map<string, StarNode>): Point[] {
  const path: Point[] = [];
  let curr = current;
  let safety = 0;
  while (safety++ < 10000) {
    path.push(curr.pnt);
    if (getKeyString(curr.parent) === getKeyString(curr.pnt)) return path.reverse();
    const parent = closed.get(getKeyString(curr.parent));
    if (!parent) break;
    curr = parent;
  }
  return path.reverse();
}
