import { useEffect } from 'react';
import Header from './components/Header';
import Timeline from './components/Timeline';
import Canvas from './components/Canvas';
import SidePanel from './components/SidePanel';
import { useStore } from './utils/store';
import { computeVisibilityGraph } from './algorithms/visibilityGraph';
import { computeVoronoi } from './algorithms/voronoi';
import type { AlgorithmType, Point } from './utils/types';
import { dist } from './utils/common';
import About from './components/About';

const algorithms = {
  visibility: {
    name: 'Visibility Graph',
    algorithm: computeVisibilityGraph,
  },
  voronoi: {
    name: 'Voronoi Diagram',
    algorithm: computeVoronoi,
  },
  compare: {
    name: 'Compare',
  },
};

const calculatePathLength = (path: Point[]): number => {
  if (!path || path.length < 2) return 0;
  let length = 0;
  for (let i = 0; i < path.length - 1; i++) {
    length += dist(path[i], path[i + 1]);
  }
  return length;
};

function App() {
  const {
    algorithm,
    startPoint,
    goalPoint,
    polygons,
    canvasSize,
    params,
    currentStep,
    timeline,
    setTimelineData,
    setCurrentStep,
    setCompareData,
    isAboutDialogOpen,
    setIsAboutDialogOpen,
    setFinalVisStep,
    setFinalVoronoiStep,
  } = useStore();

  useEffect(() => {
    if (canvasSize.width === 0 || canvasSize.height === 0) return;

    const wasAtEnd = currentStep == timeline.length - 1;

    // Compute Visibility Graph
    const visOutput = algorithms.visibility.algorithm(startPoint, goalPoint, polygons, canvasSize);
    const finalVisStep = visOutput.steps[visOutput.steps.length - 1] || null;
    setFinalVisStep(finalVisStep); // Set final step
    const visPathLength = calculatePathLength(finalVisStep?.path);
    setCompareData({ visibility: { pathLength: visPathLength } });

    // Compute Voronoi Diagram
    const vorOutput = algorithms.voronoi.algorithm(startPoint, goalPoint, polygons, canvasSize, params);
    const finalVoronoiStep = vorOutput.steps[vorOutput.steps.length - 1] || null;
    setFinalVoronoiStep(finalVoronoiStep); // Set final step
    const vorPathLength = calculatePathLength(finalVoronoiStep?.path);
    setCompareData({ voronoi: { pathLength: vorPathLength } });

    // Update timeline based on selected algorithm
    const selectedAlgo = algorithms[algorithm as AlgorithmType];
    if (algorithm !== 'compare' && selectedAlgo) {
      const output = algorithm === 'visibility' ? visOutput : vorOutput;
      setTimelineData(output.steps, output.phases);
      const lastFrame = output.steps.length - 1;
      if (currentStep === -1) {
        setCurrentStep(lastFrame);
      } else {
        setCurrentStep(wasAtEnd ? lastFrame : Math.min(currentStep, lastFrame));
      }
    }

    // Clear timeline for compare mode
    if (algorithm === 'compare') {
      setTimelineData([], []);
    }
  }, [
    polygons,
    startPoint,
    goalPoint,
    algorithm,
    canvasSize,
    params,
    setTimelineData,
    setCurrentStep,
    setCompareData,
    setFinalVisStep,
    setFinalVoronoiStep,
  ]);

  return (
    <div className="w-full h-screen flex flex-col overflow-hidden bg-bg text-text">
      <Header />
      <div className="flex-1 flex overflow-hidden pb-4 relative">
        <SidePanel />
        <Canvas />
      </div>
      <Timeline />

      {/* About Dialog */}
      {isAboutDialogOpen && <About onClose={() => setIsAboutDialogOpen(false)} />}
    </div>
  );
}

export default App;
