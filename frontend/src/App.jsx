import React, { useState } from 'react';
import useAlgorithmNarrator from './useAlgorithmNarrator';
import VisualizerPage from './VisualizerPage';
import AIPage from './AIPage';

export default function App() {
  const {
    narrationText,
    introText,
    isLoading,
    currentStep,
    stepCount,
    isComplete,
    dataArray,
    customInput,
    setCustomInput,
    algorithm,
    setAlgorithm,
    handleApplySettings,
    handleNextStep,
    handlePrevStep,
    handleSeekStep,
    handleJumpToStart,
    handleJumpToEnd,
    handlePlayPause,
    isPlaying,
    hasShownIntro,
    compareIndices,
    swapIndices,
    pivotIndices,
    partitionTree,
  } = useAlgorithmNarrator();

  const [activePage, setActivePage] = useState('visualizer');

  if (activePage === 'ai') {
    return (
      <div className="app-shell">
        <AIPage onBack={() => setActivePage('visualizer')} />
      </div>
    );
  }

  return (
    <div className="app-shell">
      <VisualizerPage
        narrationText={narrationText}
        introText={introText}
        isLoading={isLoading}
        currentStep={currentStep}
        stepCount={stepCount}
        isComplete={isComplete}
        dataArray={dataArray}
        customInput={customInput}
        setCustomInput={setCustomInput}
        algorithm={algorithm}
        setAlgorithm={setAlgorithm}
        handleApplySettings={handleApplySettings}
        handleNextStep={handleNextStep}
        handlePrevStep={handlePrevStep}
        handleSeekStep={handleSeekStep}
        handleJumpToStart={handleJumpToStart}
        handleJumpToEnd={handleJumpToEnd}
        handlePlayPause={handlePlayPause}
        isPlaying={isPlaying}
        hasShownIntro={hasShownIntro}
        compareIndices={compareIndices}
        swapIndices={swapIndices}
        pivotIndices={pivotIndices}
        partitionTree={partitionTree}
        onOpenAI={() => setActivePage('ai')}
      />
    </div>
  );
}
