export interface Point {
  x: number
  y: number
}

export interface Rectangle {
  id: string
  center: Point
  width: number
  height: number
  rotation: number // in degrees
}

export interface DraggablePoint {
  id: PointType
  center: Point
}

export type CursorType = 'default' | 'crosshair' | 'pointer' | 'grab'

export type PointType = 'start' | 'end'

export type InteractionMode = 'drawing' | 'moving' | 'resizing' | 'rotating' | 'idle'

export type Tool = 'edit' | 'delete'

export type Algorithm = 'visibilityGraph' | 'voronoi'

export interface InteractionState {
  mode: InteractionMode
  startPoint: Point | null
  selectedPointId: PointType | null
  selectedRectId: string | null
  dragHandle: string | null // 'body', 'top', 'right', 'bottom', 'left', 'nw', 'ne', 'sw', 'se'
}

export type PathResult = {
  fullGraph: [Point, Point][] // all edges in the full graph for visualization
  path: [Point, Point][] // the computed path from start to end
}
