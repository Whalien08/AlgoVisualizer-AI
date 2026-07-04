import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function AIPage({ onBack, vizContext = {} }) {
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState([
    { role: 'assistant', content: 'Ask me anything about sorting, data structures, or algorithms and I will explain it clearly.\n\nIf the visualizer is running, I can see exactly which step you are on — try asking **"Why did it just swap those two?"** or **"What happens next?"**' }
  ]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const bottomRef = useRef(null);

  // Scroll the page to the newest message whenever the list changes
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Destructure what the backend needs; default everything to null so the
  // backend knows when there is genuinely no context to work with.
  const {
    algorithm = null,
    currentStep = null,
    stepCount = null,
    dataArray = null,
    compareIndices = null,
    swapIndices = null,
    pivotIndices = null,
    narrationText = null,
  } = vizContext;

  const hasContext = algorithm != null && currentStep != null;

  const handleSendChat = async () => {
    const message = chatInput.trim();
    if (!message) return;

    setChatMessages((prev) => [...prev, { role: 'user', content: message }]);
    setChatInput('');
    setIsChatLoading(true);

    try {
      const response = await fetch('http://localhost:8000/api/v1/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          // Silently include visualizer state so the AI knows what's on screen
          algorithm,
          current_step: currentStep,
          step_count: stepCount,
          data_array: dataArray,
          compare_indices: compareIndices,
          swap_indices: swapIndices,
          pivot_indices: pivotIndices,
          current_narration: narrationText,
        }),
      });

      const data = await response.json();
      setChatMessages((prev) => [
        ...prev,
        { role: 'assistant', content: data.reply || 'I could not generate an answer right now.' },
      ]);
    } catch (error) {
      setChatMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'The chat service is currently unavailable. Please try again shortly.' },
      ]);
    } finally {
      setIsChatLoading(false);
    }
  };

  return (
    <div className="ai-page">
      {/* Page header — scrolls away with the content */}
      <div className="page-header">
        <div>
          <h1>AI Assistant</h1>
          <p className="page-subtitle">Ask for explanations, walkthroughs, or algorithm comparisons without leaving the visualizer flow.</p>
        </div>
        <button className="chat-toggle" onClick={onBack}>
          ← Back to Visualizer
        </button>
      </div>

      {/* Context badge — shows what the AI currently sees */}
      {hasContext ? (
        <div className="ai-context-badge ai-context-badge--active">
          <span className="ai-context-dot" />
          <span className="ai-context-text">
            Context active &mdash; <strong>{algorithm}</strong>, step {currentStep + 1}&nbsp;/&nbsp;{stepCount ?? '?'},
            array&nbsp;[{(dataArray ?? []).join(', ')}]
            {compareIndices?.length > 0 && <span className="ai-context-highlight"> &middot; comparing [{compareIndices.join(', ')}]</span>}
            {swapIndices?.length > 0 && <span className="ai-context-highlight"> &middot; swapping [{swapIndices.join(', ')}]</span>}
            {pivotIndices?.length > 0 && <span className="ai-context-highlight"> &middot; pivot [{pivotIndices.join(', ')}]</span>}
          </span>
        </div>
      ) : (
        <div className="ai-context-badge ai-context-badge--inactive">
          <span className="ai-context-dot" />
          <span className="ai-context-text">No visualizer context &mdash; start the algorithm on the visualizer page to enable context-aware answers.</span>
        </div>
      )}

      {/* Message history — no fixed height, grows with content */}
      <div className="chat-panel">
        <div className="chat-panel-header">Interactive AI support</div>
        <div className="chat-messages">
          {chatMessages.map((message, index) => (
            <div key={`${message.role}-${index}`} className={`chat-bubble ${message.role}`}>
              {message.role === 'assistant' ? (
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {message.content}
                </ReactMarkdown>
              ) : (
                message.content
              )}
            </div>
          ))}
          {isChatLoading && (
            <div className="chat-bubble assistant chat-bubble--thinking">
              <span className="thinking-dot" /><span className="thinking-dot" /><span className="thinking-dot" />
            </div>
          )}
          {/* Invisible anchor so new messages scroll into view */}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input bar — sticky to the bottom of the viewport */}
      <div className="chat-input-bar">
        <div className="chat-input-row">
          <input
            value={chatInput}
            onChange={(event) => setChatInput(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && !isChatLoading && handleSendChat()}
            placeholder={hasContext ? `Ask about step ${currentStep + 1} of ${algorithm}…` : 'Ask about a topic…'}
            disabled={isChatLoading}
          />
          <button onClick={handleSendChat} disabled={isChatLoading}>
            {isChatLoading ? '…' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}
