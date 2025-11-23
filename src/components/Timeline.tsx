import { useCallback, useEffect, useRef, useState } from 'react';
import { MdPause, MdPlayArrow, MdSkipNext, MdSkipPrevious, MdFirstPage, MdLastPage } from 'react-icons/md';
import { useStore } from '../utils/store';

export default function Timeline() {
  const {
    timeline,
    phases,
    currentStep,
    isPlaying,
    fps,
    setCurrentStep,
    setIsPlaying,
    setFps,
    hoveredPhaseId,
    setHoveredPhaseId,
  } = useStore();

  const trackRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [scrubberStyle, setScrubberStyle] = useState({ left: '0px', width: '0px' });

  const totalFrames = timeline.length;

  // Scrubber Position Calculation
  useEffect(() => {
    if (!trackRef.current || totalFrames === 0) return;

    const GAP_PX = 4;
    const W_total = trackRef.current.offsetWidth;
    const N_phases = phases.length;

    const W_gaps = Math.max(0, N_phases - 1) * GAP_PX;
    const W_segments = W_total - W_gaps;

    const W_frame_px = W_segments / totalFrames;

    let currentPhaseIndex = 0;
    for (let i = 0; i < N_phases; i++) {
      if (currentStep >= phases[i].startStepIndex && currentStep <= phases[i].endStepIndex) {
        currentPhaseIndex = i;
        break;
      }
    }

    const W_preceding_frames = currentStep * W_frame_px;
    const W_preceding_gaps = currentPhaseIndex * GAP_PX;
    const left_px = W_preceding_frames + W_preceding_gaps;

    setScrubberStyle({
      left: `${left_px}px`,
      width: `${W_frame_px}px`,
    });
  }, [currentStep, totalFrames, phases, isDragging]);

  // Playback Loop
  useEffect(() => {
    if (!isPlaying) return;
    if (currentStep >= totalFrames - 1) {
      setIsPlaying(false);
      return;
    }
    const interval = setInterval(() => {
      setCurrentStep((prev) => (prev < totalFrames - 1 ? prev + 1 : prev));
    }, 1000 / fps);
    return () => clearInterval(interval);
  }, [currentStep, fps, totalFrames, isPlaying, setCurrentStep, setIsPlaying]);

  // Click/Drag Logic
  const handleTimelineInteraction = useCallback(
    (e: React.MouseEvent | MouseEvent) => {
      if (!trackRef.current || totalFrames === 0) return;
      const rect = trackRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
      const percentage = x / rect.width;

      const step = Math.max(0, Math.min(totalFrames - 1, Math.floor(percentage * totalFrames)));

      setCurrentStep(step);

      if (isPlaying) setIsPlaying(false);
    },
    [trackRef, totalFrames, isPlaying, setCurrentStep, setIsPlaying]
  );

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    handleTimelineInteraction(e);
  };

  useEffect(() => {
    const handleUp = () => setIsDragging(false);
    const handleMove = (e: MouseEvent) => {
      if (isDragging) handleTimelineInteraction(e);
    };
    window.addEventListener('mouseup', handleUp);
    window.addEventListener('mousemove', handleMove);
    return () => {
      window.removeEventListener('mouseup', handleUp);
      window.removeEventListener('mousemove', handleMove);
    };
  }, [isDragging, totalFrames, isPlaying, handleTimelineInteraction]);

  return (
    <div className="p-2 pt-0 disable-selection">
      <div className="w-full h-auto rounded-lg border border-black/15 p-4 flex flex-col gap-3 shadow-lg">
        {/* Current Action Message */}
        <div className="flex justify-between items-end">
          <div className="h-4">
            {timeline.length > 0 && (
              <p className="text-gray-700 font-medium text-sm animate-fade-in">
                <span className="text-blue-500 font-bold mr-2">Step {currentStep}:</span>
                {timeline[currentStep].message}
              </p>
            )}
          </div>
          <div className="text-xs text-gray-400">
            Frame {currentStep + 1} of {totalFrames}
          </div>
        </div>

        {/* Custom Segmented Timeline Track */}
        <div
          ref={trackRef}
          className="relative w-full h-6 cursor-pointer group transition-all duration-200"
          onMouseDown={handleMouseDown}
        >
          <div className="absolute inset-0 flex w-full h-full gap-1">
            {phases.map((phase) => {
              const duration = phase.endStepIndex - phase.startStepIndex + 1;
              const widthPct = (duration / totalFrames) * 100;

              return (
                <div
                  key={phase.id}
                  className={`h-full rounded-lg transition-colors duration-200 relative flex justify-center
                    ${phase.id === hoveredPhaseId ? 'bg-blue-200' : 'bg-black/8'}
                  `}
                  style={{ width: `${widthPct}%` }}
                  onMouseEnter={() => setHoveredPhaseId(phase.id)}
                  onMouseLeave={() => setHoveredPhaseId(null)}
                >
                  {/* Phase Name Popup */}
                  {phase.id === hoveredPhaseId && (
                    <span className="absolute top-[-32px] text-xs bg-gray-900/60 backdrop-blur text-white px-2 py-1.5 rounded shadow-lg whitespace-nowrap">
                      {phase.name}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Scrubber Knob */}
          <div
            className="absolute top-0 h-full rounded-lg bg-blue-500/30 border-2 border-blue-600 shadow-inner pointer-events-none z-10"
            style={{
              left: scrubberStyle.left,
              width: scrubberStyle.width,
              transition: 'all 0.1s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
            }}
          />
        </div>

        {/* Controls Row */}
        <div className="flex items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            {/* Skip to Start */}
            <button onClick={() => setCurrentStep(0)} className="p-2 rounded-full hover:bg-gray-200 text-gray-600">
              <MdFirstPage />
            </button>

            {/* Previous */}
            <button
              onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
              className="p-2 rounded-full hover:bg-gray-200 text-gray-600"
            >
              <MdSkipPrevious />
            </button>

            {/* Play / Pause */}
            <button
              className={`flex items-center gap-2 pl-5 pr-6 py-2 rounded-full font-semibold transition-all shadow-sm ${
                isPlaying
                  ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
              onClick={() => {
                if (!isPlaying && currentStep >= totalFrames - 1) setCurrentStep(0);
                setIsPlaying(!isPlaying);
              }}
            >
              {isPlaying ? (
                <>
                  <MdPause /> Pause
                </>
              ) : (
                <>
                  <MdPlayArrow /> Play
                </>
              )}
            </button>

            {/* Next */}
            <button
              onClick={() => setCurrentStep(Math.min(totalFrames - 1, currentStep + 1))}
              className="p-2 rounded-full hover:bg-gray-200 text-gray-600"
            >
              <MdSkipNext />
            </button>

            {/* Skip to End */}
            <button
              onClick={() => setCurrentStep(totalFrames - 1)}
              className="p-2 rounded-full hover:bg-gray-200 text-gray-600"
            >
              <MdLastPage />
            </button>
          </div>

          {/* FPS */}
          <div className="flex items-center gap-4 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-gray-400">Animation Speed:</label>
              <input
                type="range"
                min="1"
                max="60"
                value={fps}
                onChange={(e) => setFps(Number(e.target.value))}
                className="w-24 h-1 bg-gray-300 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
              <p className="text-xs text-gray-400">{fps} fps</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
