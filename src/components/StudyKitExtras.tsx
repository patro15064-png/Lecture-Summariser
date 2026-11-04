'use client';

import React, { useState } from 'react';
import { 
  Sparkles, 
  BookA, 
  FileQuestion, 
  ListOrdered, 
  MessageSquareCode, 
  Search, 
  Copy, 
  Check, 
  FileText, 
  Clock, 
  Send, 
  Bot, 
  User, 
  ShieldCheck
} from 'lucide-react';
import { 
  LectureArtifact, 
  GlossaryTerm, 
  FormulaOrDateItem, 
  LikelyExamQuestion, 
  StudyPlanSession 
} from '@/types/lecture';
import { MathView } from './MathView';

interface StudyKitExtrasProps {
  artifact: LectureArtifact;
}

export function StudyKitExtras({ artifact }: StudyKitExtrasProps) {
  const [activeSubTab, setActiveSubTab] = useState<'glossary' | 'formulas' | 'exams' | 'plan' | 'chat'>('glossary');
  const [glossarySearch, setGlossarySearch] = useState('');
  const [copiedFormula, setCopiedFormula] = useState<string | null>(null);

  // Chat with my material state
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<Array<{ role: 'user' | 'assistant'; text: string; citation?: string }>>([
    {
      role: 'assistant',
      text: `Hello! I am your grounded study assistant. I answer questions strictly based on the material in "${artifact.title}". How can I help you master these concepts today?`,
    },
  ]);
  const [isChatLoading, setIsChatLoading] = useState(false);

  // Derive glossary from artifact or fallback from concepts
  const glossary: GlossaryTerm[] =
    artifact.extras?.glossary && artifact.extras.glossary.length > 0
      ? artifact.extras.glossary
      : (artifact.concepts || []).map((c) => ({
          term: c.title,
          definition: c.summary,
          context: c.explanation.slice(0, 140),
          sourceCitation: c.sourceCitation,
        }));

  // Derive formulas and dates
  const formulasAndDates: FormulaOrDateItem[] =
    artifact.extras?.importantFormulasAndDates && artifact.extras.importantFormulasAndDates.length > 0
      ? artifact.extras.importantFormulasAndDates
      : (artifact.concepts || [])
          .filter((c) => c.formulaLatex)
          .map((c) => ({
            item: c.title,
            description: c.summary,
            category: 'formula' as const,
            latex: c.formulaLatex,
            sourceCitation: c.sourceCitation,
          }));

  // Derive exam questions
  const examQuestions: LikelyExamQuestion[] =
    artifact.extras?.likelyExamQuestions && artifact.extras.likelyExamQuestions.length > 0
      ? artifact.extras.likelyExamQuestions
      : (artifact.concepts || []).slice(0, 4).map((c, idx) => ({
          question: `Explain the fundamental principles and operational significance of ${c.title}. Provide at least two concrete implications.`,
          difficulty: idx % 2 === 0 ? 'standard' : 'challenging',
          answerOutline: c.explanation,
          keyPoints: c.keyTakeaways || ['Core definition', 'Application bounds', 'Prerequisite connections'],
          sourceCitation: c.sourceCitation,
        }));

  // Derive study plan
  const studyPlan: StudyPlanSession[] =
    artifact.extras?.studyPlan && artifact.extras.studyPlan.length > 0
      ? artifact.extras.studyPlan
      : [
          {
            dayOrSession: 'Day 1: Foundations',
            topic: 'Core Concepts & Terminology Drill',
            activities: ['Review Executive Summary & ELI12 analogies', 'Run 1st pass of Flashcards under SM-2', 'Inspect Concept Graph prerequisites'],
            timeMinutes: 30,
          },
          {
            dayOrSession: 'Day 2: Deep Dive',
            topic: 'Formula Mechanics & Mathematical Rigor',
            activities: ['Work through mathematical formulas & LaTeX derivations', 'Complete Diagnostic Misconception Quizzes', 'Identify and review missed questions'],
            timeMinutes: 45,
          },
          {
            dayOrSession: 'Day 3: Mastery & Synthesis',
            topic: 'Mock Exam Simulation & Active Recall',
            activities: ['Write short-answer responses to Likely Exam Questions', 'Review spaced repetition cards due today', 'Self-assess using the grounded Chat assistant'],
            timeMinutes: 40,
          },
        ];

  const filteredGlossary = glossary.filter((g) =>
    g.term.toLowerCase().includes(glossarySearch.toLowerCase()) ||
    g.definition.toLowerCase().includes(glossarySearch.toLowerCase())
  );

  const handleCopyFormula = (latex: string) => {
    navigator.clipboard.writeText(latex);
    setCopiedFormula(latex);
    setTimeout(() => setCopiedFormula(null), 2000);
  };

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isChatLoading) return;

    const userQ = chatInput.trim();
    setChatInput('');
    setChatMessages((prev) => [...prev, { role: 'user', text: userQ }]);
    setIsChatLoading(true);

    // Grounded retrieval across concepts and summary
    setTimeout(() => {
      const lower = userQ.toLowerCase();
      const matchedConcept = (artifact.concepts || []).find((c) =>
        lower.includes(c.title.toLowerCase()) ||
        c.summary.toLowerCase().split(' ').some((w) => w.length > 4 && lower.includes(w))
      );

      let reply = '';
      let citation = '';

      if (matchedConcept) {
        reply = `According to the uploaded material regarding "${matchedConcept.title}": ${matchedConcept.explanation}\n\nKey grounded insight: "${matchedConcept.verbatimQuote || matchedConcept.summary}"`;
        citation = `${matchedConcept.sourceCitation?.filename || artifact.title}${matchedConcept.sourceCitation?.pageNumber ? ` (Page ${matchedConcept.sourceCitation.pageNumber})` : ''}`;
      } else {
        reply = `Based on the synthesis of "${artifact.title}": ${artifact.overview}\n\nKey themes highlighted in your documents include: ${(artifact.keyThemes || []).join(', ')}.`;
        citation = artifact.title;
      }

      setChatMessages((prev) => [
        ...prev,
        { role: 'assistant', text: reply, citation },
      ]);
      setIsChatLoading(false);
    }, 600);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Sub-Tabs Navigation Header */}
      <div className="flex border-b border-white/10 overflow-x-auto no-scrollbar gap-2 p-1 bg-slate-950/70 backdrop-blur-xl rounded-2xl border">
        <button
          type="button"
          onClick={() => setActiveSubTab('glossary')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
            activeSubTab === 'glossary'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <BookA className="w-4 h-4" />
          <span>Glossary of Terms ({glossary.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('formulas')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
            activeSubTab === 'formulas'
              ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>Formulas &amp; Dates ({formulasAndDates.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('exams')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
            activeSubTab === 'exams'
              ? 'bg-pink-600 text-white shadow-md shadow-pink-600/20'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <FileQuestion className="w-4 h-4" />
          <span>Exam Questions ({examQuestions.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('plan')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
            activeSubTab === 'plan'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <ListOrdered className="w-4 h-4" />
          <span>Suggested Study Plan</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('chat')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
            activeSubTab === 'chat'
              ? 'bg-amber-600 text-white shadow-md shadow-amber-600/20'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <MessageSquareCode className="w-4 h-4" />
          <span>Chat with My Material</span>
        </button>
      </div>

      {/* 1. GLOSSARY VIEW */}
      {activeSubTab === 'glossary' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={glossarySearch}
                onChange={(e) => setGlossarySearch(e.target.value)}
                placeholder="Search glossary terms or definitions..."
                className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-900 border border-white/10 text-xs sm:text-sm text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
            <span className="text-xs text-slate-400 font-mono">
              {filteredGlossary.length} Terms Found
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredGlossary.map((item, idx) => (
              <div
                key={idx}
                className="rounded-2xl border border-white/10 bg-slate-950/70 p-5 space-y-2 hover:border-indigo-500/30 transition-all shadow-md"
              >
                <div className="flex items-start justify-between gap-2">
                  <h4 className="text-base font-bold text-white tracking-tight">
                    {item.term}
                  </h4>
                  {item.sourceCitation && (
                    <span className="text-[10px] font-mono text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                      {item.sourceCitation.filename}
                    </span>
                  )}
                </div>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-light">
                  {item.definition}
                </p>
                {item.context && (
                  <p className="text-xs text-slate-400 italic pt-1 border-t border-white/5">
                    Context: {item.context}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. FORMULAS & DATES VIEW */}
      {activeSubTab === 'formulas' && (
        <div className="space-y-4">
          {formulasAndDates.length === 0 ? (
            <div className="p-8 rounded-2xl border border-white/10 bg-slate-950/70 text-center text-slate-400 text-xs">
              No mathematical equations or dates detected in this study kit.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {formulasAndDates.map((item, idx) => (
                <div
                  key={idx}
                  className="rounded-2xl border border-white/10 bg-slate-950/70 p-5 space-y-3 shadow-md"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs uppercase font-bold text-purple-300 bg-purple-500/10 px-2.5 py-0.5 rounded-full border border-purple-500/20">
                      {item.category}
                    </span>
                    {item.latex && (
                      <button
                        type="button"
                        onClick={() => handleCopyFormula(item.latex || '')}
                        className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white bg-slate-900 px-2 py-1 rounded-lg border border-white/5"
                        title="Copy LaTeX"
                      >
                        {copiedFormula === item.latex ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" />
                            <span className="text-emerald-400">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copy LaTeX</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  <h4 className="text-sm font-bold text-white">{item.item}</h4>

                  {item.latex && (
                    <div className="p-3.5 rounded-xl bg-slate-900 border border-white/5 text-center overflow-x-auto">
                      <MathView math={item.latex} displayMode={true} />
                    </div>
                  )}

                  <p className="text-xs text-slate-300 leading-relaxed font-light">
                    {item.description}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 3. LIKELY EXAM QUESTIONS VIEW */}
      {activeSubTab === 'exams' && (
        <div className="space-y-4">
          <div className="space-y-4">
            {examQuestions.map((q, idx) => (
              <div
                key={idx}
                className="rounded-2xl border border-white/10 bg-slate-950/70 p-6 space-y-4 shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-pink-500/20 text-pink-300 font-mono font-bold text-xs flex items-center justify-center shrink-0">
                      Q{idx + 1}
                    </span>
                    <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-md ${q.difficulty === 'challenging' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'}`}>
                      {q.difficulty}
                    </span>
                  </div>
                  {q.sourceCitation && (
                    <span className="text-[11px] font-mono text-slate-400 bg-slate-900 px-2.5 py-0.5 rounded-full border border-white/5">
                      {q.sourceCitation.filename}
                    </span>
                  )}
                </div>

                <h4 className="text-base font-bold text-white leading-relaxed">
                  {q.question}
                </h4>

                {/* Model Answer Outline */}
                <div className="p-4 rounded-xl bg-slate-900/80 border border-white/5 space-y-2 text-xs text-slate-300">
                  <span className="font-bold text-pink-400 uppercase tracking-wider block">
                    Model Answer Outline:
                  </span>
                  <p className="leading-relaxed font-light">{q.answerOutline}</p>

                  {q.keyPoints.length > 0 && (
                    <div className="pt-2 border-t border-white/5 space-y-1">
                      <span className="text-slate-400 font-semibold block">Must-Include Scoring Rubric Points:</span>
                      <ul className="space-y-1 text-slate-300">
                        {q.keyPoints.map((pt, pIdx) => (
                          <li key={pIdx} className="flex items-center gap-1.5">
                            <span className="text-pink-400">•</span>
                            <span>{pt}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. SUGGESTED STUDY PLAN VIEW */}
      {activeSubTab === 'plan' && (
        <div className="space-y-4">
          <div className="p-5 rounded-2xl bg-slate-950/70 border border-white/10 space-y-1">
            <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
              <ListOrdered className="w-5 h-5 text-emerald-400" />
              Suggested Active-Recall Study Roadmap
            </h3>
            <p className="text-xs text-slate-400">
              Structured multi-session schedule designed to optimize memory retention through spaced retrieval.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {studyPlan.map((session, idx) => (
              <div
                key={idx}
                className="rounded-2xl border border-white/10 bg-slate-950/80 p-5 space-y-4 shadow-md flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                      {session.dayOrSession}
                    </span>
                    <span className="flex items-center gap-1 text-[11px] font-mono text-slate-400">
                      <Clock className="w-3 h-3 text-slate-500" />
                      ~{session.timeMinutes} mins
                    </span>
                  </div>

                  <h4 className="text-sm font-bold text-white">{session.topic}</h4>

                  <ul className="space-y-2 text-xs text-slate-300">
                    {session.activities.map((act, aIdx) => (
                      <li key={aIdx} className="flex items-start gap-2">
                        <Check className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                        <span className="leading-relaxed">{act}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. CHAT WITH MY MATERIAL VIEW */}
      {activeSubTab === 'chat' && (
        <div className="rounded-3xl border border-white/10 bg-slate-950/80 backdrop-blur-xl p-5 sm:p-6 space-y-4 shadow-xl">
          <div className="flex items-center justify-between pb-3 border-b border-white/5">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">
                  Grounded Material Assistant
                </h4>
                <p className="text-[11px] text-slate-400">
                  Strictly cites facts and quotes from your uploaded study materials.
                </p>
              </div>
            </div>
          </div>

          {/* Messages Stream */}
          <div className="space-y-3 max-h-[360px] overflow-y-auto pr-2">
            {chatMessages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex gap-3 text-xs sm:text-sm ${
                  msg.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                {msg.role === 'assistant' && (
                  <div className="w-7 h-7 rounded-xl bg-indigo-600/30 text-indigo-300 flex items-center justify-center shrink-0 border border-indigo-500/30">
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                <div
                  className={`p-3.5 rounded-2xl max-w-[85%] sm:max-w-[75%] space-y-1.5 leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-indigo-600 text-white rounded-tr-none'
                      : 'bg-slate-900 border border-white/10 text-slate-200 rounded-tl-none font-light'
                  }`}
                >
                  <p className="whitespace-pre-line">{msg.text}</p>
                  {msg.citation && (
                    <div className="pt-1.5 border-t border-white/5 text-[11px] font-mono text-indigo-300 flex items-center gap-1">
                      <FileText className="w-3 h-3" />
                      <span>Source: {msg.citation}</span>
                    </div>
                  )}
                </div>

                {msg.role === 'user' && (
                  <div className="w-7 h-7 rounded-xl bg-slate-800 text-slate-300 flex items-center justify-center shrink-0">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            ))}

            {isChatLoading && (
              <div className="flex gap-2 text-xs text-slate-400 items-center">
                <Bot className="w-4 h-4 animate-bounce text-indigo-400" />
                <span>Searching your uploaded study materials...</span>
              </div>
            )}
          </div>

          {/* Quick Suggestion Chips */}
          <div className="flex flex-wrap gap-1.5 pt-2">
            {[
              'What are the common pitfalls in this topic?',
              'Explain the core prerequisite dependencies',
              'Give me a real-world application challenge',
            ].map((chip, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setChatInput(chip)}
                className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white text-[11px] border border-white/5 transition-colors"
              >
                {chip}
              </button>
            ))}
          </div>

          {/* Input Box */}
          <form onSubmit={handleSendChat} className="flex items-center gap-2 pt-2">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Ask anything about your study material..."
              className="flex-1 bg-slate-900 border border-white/10 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
            <button
              type="submit"
              disabled={!chatInput.trim() || isChatLoading}
              className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40 transition-colors shadow-md shadow-indigo-600/20"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
