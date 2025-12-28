import { useStore } from '../utils/store';
import type { AlgorithmType } from '../utils/types';
import { MdInfoOutline } from 'react-icons/md';

export default function Header() {
  const {
    mode,
    setMode,
    algorithm,
    timeline,
    setAlgorithm,
    setPolygons,
    setIsComplete,
    setCurrentPoints,
    setIsAboutDialogOpen,
    setStartPoint,
    setGoalPoint,
    setCurrentStep,
  } = useStore();

  const handleClear = () => {
    setPolygons([]);
    setCurrentPoints([]);
    setIsComplete(true);
    setStartPoint({ x: 100, y: 200 });
    setGoalPoint({ x: 500, y: 200 });
    setCurrentStep(timeline.length - 1);
  };

  return (
    <div className="w-full h-14 px-5 flex items-center justify-between border-b border-white/20 backdrop-blur-md z-30">
      <h1 className="font-bold text-lg tracking-tight">Motion Planning Visualizer</h1>

      <div className="flex gap-4 items-center">
        {/* Tools */}
        <div className="flex bg-text/8 p-1 rounded-full">
          <button
            onClick={() => setMode('edit')}
            className={`px-3 py-1 rounded-full duration-300 ${
              mode === 'edit' ? 'bg-white text-text shadow-sm' : 'text-text/50 hover:text-text/70'
            }`}
          >
            Draw
          </button>
          <button
            onClick={() => setMode('delete')}
            className={`px-3 py-1 rounded-full duration-300 ${
              mode === 'delete' ? 'bg-white text-red-500 shadow-sm' : 'text-text/50 hover:text-text/70'
            }`}
          >
            Delete
          </button>
        </div>

        <div className="h-6 border-l border-text/10" />

        {/* Algorithm Select */}
        <select
          value={algorithm}
          onChange={(e) => setAlgorithm(e.target.value as AlgorithmType)}
          className="bg-text/8 rounded-full px-3 py-1.5 focus:ring-2 focus:ring-blue-500 outline-none"
        >
          <option value="visibility">Visibility Graph</option>
          <option value="voronoi">Voronoi Diagram</option>
          <option value="compare">Compare</option>
        </select>

        <div className="h-6 border-l border-text/10" />

        {/* Reset Button */}
        <button onClick={handleClear} className="p-1 text-text/50 hover:text-red-500 duration-300">
          Reset
        </button>

        <div className="h-6 border-l border-text/10" />

        {/* About Button */}
        <button
          onClick={() => setIsAboutDialogOpen(true)}
          className="p-1 text-text/50 hover:text-text duration-300 flex items-center gap-1"
        >
          <MdInfoOutline className="text-lg" /> About
        </button>
      </div>
    </div>
  );
}
