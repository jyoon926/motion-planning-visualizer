import { useEffect, useRef } from 'react';
import { useStore } from '../utils/store';
import type { HoveredPoint, Point, SpecialPoint } from '../utils/types';

const POINT_RADIUS = 5;
const HOVER_RADIUS = 10;
const SPECIAL_POINT_RADIUS = 12;

const THEME = {
  poly: {
    fill: 'rgba(148, 163, 184, 0.2)',
    stroke: '#94a3b8',
    hover: '#3b82f6',
    delete: '#ef4444',
    deleteFill: 'rgba(239, 68, 68, 0.2)',
  },
  active: {
    line: '#3b82f6',
    check: '#f59e0b',
    valid: '#10b981',
    invalid: '#ef4444',
  },
  graph: {
    edge: 'rgba(203, 213, 225, 1)',
    node: '#94a3b8',
  },
};

const dist = (p1: Point, p2: Point) => Math.hypot(p1.x - p2.x, p1.y - p2.y);

const distToSegment = (p: Point, v: Point, w: Point) => {
  const l2 = dist(v, w) ** 2;
  if (l2 === 0) return dist(p, v);
  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  return dist(p, { x: v.x + t * (w.x - v.x), y: v.y + t * (w.y - v.y) });
};

export default function Canvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const state = useStore();
  const {
    polygons,
    currentPoints,
    isComplete,
    startPoint,
    goalPoint,
    mode,
    cursor,
    canvasSize,
    mousePos,
    hoveredPoint,
    hoveredPolygon,
    hoveredSpecialPoint,
    draggedPoint,
    draggedSpecialPoint,
    isDraggingPolygon,
    dragOffset,
    hasDragged,
    timeline,
    currentStep,
    canvasTooltip,
  } = state;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Set up the observer to watch the container div for size changes
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      const { width, height } = entry.contentRect;

      // Update the store only if the size has actually changed significantly
      if (Math.abs(canvasSize.width - width) > 1 || Math.abs(canvasSize.height - height) > 1) {
        state.setCanvasSize({ width, height });
      }
    });

    observer.observe(container);

    // Cleanup function
    return () => observer.unobserve(container);
  }, [state, canvasSize.width, canvasSize.height]);

  // Main Draw Cycle
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Apply dimensions from store to canvas element to match CSS size
    canvas.width = canvasSize.width;
    canvas.height = canvasSize.height;

    // Clear
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw Polygons (Obstacles)
    polygons.forEach((poly, polyIdx) => {
      const isHovered = hoveredPolygon?.polygonIdx === polyIdx && hoveredPolygon.type === 'body';
      const isDeleteMode = mode === 'delete';

      ctx.beginPath();
      ctx.moveTo(poly[0].x, poly[0].y);
      for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i].x, poly[i].y);
      ctx.closePath();

      // Fill
      if (isDeleteMode && isHovered) ctx.fillStyle = THEME.poly.deleteFill;
      else ctx.fillStyle = THEME.poly.fill;
      ctx.fill();

      // Stroke
      ctx.lineWidth = 2;
      if (isDeleteMode && isHovered) ctx.strokeStyle = THEME.poly.delete;
      else if (isHovered) ctx.strokeStyle = THEME.poly.hover;
      else ctx.strokeStyle = THEME.poly.stroke;
      ctx.stroke();

      // Vertices
      poly.forEach((pt, ptIdx) => {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, POINT_RADIUS, 0, Math.PI * 2);
        const isPointHovered = hoveredPoint?.polygonIdx === polyIdx && hoveredPoint.pointIdx === ptIdx;

        if (isDeleteMode && isPointHovered) ctx.fillStyle = THEME.poly.delete;
        else if (isPointHovered || isHovered) ctx.fillStyle = THEME.poly.hover;
        else ctx.fillStyle = '#64748b'; // Slate-500

        ctx.fill();
      });
    });

    // Draw Algorithm State
    if (currentStep >= 0 && currentStep < timeline.length) {
      const step = timeline[currentStep];

      // Static Graph Edges
      if (step.edges) {
        ctx.lineWidth = 1;
        ctx.strokeStyle = THEME.graph.edge;
        step.edges.forEach(([p1, p2]) => {
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
        });
      }

      // Static Graph Vertices
      if (step.vertices) {
        ctx.fillStyle = THEME.graph.node;
        step.vertices.forEach((v) => {
          ctx.beginPath();
          ctx.arc(v.x, v.y, 3, 0, Math.PI * 2);
          ctx.fill();
        });
      }

      // Active Elements

      // Scan Line (Raycasting / Checking)
      if (step.scanLine) {
        const [p1, p2] = step.scanLine;
        ctx.setLineDash([5, 5]);
        ctx.lineWidth = 2;
        ctx.strokeStyle = step.activeState === 'invalid' ? THEME.active.invalid : THEME.active.check;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
        ctx.setLineDash([]); // Reset
      }

      // Active Edge (Newly added or traversed)
      if (step.activeEdge) {
        const [p1, p2] = step.activeEdge;
        ctx.lineWidth = 3;
        ctx.strokeStyle = THEME.active.valid;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }

      // Active Node (Current A* node)
      if (step.activeNode) {
        ctx.beginPath();
        ctx.arc(step.activeNode.x, step.activeNode.y, 8, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(59, 130, 246, 0.3)';
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#3b82f6';
        ctx.stroke();
      }

      // Final Path
      if (step.path && step.path.length > 1) {
        ctx.shadowColor = 'rgba(16, 185, 129, 0.5)';
        ctx.shadowBlur = 10;
        ctx.lineWidth = 4;
        ctx.strokeStyle = THEME.active.valid;
        ctx.beginPath();
        ctx.moveTo(step.path[0].x, step.path[0].y);
        for (let i = 1; i < step.path.length; i++) ctx.lineTo(step.path[i].x, step.path[i].y);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
    }

    // Draw Current Drawing (Incomplete Polygon)
    if (!isComplete && currentPoints.length > 0) {
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(currentPoints[0].x, currentPoints[0].y);
      for (let i = 1; i < currentPoints.length; i++) ctx.lineTo(currentPoints[i].x, currentPoints[i].y);
      ctx.stroke();

      if (mousePos) {
        ctx.strokeStyle = '#3b82f6';
        ctx.beginPath();
        ctx.moveTo(currentPoints[currentPoints.length - 1].x, currentPoints[currentPoints.length - 1].y);
        ctx.lineTo(mousePos.x, mousePos.y);
        ctx.stroke();

        // Closing Hint
        if (currentPoints.length > 2) {
          const d = dist(mousePos, currentPoints[0]);
          if (d < HOVER_RADIUS) {
            ctx.beginPath();
            ctx.moveTo(currentPoints[currentPoints.length - 1].x, currentPoints[currentPoints.length - 1].y);
            ctx.lineTo(currentPoints[0].x, currentPoints[0].y);
            ctx.stroke();
          }
        }
      }

      currentPoints.forEach((pt, idx) => {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, POINT_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = idx === 0 ? '#3b82f6' : '#64748b';
        ctx.fill();
      });
    }

    // Draw Special Points (Start/Goal)
    const drawSpecial = (pt: Point, label: string, color: string, isHovered: boolean) => {
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, SPECIAL_POINT_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();

      ctx.lineWidth = 3;
      ctx.strokeStyle = isHovered ? '#ffffff' : 'rgba(255,255,255,0.8)';
      ctx.stroke();

      // Text Label
      ctx.fillStyle = 'white';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, pt.x, pt.y);
    };

    drawSpecial(startPoint, 'S', '#10B981', hoveredSpecialPoint === 'start');
    drawSpecial(goalPoint, 'G', '#F59E0B', hoveredSpecialPoint === 'goal');
  });

  // Interaction Helpers
  const getMousePos = (e: React.MouseEvent<HTMLCanvasElement>): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const getSpecialPointAtPosition = (pos: Point): SpecialPoint => {
    if (dist(pos, startPoint) < SPECIAL_POINT_RADIUS + 5) return 'start';
    if (dist(pos, goalPoint) < SPECIAL_POINT_RADIUS + 5) return 'goal';
    return null;
  };

  const getPointAtPosition = (pos: Point): HoveredPoint | null => {
    for (let i = 0; i < polygons.length; i++) {
      for (let j = 0; j < polygons[i].length; j++) {
        if (dist(pos, polygons[i][j]) < HOVER_RADIUS) return { polygonIdx: i, pointIdx: j };
      }
    }
    return null;
  };

  const isPointInPolygon = (pos: Point, poly: Point[]): boolean => {
    if (poly.length < 3) return false;
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i].x,
        yi = poly[i].y;
      const xj = poly[j].x,
        yj = poly[j].y;
      const intersect = yi > pos.y !== yj > pos.y && pos.x < ((xj - xi) * (pos.y - yi)) / (yj - yi) + xi;
      if (intersect) inside = !inside;
    }
    return inside;
  };

  const getPolygonAtPosition = (pos: Point): number | null => {
    for (let i = polygons.length - 1; i >= 0; i--) {
      if (isPointInPolygon(pos, polygons[i])) return i;
    }
    return null;
  };

  // Event Handlers

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getMousePos(e);
    state.setHasDragged(false);

    // Check Special Points
    const specialPt = getSpecialPointAtPosition(pos);
    if (specialPt) {
      state.setDraggedSpecialPoint(specialPt);
      const pt = specialPt === 'start' ? startPoint : goalPoint;
      state.setDragOffset({ x: pos.x - pt.x, y: pos.y - pt.y });
      state.setCursor('grabbing');
      return;
    }

    // Check Polygon Vertices
    const point = getPointAtPosition(pos);
    if (mode === 'edit' || mode === 'delete') {
      // Allow dragging/hovering points in delete mode too
      if (point !== null) {
        state.setDraggedPoint(point);
        state.setDragOffset({
          x: pos.x - polygons[point.polygonIdx][point.pointIdx].x,
          y: pos.y - polygons[point.polygonIdx][point.pointIdx].y,
        });
        state.setCursor('grabbing');
      } else {
        // 3. Check Polygon Bodies
        const polyIdx = getPolygonAtPosition(pos);
        if (polyIdx !== null && mode === 'edit') {
          // Only drag polygon in edit mode
          state.setIsDraggingPolygon(polyIdx);
          state.setDragOffset({ x: pos.x, y: pos.y });
          state.setCursor('grabbing');
        }
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getMousePos(e);
    state.setMousePos(pos);

    // Dragging
    if (draggedSpecialPoint !== null) {
      state.setHasDragged(true);
      const newPos = { x: pos.x - dragOffset.x, y: pos.y - dragOffset.y };
      if (draggedSpecialPoint === 'start') state.setStartPoint(newPos);
      else state.setGoalPoint(newPos);
      return;
    }

    if (draggedPoint !== null) {
      state.setHasDragged(true);
      const newPolygons = [...polygons];
      newPolygons[draggedPoint.polygonIdx][draggedPoint.pointIdx] = {
        x: pos.x - dragOffset.x,
        y: pos.y - dragOffset.y,
      };
      state.setPolygons(newPolygons);
      return;
    }

    if (isDraggingPolygon !== false) {
      state.setHasDragged(true);
      const dx = pos.x - dragOffset.x;
      const dy = pos.y - dragOffset.y;

      const newPolygons = [...polygons];
      newPolygons[isDraggingPolygon as number] = newPolygons[isDraggingPolygon as number].map((pt) => ({
        x: pt.x + dx,
        y: pt.y + dy,
      }));
      state.setPolygons(newPolygons);
      state.setDragOffset(pos);
      return;
    }

    let tip = null;

    // Hover Special Points
    const specialPt = getSpecialPointAtPosition(pos);
    state.setHoveredSpecialPoint(specialPt);
    if (specialPt) {
      state.setCursor('grab');
      state.setHoveredPoint(null);
      state.setHoveredPolygon(null);
      tip = specialPt === 'start' ? 'Start Point' : 'Goal Point';
    } else {
      // Hover Vertices
      const point = getPointAtPosition(pos);
      state.setHoveredPoint(point);

      if (point) {
        state.setCursor(mode === 'edit' ? 'grab' : 'pointer');
        state.setHoveredPolygon(null);
        tip = mode === 'delete' ? 'Click to delete obstacle vertex' : 'Drag to move obstacle vertex';
      } else {
        // Hover Polygons
        const polyIdx = getPolygonAtPosition(pos);
        if (polyIdx !== null) {
          state.setHoveredPolygon({ polygonIdx: polyIdx, type: 'body' });
          state.setCursor(mode === 'edit' || mode === 'delete' ? 'grab' : 'pointer');
          tip = mode === 'delete' ? 'Click to delete obstacle' : 'Drag to move obstacle';
        } else {
          state.setHoveredPolygon(null);
          state.setCursor('crosshair');
        }
      }
    }

    // Algorithm Visualization Tooltips
    if (!tip && currentStep >= 0 && currentStep < timeline.length) {
      const step = timeline[currentStep];

      // Check Active Node
      if (step.activeNode && dist(pos, step.activeNode) < 10) {
        tip = 'Current Node being processed';
      }
      // Check Active Edge
      else if (step.activeEdge && distToSegment(pos, step.activeEdge[0], step.activeEdge[1]) < 8) {
        tip = 'Connection being verified';
      }
    }

    state.setCanvasTooltip(tip);
  };

  const handleMouseUp = () => {
    state.setDraggedPoint(null);
    state.setDraggedSpecialPoint(null);
    state.setIsDraggingPolygon(false);
    state.setCursor(hoveredPoint || hoveredPolygon || hoveredSpecialPoint ? 'grab' : 'crosshair');
  };

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (hasDragged) return;
    const pos = getMousePos(e);
    if (getSpecialPointAtPosition(pos)) return;

    if (mode === 'delete') {
      const point = getPointAtPosition(pos);
      // Delete Vertex
      if (point !== null) {
        const newPolygons = [...polygons];
        newPolygons[point.polygonIdx].splice(point.pointIdx, 1);
        if (newPolygons[point.polygonIdx].length < 3) {
          newPolygons.splice(point.polygonIdx, 1); // Remove if too few points
        }
        state.setPolygons(newPolygons);
        return;
      }
      // Delete Polygon
      const polyIdx = getPolygonAtPosition(pos);
      if (polyIdx !== null) {
        state.setPolygons(polygons.filter((_, idx) => idx !== polyIdx));
        return;
      }
    }

    if (mode === 'edit') {
      // Closing a polygon?
      if (currentPoints.length > 2) {
        const d = dist(pos, currentPoints[0]);
        if (d < HOVER_RADIUS) {
          state.setPolygons([...polygons, currentPoints]);
          state.setCurrentPoints([]);
          state.setIsComplete(true);
          return;
        }
      }

      // Start new polygon or add point
      if (isComplete) {
        state.setCurrentPoints([pos]);
        state.setIsComplete(false);
      } else {
        state.setCurrentPoints([...currentPoints, pos]);
      }
    }
  };

  return (
    <div ref={containerRef} className="p-2 pl-0 pt-0 relative w-full flex-1 overflow-hidden disable-selection">
      <canvas
        ref={canvasRef}
        className="w-full h-full block touch-none"
        style={{ cursor }}
        width={canvasSize.width}
        height={canvasSize.height}
        onClick={handleClick}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      />

      {/* Floating Tooltip */}
      {canvasTooltip && mousePos && (
        <div
          className="absolute pointer-events-none z-50 backdrop-blur-xs bg-gray-900/70 text-white text-xs px-2 py-1.5 rounded shadow-lg transform translate-x-4 translate-y-4 whitespace-nowrap"
          style={{ left: mousePos.x, top: mousePos.y }}
        >
          {canvasTooltip}
        </div>
      )}
    </div>
  );
}
