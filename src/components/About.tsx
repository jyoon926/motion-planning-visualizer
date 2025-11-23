import { MdClose } from 'react-icons/md';

interface Props {
  onClose: () => void;
}

export default function About({ onClose }: Props) {
  return (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-black/15 flex justify-between items-center sticky top-0 bg-white z-10">
          <h2 className="text-2xl font-bold text-gray-800">Motion Planning Visualizer</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 text-gray-500">
            <MdClose className="text-2xl" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-4 overflow-y-auto text-gray-700">
          <section className="space-y-3">
            <h3 className="text-xl font-semibold">What is Motion Planning?</h3>
            <p>
              Motion Planning is the core problem of calculating a sequence of valid movements, or a path, for an agent
              to travel from a start point to a goal point while avoiding obstacles.
            </p>
            <p>
              This visualizer helps you understand two fundamental and conceptually different approaches to solving this
              problem by allowing you to draw obstacles and see how each algorithm computes its path step-by-step.
            </p>
          </section>

          <section className="space-y-4">
            <div className="flex-col items-start gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <h4 className="font-bold text-lg">Visibility Graph (Shortest Path)</h4>
              <p className="text-sm mt-1">
                This algorithm connects the start/goal points and obstacle vertices to create a graph of all possible
                "visible" paths. The final path is then found using a shortest-path search algorithm like A* Search.
              </p>
              <p className="text-xs font-semibold mt-1">Goal: Minimum Path Distance (Shortest)</p>
            </div>

            <div className="flex-col items-start gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <h4 className="font-bold text-lg">Voronoi Diagram (Maximum Clearance)</h4>
              <p className="text-sm mt-1">
                This method constructs a Voronoi Diagram where all points are equidistant to two or more obstacles. The
                path is constrained to follow the 'skeletal' structure of the free space, effectively maximizing the
                distance (clearance) to all obstacles.
              </p>
              <p className="text-xs font-semibold mt-1">Goal: Maximum Obstacle Clearance (Safest)</p>
            </div>

            <div className="flex-col items-start gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <h4 className="font-bold text-lg">Compare Mode</h4>
              <p className="text-sm mt-1">
                Select the "Compare" mode to run both algorithms simultaneously and view a direct comparison of the
                final path lengths and the conceptual trade-off between shortest-path and maximum-clearance.
              </p>
            </div>
          </section>

          <div className="pt-4 flex justify-end">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg shadow hover:bg-blue-700 transition-colors"
            >
              Start Visualizing
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
