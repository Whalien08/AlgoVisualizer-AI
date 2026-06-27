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
    handleNextStep
  } = useAlgorithmNarrator();

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
      
      <div style={{ display: 'flex', gap: '15px', margin: '30px 0', minHeight: '80px' }}>
        {dataArray.map((num, i) => (
          <div 
            key={i} 
            style={{ 
              padding: '20px', 
              border: '2px solid #333', 
              borderRadius: '6px',
              backgroundColor: '#fff',
              fontWeight: 'bold',
              fontSize: '18px',
              textAlign: 'center',
              minWidth: '40px'
            }}
          >
            {num}
          </div>
        ))}
      </div>

      <div style={{ marginBottom: '20px' }}>
        <p><strong>Step Counter:</strong> {currentStep}</p>
      </div>

      <button 
        onClick={handleNextStep} 
        disabled={isLoading}
        style={{ padding: '10px 20px', fontSize: '16px', cursor: 'pointer' }}
      >
        {isLoading ? "AI is processing..." : "Next Step"}
      </button>

      <div style={{ marginTop: '30px', padding: '20px', backgroundColor: '#f5f5f5', borderRadius: '8px', borderLeft: '4px solid #0062ff' }}>
        <p style={{ margin: 10, lineHeight: '1.5' }}>{narrationText}</p>
      </div>
    </div>
  );
}