'use client';

import React, { useState } from 'react';
import { 
  X, 
  Download, 
  Printer, 
  Copy, 
  Check, 
  FileText, 
  Code,
  Archive,
  Layers,
  HelpCircle
} from 'lucide-react';
import { LectureArtifact } from '@/types/lecture';
import { generateObsidianVaultMarkdown, downloadMarkdownFile, printLectureStudySheet } from '@/lib/exportUtils';
import { generateAndDownloadExportPack } from '@/lib/exportPack';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  artifact: LectureArtifact;
}

export function ExportModal({ isOpen, onClose, artifact }: ExportModalProps) {
  const [copied, setCopied] = useState(false);
  const [showRawMarkdown, setShowRawMarkdown] = useState(false);
  const [isExportingZip, setIsExportingZip] = useState(false);
  const [zipProgress, setZipProgress] = useState(0);
  const [zipStatusText, setZipStatusText] = useState('');

  if (!isOpen) return null;

  const markdownContent = generateObsidianVaultMarkdown(artifact);
  const filename = `${artifact.id || 'study-kit'}-study-pack.md`;
  const slug = (artifact.title || 'study-kit').toLowerCase().replace(/[^a-z0-9]+/g, '-');

  const handleCopy = () => {
    navigator.clipboard.writeText(markdownContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadMd = () => {
    downloadMarkdownFile(filename, markdownContent);
  };

  const handlePrint = () => {
    printLectureStudySheet(artifact);
  };

  const handleDownloadAnkiCsv = () => {
    let ankiCsv = '#separator:tab\n#html:true\n#tags column:4\n';
    (artifact.flashcards || []).forEach((card) => {
      const front = `"${card.front.replace(/"/g, '""')}"`;
      const back = `"${card.back.replace(/"/g, '""')}<br><br><b>Key Takeaway:</b> ${card.takeaway.replace(/"/g, '""')}"`;
      const hint = `"${(card.hint || '').replace(/"/g, '""')}"`;
      const tags = `"study-kit ${slug}"`;
      ankiCsv += `${front}\t${back}\t${hint}\t${tags}\n`;
    });

    const blob = new Blob([ankiCsv], { type: 'text/tab-separated-values;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${slug}-anki-deck.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadQuizzesJson = () => {
    const jsonStr = JSON.stringify(artifact.diagnosticQuestions || [], null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${slug}-quizzes.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadZipPack = async () => {
    setIsExportingZip(true);
    setZipProgress(10);
    setZipStatusText('Preparing study pack components...');

    try {
      await generateAndDownloadExportPack(artifact, (pct, status) => {
        setZipProgress(pct);
        setZipStatusText(status);
      });
      setIsExportingZip(false);
    } catch (err: unknown) {
      console.error('[Export Zip Error]:', err);
      setIsExportingZip(false);
      setZipStatusText(err instanceof Error ? err.message : 'Export failed.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-3xl rounded-3xl border border-white/10 bg-slate-900/95 p-6 sm:p-8 shadow-2xl text-slate-100 space-y-6 max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          disabled={isExportingZip}
          className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700 transition-colors disabled:opacity-40"
          title="Close export modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-600 shadow-md shadow-indigo-500/20 text-white">
            <Download className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              Export Study Kit &amp; Learning Pack
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 font-medium">
                Production Pack
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Download your study materials as PDF, Markdown, Anki CSV, Quiz JSON, or Complete ZIP.
            </p>
          </div>
        </div>

        {/* Export Options Grid (4 Formats) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Format 1: Printable PDF */}
          <div className="flex flex-col justify-between p-5 rounded-2xl border border-white/10 bg-slate-950/60 hover:border-indigo-500/40 transition-all space-y-3">
            <div className="space-y-1.5">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                <Printer className="w-3.5 h-3.5" /> Printable PDF
              </span>
              <h4 className="text-sm font-bold text-white">Print-Ready Study Sheet</h4>
              <p className="text-xs text-slate-400 leading-relaxed font-light">
                Formatted academic summary sheet with KaTeX formulas, key takeaways, and printable cards.
              </p>
            </div>
            <button
              type="button"
              onClick={handlePrint}
              className="w-full flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs border border-white/10 transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / Save as PDF</span>
            </button>
          </div>

          {/* Format 2: Obsidian Vault Markdown */}
          <div className="flex flex-col justify-between p-5 rounded-2xl border border-white/10 bg-slate-950/60 hover:border-purple-500/40 transition-all space-y-3">
            <div className="space-y-1.5">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                <FileText className="w-3.5 h-3.5" /> Obsidian (.md)
              </span>
              <h4 className="text-sm font-bold text-white">Obsidian &amp; PKM Vault Note</h4>
              <p className="text-xs text-slate-400 leading-relaxed font-light">
                YAML frontmatter, bidirectional [[Wikilinks]], #card flashcard tags, and KaTeX math formulas.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleDownloadMd}
                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs border border-white/10 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download .md</span>
              </button>
              <button
                type="button"
                onClick={handleCopy}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-white/10 text-xs transition-colors"
                title="Copy markdown text"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Format 3: Anki-Compatible CSV */}
          <div className="flex flex-col justify-between p-5 rounded-2xl border border-white/10 bg-slate-950/60 hover:border-pink-500/40 transition-all space-y-3">
            <div className="space-y-1.5">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-pink-500/20 text-pink-300 border border-pink-500/30">
                <Layers className="w-3.5 h-3.5" /> Anki Deck (.csv)
              </span>
              <h4 className="text-sm font-bold text-white">Anki Import Ready</h4>
              <p className="text-xs text-slate-400 leading-relaxed font-light">
                Standard tab-delimited file ready to import directly into Anki desktop or mobile.
              </p>
            </div>
            <button
              type="button"
              onClick={handleDownloadAnkiCsv}
              className="w-full flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs border border-white/10 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Anki CSV</span>
            </button>
          </div>

          {/* Format 4: Quizzes JSON */}
          <div className="flex flex-col justify-between p-5 rounded-2xl border border-white/10 bg-slate-950/60 hover:border-amber-500/40 transition-all space-y-3">
            <div className="space-y-1.5">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                <HelpCircle className="w-3.5 h-3.5" /> Quizzes (.json)
              </span>
              <h4 className="text-sm font-bold text-white">Diagnostic Questions JSON</h4>
              <p className="text-xs text-slate-400 leading-relaxed font-light">
                Export all questions, distractors, misconception rationales, and grading rubrics as JSON.
              </p>
            </div>
            <button
              type="button"
              onClick={handleDownloadQuizzesJson}
              className="w-full flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs border border-white/10 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Quizzes JSON</span>
            </button>
          </div>
        </div>

        {/* Featured: Master Complete ZIP Pack */}
        <div className="p-5 sm:p-6 rounded-2xl border-2 border-indigo-500/40 bg-gradient-to-br from-indigo-950/40 via-purple-950/20 to-slate-950 shadow-xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 text-xs font-semibold">
              <Archive className="w-3.5 h-3.5" /> Complete Export Pack (.ZIP)
            </span>
            <span className="text-[11px] font-mono text-purple-300">
              All Study Formats Bundled
            </span>
          </div>

          <div>
            <h3 className="text-base sm:text-lg font-bold text-white">
              Full Standalone Learning Bundle
            </h3>
            <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
              Bundles <span className="text-indigo-300 font-mono">anki_cards.csv</span>, <span className="text-pink-300 font-mono">concept-graph.json</span>, <span className="text-amber-300 font-mono">quizzes.json</span>, <span className="text-emerald-300 font-mono">transcript.vtt</span>, and <span className="text-sky-300 font-mono">summary.md</span>.
            </p>
          </div>

          {isExportingZip ? (
            <div className="space-y-2 pt-2 animate-in fade-in">
              <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
                <span>{zipStatusText}</span>
                <span>{zipProgress}%</span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 h-full transition-all duration-300"
                  style={{ width: `${zipProgress}%` }}
                />
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleDownloadZipPack}
              className="w-full flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 via-purple-600 to-pink-600 hover:from-indigo-400 hover:via-purple-500 hover:to-pink-500 text-white font-semibold text-xs sm:text-sm shadow-lg shadow-purple-500/25 transition-all"
            >
              <Download className="w-4 h-4" />
              <span>Download Complete ZIP Bundle</span>
            </button>
          )}
        </div>

        {/* Live Preview Toggle */}
        <div className="pt-2 border-t border-white/10">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setShowRawMarkdown((prev) => !prev)}
              className="flex items-center gap-1.5 text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              <Code className="w-4 h-4" />
              <span>{showRawMarkdown ? 'Hide Raw Markdown Preview' : 'Inspect Markdown Study Pack'}</span>
            </button>

            <span className="text-xs text-slate-500 font-mono">
              {markdownContent.length} bytes
            </span>
          </div>

          {showRawMarkdown && (
            <div className="mt-3 p-4 rounded-2xl bg-slate-950 border border-white/10 max-h-56 overflow-y-auto text-xs font-mono text-slate-300 leading-relaxed whitespace-pre-wrap shadow-inner animate-in fade-in">
              {markdownContent}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
