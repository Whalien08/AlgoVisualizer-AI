import React, { useState } from 'react';

export default function AIPage({ onBack }) {
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState([
    { role: 'assistant', content: 'Ask me anything about sorting, data structures, or algorithms and I will explain it clearly.' }
  ]);
  const [isChatLoading, setIsChatLoading] = useState(false);

  const handleSendChat = async () => {
    const message = chatInput.trim();
    if (!message) {
      return;
    }

    setChatMessages((prev) => [...prev, { role: 'user', content: message }]);
    setChatInput('');
    setIsChatLoading(true);

    try {
      const response = await fetch('http://localhost:8000/api/v1/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message })
      });

      const data = await response.json();
      setChatMessages((prev) => [
        ...prev,
        { role: 'assistant', content: data.reply || 'I could not generate an answer right now.' }
      ]);
    } catch (error) {
      setChatMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'The chat service is currently unavailable. Please try again shortly.' }
      ]);
    } finally {
      setIsChatLoading(false);
    }
  };

  return (
    <div className="ai-page">
      <div className="page-header">
        <div>
          <h1>AI Assistant</h1>
          <p className="page-subtitle">Ask for explanations, walkthroughs, or algorithm comparisons without leaving the visualizer flow.</p>
        </div>
        <button className="chat-toggle" onClick={onBack}>
          ← Back to Visualizer
        </button>
      </div>

      <div className="chat-panel">
        <div className="chat-panel-header">Interactive AI support</div>
        <div className="chat-messages">
          {chatMessages.map((message, index) => (
            <div key={`${message.role}-${index}`} className={`chat-bubble ${message.role}`}>
              {message.content}
            </div>
          ))}
        </div>
        <div className="chat-input-row">
          <input
            value={chatInput}
            onChange={(event) => setChatInput(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && handleSendChat()}
            placeholder="Ask about a topic..."
          />
          <button onClick={handleSendChat} disabled={isChatLoading}>
            {isChatLoading ? '...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}
