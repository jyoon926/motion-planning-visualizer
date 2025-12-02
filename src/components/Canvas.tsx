import { useEffect, useRef } from 'react';
import { useStore } from '../utils/store';
import type { HoveredPoint, Point, SpecialPoint } from '../utils/types';

const POINT_RADIUS = 5;
const HOVER_RADIUS = 10;
const SPECIAL_POINT_RADIUS = 12;

const hexToRgba = (hex: string, alpha: number) => {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const ACCENTS = {
  blue: '#155dfc',
  amber: '#f89c0b',
  green: '#00a63e',
  red: '#ef4444',
};

const GRAY = {
  50: '#fafafa',
  100: '#f7f7f7',
  200: '#efefef',
  300: '#d9d9d9',
  400: '#bfbfbf',
  500: '#8c8c8c',
  700: '#4d4d4d',
  900: '#111111',
};

const THEME = {
  poly: {
    fill: hexToRgba(GRAY[700], 0.1),
    stroke: GRAY[500],
    hover: ACCENTS.blue,
    delete: ACCENTS.red,
    deleteFill: hexToRgba(ACCENTS.red, 0.12),
  },
  active: {
    line: ACCENTS.blue,
    check: ACCENTS.amber,
    valid: ACCENTS.green,
    invalid: ACCENTS.red,
  },
  graph: {
    edge: GRAY[300],
    node: GRAY[500],
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

const drawPath = (ctx: CanvasRenderingContext2D, path: Point[], color: string, isDashed: boolean = false) => {
  if (path && path.length > 1) {
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;
    ctx.lineWidth = 4;
    ctx.strokeStyle = color;
    if (isDashed) ctx.setLineDash([10, 5]);

    ctx.beginPath();
    ctx.moveTo(path[0].x, path[0].y);
    for (let i = 1; i < path.length; i++) ctx.lineTo(path[i].x, path[i].y);
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.shadowBlur = 0;
  }
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
    algorithm,
    finalVisStep,
    finalVoronoiStep,
  } = state;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      const { width, height } = entry.contentRect;

      if (Math.abs(canvasSize.width - width) > 1 || Math.abs(canvasSize.height - height) > 1) {
        state.setCanvasSize({ width, height });
      }
    });

    observer.observe(container);

    return () => observer.unobserve(container);
  }, [state, canvasSize.width, canvasSize.height]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle device pixel ratio for high DPI displays
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvasSize.width * dpr;
    canvas.height = canvasSize.height * dpr;
    canvas.style.width = canvasSize.width + 'px';
    canvas.style.height = canvasSize.height + 'px';
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, canvasSize.width, canvasSize.height);

    // Draw Obstacle Polygons
    polygons.forEach((poly, polyIdx) => {
      const isHovered = hoveredPolygon?.polygonIdx === polyIdx && hoveredPolygon.type === 'body';
      const isDeleteMode = mode === 'delete';

      ctx.beginPath();
      ctx.moveTo(poly[0].x, poly[0].y);
      for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i].x, poly[i].y);
      ctx.closePath();

      if (isDeleteMode && isHovered) ctx.fillStyle = THEME.poly.deleteFill;
      else ctx.fillStyle = THEME.poly.fill;
      ctx.fill();

      ctx.lineWidth = 2;
      if (isDeleteMode && isHovered) ctx.strokeStyle = THEME.poly.delete;
      else if (isHovered) ctx.strokeStyle = THEME.poly.hover;
      else ctx.strokeStyle = THEME.poly.stroke;
      ctx.stroke();

      // Draw Polygon Vertices
      poly.forEach((pt, ptIdx) => {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, POINT_RADIUS, 0, Math.PI * 2);
        const isPointHovered = hoveredPoint?.polygonIdx === polyIdx && hoveredPoint.pointIdx === ptIdx;

        if (isDeleteMode && isPointHovered) ctx.fillStyle = THEME.poly.delete;
        else if (isPointHovered || isHovered) ctx.fillStyle = THEME.poly.hover;
        else ctx.fillStyle = GRAY[500];

        ctx.fill();
      });
    });

    // Draw Final Paths for Comparison Mode
    if (algorithm === 'compare') {
      if (finalVoronoiStep?.path) {
        drawPath(ctx, finalVoronoiStep.path, THEME.active.line, false);
      }
      if (finalVisStep?.path) {
        drawPath(ctx, finalVisStep.path, THEME.active.valid, false);
      }
    }
    // Draw Algorithm Visualization Steps
    else if (currentStep >= 0 && currentStep < timeline.length) {
      const step = timeline[currentStep];

      // Draw Graph Edges
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

      // Draw Graph Vertices/Nodes
      if (step.vertices) {
        ctx.fillStyle = THEME.graph.node;
        step.vertices.forEach((v) => {
          ctx.beginPath();
          ctx.arc(v.x, v.y, 3, 0, Math.PI * 2);
          ctx.fill();
        });
      }

      // Draw Scan Line (e.g., in Visibility Graph)
      if (step.scanLine) {
        const [p1, p2] = step.scanLine;
        ctx.setLineDash([5, 5]);
        ctx.lineWidth = 2;
        ctx.strokeStyle = step.activeState === 'invalid' ? THEME.active.invalid : THEME.active.check;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Draw Active Edge being processed
      if (step.activeEdge) {
        const [p1, p2] = step.activeEdge;
        ctx.lineWidth = 3;
        ctx.strokeStyle = THEME.active.valid;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }

      // Draw Active Node being processed
      if (step.activeNode) {
        ctx.beginPath();
        ctx.arc(step.activeNode.x, step.activeNode.y, 8, 0, Math.PI * 2);
        ctx.fillStyle = hexToRgba(ACCENTS.blue, 0.3);
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = ACCENTS.blue;
        ctx.stroke();
      }

      // Draw Final/Current Path
      if (step.path && step.path.length > 1) {
        ctx.shadowColor = hexToRgba(ACCENTS.green, 0.5);
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

    // Draw Polygon under construction
    if (!isComplete && currentPoints.length > 0) {
      ctx.strokeStyle = GRAY[500];
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(currentPoints[0].x, currentPoints[0].y);
      for (let i = 1; i < currentPoints.length; i++) ctx.lineTo(currentPoints[i].x, currentPoints[i].y);
      ctx.stroke();

      if (mousePos) {
        ctx.strokeStyle = ACCENTS.blue;
        ctx.beginPath();
        ctx.moveTo(currentPoints[currentPoints.length - 1].x, currentPoints[currentPoints.length - 1].y);
        ctx.lineTo(mousePos.x, mousePos.y);
        ctx.stroke();

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

      // Draw Vertices of the polygon under construction
      currentPoints.forEach((pt, idx) => {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, POINT_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = idx === 0 ? ACCENTS.blue : GRAY[500];
        ctx.fill();
      });
    }

    // Helper function to draw Start and Goal points
    const drawSpecial = (pt: Point, label: string, color: string, isHovered: boolean) => {
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, SPECIAL_POINT_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();

      ctx.lineWidth = 3;
      ctx.strokeStyle = isHovered ? '#ffffff' : 'rgba(255,255,255,0.8)';
      ctx.stroke();

      ctx.fillStyle = 'white';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, pt.x, pt.y);
    };

    // Draw Start Point
    drawSpecial(startPoint, 'S', ACCENTS.green, hoveredSpecialPoint === 'start');
    // Draw Goal Point
    drawSpecial(goalPoint, 'G', ACCENTS.amber, hoveredSpecialPoint === 'goal');
  });

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

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getMousePos(e);
    state.setHasDragged(false);

    const specialPt = getSpecialPointAtPosition(pos);
    if (specialPt) {
      state.setDraggedSpecialPoint(specialPt);
      const pt = specialPt === 'start' ? startPoint : goalPoint;
      state.setDragOffset({ x: pos.x - pt.x, y: pos.y - pt.y });
      state.setCursor('grabbing');
      return;
    }

    const point = getPointAtPosition(pos);
    if (mode === 'edit' || mode === 'delete') {
      if (point !== null) {
        state.setDraggedPoint(point);
        state.setDragOffset({
          x: pos.x - polygons[point.polygonIdx][point.pointIdx].x,
          y: pos.y - polygons[point.polygonIdx][point.pointIdx].y,
        });
        state.setCursor('grabbing');
      } else {
        const polyIdx = getPolygonAtPosition(pos);
        if (polyIdx !== null && mode === 'edit') {
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

    const specialPt = getSpecialPointAtPosition(pos);
    state.setHoveredSpecialPoint(specialPt);
    if (specialPt) {
      state.setCursor('grab');
      state.setHoveredPoint(null);
      state.setHoveredPolygon(null);
      tip = specialPt === 'start' ? 'Start Point' : 'Goal Point';
    } else {
      const point = getPointAtPosition(pos);
      state.setHoveredPoint(point);

      if (point) {
        state.setCursor(mode === 'edit' ? 'grab' : 'pointer');
        state.setHoveredPolygon(null);
        tip = mode === 'delete' ? 'Click to delete obstacle vertex' : 'Drag to move obstacle vertex';
      } else {
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

    if (!tip && currentStep >= 0 && currentStep < timeline.length) {
      const step = timeline[currentStep];

      // Check hover on final path
      if (step.path && step.path.length > 1) {
        for (let i = 0; i < step.path.length - 1; i++) {
          if (distToSegment(pos, step.path[i], step.path[i + 1]) < 10) {
            tip = 'Final Path';
            break;
          }
        }
      }

      // Check hover on path points
      if (!tip && step.path) {
        for (const pt of step.path) {
          if (dist(pos, pt) < 8) {
            tip = 'Path Point';
            break;
          }
        }
      }

      // Check hover on active edge (being verified)
      if (!tip && step.activeEdge) {
        if (distToSegment(pos, step.activeEdge[0], step.activeEdge[1]) < 8) {
          tip = step.activeState === 'valid' ? 'Valid Edge' : 'Invalid Edge';
        }
      }

      // Check hover on scan line (visibility check in progress)
      if (!tip && step.scanLine) {
        if (distToSegment(pos, step.scanLine[0], step.scanLine[1]) < 8) {
          tip = step.activeState === 'invalid' ? 'Invalid Edge' : 'Visibility Check';
        }
      }

      // Check hover on graph edges (computed edges)
      if (!tip && step.edges) {
        for (const [p1, p2] of step.edges) {
          if (distToSegment(pos, p1, p2) < 6) {
            tip = 'Graph Edge';
            break;
          }
        }
      }

      // Check hover on graph vertices
      if (!tip && step.vertices) {
        for (let i = 0; i < step.vertices.length; i++) {
          if (dist(pos, step.vertices[i]) < 8) {
            tip = `Vertex ${i}`;
            break;
          }
        }
      }

      // Check hover on active node (being processed in pathfinding)
      if (!tip && step.activeNode && dist(pos, step.activeNode) < 10) {
        tip = 'Active Node';
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
      if (point !== null) {
        const newPolygons = [...polygons];
        newPolygons[point.polygonIdx].splice(point.pointIdx, 1);
        if (newPolygons[point.polygonIdx].length < 3) {
          newPolygons.splice(point.polygonIdx, 1);
        }
        state.setPolygons(newPolygons);
        return;
      }
      const polyIdx = getPolygonAtPosition(pos);
      if (polyIdx !== null) {
        state.setPolygons(polygons.filter((_, idx) => idx !== polyIdx));
        return;
      }
    }

    if (mode === 'edit') {
      if (currentPoints.length > 2) {
        const d = dist(pos, currentPoints[0]);
        if (d < HOVER_RADIUS) {
          state.setPolygons([...polygons, currentPoints]);
          state.setCurrentPoints([]);
          state.setIsComplete(true);
          return;
        }
      }

      if (isComplete) {
        state.setCurrentPoints([pos]);
        state.setIsComplete(false);
      } else {
        state.setCurrentPoints([...currentPoints, pos]);
      }
    }
  };

  return (
    <div ref={containerRef} className="pr-4 relative w-full flex-1 disable-selection">
      <canvas
        ref={canvasRef}
        className="w-full h-full block touch-none border border-black/10 bg-black/5 rounded-xl"
        style={{ cursor }}
        width={canvasSize.width}
        height={canvasSize.height}
        onClick={handleClick}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      />

      {canvasTooltip && mousePos && (
        <div
          className="absolute pointer-events-none z-50 backdrop-blur-xs bg-black/70 text-white text-xs px-2 py-1.5 rounded shadow-lg transform translate-x-4 translate-y-4 whitespace-nowrap"
          style={{ left: mousePos.x, top: mousePos.y }}
        >
          {canvasTooltip}
        </div>
      )}
    </div>
  );
}