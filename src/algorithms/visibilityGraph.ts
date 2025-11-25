import { getKeyString, getEdgeKeyString } from '../utils/common';
import type { AlgorithmOutput, AlgorithmPhase, AlgorithmStep, Point } from '../utils/types';
import { runAStar } from './astar';
import { BinarySearchTree, BinarySearchTreeNode } from './bst';


interface NodeEdge {
  dist: number;
  edge: [Point, Point];
}

export function computeVisibilityGraph(
  start: Point,
  goal: Point,
  polygons: Point[][],
  canvasSize: { width: number; height: number }
): AlgorithmOutput {
  console.log(canvasSize);
  const steps: AlgorithmStep[] = [];
  const phases: AlgorithmPhase[] = [];
  const currentVertices: Point[] = [];
  const currentEdges: [Point, Point][] = [];
  let currentPath: Point[] = [];

  const addStep = (phaseId: string, message: string, extras: Partial<AlgorithmStep> = {}) => {
    steps.push({
      phaseId,
      message,
      vertices: [...currentVertices],
      edges: [...currentEdges],
      path: [...currentPath],
      ...extras,
    });
  };

  // --- PHASE 1: INIT ---
  const phase1Id = 'init';
  const startIdx1 = steps.length;

  // 1. Add Start and Goal Points
  currentVertices.push(start, goal);
  addStep(phase1Id, 'Added Start and Goal points to the set of vertices.');

  // 2. Add Obstacle Vertices
  const allObstacleVertices = polygons.flat();
  currentVertices.push(...allObstacleVertices);

  addStep(
    phase1Id,
    `Added ${allObstacleVertices.length} obstacle corner vertices. Total vertices: ${currentVertices.length}.`
  );

  // 3. Initialize graph structure
  const vgraph: Map<string, Point[]> = new Map();
  currentVertices.forEach((v) => vgraph.set(getKeyString(v), []));

  phases.push({
    id: phase1Id,
    name: 'Initialization',
    description:
      'We begin by defining the nodes (vertices) of our graph. These include the start point, the goal point, and all vertices of the obstacles.',
    pseudocode: `// 1. Define Vertices
V = {start, goal} + Vertices(obstacles)`,
    complexity: 'O(V)',
    startStepIndex: startIdx1,
    endStepIndex: steps.length - 1,
  });

  // --- PHASE 2: ADD VISIBLE EDGES ---
  const phase2Id = 'visibility';
  const startIdx2 = steps.length;

  // FAST IMPLEMENTATION: Add visible edges
  for (let p = 0; p < currentVertices.length; p++){
    findVisibleEdges(p, currentVertices, polygons).forEach((edge: [Point, Point]) => {
      currentEdges.push(edge)
      vgraph.get(getKeyString(edge[0]))?.push(edge[1]);
      vgraph.get(getKeyString(edge[1]))?.push(edge[0]);
      addStep(
        phase2Id,
        `Added edge between (${Math.round(edge[0].x)}, ${Math.round(edge[0].y)}) and (${Math.round(edge[1].x)}, ${Math.round(edge[1].y)})`,
        {activeState: 'checking'}
      );
    })
  }

  phases.push({
    id: phase2Id,
    name: 'Building Visibility Graph',
    description:
      'We construct the edges of the graph by checking the line of sight (LOS) between every pair of vertices. An edge exists if and only if the straight line segment between the two vertices does not intersect any obstacle. The intersection check uses a rotation plane sweep algorithm to check for any visible vertices from one central point to all points around it, in a clockwise order.',
    pseudocode: `For each vertice v in V:
    TODO describe rotational plane sweep algorithm`,
    complexity: 'O(e^2 log e)',
    startStepIndex: startIdx2,
    endStepIndex: steps.length - 1,
  });

/*
// SLOW IMPLEMENTATION
  const ccw = (A: Point, B: Point, C: Point): boolean => (C.y - A.y) * (B.x - A.x) > (B.y - A.y) * (C.x - A.x);
  const segmentsIntersect = (A: Point, B: Point, C: Point, D: Point): boolean =>
    ccw(A, C, D) !== ccw(B, C, D) && ccw(A, B, C) !== ccw(A, B, D);

  const isVisible = (p1: Point, p2: Point): boolean => {
    for (const polygon of polygons) {
      let selfIntersectionCounter = 0;
      for (let i = 0; i < polygon.length; i++) {
        const a = polygon[i];
        const b = polygon[(i + 1) % polygon.length];

        if (
          (a.x === p1.x && a.y === p1.y) ||
          (b.x === p1.x && b.y === p1.y) ||
          (a.x === p2.x && a.y === p2.y) ||
          (b.x === p2.x && b.y === p2.y)
        ) {
          selfIntersectionCounter++;
          continue;
        }
        if (segmentsIntersect(p1, p2, a, b)) return false;
      }
      // Check if the line segment is inside the polygon
      if (selfIntersectionCounter > 3) return false;
    }
    return true;
  };

  for (let i = 0; i < currentVertices.length; i++) {
    for (let j = i + 1; j < currentVertices.length; j++) {
      const v1 = currentVertices[i];
      const v2 = currentVertices[j];

      addStep(
        phase2Id,
        `Checking visibility between (${Math.round(v1.x)}, ${Math.round(v1.y)}) and (${Math.round(v2.x)}, ${Math.round(v2.y)})`,
        {
          scanLine: [v1, v2],
          activeState: 'checking',
        }
      );

      // TESTING
      // const orientation = (p: Point, q: Point, r: Point): number => 
      //   ((q.x * r.y) + (p.x * q.y) + (p.y * r.x)) - ((q.x * p.y) + (r.x * q.y) + (r.y * p.x)); 
      // if(vertices.length > 2){
      //   update(`orientation of start, goal, and (${vertices[2].x}, ${vertices[2].y}) is ${orientation(start, goal, vertices[2])}`);
      // }
      // END TESTING
      


      if (isVisible(v1, v2)) {
        currentEdges.push([v1, v2]);
        vgraph.get(getKeyString(v1))?.push(v2);
        vgraph.get(getKeyString(v2))?.push(v1);
       
        addStep(phase2Id, 'Line of sight is clear. Edge added.', {
          activeEdge: [v1, v2],
          activeState: 'valid',
        });
      } else {
        addStep(phase2Id, 'Line of sight blocked by obstacle.', {
          scanLine: [v1, v2],
          activeState: 'invalid',
        });
      }
    }
  }

  phases.push({
    id: phase2Id,
    name: 'Building Visibility Graph',
    description:
      'We construct the edges of the graph by checking the line of sight (LOS) between every pair of vertices. An edge exists if and only if the straight line segment between the two vertices does not intersect any obstacle. The intersection check uses the Counter-Clockwise (CCW) orientation test to determine if two line segments cross.',
    pseudocode: `For each pair of vertices (u, v) in V:
    If LOS(u, v) is clear (does not intersect any obstacle edge):
        Add edge (u, v) to G

# LOS check helper:
function SegmentsIntersect(A, B, C, D):
    return CCW(A, C, D) != CCW(B, C, D) AND CCW(A, B, C) != CCW(A, B, D)`,
    complexity: 'O(V^3)',
    startStepIndex: startIdx2,
    endStepIndex: steps.length - 1,
  });
*/

  // --- PHASE 3: PATHFINDING (A*) ---
  const phase3Id = 'astar';
  const startIdx3 = steps.length;

  const pathResult = runAStar(start, goal, vgraph);

  if (pathResult.length > 0) {
    currentPath = pathResult;
    addStep(phase3Id, 'Optimal path found!', { activeState: 'valid' });
  } else {
    addStep(phase3Id, 'No path found.', { activeState: 'invalid' });
  }

  phases.push({
    id: phase3Id,
    name: 'A* Search',
    description:
      'With the complete visibility graph built, the A* search algorithm is used to find the shortest path from the start node to the goal node. A* minimizes the total estimated cost f(n) = g(n) + h(n), where g(n) is the actual cost from the start to node n, and h(n) is the Euclidean distance (straight-line distance) from node n to the goal, serving as an admissible heuristic.',
    pseudocode: `OpenSet = {Start}
gScore[Start] = 0
fScore[Start] = h(Start, Goal)

While OpenSet is not empty:
    Current = node in OpenSet with lowest fScore
    If Current == Goal:
        Reconstruct path and return
    For each neighbor of Current in G:
        tentative_g = gScore[Current] + distance(Current, neighbor)
        If tentative_g < gScore[neighbor]:
            gScore[neighbor] = tentative_g
            fScore[neighbor] = tentative_g + h(neighbor, Goal)
            Parent[neighbor] = Current
            Add neighbor to OpenSet`,
    complexity: 'O(E log V)',
    startStepIndex: startIdx3,
    endStepIndex: steps.length - 1,
  });

  return { steps, phases };
}
   

/**
 * Find all visible edges from the current point in O(n log n) time
 * @param currP current point
 * @param vertices all vertices
 * @param polygons all polygons
 * @returns the visible edges
 */
function findVisibleEdges(currP: number, vertices: Point[], polygons: Point[][]): [Point, Point][]{
  const currPoint: Point = vertices[currP];
  const visibleEdges : [Point, Point][] = [];
  
  const distComparator = (a: NodeEdge, b: NodeEdge): number => {
    if (a.dist < b.dist) return -1;
    if (a.dist > b.dist) return 1;
    return 0;
  }
  
  const bst = new BinarySearchTree<NodeEdge>(distComparator);

  const calculateIntersection = (edge1: [Point, Point], edge2: Point[]): Point => {
    return {x: 0, y: 0}; //TODO
  }

  const calculateDistance = (p: Point): number =>{
    return Math.sqrt(Math.pow(vertices[currP].x - p.x,2) + Math.pow(vertices[currP].y - p.y,2));
  }

  const inOrderIntersection = (
    bst: BinarySearchTree<NodeEdge>, node: BinarySearchTreeNode<NodeEdge> | undefined, 
    wiMinus1: Point, wi: Point
  ): boolean => {
    if (node) {
      inOrderIntersection(bst, node.leftNode, wiMinus1, wi);
      if (segmentsIntersect(node.data.edge[0], node.data.edge[1], wiMinus1, wi)){
        return true;
      }
      inOrderIntersection(bst, node.rightNode, wiMinus1, wi);
    } else {
      return false;
    }
    return false;
  }

  // DEBUGGING Note: isVisible is the main problem (works when replaced with naive)
  const isVisible = (p: Point, w: number): boolean => {
    // if intersects interior of obstacle of which wi is vertex then return false
    const incidents = incidentEdges.get(getKeyString(vertices[w]));
    if (incidents !== undefined && incidents.length > 1){
      const wprev = incidents[0];
      const wnext = incidents[1];
      if (orientation(wprev, vertices[w], p) > 0 &&
          orientation(vertices[w], wnext, p) > 0){
        return false;
      }
    }
    
    console.log("isVisible: w=",w);
    // if wi = 1 or wi-1 is not on the segment pwi
    if (w === 1 || orientation(p, vertices[w], vertices[mod(w-1, vertices.length)]) !== 0){
      // then search bst for the edge in the leftmost leaf
      let left = bst.leftmost(bst.root)?.data
      if (left == undefined){ 
        console.log("isVisible: undefined leftmost node", bst);
        return false; 
      }
      if (left.edge == undefined){console.log("isVisible: leftmost edge undefined", left)}
      // if e exists and pwi instersects e return false
      if (segmentsIntersect(left.edge[0], left.edge[1], p, vertices[w])){
        return false;
      } else { // else return true
        return true;
      }
    } else {
      // else if wi-1 is not visible return false
      if (!isVisible(p, mod(w-1, vertices.length))){
        return false;
      // else search bst for an edge that intersects wi-1wi
      } else {
        // search bst for edge that intersects w-1,w
        if (inOrderIntersection(bst, bst.root, vertices[mod(w-1, vertices.length)], vertices[w])){
          // if edge exists, return false
          return false;
        } else {
          // else return true
          return true;
        }
      }
    }
  };
  
 //DEBUGGING Note: everything works with this naive version
 /*
  const isVisible = (p1: Point, p2: Point): boolean => {
    for (const polygon of polygons) {
      let selfIntersectionCounter = 0;
      for (let i = 0; i < polygon.length; i++) {
        const a = polygon[i];
        const b = polygon[(i + 1) % polygon.length];

        if (
          (a.x === p1.x && a.y === p1.y) ||
          (b.x === p1.x && b.y === p1.y) ||
          (a.x === p2.x && a.y === p2.y) ||
          (b.x === p2.x && b.y === p2.y)
        ) {
          selfIntersectionCounter++;
          continue;
        }
        if (segmentsIntersect(p1, p2, a, b)) return false;
      }
      // Check if the line segment is inside the polygon
      if (selfIntersectionCounter > 3) return false;
    }
    return true;
  };
  */

  const ccw = (A: Point, B: Point, C: Point): boolean => (C.y - A.y) * (B.x - A.x) > (B.y - A.y) * (C.x - A.x);

  const segmentsIntersect = (A: Point, B: Point, C: Point, D: Point): boolean =>
    ccw(A, C, D) !== ccw(B, C, D) && ccw(A, B, C) !== ccw(A, B, D);

  // cross product:  a x b = ax*by - ay*bx
  const cross = (a: Point, b: Point): number => {
    return a.x * b.y - a.y * b.x;
  }

  /**
   * Compute distance to the intersection between
   * ray: origin + dist * direction  (t ≥ 0)
   * segment: C + u * (D - C)  (0 ≤ u ≤ 1)
   */
    const intersectionDistance = (origin: Point, direction: Point, C: Point, D: Point): number | null => {
      const seg_dir = {x: D.x - C.x, y: D.y - C.y};
      const rxs = cross(direction, seg_dir);
      const qp = {x: C.x - origin.x, y: C.y - origin.y};

      //if r × s == 0, they're parallel or collinear
      if (rxs === 0) return null;

      const dist = cross(qp, seg_dir) / rxs;

      //if t >= 0 we are in front of ray origin
      if (dist < 0) return null;

      return dist;
    }


  /**
     * Returns the determinant of 3 points in order to find their orientation.
     * @return negative value for negative orientation (clockwise),
     *         positive value for positive orientation (counter-clockwise),
     *         or zero for co-linear points
     */
  // orientation(p, w/edge.p1, edge.p2): + for clockwise (insert edge), - for ccw(delete edge)
  const orientation = (p: Point, q: Point, r: Point): number => 
    ((q.x * r.y) + (p.x * q.y) + (p.y * r.x)) - ((q.x * p.y) + (r.x * q.y) + (r.y * p.x));
  
  const rayDirection = (theta: number): Point => ({x:Math.cos(theta), y:Math.sin(theta)});

  const stringToEdge = (s: string) : [Point, Point] => {
    const strs = s.split(",");
    return [{x: parseInt(strs[0]), y: parseInt(strs[1])}, {x: parseInt(strs[2]), y: parseInt(strs[3])}];
  };

  const mod = (dividend: number, divisor: number): number => {
    if (divisor === 0) { throw new Error("Cannot divide by zero");}
    return ((dividend % divisor) + divisor) % divisor;
  }

  /*
  sort all obstacle vertices according to clockwise angle that the half-line from p to each obstacles makes with the positive x-axis (use code from homework?)
  P is half-line parallel to x-aixs starting at p
  find obstacle Edges that are intersected by P and store in bst in the order of which they are intersected by P
  for each obstacle vertice:
    if Visible, add Wi to list of visible edges
    insert obstacle edges incident to Wi that lie on the clockwise side of the half-line from p to Wi into tree
     delete '' counterclockwise side of half-line from tree

  */

  // case of only start and end points to make things faster
  if (polygons.length === 0 && vertices.length === 2){
    return [[vertices[0], vertices[1]]];
  }

  // build map of all edges and their incident edges
  const allEdges : Map<string, string[]> = new Map(); // all edges by string id and incident edges
  const incidentEdges : Map<string, Point[]> = new Map();
  for (const p of polygons){
    const l = p.length;
    console.log("add edges from polygon: ", p);
    for (let i = 0; i < l; i++){
      allEdges.set(getEdgeKeyString(p[mod((i-1), l)], p[i]), [getEdgeKeyString(p[mod((i-2), l)], p[mod((i-1), l)]), getEdgeKeyString(p[i], p[mod((i+1), l)])]);
      incidentEdges.set(getKeyString(p[i]), [p[mod((i-1), l)],p[mod((i+1), l)]]);
    } 
  }

  // sort all obstacle vertices clockwise around p
  const pointAngles: [number, number][] = []
  for (let v = 0; v < vertices.length; v++){
    if (v != currP){
    pointAngles.push([v, Math.atan2(vertices[v].y - currPoint.y, vertices[v].x - currPoint.x)]);
    }
  }
  pointAngles.sort((a, b) => a[1] - b[1]);
  
  // find obstacle edges intersected by P and store in bst
  const halflineOrigin = {x:0, y:currPoint.y};
  const halfline = [halflineOrigin, currPoint];
  for (const e of allEdges.keys()){
    const currEdge = stringToEdge(e);
    if (currEdge == undefined) {console.log("line 390: stringToEdge function did not return an edge");}
    if(segmentsIntersect(currEdge[0], currEdge[1], halfline[0], halfline[1])) {
      const dir = rayDirection(0);
      const d = intersectionDistance(halflineOrigin, dir, currEdge[0], currEdge[1]);
      // insert in the order they intersect halfline (distance from origin)
      if (d !== null){
        console.log("inserting orginal edges into bst", bst)
        bst.insert({edge: currEdge, dist: d})
      }
    }
  }

  for (const w of pointAngles){
      const wi = w[0];
      const wPoint = vertices[wi];
      const wTheta = w[1];
      const dist = calculateDistance(wPoint);
      if (isVisible(currPoint, wi)){
        visibleEdges.push([currPoint, wPoint]);
        let incidents = incidentEdges.get(getKeyString(wPoint));
        if (incidents !== undefined){
          for (const p of incidents){
            let e: [Point, Point] = [wPoint, p];
            // orientation(p, w/edge.p1, edge.p2): + for clockwise (insert edge), - for ccw(delete edge)
            if (orientation(currPoint, e[0], e[1]) > 0){
              // insert edges incident to w on clockwise side of half-line
              console.log("inserting edge into bst", bst);
              bst.insert({dist: dist, edge: e})
            } else {
              // delete edges incident to w on counter-clockwise side of half-line
              console.log("removing edge from bst", bst);
              bst.delete(bst.root, {dist: dist, edge: e});
            }
          }
        }
      }
  }

  return visibleEdges;
}

/*
// Get unique key string from Point for comparison use
export function getKeyString(p: Point): string {
  return `${p.x.toFixed(5)},${p.y.toFixed(5)}`;
}

// Return lowest f value
function getLowestF(open: Map<string, StarPoint>) {
  let lowestF = -1;
  let lowest = null;
  for (const value of open.values()) {
    if (lowestF === -1 || value.f < lowestF) {
      lowestF = value.f;
      lowest = value;
    }
  }
  return lowest;
}

*/
