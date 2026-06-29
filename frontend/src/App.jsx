import React from 'react';
import useAlgorithmNarrator from './useAlgorithmNarrator';

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
    swapIndices
  } = useAlgorithmNarrator();

  const handleNextClicked = () => {
    handleNextStep();
  };

  const isIntroPending = !hasShownIntro && currentStep === 0;

  return (
    <div style={{ padding: '40px', fontFamily: 'system-ui, sans-serif', maxWidth: '800px', margin: '0 auto' }}>
      <h1>Algorithmic Visualizer AI</h1>
      
      <div style={{ marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div>
          <label style={{ marginRight: '10px' }}>Algorithm: </label>
          <select className="drop-down" value={algorithm} onChange={(e) => setAlgorithm(e.target.value)}>
            <option>Bubble Sort</option>
            <option>Selection Sort</option>
            <option>Insertion Sort</option>
            <option>Merge Sort</option>
            <option>Quick Sort</option>
            <option>Heap Sort</option>
            <option>3-way Merge Sort</option>
            <option>Cycle Sort</option>
          </select>
        </div>
        
        <div>
          <label style={{ marginRight: '10px' }}>Data Array (comma separated): </label>
          <input 
            type="text" 
            value={customInput} 
            onChange={(e) => setCustomInput(e.target.value)} 
            style={{ width: '200px', padding: '4px' }}
          />
          <button onClick={handleApplySettings} style={{ marginLeft: '10px', padding: '4px 10px' }}>Apply</button>
        </div>
      </div>
      
      <div className="array-container">
        {dataArray.map((num, i) => {
          const isCompared = compareIndices.includes(i);
          const isSwapped = swapIndices.includes(i);

          return (
            <div key={i} className="array-item">
              <div
                className={`array-card ${isCompared ? 'compare' : ''} ${isSwapped ? 'swap' : ''}`}
              >
                {num}
              </div>
              {isCompared && (
                <div className="compare-annotation">
                  <div className="compare-line" />
                  <span className="compare-label">Compared</span>
                </div>
              )}
              {isSwapped && (
                <div className="swap-annotation">
                  <div className="swap-line" />
                  <span className="swap-label">Swapped</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ marginBottom: '20px' }}>
        <p><strong>Step Counter:</strong> {currentStep}</p>
      </div>

      <button 
        onClick={handleNextClicked} 
        disabled={isLoading}
        style={{ padding: '10px 20px', fontSize: '16px', cursor: 'pointer' }}
      >
        {isLoading ? "AI is processing..." : isIntroPending ? "Start Algorithm" : "Next Step"}
      </button>

      <div style={{ marginTop: '30px', padding: '20px', backgroundColor: '#f5f5f5', borderRadius: '8px', borderLeft: '4px solid #0062ff' }}>
        <p style={{ margin: 10, lineHeight: '1.5' }}>{narrationText}</p>
      </div>
    </div>
  );
}