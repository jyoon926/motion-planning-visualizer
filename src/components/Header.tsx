// Header.tsx

import { useStore } from '../utils/store';
import type { AlgorithmType } from '../utils/types';
import { MdInfoOutline } from 'react-icons/md'; // Import icon for About button

export default function Header() {
  const {
    mode,
    setMode,
    algorithm,
    setAlgorithm,
    setPolygons,
    setIsComplete,
    setCurrentPoints,
    setIsAboutDialogOpen, // Get the setter
  } = useStore();

  const handleClear = () => {
    setPolygons([]);
    setCurrentPoints([]);
    setIsComplete(true);
  };

  return (
    <div className="w-full h-14 px-5 flex items-center justify-between border-b border-white/20 backdrop-blur-md z-30">
      <h1 className="font-bold text-lg tracking-tight">Motion Planning Visualizer</h1>

      <div className="flex gap-4 items-center">
        {/* Tools */}
        <div className="flex bg-black/5 p-1 rounded-lg border border-black/10">
          <button
            onClick={() => setMode('edit')}
            className={`px-3 py-1 rounded-md transition-all ${mode === 'edit' ? 'bg-white text-black shadow-sm' : 'text-black/50 hover:text-black/70'
              }`}
          >
            Draw
          </button>
          <button
            onClick={() => setMode('delete')}
            className={`px-3 py-1 rounded-md transition-all ${mode === 'delete' ? 'bg-white text-red-500 shadow-sm' : 'text-black/50 hover:text-black/70'
              }`}
          >
            Delete
          </button>
        </div>

        <div className="h-6 border-l border-black/10" />

        {/* Algorithm Select */}
        <select
          value={algorithm}
          onChange={(e) => setAlgorithm(e.target.value as AlgorithmType)}
          className="bg-black/5 border border-black/10 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-blue-500 outline-none"
        >
          <option value="visibility">Visibility Graph</option>
          <option value="voronoi">Voronoi Diagram</option>
          <option value="compare">Compare</option>
        </select>

        <div className="h-6 border-l border-black/10" />

        {/* Reset Button */}
        <button onClick={handleClear} className="p-1 text-black/50 hover:text-red-500 transition-colors">
          Reset
        </button>

        <div className="h-6 border-l border-black/10" />

        {/* About Button */}
        <button
          onClick={() => setIsAboutDialogOpen(true)}
          className="p-1 text-black/50 hover:text-black transition-colors flex items-center gap-1"
        >
          <MdInfoOutline className="text-lg" /> About
        </button>
      </div>
    </div>
  );
}
