'use client';

import React, { useState, useRef, useEffect } from 'react';
import { 
  MessageSquareCode, 
  Send, 
  Sparkles, 
  Compass, 
  Play, 
  Copy, 
  Check, 
  Volume2, 
  VolumeX, 
  Trash2,
  Bot,
  User,
  HelpCircle,
  BookOpen
} from 'lucide-react';
import { LectureArtifact } from '@/types/lecture';

interface SocraticChatProps {
  artifact: LectureArtifact;
  currentTime: number;
  onSeek: (seconds: number) => void;
  apiKey?: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export function SocraticChat({ artifact, currentTime, onSeek, apiKey }: SocraticChatProps) {
  const messageIdCounter = useRef(1);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome-msg',
      role: 'assistant',
      content: `Welcome to your Socratic study session for **"${artifact.title}"**!

I have ingested the entire lecture, including the **${artifact.concepts.length} key conceptual milestones**, prerequisite dependency graph, and golden breakthrough snippets.

Ask me anything about this lecture! Whenever I reference a concept, I will include timestamp markers like **[${artifact.concepts[0]?.timestampFormatted || '02:00'}]** that you can click to jump the media player instantly.`,
      timestamp: 'Session Start',
    },
  ]);

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<'socratic' | 'direct'>('socratic');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [speakingId, setSpeakingId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Handle TTS playback via Web Speech API
  const handleSpeak = (text: string, id: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    if (speakingId === id) {
      window.speechSynthesis.cancel();
      setSpeakingId(null);
      return;
    }

    window.speechSynthesis.cancel();
    // Clean markdown before speaking
    const cleanText = text.replace(/\[\d{1,2}:\d{2}\]/g, '').replace(/[*_#`$]/g, '');
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.05;
    utterance.pitch = 1.0;
    utterance.onend = () => setSpeakingId(null);
    utterance.onerror = () => setSpeakingId(null);

    setSpeakingId(id);
    window.speechSynthesis.speak(utterance);
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const currentPlaybackFormatted = `${Math.floor(currentTime / 60)}:${(currentTime % 60)
    .toString()
    .padStart(2, '0')}`;

  const handleSendMessage = async (userPrompt?: string) => {
    const textToSend = (userPrompt || input).trim();
    if (!textToSend || isLoading) return;

    const userMsgId = `user-${messageIdCounter.current++}`;
    const userMsg: ChatMessage = {
      id: userMsgId,
      role: 'user',
      content: textToSend,
      timestamp: currentPlaybackFormatted,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      // Build history for context
      const history = messages
        .filter((m) => m.id !== 'welcome-msg')
        .slice(-6)
        .map((m) => ({
          role: m.role === 'user' ? ('user' as const) : ('model' as const),
          content: m.content,
        }));

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { 'x-gemini-key': apiKey } : {}),
        },
        body: JSON.stringify({
          message: textToSend,
          history,
          artifact,
          mode,
          currentPlaybackTime: currentPlaybackFormatted,
        }),
      });

      const data = await res.json();
      const reply = data.reply || 'I processed your question based on the lecture notes.';

      const asstMsgId = `asst-${messageIdCounter.current++}`;
      const assistantMsg: ChatMessage = {
        id: asstMsgId,
        role: 'assistant',
        content: reply,
        timestamp: currentPlaybackFormatted,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      console.error('Chat error:', err);
      const errMsgId = `asst-err-${messageIdCounter.current++}`;
      setMessages((prev) => [
        ...prev,
        {
          id: errMsgId,
          role: 'assistant',
          content: 'I had trouble connecting to the tutor service. Please check your network connection.',
          timestamp: currentPlaybackFormatted,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // Convert [MM:SS] timestamp references in text to clickable jump links
  const renderMessageContent = (content: string) => {
    const timestampRegex = /\[(\d{1,2}):(\d{2})\]/g;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match;

    while ((match = timestampRegex.exec(content)) !== null) {
      const matchIndex = match.index;
      const minutes = parseInt(match[1], 10);
      const seconds = parseInt(match[2], 10);
      const totalSeconds = minutes * 60 + seconds;
      const fullMatch = match[0];

      if (matchIndex > lastIndex) {
        parts.push(content.substring(lastIndex, matchIndex));
      }

      parts.push(
        <button
          key={`seek-${matchIndex}`}
          type="button"
          onClick={() => onSeek(totalSeconds)}
          className="inline-flex items-center gap-1 mx-1 px-2 py-0.5 rounded-lg bg-indigo-500/20 hover:bg-indigo-500 text-indigo-300 hover:text-white border border-indigo-500/30 text-xs font-mono font-semibold transition-all align-baseline cursor-pointer"
          title={`Jump video player to ${fullMatch}`}
        >
          <Play className="w-2.5 h-2.5 fill-current" />
          <span>{fullMatch}</span>
        </button>
      );

      lastIndex = matchIndex + fullMatch.length;
    }

    if (lastIndex < content.length) {
      parts.push(content.substring(lastIndex));
    }

    return (
      <div className="whitespace-pre-wrap leading-relaxed text-sm">
        {parts.map((p, i) => (
          <React.Fragment key={i}>{p}</React.Fragment>
        ))}
      </div>
    );
  };

  const quickPrompts = [
    `Explain the intuition of "${artifact.concepts[0]?.title || 'the first concept'}" with an everyday analogy.`,
    `What is the most frequent misconception students have in this lecture?`,
    `Walk me through the mathematical formulation step by step.`,
    `How does the prerequisite graph connect these topics?`,
  ];

  return (
    <div className="flex flex-col h-[750px] rounded-2xl border border-white/10 bg-slate-950/80 backdrop-blur-xl shadow-2xl overflow-hidden animate-in fade-in duration-300">
      {/* Top Header / Mode Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-white/10 bg-slate-900/60">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <MessageSquareCode className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              Socratic AI Lecture Tutor
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Context-Aware
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Grounded in {artifact.concepts.length} milestones • Click [MM:SS] citations to jump media player
            </p>
          </div>
        </div>

        {/* Right Controls: Mode Toggle & Actions */}
        <div className="flex items-center gap-2">
          {/* Mode Switcher */}
          <div className="flex items-center p-1 rounded-xl bg-slate-900 border border-white/10 text-xs">
            <button
              type="button"
              onClick={() => setMode('socratic')}
              className={`flex items-center gap-1 px-3 py-1 rounded-lg font-medium transition-all ${
                mode === 'socratic'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Guides you with probing questions and analogies"
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Socratic Mentor</span>
            </button>
            <button
              type="button"
              onClick={() => setMode('direct')}
              className={`flex items-center gap-1 px-3 py-1 rounded-lg font-medium transition-all ${
                mode === 'direct'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Gives direct mathematical breakdowns and formal explanations"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Direct Professor</span>
            </button>
          </div>

          {/* Clear Chat */}
          <button
            type="button"
            onClick={() => setMessages(messages.slice(0, 1))}
            className="p-2 rounded-xl bg-slate-900 border border-white/10 text-slate-400 hover:text-rose-400 hover:border-rose-500/30 transition-colors"
            title="Reset conversation"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {messages.map((msg) => {
          const isUser = msg.role === 'user';

          return (
            <div
              key={msg.id}
              className={`flex gap-3 max-w-3xl ${isUser ? 'ml-auto justify-end' : 'mr-auto justify-start'}`}
            >
              {/* Assistant Avatar */}
              {!isUser && (
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shrink-0 shadow-md">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              {/* Message Bubble */}
              <div
                className={`relative group rounded-2xl p-4 shadow-lg transition-all ${
                  isUser
                    ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white border border-indigo-400/30 rounded-tr-none'
                    : 'bg-slate-900/90 text-slate-200 border border-white/10 rounded-tl-none'
                }`}
              >
                {/* Header info */}
                <div className="flex items-center justify-between gap-4 mb-2 text-[11px] text-slate-400">
                  <span className="font-semibold text-slate-300">
                    {isUser ? 'You' : mode === 'socratic' ? 'Socratic Mentor' : 'Professor'}
                  </span>
                  <span>{msg.timestamp}</span>
                </div>

                {/* Content */}
                {renderMessageContent(msg.content)}

                {/* Assistant Bubble Actions */}
                {!isUser && (
                  <div className="flex items-center gap-2 mt-3 pt-2 border-t border-white/5 opacity-80 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={() => handleSpeak(msg.content, msg.id)}
                      className={`flex items-center gap-1 text-xs px-2 py-1 rounded-lg border transition-colors ${
                        speakingId === msg.id
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30 animate-pulse'
                          : 'bg-slate-800/60 text-slate-400 hover:text-white border-white/5'
                      }`}
                      title={speakingId === msg.id ? 'Stop audio' : 'Listen via Web Speech'}
                    >
                      {speakingId === msg.id ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
                      <span>{speakingId === msg.id ? 'Mute' : 'Listen'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleCopy(msg.content, msg.id)}
                      className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-slate-800/60 text-slate-400 hover:text-white border border-white/5 transition-colors"
                      title="Copy text"
                    >
                      {copiedId === msg.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedId === msg.id ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                )}
              </div>

              {/* User Avatar */}
              {isUser && (
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white shrink-0 shadow-md">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          );
        })}

        {/* Loading Indicator */}
        {isLoading && (
          <div className="flex gap-3 max-w-xl mr-auto">
            <div className="w-8 h-8 rounded-xl bg-emerald-600/30 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 animate-pulse">
              <Bot className="w-4 h-4" />
            </div>
            <div className="p-4 rounded-2xl rounded-tl-none bg-slate-900 border border-white/10 flex items-center gap-2 text-xs text-slate-400">
              <Sparkles className="w-4 h-4 text-emerald-400 animate-spin" />
              <span>Analyzing lecture context &amp; timestamp nodes...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Quick Prompt Chips */}
      <div className="px-6 py-2.5 bg-slate-900/40 border-t border-white/5 flex items-center gap-2 overflow-x-auto no-scrollbar">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1 shrink-0">
          <HelpCircle className="w-3 h-3" /> Quick Prompts:
        </span>
        {quickPrompts.map((prompt, i) => (
          <button
            key={i}
            type="button"
            onClick={() => handleSendMessage(prompt)}
            className="text-xs px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-white/10 hover:border-emerald-500/40 text-slate-300 hover:text-white transition-all whitespace-nowrap shrink-0"
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Input Form Bar */}
      <div className="p-4 border-t border-white/10 bg-slate-900/80">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-center gap-3"
        >
          <div className="relative flex-1">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={`Ask the Socratic Tutor anything about ${artifact.title}...`}
              className="w-full bg-slate-950 border border-white/10 focus:border-emerald-500/50 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none transition-all shadow-inner pr-10"
              disabled={isLoading}
            />
          </div>

          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-semibold text-sm shadow-lg shadow-emerald-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all transform hover:scale-[1.02] active:scale-[0.98] shrink-0"
          >
            <Send className="w-4 h-4" />
            <span className="hidden sm:inline">Ask Tutor</span>
          </button>
        </form>
      </div>
    </div>
  );
}
