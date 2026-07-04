import React from 'react';

export default function VisualizerPage({
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
  onOpenAI,
}) {
  const renderPartitionNode = (node) => {
    if (!node) return null;
    const children = Array.isArray(node.children) ? node.children.filter(Boolean) : [];
    return (
      <div className="partition-node-wrapper">
        <div className="partition-node">
          <div className="partition-node-label">{node.label || 'Partition'}</div>
          {node.operation && <div className="partition-node-operation">{node.operation}</div>}
          {node.message && <div className="partition-node-message">{node.message}</div>}
          <div className="partition-values">
            {(node.values || []).map((value, index) => (
              <span key={`${node.label}-${index}`} className="partition-value">{value}</span>
            ))}
          </div>
        </div>
        {children.length > 0 && (
          <div className="partition-children">
            {children.map((child, index) => (
              <div
                key={`${node.label}-child-${index}`}
                className={`partition-child ${index === 0 ? 'partition-child-left' : 'partition-child-right'}`}
              >
                {renderPartitionNode(child)}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const treeAlgos = ['merge sort', '3-way merge sort', 'quick sort'];
  const visiblePartitionTree = treeAlgos.includes(algorithm?.toLowerCase()) ? partitionTree : null;

  // Transport bar derived state
  const hasSteps = hasShownIntro && stepCount > 0;
  const atStart = currentStep === 0;
  const atEnd = isComplete;
  const sliderMax = stepCount > 1 ? stepCount - 1 : 1;

  const playLabel = isLoading ? '⏳' : isPlaying ? '⏸' : hasShownIntro ? '▶' : '▶ Start';

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Algorithmic Visualizer AI</h1>
          <p className="page-subtitle">Study each sorting step with highlights and a separate AI workspace.</p>
        </div>
        <button className="chat-toggle" onClick={onOpenAI}>
          🤖 Open AI Page
        </button>
      </div>

      <div className="control-stack">
        <div>
          <label htmlFor="algorithm-select">Algorithm: </label>
          <select id="algorithm-select" className="drop-down" value={algorithm} onChange={(e) => setAlgorithm(e.target.value)}>
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
          <label htmlFor="array-input">Data Array (comma separated): </label>
          <input
            id="array-input"
            type="text"
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleApplySettings()}
            className="array-text-input"
            placeholder="e.g. 12, 45, 23, 7, 50"
          />
          <button className="btn-secondary" onClick={handleApplySettings}>
            Apply
          </button>
        </div>
      </div>

      <div className="array-container">
        {dataArray.map((num, i) => {
          const isCompared = compareIndices.includes(i);
          const isSwapped = swapIndices.includes(i);
          const isPivot = pivotIndices.includes(i);
          return (
            <div key={i} className="array-item">
              <div className={`array-card ${isCompared ? 'compare' : ''} ${isSwapped ? 'swap' : ''} ${isPivot ? 'pivot' : ''}`}>
                {num}
              </div>
              {isCompared && (
                <div className="compare-annotation">
                  <div className="compare-line" />
                  <span className="compare-label">Compared</span>
                </div>
              )}
              {isPivot && (
                <div className="pivot-annotation">
                  <div className="pivot-line" />
                  <span className="pivot-label">Pivot</span>
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

      {visiblePartitionTree && (
        <div className="partition-tree">
          <div className="partition-tree-title">Partition view</div>
          {renderPartitionNode(visiblePartitionTree)}
        </div>
      )}

      {/* ── Transport controls ─────────────────────────────────────── */}
      <div className="transport">
        <div className="transport-buttons">
          <button
            className="transport-btn"
            onClick={handleJumpToStart}
            disabled={isLoading || !hasSteps || atStart}
            title="Jump to first step"
          >⏮</button>

          <button
            className="transport-btn"
            onClick={handlePrevStep}
            disabled={isLoading || !hasSteps || atStart}
            title="Previous step"
          >◀</button>

          <button
            className="transport-btn transport-btn--play"
            onClick={handlePlayPause}
            disabled={isLoading || (hasSteps && atEnd)}
            title={isPlaying ? 'Pause' : 'Play'}
          >{playLabel}</button>

          <button
            className="transport-btn"
            onClick={handleNextStep}
            disabled={isLoading || (hasSteps && atEnd)}
            title="Next step"
          >▶</button>

          <button
            className="transport-btn"
            onClick={handleJumpToEnd}
            disabled={isLoading || !hasSteps || atEnd}
            title="Jump to last step"
          >⏭</button>
        </div>

        {/* Slider — only visible once a plan has loaded */}
        {hasSteps && (
          <div className="transport-slider-row">
            <span className="transport-step-label">
              Step {currentStep + 1} / {stepCount}
            </span>
            <input
              type="range"
              className="transport-slider"
              min={0}
              max={sliderMax}
              value={currentStep}
              style={{ '--pct': `${(currentStep / sliderMax) * 100}%` }}
              onChange={(e) => handleSeekStep(Number(e.target.value))}
            />
          </div>
        )}
        </div>
            <div className="narration-card">
            <p>{narrationText}</p>
        </div>
        
      {introText && (
        <div className="intro-card">
          <div className="intro-card-title">{algorithm} — How it works</div>
          <p>{introText}</p>
        </div>
      )}
    </>
  );
}
