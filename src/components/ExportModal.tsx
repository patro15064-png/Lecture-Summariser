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
  Archive
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
  const filename = `${artifact.id || 'lecture'}-study-pack.md`;

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
        className="relative w-full max-w-2xl rounded-3xl border border-white/10 bg-slate-900/95 p-6 sm:p-8 shadow-2xl text-slate-100 space-y-6 max-h-[92vh] overflow-y-auto"
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
              Export Academic Study Ecosystem
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 font-medium">
                Production Pack
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Export real sliced audio clips, Anki decks, Obsidian markdown, WebVTT transcripts, and DAG graphs.
            </p>
          </div>
        </div>

        {/* Featured Hero: Full ZIP Export Pack */}
        <div className="p-5 sm:p-6 rounded-2xl border-2 border-indigo-500/40 bg-gradient-to-br from-indigo-950/40 via-purple-950/20 to-slate-950 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 text-xs font-semibold">
              <Archive className="w-3.5 h-3.5" /> Complete Export Pack (.ZIP)
            </span>
            <span className="text-[11px] font-mono text-purple-300">
              6 Artifacts Bundled
            </span>
          </div>

          <div>
            <h3 className="text-lg font-bold text-white">
              Full Standalone Learning Bundle
            </h3>
            <p className="text-xs text-slate-300 mt-1 leading-relaxed">
              Includes <span className="text-indigo-300 font-mono">clips/*.wav</span> (sliced audio clips), <span className="text-purple-300 font-mono">anki_cards.csv</span> (Anki import deck), <span className="text-pink-300 font-mono">concept-graph.json</span> (DAG graph), <span className="text-emerald-300 font-mono">transcript.vtt</span>, and <span className="text-sky-300 font-mono">summary.md</span>.
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
              className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-indigo-500 via-purple-600 to-pink-600 hover:from-indigo-400 hover:via-purple-500 hover:to-pink-500 text-white font-semibold text-xs sm:text-sm shadow-lg shadow-purple-500/25 transition-all transform hover:scale-[1.01]"
            >
              <Download className="w-4 h-4" />
              <span>Download Master Export Pack (.ZIP)</span>
            </button>
          )}
        </div>

        {/* Secondary Export Options Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Format 1: Obsidian Vault Markdown */}
          <div className="flex flex-col justify-between p-5 rounded-2xl border border-white/10 bg-slate-950/60 hover:border-purple-500/40 transition-all space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  <FileText className="w-3.5 h-3.5" /> Obsidian Vault (.md)
                </span>
                <span className="text-[10px] text-slate-400 font-mono">Markdown</span>
              </div>
              <h4 className="text-base font-bold text-white">Obsidian &amp; PKM Vault</h4>
              <p className="text-xs text-slate-400 leading-relaxed font-light">
                Equipped with YAML frontmatter, bidirectional [[Wikilinks]], #card spaced repetition tags, and LaTeX equations.
              </p>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={handleDownloadMd}
                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs transition-all border border-white/10"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download .md</span>
              </button>

              <button
                type="button"
                onClick={handleCopy}
                className="px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-white/10 text-xs font-medium transition-all"
                title="Copy markdown text to clipboard"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Format 2: Printable PDF Master Pack */}
          <div className="flex flex-col justify-between p-5 rounded-2xl border border-white/10 bg-slate-950/60 hover:border-indigo-500/40 transition-all space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  <Printer className="w-3.5 h-3.5" /> Printable PDF
                </span>
                <span className="text-[10px] text-slate-400 font-mono">Academic</span>
              </div>
              <h4 className="text-base font-bold text-white">Printable Study Sheet</h4>
              <p className="text-xs text-slate-400 leading-relaxed font-light">
                Print-optimized academic layout with printable flashcards, LaTeX formulas, and executive summary.
              </p>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={handlePrint}
                className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs transition-all border border-white/10"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print / Save as PDF</span>
              </button>
            </div>
          </div>
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
              <span>{showRawMarkdown ? 'Hide Raw Markdown Preview' : 'Inspect Generated Obsidian Markdown'}</span>
            </button>

            <span className="text-xs text-slate-500 font-mono">
              {markdownContent.length} bytes
            </span>
          </div>

          {showRawMarkdown && (
            <div className="mt-3 p-4 rounded-2xl bg-slate-950 border border-white/10 max-h-60 overflow-y-auto text-xs font-mono text-slate-300 leading-relaxed whitespace-pre-wrap shadow-inner animate-in fade-in">
              {markdownContent}
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-white/5">
          <span>Client-Side Local Generation • Zero Telemetry</span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white transition-colors font-semibold"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
