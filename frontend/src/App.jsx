import React, { useState } from 'react';
import useAlgorithmNarrator from './useAlgorithmNarrator';
import VisualizerPage from './VisualizerPage';
import AIPage from './AIPage';

export default function App() {
  const {
    narrationText,
    isLoading,
    currentStep,
    dataArray,
    customInput,
    setCustomInput,
    algorithm,
    setAlgorithm,
    handleApplySettings,
    handleNextStep,
    hasShownIntro,
    compareIndices,
    swapIndices,
    pivotIndices,
    partitionTree
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
        isLoading={isLoading}
        currentStep={currentStep}
        dataArray={dataArray}
        customInput={customInput}
        setCustomInput={setCustomInput}
        algorithm={algorithm}
        setAlgorithm={setAlgorithm}
        handleApplySettings={handleApplySettings}
        handleNextStep={handleNextStep}
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
