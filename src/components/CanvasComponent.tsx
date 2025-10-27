import { useCallback, useEffect, useRef, useState } from 'react';
import { computeVisibilityGraph } from '../algorithms/visibilityGraph';
import { computeVoronoi } from '../algorithms/voronoi';
import { MdDelete, MdEdit, MdPause, MdPlayArrow } from 'react-icons/md';

// MARK: Interfaces and Types

export interface Point {
  x: number;
  y: number;
}

interface HoveredPoint {
  polygonIdx: number;
  pointIdx: number;
}

interface HoveredPolygon {
  polygonIdx: number;
  type: 'body';
}

export interface AlgorithmStep {
  message: string;
  vertices?: Point[];
  edges?: [Point, Point][];
  path?: Point[];
}

type Mode = 'edit' | 'delete';
type SpecialPoint = 'start' | 'goal' | null;
type AlgorithmType = 'visibility' | 'voronoi';
interface AlgorithmInfo {
  name: string;
  algorithm: (start: Point, goal: Point, obstacles: Point[][]) => AlgorithmStep[];
}

const algorithms: Record<AlgorithmType, AlgorithmInfo> = {
  visibility: {
    name: 'Visibility Graph',
    algorithm: computeVisibilityGraph,
  },
  voronoi: {
    name: 'Voronoi',
    algorithm: computeVoronoi,
  },
};

function CanvasComponent() {
  // MARK: Refs and State
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [polygons, setPolygons] = useState<Point[][]>([]);
  const [currentPoints, setCurrentPoints] = useState<Point[]>([]);
  const [isComplete, setIsComplete] = useState<boolean>(true);
  const [hoveredPoint, setHoveredPoint] = useState<HoveredPoint | null>(null);
  const [hoveredPolygon, setHoveredPolygon] = useState<HoveredPolygon | null>(null);
  const [draggedPoint, setDraggedPoint] = useState<HoveredPoint | null>(null);
  const [dragOffset, setDragOffset] = useState<Point>({ x: 0, y: 0 });
  const [isDraggingPolygon, setIsDraggingPolygon] = useState<number | false>(false);
  const [mousePos, setMousePos] = useState<Point | null>(null);
  const [mode, setMode] = useState<Mode>('edit');
  const [cursor, setCursor] = useState<string>('crosshair');
  const [hasDragged, setHasDragged] = useState<boolean>(false);
  const [canvasSize, setCanvasSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [algorithm, setAlgorithm] = useState<AlgorithmType>('visibility');
  const [timeline, setTimeline] = useState<AlgorithmStep[]>([]);
  const [currentStep, setCurrentStep] = useState<number>(-1);
  const [live, setLive] = useState<boolean>(true);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  // Special points
  const [startPoint, setStartPoint] = useState<Point>({ x: 100, y: 200 });
  const [goalPoint, setGoalPoint] = useState<Point>({ x: 300, y: 200 });
  const [draggedSpecialPoint, setDraggedSpecialPoint] = useState<SpecialPoint>(null);
  const [hoveredSpecialPoint, setHoveredSpecialPoint] = useState<SpecialPoint>(null);

  const POINT_RADIUS = 5;
  const HOVER_RADIUS = 10;
  const SPECIAL_POINT_RADIUS = 16;

  // MARK: Use Effects

  // Handle canvas resize
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect();
        setCanvasSize({ width, height });
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const runAlgorithm = useCallback(() => {
    const steps = algorithms[algorithm].algorithm(startPoint, goalPoint, polygons);
    setTimeline(steps);
    setCurrentStep(live ? steps.length - 1 : 0);
  }, [algorithm, startPoint, goalPoint, polygons, live]);

  // Run algorithm when polygons, start, goal, or algorithm changes
  useEffect(() => {
    if (live) {
      runAlgorithm();
    } else {
      setTimeline([]);
      setCurrentStep(0);
    }
  }, [polygons, startPoint, goalPoint, algorithm, live, runAlgorithm]);

  // Handle play/pause of timeline
  useEffect(() => {
    if (!isPlaying) return;

    if (currentStep >= timeline.length - 1) {
      setIsPlaying(false);
      return;
    }

    const interval = setInterval(() => {
      setCurrentStep((prev) => {
        if (prev < timeline.length - 1) {
          return prev + 1;
        } else {
          clearInterval(interval);
          setIsPlaying(false);
          return prev;
        }
      });
    }, 100);

    return () => clearInterval(interval);
  }, [isPlaying, currentStep, timeline]);

  // MARK: Draw canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw completed polygons
    polygons.forEach((poly, polyIdx) => {
      const isHovered = hoveredPolygon?.polygonIdx === polyIdx && hoveredPolygon.type === 'body';
      const hoverColor = mode === 'delete' ? '#EF4444' : '#3B82F6';

      // Fill polygon
      ctx.fillStyle = isHovered && mode === 'delete' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(156, 163, 175, 0.4)';
      ctx.beginPath();
      ctx.moveTo(poly[0].x, poly[0].y);
      for (let i = 1; i < poly.length; i++) {
        ctx.lineTo(poly[i].x, poly[i].y);
      }
      ctx.closePath();
      ctx.fill();

      // Draw edges
      ctx.strokeStyle = isHovered ? hoverColor : '#4B5563';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(poly[0].x, poly[0].y);
      for (let i = 1; i < poly.length; i++) {
        ctx.lineTo(poly[i].x, poly[i].y);
      }
      ctx.closePath();
      ctx.stroke();

      // Draw points
      poly.forEach((pt, ptIdx) => {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, POINT_RADIUS, 0, Math.PI * 2);

        const isPointHovered = hoveredPoint?.polygonIdx === polyIdx && hoveredPoint.pointIdx === ptIdx;
        const isPolyHovered = hoveredPolygon?.polygonIdx === polyIdx;

        ctx.fillStyle = isPointHovered || isPolyHovered ? hoverColor : '#4B5563';
        ctx.fill();
      });
    });

    // Draw current polygon being drawn
    if (!isComplete && currentPoints.length > 0) {
      ctx.strokeStyle = '#4B5563';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(currentPoints[0].x, currentPoints[0].y);
      for (let i = 1; i < currentPoints.length; i++) {
        ctx.lineTo(currentPoints[i].x, currentPoints[i].y);
      }
      ctx.stroke();

      // Draw preview line to mouse position
      if (mousePos) {
        ctx.strokeStyle = '#3B82F6';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(currentPoints[currentPoints.length - 1].x, currentPoints[currentPoints.length - 1].y);
        ctx.lineTo(mousePos.x, mousePos.y);
        ctx.stroke();

        // Preview line to first point if close
        if (currentPoints.length > 2) {
          const dx = mousePos.x - currentPoints[0].x;
          const dy = mousePos.y - currentPoints[0].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < HOVER_RADIUS) {
            ctx.strokeStyle = '#3B82F6';
            ctx.beginPath();
            ctx.moveTo(currentPoints[currentPoints.length - 1].x, currentPoints[currentPoints.length - 1].y);
            ctx.lineTo(currentPoints[0].x, currentPoints[0].y);
            ctx.stroke();
          }
        }
      }

      // Draw current points
      currentPoints.forEach((pt, idx) => {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, POINT_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = idx === 0 ? '#3B82F6' : '#4B5563';
        ctx.fill();
      });
    }

    // Draw timeline step (if any)
    if (currentStep >= 0 && currentStep < timeline.length) {
      const step = timeline[currentStep];
      if (step.vertices) {
        // Draw vertices
        step.vertices.forEach((v) => {
          ctx.beginPath();
          ctx.arc(v.x, v.y, 3, 0, Math.PI * 2);
          ctx.fillStyle = '#FBBF24';
          ctx.fill();
        });
      }
      if (step.edges) {
        // Draw edges
        ctx.strokeStyle = '#FBBF2480';
        ctx.lineWidth = 1;
        step.edges.forEach(([p1, p2]) => {
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
        });
      }
      if (step.path && step.path.length > 1) {
        // Draw path
        ctx.strokeStyle = '#1447e6';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(step.path[0].x, step.path[0].y);
        for (let i = 1; i < step.path.length; i++) {
          ctx.lineTo(step.path[i].x, step.path[i].y);
        }
        ctx.stroke();
      }
    }

    // Draw start point
    ctx.beginPath();
    ctx.arc(startPoint.x, startPoint.y, SPECIAL_POINT_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = hoveredSpecialPoint === 'start' ? '#10B981' : '#059669';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Draw "S" label
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('S', startPoint.x, startPoint.y);

    // Draw goal point
    ctx.beginPath();
    ctx.arc(goalPoint.x, goalPoint.y, SPECIAL_POINT_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = hoveredSpecialPoint === 'goal' ? '#F59E0B' : '#D97706';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Draw "G" label
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('G', goalPoint.x, goalPoint.y);
  }, [
    polygons,
    currentPoints,
    isComplete,
    hoveredPoint,
    hoveredPolygon,
    mousePos,
    mode,
    startPoint,
    goalPoint,
    hoveredSpecialPoint,
    currentStep,
    live,
    timeline,
  ]);

  // MARK: Handlers/Helpers

  const getMousePos = (e: React.MouseEvent<HTMLCanvasElement>): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const getSpecialPointAtPosition = (pos: Point): SpecialPoint => {
    const startDist = Math.sqrt(Math.pow(pos.x - startPoint.x, 2) + Math.pow(pos.y - startPoint.y, 2));
    if (startDist < SPECIAL_POINT_RADIUS + 5) return 'start';

    const goalDist = Math.sqrt(Math.pow(pos.x - goalPoint.x, 2) + Math.pow(pos.y - goalPoint.y, 2));
    if (goalDist < SPECIAL_POINT_RADIUS + 5) return 'goal';

    return null;
  };

  const getPointAtPosition = (pos: Point): HoveredPoint | null => {
    for (let i = 0; i < polygons.length; i++) {
      for (let j = 0; j < polygons[i].length; j++) {
        const dx = pos.x - polygons[i][j].x;
        const dy = pos.y - polygons[i][j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < HOVER_RADIUS) {
          return { polygonIdx: i, pointIdx: j };
        }
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
      if (isPointInPolygon(pos, polygons[i])) {
        return i;
      }
    }
    return null;
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getMousePos(e);
    setHasDragged(false);

    // Check for special points first
    const specialPt = getSpecialPointAtPosition(pos);
    if (specialPt) {
      setDraggedSpecialPoint(specialPt);
      const pt = specialPt === 'start' ? startPoint : goalPoint;
      setDragOffset({
        x: pos.x - pt.x,
        y: pos.y - pt.y,
      });
      setCursor('grabbing');
      return;
    }

    const point = getPointAtPosition(pos);

    if (mode === 'edit') {
      if (point !== null) {
        setDraggedPoint(point);
        setDragOffset({
          x: pos.x - polygons[point.polygonIdx][point.pointIdx].x,
          y: pos.y - polygons[point.polygonIdx][point.pointIdx].y,
        });
        setCursor('grabbing');
      } else {
        const polyIdx = getPolygonAtPosition(pos);
        if (polyIdx !== null) {
          setIsDraggingPolygon(polyIdx);
          setDragOffset({ x: pos.x, y: pos.y });
          setCursor('grabbing');
        }
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getMousePos(e);
    setMousePos(pos);

    if (draggedSpecialPoint !== null) {
      setHasDragged(true);
      const newPos = {
        x: pos.x - dragOffset.x,
        y: pos.y - dragOffset.y,
      };
      if (draggedSpecialPoint === 'start') {
        setStartPoint(newPos);
      } else {
        setGoalPoint(newPos);
      }
    } else if (draggedPoint !== null) {
      setHasDragged(true);
      const newPolygons = [...polygons];
      newPolygons[draggedPoint.polygonIdx][draggedPoint.pointIdx] = {
        x: pos.x - dragOffset.x,
        y: pos.y - dragOffset.y,
      };
      setPolygons(newPolygons);
    } else if (isDraggingPolygon !== false) {
      setHasDragged(true);
      const dx = pos.x - dragOffset.x;
      const dy = pos.y - dragOffset.y;
      const newPolygons = [...polygons];
      newPolygons[isDraggingPolygon] = newPolygons[isDraggingPolygon].map((pt) => ({
        x: pt.x + dx,
        y: pt.y + dy,
      }));
      setPolygons(newPolygons);
      setDragOffset(pos);
    } else {
      // Update hover states
      const specialPt = getSpecialPointAtPosition(pos);
      setHoveredSpecialPoint(specialPt);

      if (specialPt) {
        setCursor('grab');
        setHoveredPoint(null);
        setHoveredPolygon(null);
      } else {
        const point = getPointAtPosition(pos);
        setHoveredPoint(point);

        if (!point) {
          const polyIdx = getPolygonAtPosition(pos);
          if (polyIdx !== null) {
            setHoveredPolygon({ polygonIdx: polyIdx, type: 'body' });
            setCursor(mode === 'edit' ? 'grab' : 'pointer');
          } else {
            setHoveredPolygon(null);
            setCursor(isComplete ? 'crosshair' : 'crosshair');
          }
        } else {
          setHoveredPolygon(null);
          setCursor(mode === 'edit' ? 'grab' : 'pointer');
        }
      }
    }
  };

  const handleMouseUp = () => {
    setDraggedPoint(null);
    setDraggedSpecialPoint(null);
    setIsDraggingPolygon(false);
    if (hoveredPoint || hoveredPolygon || hoveredSpecialPoint) {
      setCursor('grab');
    } else {
      setCursor(isComplete ? 'crosshair' : 'crosshair');
    }
  };

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // Prevent click if user was dragging
    if (hasDragged) return;

    const pos = getMousePos(e);

    // Don't process clicks on special points
    if (getSpecialPointAtPosition(pos)) return;

    if (mode === 'delete') {
      const point = getPointAtPosition(pos);
      if (point !== null) {
        const newPolygons = [...polygons];
        newPolygons[point.polygonIdx].splice(point.pointIdx, 1);
        if (newPolygons[point.polygonIdx].length < 3) {
          newPolygons.splice(point.polygonIdx, 1);
        }
        setPolygons(newPolygons);
        return;
      }

      const polyIdx = getPolygonAtPosition(pos);
      if (polyIdx !== null) {
        const newPolygons = polygons.filter((_, idx) => idx !== polyIdx);
        setPolygons(newPolygons);
        return;
      }
    }

    if (mode === 'edit' && isComplete) {
      // Check if clicking first point to close current polygon
      if (!isComplete && currentPoints.length > 2) {
        const dx = pos.x - currentPoints[0].x;
        const dy = pos.y - currentPoints[0].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < HOVER_RADIUS) {
          setPolygons([...polygons, currentPoints]);
          setCurrentPoints([]);
          setIsComplete(true);
          return;
        }
      }

      // Start new polygon
      setCurrentPoints([pos]);
      setIsComplete(false);
    } else if (mode === 'edit' && !isComplete) {
      // Check if clicking first point to close
      if (currentPoints.length > 2) {
        const dx = pos.x - currentPoints[0].x;
        const dy = pos.y - currentPoints[0].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < HOVER_RADIUS) {
          setPolygons([...polygons, currentPoints]);
          setCurrentPoints([]);
          setIsComplete(true);
          return;
        }
      }

      // Add new point
      setCurrentPoints([...currentPoints, pos]);
    }
  };

  const handlePlayPause = () => {
    if (!isPlaying && currentStep >= timeline.length - 1) {
      setCurrentStep(0);
    }
    setIsPlaying(!isPlaying);
  };

  // MARK: JSX
  return (
    <div className="w-full h-full flex flex-col items-center gap-2 p-2">
      {/* Header */}
      <div className="w-full flex items-center justify-between gap-2 bg-white px-4 py-2 rounded-lg border">
        <p>
          <b>Motion Planning Visualizer</b>
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => setMode('edit')}
            className={`text-xl p-2 rounded transition-colors cursor-pointer ${
              mode === 'edit' ? 'bg-blue-700 text-white' : 'text-gray-700 hover:bg-gray-200'
            }`}
          >
            <MdEdit />
          </button>
          <button
            onClick={() => setMode('delete')}
            className={`text-xl p-2 rounded transition-colors cursor-pointer ${
              mode === 'delete' ? 'bg-red-500 text-white' : 'text-gray-700 hover:bg-gray-200'
            }`}
          >
            <MdDelete />
          </button>
        </div>
        <div className="flex gap-2 items-center">
          <button
            className="px-3 py-1.5 rounded cursor-pointer bg-gray-200 flex flex-row items-center gap-2"
            onClick={() => setLive(!live)}
          >
            Live
            <div className={`flex p-1 w-8 rounded-full ${live ? 'bg-blue-700' : 'bg-gray-400'}`}>
              <span className={`w-2.5 h-2.5 rounded-full bg-white duration-150 ${live && 'ml-3.5'}`} />
            </div>
          </button>
          <select
            className="px-2 py-1.5 rounded bg-gray-200"
            name="algorithm"
            id=""
            value={algorithm}
            onChange={(e) => setAlgorithm(e.target.value as AlgorithmType)}
          >
            <option value="visibility">Visibility Graph</option>
            <option value="voronoi">Voronoi</option>
          </select>
          {!live && (
            <button
              className="px-3 py-1.5 rounded cursor-pointer bg-blue-700 text-white"
              onClick={() => runAlgorithm()}
            >
              Generate
            </button>
          )}
        </div>
      </div>

      {/* Instructions */}
      <div className="text-gray-600">
        {mode === 'edit'
          ? isComplete
            ? polygons.length == 0
              ? 'Hint: Click to start drawing a polygon'
              : 'Hint: Draw a new polygon or edit the objects by dragging them around'
            : 'Hint: Click to add points, click the first point to close polygon'
          : 'Hint: Click a polygon or vertex to delete it'}
      </div>

      {/* Canvas */}
      <div ref={containerRef} className="w-full flex-1 min-h-0">
        <canvas
          ref={canvasRef}
          className="bg-white border rounded-lg w-full h-full"
          style={{ cursor }}
          width={canvasSize.width}
          height={canvasSize.height}
          onClick={handleClick}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        />
      </div>

      {currentStep >= 0 && currentStep < timeline.length && !live && (
        <p className="text-gray-600 italic">{timeline[currentStep].message}</p>
      )}

      {/* Timeline */}
      <div
        className={`w-full px-3 py-2 bg-white border rounded-lg flex flex-row items-center gap-2 ${timeline.length === 0 || live ? 'opacity-20 pointer-events-none' : ''}`}
      >
        <button className="text-3xl cursor-pointer" onClick={handlePlayPause}>
          {isPlaying ? <MdPause /> : <MdPlayArrow />}
        </button>
        <input
          className="w-full"
          type="range"
          value={currentStep}
          onChange={(e) => setCurrentStep(parseInt(e.target.value))}
          min="0"
          max={timeline.length - 1}
        />
        {timeline.length > 0 && (
          <p>
            ({currentStep}/{timeline.length - 1})
          </p>
        )}
      </div>
    </div>
  );
}

export default CanvasComponent;
