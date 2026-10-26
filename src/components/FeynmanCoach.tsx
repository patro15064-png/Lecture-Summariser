'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  Sparkles, 
  Mic, 
  MicOff, 
  Play, 
  RotateCcw, 
  CheckCircle2, 
  AlertTriangle, 
  Compass, 
  Volume2, 
  VolumeX, 
  Award, 
  Flame, 
  BookOpen, 
  Send,
  Zap,
  HelpCircle
} from 'lucide-react';
import { LectureArtifact, FeynmanEvaluation } from '@/types/lecture';
import { animateScoreGauge } from '@/lib/animations';

interface FeynmanCoachProps {
  artifact: LectureArtifact;
  onSeek: (seconds: number) => void;
  apiKey?: string;
}

export function FeynmanCoach({ artifact, onSeek, apiKey }: FeynmanCoachProps) {
  const concepts = artifact.concepts || [];
  const [selectedConceptId, setSelectedConceptId] = useState<string>(
    concepts.length > 0 ? concepts[0].id : ''
  );

  const activeConcept = concepts.find((c) => c.id === selectedConceptId) || concepts[0];

  const [explanation, setExplanation] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evaluation, setEvaluation] = useState<FeynmanEvaluation | null>(null);
  const [speakingSection, setSpeakingSection] = useState<'feedback' | 'followup' | null>(null);

  // Web Speech Recognition Reference
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);

  // Initialize Speech Recognition if supported
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        recognition.onresult = (event: any) => {
          let currentTranscript = '';
          for (let i = 0; i < event.results.length; i++) {
            currentTranscript += event.results[i][0].transcript;
          }
          setExplanation(currentTranscript);
        };

        recognition.onerror = () => {
          setIsRecording(false);
        };

        recognition.onend = () => {
          setIsRecording(false);
        };

        recognitionRef.current = recognition;
      }
    }
  }, []);

  const toggleRecording = () => {
    if (!recognitionRef.current) {
      alert('Speech Recognition is not supported in this browser. You can type or use sample explanations.');
      return;
    }

    if (isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsRecording(true);
      } catch (err) {
        console.warn('Speech recognition start failed:', err);
      }
    }
  };

  const handleEvaluate = async (customText?: string) => {
    const textToEvaluate = (customText || explanation).trim();
    if (!textToEvaluate || !activeConcept || isEvaluating) return;

    if (isRecording && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsRecording(false);
    }

    setIsEvaluating(true);

    try {
      const res = await fetch('/api/feynman', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { 'x-gemini-key': apiKey } : {}),
        },
        body: JSON.stringify({
          concept: activeConcept,
          studentExplanation: textToEvaluate,
          artifact,
        }),
      });

      const data = await res.json();
      if (data.evaluation) {
        setEvaluation(data.evaluation);
      }
    } catch (err) {
      console.error('Feynman evaluation error:', err);
    } finally {
      setIsEvaluating(false);
    }
  };

  // Trigger metric gauge animations whenever a new evaluation loads
  useEffect(() => {
    if (evaluation) {
      animateScoreGauge('#gauge-overall', evaluation.overallScore);
      animateScoreGauge('#gauge-conceptual', evaluation.conceptualScore);
      animateScoreGauge('#gauge-clarity', evaluation.clarityScore);
      animateScoreGauge('#gauge-depth', evaluation.depthScore);
    }
  }, [evaluation]);

  // Audio Speech Synthesis for Coach
  const handleSpeakCoach = (text: string, section: 'feedback' | 'followup') => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    if (speakingSection === section) {
      window.speechSynthesis.cancel();
      setSpeakingSection(null);
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.onend = () => setSpeakingSection(null);
    utterance.onerror = () => setSpeakingSection(null);

    setSpeakingSection(section);
    window.speechSynthesis.speak(utterance);
  };

  // Sample explanations for 1-click judge evaluation
  const samplePrompts = [
    {
      label: 'Intuitive Analogy (High Score)',
      text: `Think of this like a hiker on a foggy mountain ridge. When you stand on a slope, the gradient vector points straight up the steepest hill. If you walk along the contour path where height doesn't change, your direction is perpendicular to the gradient!`,
    },
    {
      label: 'Common Misconception (Trap Test)',
      text: `The rate of change in any direction is just taking the gradient vector and multiplying it directly by the vector you want to move along. If the vector is long, the slope gets bigger!`,
    },
    {
      label: 'Jargon-Heavy (Clarity Test)',
      text: `It is an affine manifold projection where the differential operator transforms vector-valued functions through an invariant Euclidean metric tensor without loss of algebraic dimensionality.`,
    },
  ];

  if (!activeConcept) {
    return (
      <div className="p-8 rounded-2xl border border-white/10 bg-slate-950/70 text-center text-slate-400">
        No concepts found to evaluate.
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-slate-950/80 backdrop-blur-xl p-6 sm:p-8 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-500 shadow-md shadow-purple-500/20 text-white">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                Richard Feynman Pedagogical Voice Coach
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 font-medium">
                  Active Voice Recall
                </span>
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-2xl">
                &quot;If you can&apos;t explain it to a six-year-old, you don&apos;t understand it yourself.&quot; Explain a concept in your own words, speak or type, and receive instant rubric evaluation.
              </p>
            </div>
          </div>

          {/* Jump to lecture timestamp */}
          <button
            type="button"
            onClick={() => onSeek(activeConcept.timestampSeconds)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-slate-900 border border-white/10 hover:border-purple-500/50 hover:bg-slate-800 transition-all shrink-0 self-start sm:self-auto"
            title="Review concept in player"
          >
            <Play className="w-3.5 h-3.5 text-purple-400 fill-current" />
            <span>Review at {activeConcept.timestampFormatted}</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Input Workspace on Left, Evaluation Card on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Concept Picker & Explanation Input (6 cols) */}
        <div className="lg:col-span-6 space-y-4">
          {/* Concept Picker Dropdown */}
          <div className="p-4 rounded-2xl border border-white/10 bg-slate-950/70 backdrop-blur-xl space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-purple-400" /> Select Target Concept to Teach:
            </label>
            <select
              value={selectedConceptId}
              onChange={(e) => {
                setSelectedConceptId(e.target.value);
                setEvaluation(null);
              }}
              className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-indigo-200 font-semibold focus:outline-none focus:border-purple-500/50 cursor-pointer"
            >
              {concepts.map((concept) => (
                <option key={concept.id} value={concept.id} className="bg-slate-950 text-white">
                  [{concept.timestampFormatted}] {concept.title} ({concept.importance.toUpperCase()})
                </option>
              ))}
            </select>

            <div className="p-3 rounded-xl bg-slate-900/60 border border-white/5 text-xs text-slate-300 leading-relaxed font-light">
              <span className="font-semibold text-indigo-300 block mb-0.5">Reference Principle:</span>
              {activeConcept.summary}
            </div>
          </div>

          {/* Student Explanation Input Box with Voice Mic */}
          <div className="p-5 rounded-2xl border border-white/10 bg-slate-950/70 backdrop-blur-xl space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Your Explanation (No Jargon, Plain English):
              </label>

              {/* Voice Recording Button */}
              <button
                type="button"
                onClick={toggleRecording}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  isRecording
                    ? 'bg-rose-500 text-white animate-pulse shadow-lg shadow-rose-500/30'
                    : 'bg-slate-900 text-slate-300 hover:text-white border border-white/10 hover:border-purple-500/40'
                }`}
                title={isRecording ? 'Click to Stop Speaking' : 'Click to Speak via Microphone'}
              >
                {isRecording ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5 text-purple-400" />}
                <span>{isRecording ? 'Listening...' : 'Voice Record'}</span>
              </button>
            </div>

            <div className="relative">
              <textarea
                value={explanation}
                onChange={(e) => setExplanation(e.target.value)}
                rows={5}
                placeholder="Explain this concept as if you were teaching a high school student or friend over coffee. Use an everyday analogy..."
                className="w-full bg-slate-900/90 border border-white/10 focus:border-purple-500/50 rounded-xl p-4 text-sm text-white placeholder-slate-500 focus:outline-none transition-all shadow-inner leading-relaxed resize-none"
              />
              {isRecording && (
                <div className="absolute bottom-3 right-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/20 border border-rose-500/40 text-[10px] text-rose-300 font-mono">
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                  Live Audio Stream
                </div>
              )}
            </div>

            {/* Quick 1-Click Test Chips */}
            <div className="space-y-1.5">
              <span className="text-[11px] text-slate-500 flex items-center gap-1">
                <Zap className="w-3 h-3 text-amber-400" /> 1-Click Evaluation Presets:
              </span>
              <div className="flex flex-wrap gap-2">
                {samplePrompts.map((preset, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      setExplanation(preset.text);
                      handleEvaluate(preset.text);
                    }}
                    className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-white/5 hover:border-purple-500/30 text-slate-300 hover:text-white transition-colors"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setExplanation('');
                  setEvaluation(null);
                }}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-400 hover:text-white bg-slate-900 rounded-xl border border-white/10 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>

              <button
                type="button"
                onClick={() => handleEvaluate()}
                disabled={!explanation.trim() || isEvaluating}
                className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-600 hover:from-purple-500 hover:via-indigo-500 hover:to-pink-500 text-white font-semibold text-xs sm:text-sm shadow-lg shadow-purple-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all transform hover:scale-[1.01] active:scale-[0.99]"
              >
                {isEvaluating ? (
                  <>
                    <Sparkles className="w-4 h-4 animate-spin" />
                    <span>Grading with Feynman Rubric...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Grade My Explanation</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: AI Pedagogical Feedback Display (6 cols) */}
        <div className="lg:col-span-6 space-y-4">
          {evaluation ? (
            <div className="rounded-2xl border border-purple-500/30 bg-slate-950/90 backdrop-blur-xl p-6 shadow-2xl space-y-5 animate-in fade-in duration-300">
              {/* Header Score Banner */}
              <div className="flex items-center justify-between gap-4 pb-4 border-b border-white/10">
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block mb-0.5">
                    Feynman Mastery Metric
                  </span>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    {evaluation.overallScore >= 80 ? (
                      <span className="flex items-center gap-1.5 text-emerald-400">
                        <Award className="w-5 h-5" /> Master Intuition
                      </span>
                    ) : evaluation.overallScore >= 60 ? (
                      <span className="flex items-center gap-1.5 text-amber-400">
                        <Flame className="w-5 h-5" /> Developing Competency
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-rose-400">
                        <HelpCircle className="w-5 h-5" /> Needs Clarification
                      </span>
                    )}
                  </h3>
                </div>

                {/* Main Overall Gauge */}
                <div className="flex flex-col items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-950 to-purple-950 border border-purple-500/40 shadow-inner">
                  <span id="gauge-overall" className="text-xl font-bold font-mono text-purple-300">
                    {evaluation.overallScore}%
                  </span>
                  <span className="text-[8px] uppercase tracking-wider text-slate-400">Overall</span>
                </div>
              </div>

              {/* Three Rubric Dimensions */}
              <div className="grid grid-cols-3 gap-2.5">
                <div className="p-3 rounded-xl bg-slate-900/80 border border-white/5 text-center">
                  <span className="text-[10px] text-slate-400 block mb-1">Conceptual</span>
                  <span id="gauge-conceptual" className="text-base font-bold font-mono text-emerald-400">
                    {evaluation.conceptualScore}%
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-900/80 border border-white/5 text-center">
                  <span className="text-[10px] text-slate-400 block mb-1">Clarity &amp; Jargon</span>
                  <span id="gauge-clarity" className="text-base font-bold font-mono text-indigo-400">
                    {evaluation.clarityScore}%
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-900/80 border border-white/5 text-center">
                  <span className="text-[10px] text-slate-400 block mb-1">Pedagogical Depth</span>
                  <span id="gauge-depth" className="text-base font-bold font-mono text-purple-400">
                    {evaluation.depthScore}%
                  </span>
                </div>
              </div>

              {/* Strength Feedback Card */}
              <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/30 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-emerald-300 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" /> What You Explained Well:
                  </span>
                  <button
                    type="button"
                    onClick={() => handleSpeakCoach(evaluation.strengthFeedback, 'feedback')}
                    className="text-[11px] text-emerald-400 hover:text-emerald-200 flex items-center gap-1"
                    title="Read feedback aloud"
                  >
                    {speakingSection === 'feedback' ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
                    <span>{speakingSection === 'feedback' ? 'Stop' : 'Voice'}</span>
                  </button>
                </div>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-light">
                  {evaluation.strengthFeedback}
                </p>
              </div>

              {/* Gap Feedback Card */}
              <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-500/30 space-y-1.5">
                <span className="text-xs font-semibold text-amber-300 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-400" /> Conceptual Blindspot or Jargon:
                </span>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-light">
                  {evaluation.gapFeedback}
                </p>
              </div>

              {/* Socratic Probing Question Card */}
              <div className="p-4 rounded-xl bg-purple-950/30 border border-purple-500/30 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-purple-300 flex items-center gap-1.5">
                    <Compass className="w-4 h-4 text-purple-400" /> Socratic Boundary Probe:
                  </span>
                  <button
                    type="button"
                    onClick={() => handleSpeakCoach(evaluation.socraticFollowUp, 'followup')}
                    className="text-[11px] text-purple-400 hover:text-purple-200 flex items-center gap-1"
                    title="Read probe aloud"
                  >
                    {speakingSection === 'followup' ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
                    <span>{speakingSection === 'followup' ? 'Stop' : 'Voice'}</span>
                  </button>
                </div>
                <p className="text-xs sm:text-sm text-slate-200 italic leading-relaxed">
                  &quot;{evaluation.socraticFollowUp}&quot;
                </p>
              </div>
            </div>
          ) : (
            /* Empty State */
            <div className="h-full min-h-[400px] flex flex-col items-center justify-center p-8 rounded-2xl border border-dashed border-white/15 bg-slate-950/40 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center">
                <Award className="w-6 h-6" />
              </div>
              <h4 className="text-base font-semibold text-white">Awaiting Your Explanation</h4>
              <p className="text-xs text-slate-400 max-w-sm leading-relaxed">
                Choose a concept, speak into your microphone or type an analogy, and click &quot;Grade My Explanation&quot; to test your mastery.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
