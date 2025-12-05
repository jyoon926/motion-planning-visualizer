import { useState, useEffect, useCallback } from 'react';
import { MdExpandMore, MdExpandLess, MdInfoOutline, MdSettings } from 'react-icons/md';
import { useStore } from '../utils/store';
import type { AlgorithmPhase } from '../utils/types';

const MIN_WIDTH = 300;
const MAX_WIDTH = 600;

export default function SidePanel() {
  const {
    algorithm,
    phases,
    params,
    setParams,
    currentStep, // <-- ADDED: Retrieve current step index
    setCurrentStep,
    activePhaseId,
    setHoveredPhaseId,
    compareData,
  } = useStore();

  const [expandedPhase, setExpandedPhase] = useState<string | null>(null);
  const [width, setWidth] = useState(400);
  const [isResizing, setIsResizing] = useState(false);

  useEffect(() => {
    // Keep the active phase expanded
    if (activePhaseId && expandedPhase !== activePhaseId) {
      setExpandedPhase(activePhaseId);
    }
  }, [activePhaseId]); // eslint-disable-line react-hooks/exhaustive-deps

  const startResizing = useCallback(() => setIsResizing(true), []);
  const stopResizing = useCallback(() => setIsResizing(false), []);
  const resize = useCallback(
    (mouseMoveEvent: MouseEvent) => {
      if (isResizing) {
        const newWidth = mouseMoveEvent.clientX;
        if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
          setWidth(newWidth);
        }
      }
    },
    [isResizing]
  );

  useEffect(() => {
    window.addEventListener('mousemove', resize);
    window.addEventListener('mouseup', stopResizing);
    return () => {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
    };
  }, [resize, stopResizing]);

  const jumpToPhase = (phase: AlgorithmPhase) => {
    setCurrentStep(phase.startStepIndex);
    setExpandedPhase(phase.id);
  };

  const getPhaseProgress = (phase: AlgorithmPhase): number => {
    const totalSteps = phase.endStepIndex - phase.startStepIndex + 1;
    if (totalSteps <= 0) return 100;
    const stepsInPhase = currentStep - phase.startStepIndex;
    const progress = Math.max(0, Math.min(100, (stepsInPhase / totalSteps) * 100));
    if (currentStep > phase.endStepIndex) return 100;
    return Math.round(progress);
  };

  const algorithmInfo = {
    visibility: { title: 'Visibility Graph', complexity: 'Time: O(V³) | Space: O(V²)' },
    voronoi: { title: 'Voronoi Diagram', complexity: 'Time: O(n log n) | Space: O(n)' },
    compare: { title: 'Algorithm Comparison', complexity: '' },
  };

  const visLength = compareData.visibility.pathLength.toFixed(0);
  const vorLength = compareData.voronoi.pathLength.toFixed(0);
  const lengthDiff = Math.abs(compareData.visibility.pathLength - compareData.voronoi.pathLength).toFixed(0);

  return (
    <div className="h-full pb-4 flex flex-col relative flex-shrink-0 overflow-hidden" style={{ width }}>
      {/* Header */}
      <div className="p-4">
        <h1 className="text-2xl font-bold">{algorithmInfo[algorithm].title}</h1>
        {algorithm !== 'compare' && (
          <div className="mt-2 flex items-center gap-2 font-mono text-sm bg-black/5 py-2 px-3 rounded-lg border border-black/10">
            <MdInfoOutline className="text-black/50 text-lg" />
            {algorithmInfo[algorithm].complexity}
          </div>
        )}
      </div>

      {/* Algorithm Parameters */}
      {(algorithm === 'voronoi' || algorithm === 'compare') && (
        <div className="p-4 pt-0 space-y-4">
          <div className="rounded-lg border border-black/10 py-2 px-3">
            <div className="flex items-center gap-2 font-semibold mb-2">
              <MdSettings className="text-black/50" /> Parameters
            </div>
            <div className="flex items-center gap-3 text-sm text-black/50">
              <label>Sample Distance:</label>
              <input
                type="range"
                min="20"
                max="80"
                step="5"
                value={params.voronoiSampleDist}
                onChange={(e) => setParams({ voronoiSampleDist: Number(e.target.value) })}
                className="flex-1 h-1 bg-black/10 rounded-lg appearance-none accent-blue-500"
              />
              <span className="w-10 text-right">{params.voronoiSampleDist}px</span>
            </div>
          </div>
        </div>
      )}

      {/* Comparison View (omitted for brevity) */}
      {algorithm === 'compare' && (
        <div className="flex-1 overflow-y-auto p-4 pt-0 space-y-6">
          <div className="space-y-3">
            <h3 className="flex items-center gap-2 text-lg font-bold">Path Lengths</h3>
            <div className="p-3 rounded-lg bg-black/5 border border-black/10 space-y-2">
              <p className={`flex justify-between text-green-600`}>
                <span className="font-bold">Visibility Graph (Shortest Path):</span>
                <span className="font-mono text-base">{visLength} px</span>
              </p>
              <p className={`flex justify-between text-blue-600`}>
                <span className="font-bold">Voronoi Diagram (Max Clearance):</span>
                <span className="font-mono text-base">{vorLength} px</span>
              </p>
              <p className={`flex justify-between`}>
                <span className="font-bold">Difference:</span>
                <span className="font-mono text-base">{lengthDiff} px</span>
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="flex items-center gap-2 text-lg font-bold">Conceptual Difference</h3>
            <div className="space-y-4">
              <p className="text-black/60">
                The Visibility Graph algorithm finds the geometrically shortest path (minimum distance) between the
                start and goal points by only allowing travel along obstacle vertices.
              </p>
              <p className="text-black/60">
                The Voronoi Diagram algorithm finds a path that maximizes the clearance (distance) to the nearest
                obstacle. This usually results in a longer, but much safer path for the robot.
              </p>
              <p className="font-semibold">
                <span className="text-green-600">Visibility Graph</span> often yields a shorter, but more risk-prone
                path near corners, while the
                <span className="text-blue-600"> Voronoi Diagram</span> guarantees the maximum safety margin.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Phases List */}
      {algorithm !== 'compare' && (
        <div className="flex-1 px-4 overflow-hidden">
          <div className="h-full rounded-xl border border-black/10 overflow-hidden">
            <div className="h-full overflow-y-auto p-3 space-y-2">
              <h3 className="font-bold text-lg">Algorithm Phases</h3>
              {phases.map((phase) => {
                const isActive = activePhaseId === phase.id;
                const isExpanded = expandedPhase === phase.id;
                const progress = getPhaseProgress(phase);

                return (
                  <div
                    key={phase.id}
                    className={`rounded-lg border transition-all duration-200 overflow-hidden
                    ${isActive ? 'border-black/40 shadow-md' : 'border-black/10'}
                  `}
                    onMouseEnter={() => setHoveredPhaseId(phase.id)}
                    onMouseLeave={() => setHoveredPhaseId(null)}
                  >
                    {/* Phase Header */}
                    <button
                      onClick={() => (isExpanded ? setExpandedPhase(null) : jumpToPhase(phase))}
                      className={`w-full p-3 text-left relative ${isActive && 'border-b border-black/10'}`}
                    >
                      {/* Progress Bar */}
                      {isActive && (
                        <div
                          className="absolute bottom-0 left-0 h-1 bg-black/10 transition-all duration-200"
                          style={{ width: `${progress}%` }}
                        />
                      )}

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-6 rounded-full ${isActive ? 'bg-black' : 'bg-black/20'}`}></div>
                          <span className={`font-bold ${isActive ? 'text-black' : 'text-black/50'}`}>{phase.name}</span>
                        </div>
                        {isExpanded ? (
                          <MdExpandLess className="text-black/50 text-lg" />
                        ) : (
                          <MdExpandMore className="text-black/50 text-lg" />
                        )}
                      </div>
                    </button>

                    {/* Collapsible Content */}
                    <div
                      className={`transition-all duration-300 ease-in-out overflow-hidden ${
                        isExpanded ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'
                      }`}
                    >
                      <div className="p-4 pt-3 text-black/60 space-y-3">
                        <p className="leading-relaxed">{phase.description}</p>

                        {/* Pseudocode Block */}
                        <div className="rounded-lg border border-black/10 bg-black/5">
                          <div className="p-3 font-mono text-sm text-black/60 overflow-x-auto relative group">
                            <div className="absolute top-1 left-2 text-[10px] uppercase tracking-wider">Pseudocode</div>
                            <pre className="mt-2">
                              {phase.pseudocode.split('\n').map((line, idx) => (
                                <div key={idx} className="px-1 rounded">
                                  <span className="select-none w-4 inline-block text-right mr-3">{idx + 1}</span>
                                  {line}
                                </div>
                              ))}
                            </pre>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Resize Handle */}
      <div
        className="absolute right-0 top-0 w-1.5 h-full rounded-full cursor-col-resize hover:bg-black/10 transition-colors z-20"
        onMouseDown={startResizing}
      />
    </div>
  );
}
