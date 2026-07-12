import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// ── Prompt builders ───────────────────────────────────────────────────────

function buildQuizPrompt(ctx) {
  const highlights = [];
  if (ctx.compare_indices?.length) highlights.push(`comparing indices ${JSON.stringify(ctx.compare_indices)}`);
  if (ctx.swap_indices?.length)    highlights.push(`swapping indices ${JSON.stringify(ctx.swap_indices)}`);
  if (ctx.pivot_indices?.length)   highlights.push(`pivot at index ${JSON.stringify(ctx.pivot_indices)}`);
  const highlightStr = highlights.length ? highlights.join('; ') : 'no highlighted elements';

  return (
    `Your name is Elix. Greet user and introduce yourself as Elix`+
    `You are a quiz tutor for an algorithm visualizer. ` +
    `The student is watching ${ctx.algorithm} step by step.\n\n` +
    `[CURRENT STATE]\n` +
    `Step: ${ctx.current_step + 1} of ${ctx.step_count ?? '?'}\n` +
    `Array: ${JSON.stringify(ctx.data_array)}\n` +
    `Active highlights: ${highlightStr}\n` +
    `Step narration: ${ctx.current_narration ?? 'none'}\n` +
    `[END STATE]\n\n` +
    `Ask the student ONE short, focused question about what the algorithm will do NEXT — ` +
    `or why the current highlighted elements were chosen. ` +
    `Do NOT reveal the answer. Keep it to 2–3 sentences maximum. ` +
    `End with a clear question mark so the student knows what to answer.`
  );
}

function buildGradePrompt(question, studentAnswer, ctx) {
  const highlights = [];
  if (ctx.compare_indices?.length) highlights.push(`comparing indices ${JSON.stringify(ctx.compare_indices)}`);
  if (ctx.swap_indices?.length)    highlights.push(`swapping indices ${JSON.stringify(ctx.swap_indices)}`);
  if (ctx.pivot_indices?.length)   highlights.push(`pivot at index ${JSON.stringify(ctx.pivot_indices)}`);
  const highlightStr = highlights.length ? highlights.join('; ') : 'no highlighted elements';

  return (
    `Your name is Elix. Greet user and introduce yourself as Elix`+ 
    `You are a quiz tutor grading a student's answer about ${ctx.algorithm}.\n\n` +
    `[QUIZ CONTEXT — step ${ctx.current_step + 1} of ${ctx.step_count ?? '?'}]\n` +
    `Array at quiz time: ${JSON.stringify(ctx.data_array)}\n` +
    `Active highlights: ${highlightStr}\n` +
    `Step narration: ${ctx.current_narration ?? 'none'}\n` +
    `[END CONTEXT]\n\n` +
    `Quiz question asked: "${question}"\n` +
    `Student's answer: "${studentAnswer}"\n\n` +
    `Grade the answer clearly:\n` +
    `1. Start with Correct, Partially correct, or Incorrect.\n` +
    `2. In 2–4 sentences explain why, referencing the actual array values and indices.\n` +
    `3. Briefly show what the algorithm actually does next (one sentence or a short visual).`
  );
}

// ── Component ─────────────────────────────────────────────────────────────

export default function AIPage({ onBack, vizContext = {} }) {
  const [chatInput, setChatInput]     = useState('');
  const [chatMessages, setChatMessages] = useState(() => {
    const savedChat = localStorage.getItem('elixChatHistory');
    if (savedChat) {
      return JSON.parse(savedChat);
    }
    return [
      {
        role: 'assistant',
        content:
          'My name is Elix.'+
          'Ask me anything about sorting, data structures, or algorithms and I will explain it clearly.\n\n' +
          'If the visualizer is running, I can see exactly which step you are on — try asking **"Why did it just swap those two?"** ' +
          'or press **🧠 Quiz Me** and I will test your understanding of the current step.',
      },
    ];
  });
  const [isChatLoading, setIsChatLoading] = useState(false);
  // null  → idle   |   { question, snapshot } → awaiting student answer
  const [quizState, setQuizState] = useState(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  useEffect(() => {
    localStorage.setItem('elixChatHistory', JSON.stringify(chatMessages));
  }, [chatMessages]);

  // Clear chat history
  const handleClearChat = () => {
    const defaultMessage = [
      {
        role: 'assistant',
        content:
          'Ask me anything about sorting, data structures, or algorithms and I will explain it clearly.\n\n' +
          'If the visualizer is running, I can see exactly which step you are on — try asking **"Why did it just swap those two?"** ' +
          'or press **🧠 Quiz Me** and I will test your understanding of the current step.',
      },
    ];
    setChatMessages(defaultMessage);
    localStorage.removeItem('elixChatHistory');
  };

  const {
    algorithm      = null,
    currentStep    = null,
    stepCount      = null,
    dataArray      = null,
    compareIndices = null,
    swapIndices    = null,
    pivotIndices   = null,
    narrationText  = null,
  } = vizContext;

  const hasContext = algorithm != null && currentStep != null;

  // Build the context object that both prompt builders and the backend need
  const ctxPayload = () => ({
    algorithm,
    current_step:     currentStep,
    step_count:       stepCount,
    data_array:       dataArray,
    compare_indices:  compareIndices,
    swap_indices:     swapIndices,
    pivot_indices:    pivotIndices,
    current_narration: narrationText,
  });

  // Shared fetch helper — posts to /api/v1/chat and returns the reply string
  const callChat = async (message, extra = {}) => {
    const response = await fetch('/api/v1/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, ...ctxPayload(), ...extra }),
    });
    const data = await response.json();
    return data.reply || 'I could not generate an answer right now.';
  };

  // ── Normal chat ───────────────────────────────────────────────────────
  const handleSendChat = async () => {
    const message = chatInput.trim();
    if (!message) return;

    // If a quiz is active, treat this message as the student's answer
    if (quizState) {
      await handleQuizAnswer(message);
      return;
    }

    setChatMessages((prev) => [...prev, { role: 'user', content: message }]);
    setChatInput('');
    setIsChatLoading(true);

    try {
      const reply = await callChat(message);
      setChatMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
    } catch {
      setChatMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'The chat service is currently unavailable. Please try again shortly.' },
      ]);
    } finally {
      setIsChatLoading(false);
    }
  };

  // ── Quiz Me — Phase 1: generate the question ──────────────────────────
  const handleQuizMe = async () => {
    if (!hasContext || isChatLoading) return;

    // Freeze a snapshot of the context at the exact moment Quiz Me is pressed
    const snapshot = ctxPayload();

    setChatMessages((prev) => [
      ...prev,
      { role: 'assistant', content: '🧠 **Quiz time!** Let me look at what is happening on screen…', variant: 'quiz-intro' },
    ]);
    setIsChatLoading(true);

    try {
      const question = await callChat(buildQuizPrompt(snapshot));
      setQuizState({ question, snapshot });
      setChatMessages((prev) => [
        ...prev,
        { role: 'assistant', content: question, variant: 'quiz-question' },
      ]);
    } catch {
      setChatMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Could not generate a quiz question right now. Please try again.' },
      ]);
    } finally {
      setIsChatLoading(false);
    }
  };

  // ── Quiz answer — Phase 2: grade the answer ───────────────────────────
  const handleQuizAnswer = async (answer) => {
    const { question, snapshot } = quizState;

    setChatMessages((prev) => [
      ...prev,
      { role: 'user', content: answer, variant: 'quiz-answer' },
    ]);
    setChatInput('');
    setIsChatLoading(true);
    // Clear quiz state now so a slow response doesn't keep the UI locked
    setQuizState(null);

    try {
      const gradePrompt = buildGradePrompt(question, answer, snapshot);
      const reply = await callChat(gradePrompt);
      setChatMessages((prev) => [
        ...prev,
        { role: 'assistant', content: reply, variant: 'quiz-result' },
      ]);
    } catch {
      setChatMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Could not grade your answer right now. Please try again.' },
      ]);
    } finally {
      setIsChatLoading(false);
    }
  };

  // ── Cancel quiz ───────────────────────────────────────────────────────
  const handleCancelQuiz = () => {
    setQuizState(null);
    setChatMessages((prev) => [
      ...prev,
      { role: 'assistant', content: 'Quiz cancelled. Feel free to keep exploring!' },
    ]);
  };

  // ── Derived UI state ──────────────────────────────────────────────────
  const inQuiz         = quizState !== null;
  const inputPlaceholder = inQuiz
    ? 'Type your answer and press Send…'
    : hasContext
      ? `Ask about step ${currentStep + 1} of ${algorithm}…`
      : 'Ask about a topic…';

  return (
    <div className="ai-page">
      <div className="page-header">
        <div>
          <h1>AI Assistant</h1>
          <p className="page-subtitle">
            Ask for explanations, walkthroughs, or algorithm comparisons without leaving the visualizer flow.
          </p>
        </div>
        <div className="page-header-actions" style={{ display: 'flex', gap: '8px' }}>
          <button className="chat-toggle btn-secondary" onClick={handleClearChat}>
            Clear
          </button>
          <button className="chat-toggle" onClick={onBack}>
            ← Back
          </button>
        </div>
      </div>

      {/* Context badge */}
      {hasContext ? (
        <div className="ai-context-badge ai-context-badge--active">
          <span className="ai-context-dot" />
          <span className="ai-context-text">
            Context active &mdash; <strong>{algorithm}</strong>, step {currentStep + 1}&nbsp;/&nbsp;{stepCount ?? '?'},
            array&nbsp;[{(dataArray ?? []).join(', ')}]
            {compareIndices?.length > 0 && <span className="ai-context-highlight"> &middot; comparing [{compareIndices.join(', ')}]</span>}
            {swapIndices?.length > 0    && <span className="ai-context-highlight"> &middot; swapping [{swapIndices.join(', ')}]</span>}
            {pivotIndices?.length > 0   && <span className="ai-context-highlight"> &middot; pivot [{pivotIndices.join(', ')}]</span>}
          </span>
        </div>
      ) : (
        <div className="ai-context-badge ai-context-badge--inactive">
          <span className="ai-context-dot" />
          <span className="ai-context-text">
            No visualizer context &mdash; start the algorithm on the visualizer page to enable context-aware answers.
          </span>
        </div>
      )}

      {/* Message history */}
      <div className="chat-panel">
        <div className="chat-panel-header">Interactive AI support</div>
        <div className="chat-messages">
          {chatMessages.map((message, index) => (
            <div
              key={`${message.role}-${index}`}
              className={[
                'chat-bubble',
                message.role,
                message.variant ? `chat-bubble--${message.variant}` : '',
              ].filter(Boolean).join(' ')}
            >
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
          <div ref={bottomRef} />
        </div>
      </div>
    {/* Quiz active banner */}
      {inQuiz && (
        <div className="quiz-active-banner">
          <span>🧠 Quiz in progress — read the question above and type your answer below</span>
          <button className="quiz-cancel-btn" onClick={handleCancelQuiz}>
            Cancel Quiz
          </button>
        </div>
      )}

      {/* Input bar */}
      <div className={`chat-input-bar${inQuiz ? ' chat-input-bar--quiz' : ''}`}>
        <div className="chat-input-row">
          <input
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !isChatLoading && handleSendChat()}
            placeholder={inputPlaceholder}
            disabled={isChatLoading}
          />
          {inQuiz ? (
            <button onClick={handleSendChat} disabled={isChatLoading || !chatInput.trim()}>
              {isChatLoading ? '…' : 'Answer'}
            </button>
          ) : (
            <>
              <button
                className="quiz-btn"
                onClick={handleQuizMe}
                disabled={!hasContext || isChatLoading}
                title={hasContext ? 'Quiz me on the current step' : 'Start an algorithm on the visualizer first'}
              >
                🧠 Quiz Me
              </button>
              <button onClick={handleSendChat} disabled={isChatLoading}>
                {isChatLoading ? '…' : 'Send'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
