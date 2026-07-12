import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// ── Prompt builders ───────────────────────────────────────────────────────

function buildQuizPrompt(ctx, chatContext) {
  const highlights = [];
  if (ctx.compare_indices?.length) highlights.push(`comparing indices ${JSON.stringify(ctx.compare_indices)}`);
  if (ctx.swap_indices?.length)    highlights.push(`swapping indices ${JSON.stringify(ctx.swap_indices)}`);
  if (ctx.pivot_indices?.length)   highlights.push(`pivot at index ${JSON.stringify(ctx.pivot_indices)}`);
  const highlightStr = highlights.length ? highlights.join('; ') : 'no highlighted elements';

  return (
    `Your name is Elix. You are a quiz tutor for a computer science learning platform.\n\n` +
    `[RECENT CONVERSATION]\n${chatContext || 'None'}\n\n` +
    `[VISUALIZER STATE]\n` +
    `Algorithm: ${ctx.algorithm}\n` +
    `Step: ${ctx.current_step + 1} of ${ctx.step_count ?? '?'}\n` +
    `Array: ${JSON.stringify(ctx.data_array)}\n` +
    `Highlights: ${highlightStr}\n\n` +
    `INSTRUCTIONS:\n` +
    `1. Analyze the [RECENT CONVERSATION]. If the user was just asking about a general concept (like Linked Lists, Graph Traversal, Trees, etc.), ask them ONE short, focused conceptual quiz question about THAT topic to test their understanding.\n` +
    `2. IF there is no recent conceptual conversation, use the [VISUALIZER STATE] to ask ONE short question about what the algorithm will do NEXT, or why the highlighted indices were chosen.\n` +
    `3. Do NOT reveal the answer. Keep it to 2–3 sentences maximum. End with a clear question mark.`
  );
}

function buildGradePrompt(question, studentAnswer, ctx, chatContext) {
  const highlights = [];
  if (ctx.compare_indices?.length) highlights.push(`comparing indices ${JSON.stringify(ctx.compare_indices)}`);
  if (ctx.swap_indices?.length)    highlights.push(`swapping indices ${JSON.stringify(ctx.swap_indices)}`);
  if (ctx.pivot_indices?.length)   highlights.push(`pivot at index ${JSON.stringify(ctx.pivot_indices)}`);
  const highlightStr = highlights.length ? highlights.join('; ') : 'no highlighted elements';

  return (
    `Your name is Elix. You are grading a student's answer to a recent quiz question.\n\n` +
    `[RECENT CONVERSATION CONTEXT]\n${chatContext || 'None'}\n\n` +
    `[VISUALIZER CONTEXT — step ${ctx.current_step + 1}]\n` +
    `Array: ${JSON.stringify(ctx.data_array)} | Highlights: ${highlightStr}\n\n` +
    `Quiz question asked: "${question}"\n` +
    `Student's answer: "${studentAnswer}"\n\n` +
    `INSTRUCTIONS to grade the answer:\n` +
    `1. Start strictly with Correct, Partially correct, or Incorrect.\n` +
    `2. In 2–4 sentences, explain why they are right or wrong.\n` +
    `3. If it was a visualizer question, reference the actual array values. If it was a conceptual question, explain the underlying computer science principle clearly.`
    `4. 3. CRITICAL: Immediately after your explanation, generate a NEW, different quiz question based on the visualizer context to keep testing the student. End your response with this new question mark.`
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
    if (isChatLoading) return; // Removed !hasContext so quizzes work anywhere

    const snapshot = ctxPayload();
    
    // Grab the last 4 messages to give Elix context on what we were just talking about
    const recentChat = chatMessages
      .slice(-4)
      .map(m => `${m.role === 'user' ? 'Student' : 'Elix'}: ${m.content.substring(0, 150)}...`)
      .join('\n');

    setChatMessages((prev) => [
      ...prev,
      { role: 'assistant', content: '🧠 **Quiz time!** Let me think of a good question...', variant: 'quiz-intro' },
    ]);
    setIsChatLoading(true);

    try {
      const question = await callChat(buildQuizPrompt(snapshot, recentChat));
      setQuizState({ question, snapshot, recentChat }); // Save recentChat for grading
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
    const { question, snapshot, recentChat } = quizState;

    setChatMessages((prev) => [
      ...prev,
      { role: 'user', content: answer, variant: 'quiz-answer' },
    ]);
    setChatInput('');
    setIsChatLoading(true);

    try {
      const gradePrompt = buildGradePrompt(question, answer, snapshot, recentChat);
      const reply = await callChat(gradePrompt);
      setChatMessages((prev) => [
        ...prev,
        { role: 'assistant', content: reply, variant: 'quiz-result' },
      ]);
      setQuizState({ question: reply, snapshot: ctxPayload(), recentChat });
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
                disabled={isChatLoading}
                title="Quiz me on the current step or recent conversation"
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
