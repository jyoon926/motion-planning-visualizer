import type { AlgorithmStep, Point } from '../components/CanvasComponent'

type SamplePoint = {
  startPoint: Point,
  dx: number,
  dy: number,
  endPoint: Point
}

// The "main" function of finding the voronoi path
function computeVoronoi(start: Point, goal: Point, obstacles: Point[][]): AlgorithmStep[] {
  const timeline: AlgorithmStep[] = []
  const vertices: Point[] = []
  const edges: [Point, Point][] = []
  const path: Point[] = []

  const update = (message: string) => {
    timeline.push({ message, vertices: [...vertices], edges: [...edges], path: [...path] })
  }

  update('Starting voronoi path computation...')
  console.log(start, goal, obstacles)

  // Test Point for debug
  const debugPoint: Point = {
    x: 300,
    y: 300
  }

  // Set boundary limit to where lines can be drawn
  const margin = 100
  let allPoints = [start, goal, ...obstacles.flat()]
  let minX = Math.min(...allPoints.map(p => p.x)) - margin;
  let maxX = Math.max(...allPoints.map(p => p.x)) + margin;
  let minY = Math.min(...allPoints.map(p => p.y)) - margin;
  let maxY = Math.max(...allPoints.map(p => p.y)) + margin;
  let boundaryData = [minX, maxX, minY, maxY]

  // Given the obstacles, find all existing edges
  const obstacleEdges: {
    a: Point,
    b: Point,
    samplePoints: SamplePoint[],
    rayDirection: number    // 0 is positive, 1 is negative
  }[] = []

  for (let oi = 0; oi < obstacles.length; oi++) {
    const polygon = obstacles[oi]
    if (!polygon || polygon.length < 2) continue
    const polygonWinding = getPolygonWinding(polygon)
    for (let i = 0; i < polygon.length; i++) {
      const a = polygon[i]
      const b = polygon[(i + 1) % polygon.length]
      const direction = getRayDirection(polygonWinding, a, b)
      obstacleEdges.push({ a, b, samplePoints: [], rayDirection: direction })
      update("Finding obstacle edges...")
    }
  }

  // Distance between sampled points on edges
  const sampleSpacing = 5;

  // Get all sampled points from certain edge
  for (let i = 0; i < obstacleEdges.length; i++) {
    const currEdge = obstacleEdges[i]
    const samplePoints = sampleEdge(currEdge.a, currEdge.b, sampleSpacing)

    const dx = currEdge.b.x - currEdge.a.x
    const dy = currEdge.b.y - currEdge.a.y

    // The two options for direction of the rays
    const p1 = { x: -dy, y: dx }; // 90° one way
    const p2 = { x: dy,  y: -dx }; // 90° the other way

    for (let j = 0; j < samplePoints.length; j++) {
      const currSamplePoint = samplePoints[j]
      const wantUp = currEdge.rayDirection === 0

      // Choose the perpendicular whose y matches the desired sign
      let chosen = p1;
      if (wantUp) {
        if (p1.y > 0) chosen = p1;
        else if (p2.y > 0) chosen = p2;
        else {
          chosen = p2;
        }
      } else { // want down
        if (p1.y < 0) chosen = p1;
        else if (p2.y < 0) chosen = p2;
        else {
          chosen = p1;
        }
      }

      // Normalize and scale to ray length
      const len = Math.hypot(chosen.x, chosen.y);

      // Unit vector
      const ux = chosen.x / len;
      const uy = chosen.y / len;

      const rayEnd: Point = {
        x: currSamplePoint.x + ux * sampleSpacing,
        y: currSamplePoint.y + uy * sampleSpacing,
      };

      let newSamplePoint: SamplePoint = {
        startPoint: currSamplePoint,
        dx: ux,
        dy: uy,
        endPoint: rayEnd
      }
      currEdge.samplePoints.push(newSamplePoint)

      vertices.push(newSamplePoint.startPoint)
      edges.push([newSamplePoint.startPoint, newSamplePoint.endPoint]);
      update("Creating sample points and respective rays...");
    }
  }

  // Now that the rays have been created, we will grow them until they hit another ray
  // This intresection is where the boundaries will be

  // This contains all rays that were created
  let allRays: SamplePoint[] = []

  // This contains all rays that have not been intersected yet
  let stillMovingRays: SamplePoint[] = []

  // This contains a list of all the intersect points
  let boundaryPoints: Point[] = []

  for (let i = 0; i < obstacleEdges.length; i++) {
    const currObstacle = obstacleEdges[i]
    for (let j = 0; j < currObstacle.samplePoints.length; j++) {
      allRays.push(currObstacle.samplePoints[j])
      stillMovingRays.push(currObstacle.samplePoints[j])
    }
  }

  // Now, check if any of the rays are already interesecting each other
  // returnData[0] is an array of all the new intersect points
  // returnData[1] is an array of all the ray indexes that can be removed from stillMovingRays
  let returnData = checkIntersections(allRays, stillMovingRays, boundaryData)

  for (let i = 0; i < returnData[0].length; i++) {
    boundaryPoints.push(returnData[0][i])
    vertices.push(returnData[0][i])
    update("Finding where rays intersect...")
  }
  for (let i = 0; i < returnData[1].length; i++) {
    stillMovingRays.splice(returnData[1][i], 1)
  }

  // Now, repeat this effect after increasing the size of each ray by sampleSpacing

  while(stillMovingRays.length > 0) {
    for (let i = 0; i < stillMovingRays.length; i++) {
      let currRay = stillMovingRays[i]
      currRay.endPoint.x += (currRay.dx * sampleSpacing)
      currRay.endPoint.y += (currRay.dy * sampleSpacing)
      stillMovingRays[i] = currRay
    }

    let returnData = checkIntersections(allRays, stillMovingRays, boundaryData)
    for (let i = 0; i < returnData[0].length; i++) {
      boundaryPoints.push(returnData[0][i])
      vertices.push(returnData[0][i])
      update("Finding where rays intersect...")
    }
    for (let i = 0; i < returnData[1].length; i++) {
      stillMovingRays.splice(returnData[1][i], 1)
    }
  }

  return timeline
}

// Get a sample of points on a given edge AB
function sampleEdge(a: Point, b: Point, step: number): Point[] {
  const length = Math.hypot(b.x - a.x, b.y - a.y)
  const n = Math.max(2, Math.ceil(length / step))
  const points: Point[] = []

   for (let i = 0; i <= n; i++) {
    const t = i / n
    points.push({
      x: a.x + t * (b.x - a.x),
      y: a.y + t * (b.y - a.y)
    })
  }
  return points
}

// Get the winding direction of a polygon (CW or CCW)
function getPolygonWinding(points: Point[]): string {
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    area += (a.x * b.y - b.x * a.y);
  }
  if (area > 0) return "CCW"
  else return "CW"
}

// Get if a ray off the edge of an object should be in the positive or negative y direction
// If perfectly vertical line, treat moving right as postive and left as negative
function getRayDirection(winding: string, a: Point, b: Point): number {
  const change_x = b.x - a.x
  if (winding === "CCW") {
    if (change_x > 0) return 1
    else return 0
  }
  else {
    if (change_x > 0) return 0
    else return 1
  }
}

// Returns an array of arrays, where the first sub-array is an array of all the intersect points
// and the second is an array of all the ray indexes that can be removed from stillMovingRays
function checkIntersections(allRays: SamplePoint[], raysToCheck: SamplePoint[], boundaryData: number[]): [Point[], number[]] {
  let foundIntersections: Point[] = []
  let indexesToRemove: number[] = []

  for (let i = raysToCheck.length - 1; i >= 0; i--) {
    const currRay = raysToCheck[i]

    // Check if ray has grown outisde boundary
    if (currRay.endPoint.x < boundaryData[0] ||
        currRay.endPoint.x > boundaryData[1] ||
        currRay.endPoint.y < boundaryData[2] ||
        currRay.endPoint.y > boundaryData[3]) {
      currRay.endPoint.x = Math.min(Math.max(currRay.endPoint.x, boundaryData[0]), boundaryData[1])
      currRay.endPoint.y = Math.min(Math.max(currRay.endPoint.y, boundaryData[2]), boundaryData[3])
      foundIntersections.push(currRay.endPoint)
      indexesToRemove.push(i)
    }

    for (let j = 0; j < allRays.length; j++) {
      const possibleIntersectRay = allRays[j]
      // Skip if the ray to check is the same as the current ray
      if (currRay.startPoint.x === possibleIntersectRay.startPoint.x &&
          currRay.startPoint.y === possibleIntersectRay.startPoint.y) {
        continue
      }
      
      // Check for intersection of the rays
      // intersectReturn[0] is True if they intersect
      // intersectReturn[1] is the Point where they intersect if they do
      const intersectReturn = intersects(currRay, possibleIntersectRay)
      if (intersectReturn[0]) {
        foundIntersections.push(intersectReturn[1])
        indexesToRemove.push(i)
        break
      }
    }
  }

  return [foundIntersections, indexesToRemove]
}

// Determine if line segments/rays intersect
function intersects(lineOne: SamplePoint, lineTwo: SamplePoint): any {
  const p = lineOne.startPoint
  const p2 = lineOne.endPoint
  const q = lineTwo.startPoint
  const q2 = lineTwo.endPoint

  const r = {x: p2.x - p.x, y: p2.y - p.y}
  const s = {x: q2.x - q.x, y: q2.y - q.y}

  const denom = r.x * s.y - r.y * s.x

  // Lines are parallel or collinear
  if (denom === 0) return [false]

  const t = ((q.x - p.x) * s.y - (q.y - p.y) * s.x) / denom
  const u = ((q.x - p.x) * r.y - (q.y - p.y) * r.x) / denom

  // Check if intersection occurs within both line segments
  if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
    const intersection: Point = {
      x: p.x + t * r.x,
      y: p.y + t * r.y,
    };
    return [true, intersection]
  }

  // Intersection is outside of the segments
  return [false]
}


export { computeVoronoi }
