import type { AlgorithmStep, Point } from '../components/CanvasComponent'

function computeVoronoi(start: Point, goal: Point, obstacles: Point[][]): AlgorithmStep[] {
  const timeline: AlgorithmStep[] = []
  const vertices: Point[] = []
  const edges: [Point, Point][] = []
  const path: Point[] = []

  const update = (message: string) => {
    timeline.push({ message, vertices: [...vertices], edges: [...edges], path: [...path] })
  }

  update('Starting voronoi path computation...')

  // TODO: Replace with actual voronoi algorithm
  console.log(start, goal, obstacles)

  path.push(start, goal)
  update('Adding path...')

  update('Done!')

  return timeline
}

export { computeVoronoi }
