import { useState, useEffect, useCallback } from 'react';
import { MdExpandMore, MdExpandLess, MdInfoOutline, MdSettings } from 'react-icons/md';
import { useStore } from '../utils/store';
import type { AlgorithmPhase } from '../utils/types';

const MIN_WIDTH = 300;
const MAX_WIDTH = 600;

export default function SidePanel() {
  const { algorithm, phases, params, setParams, setCurrentStep, activePhaseId, setHoveredPhaseId } = useStore();

  const [expandedPhase, setExpandedPhase] = useState<string | null>(null);
  const [width, setWidth] = useState(400);
  const [isResizing, setIsResizing] = useState(false);

  useEffect(() => {
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

  const algorithmInfo = {
    visibility: { title: 'Visibility Graph', complexity: 'Time: O(V^3) | Space: O(V^2)' },
    voronoi: { title: 'Voronoi Diagram', complexity: 'Time: O(n log n) | Space: O(n)' },
  };

  return (
    <div className="p-2 pt-0">
      <div
        className="h-full flex flex-col rounded-lg border border-black/15 shadow-lg relative flex-shrink-0 overflow-hidden"
        style={{ width }}
      >
        {/* Header */}
        <div className="p-4 border-b border-black/10 bg-white/40">
          <h1 className="text-2xl font-bold text-gray-800 tracking-tight">{algorithmInfo[algorithm].title}</h1>
          <div className="mt-2 flex items-center gap-2 text-xs font-mono text-gray-500 bg-gray-100/50 p-2 rounded border border-black/10">
            <MdInfoOutline className="text-blue-500 text-lg" />
            {algorithmInfo[algorithm].complexity}
          </div>
        </div>

        {/* Algorithm Parameters */}
        {algorithm == 'voronoi' && (
          <div className="p-4 border-b border-black/10 bg-gray-50/50 space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
              <MdSettings /> Parameters
            </div>
            <div className="flex items-center gap-1">
              <label className="text-xs font-medium text-gray-700 min-w-[100px]">Sample Dist:</label>
              <input
                type="range"
                min="10"
                max="100"
                value={params.voronoiSampleDist}
                onChange={(e) => setParams({ voronoiSampleDist: Number(e.target.value) })}
                className="flex-1 h-1.5 bg-gray-300 rounded-lg appearance-none accent-blue-500"
              />
              <span className="text-xs text-gray-400 w-8 text-right">{params.voronoiSampleDist}px</span>
            </div>
          </div>
        )}

        {/* Phases List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {phases.map((phase) => {
            const isActive = activePhaseId === phase.id;
            const isExpanded = expandedPhase === phase.id;

            return (
              <div
                key={phase.id}
                className={`rounded-xl border transition-all duration-200 overflow-hidden
                ${isActive ? 'border-blue-400/50 shadow-md bg-blue-50/30' : 'border-black/10 bg-white/40 hover:border-blue-300/30'}
              `}
                onMouseEnter={() => setHoveredPhaseId(phase.id)}
                onMouseLeave={() => setHoveredPhaseId(null)}
              >
                {/* Phase Header */}
                <button
                  onClick={() => (isExpanded ? setExpandedPhase(null) : jumpToPhase(phase))}
                  className="w-full flex items-center justify-between p-3 text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-6 rounded-full ${isActive ? 'bg-blue-500' : 'bg-gray-300'}`}></div>
                    <span className={`font-semibold ${isActive ? 'text-blue-900' : 'text-gray-600'}`}>
                      {phase.name}
                    </span>
                  </div>
                  {isExpanded ? <MdExpandLess className="text-gray-400" /> : <MdExpandMore className="text-gray-400" />}
                </button>

                {/* Collapsible Content */}
                <div
                  className={`transition-all duration-300 ease-in-out overflow-hidden ${
                    isExpanded ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'
                  }`}
                >
                  <div className="p-4 pt-0 text-sm text-gray-600 space-y-3">
                    <p className="leading-relaxed">{phase.description}</p>

                    {/* Pseudocode Block */}
                    <div className="bg-gray-900 rounded-lg p-3 font-mono text-xs text-gray-300 overflow-x-auto shadow-inner relative group">
                      <div className="absolute top-1 right-2 text-[10px] text-gray-500 uppercase tracking-wider">
                        Pseudocode
                      </div>
                      <pre className="mt-2">
                        {phase.pseudocode.split('\n').map((line, idx) => (
                          <div key={idx} className="px-1 rounded">
                            <span className="text-gray-600 select-none w-4 inline-block text-right mr-2">
                              {idx + 1}
                            </span>
                            {line}
                          </div>
                        ))}
                      </pre>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Resize Handle */}
        <div
          className="absolute right-0 top-0 w-1.5 h-full cursor-col-resize hover:bg-blue-400/50 transition-colors z-20"
          onMouseDown={startResizing}
        />
      </div>
    </div>
  );
}
