'use client';

import React, { useState, useEffect } from 'react';
import { 
  X, 
  BookOpen, 
  Search, 
  Trash2, 
  Edit3, 
  Check, 
  Calendar, 
  Layers, 
  HelpCircle, 
  Network,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { LectureArtifact } from '@/types/lecture';
import { getAllSavedStudyKits, deleteStudyKit, renameStudyKit } from '@/lib/studyKitStorage';

interface StudyKitsLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectKit: (kit: LectureArtifact) => void;
}

export function StudyKitsLibraryModal({
  isOpen,
  onClose,
  onSelectKit,
}: StudyKitsLibraryModalProps) {
  const [kits, setKits] = useState<LectureArtifact[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const refreshKits = async () => {
    setIsLoading(true);
    const saved = await getAllSavedStudyKits();
    setKits(saved);
    setIsLoading(false);
  };

  useEffect(() => {
    let isCancelled = false;
    if (isOpen) {
      void getAllSavedStudyKits().then((saved) => {
        if (!isCancelled) {
          setKits(saved);
          setIsLoading(false);
        }
      });
    }
    return () => {
      isCancelled = true;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const filteredKits = kits.filter((k) =>
    k.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (k.course && k.course.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleStartRename = (k: LectureArtifact, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(k.id);
    setEditTitle(k.title);
  };

  const handleSaveRename = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (editTitle.trim()) {
      await renameStudyKit(id, editTitle.trim());
      setEditingId(null);
      await refreshKits();
    }
  };

  const handleDelete = async (id: string, title: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`Are you sure you want to delete the study kit "${title}"?`)) {
      await deleteStudyKit(id);
      await refreshKits();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-3xl rounded-3xl border border-white/10 bg-slate-900/95 p-6 sm:p-8 shadow-2xl text-slate-100 space-y-6 max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700 transition-colors"
          title="Close library"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-600 shadow-md shadow-indigo-500/20 text-white">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              Previous Study Kits Library
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-medium">
                {kits.length} Saved
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Saved automatically in local IndexedDB. Seamlessly resume review sessions anytime.
            </p>
          </div>
        </div>

        {/* Search input */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by topic, course, or title..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950/70 border border-white/10 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>

        {/* Kits List */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1 max-h-[50vh]">
          {isLoading ? (
            <div className="text-center py-12 text-slate-400 text-xs">
              Loading saved study kits...
            </div>
          ) : filteredKits.length === 0 ? (
            <div className="text-center py-12 border border-white/5 rounded-2xl bg-slate-950/40 p-6 space-y-2">
              <Sparkles className="w-8 h-8 text-slate-600 mx-auto" />
              <p className="text-sm text-slate-300 font-medium">No previous study kits found</p>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Upload your notes, slides, PDFs, or audio/video to generate your first comprehensive active-learning pack.
              </p>
            </div>
          ) : (
            filteredKits.map((k) => (
              <div
                key={k.id}
                onClick={() => {
                  onSelectKit(k);
                  onClose();
                }}
                className="group relative flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl border border-white/10 bg-slate-950/60 hover:bg-slate-950 hover:border-indigo-500/40 transition-all cursor-pointer shadow-sm hover:shadow-indigo-500/10"
              >
                <div className="space-y-1.5 flex-1 min-w-0">
                  {editingId === k.id ? (
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="px-2.5 py-1 text-sm rounded-lg bg-slate-900 border border-indigo-500 text-white focus:outline-none w-full max-w-md"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={(e) => handleSaveRename(k.id, e)}
                        className="p-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-500"
                        title="Save name"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm sm:text-base font-bold text-white group-hover:text-indigo-300 transition-colors truncate">
                        {k.title}
                      </h4>
                      <button
                        type="button"
                        onClick={(e) => handleStartRename(k, e)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-white transition-opacity"
                        title="Rename study kit"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  {/* Metadata tags */}
                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-slate-500" />
                      {k.date || new Date(k.createdAt).toLocaleDateString()}
                    </span>
                    <span className="flex items-center gap-1">
                      <Network className="w-3 h-3 text-indigo-400" />
                      {k.concepts?.length || 0} Concepts
                    </span>
                    <span className="flex items-center gap-1">
                      <Layers className="w-3 h-3 text-purple-400" />
                      {k.flashcards?.length || 0} Flashcards
                    </span>
                    <span className="flex items-center gap-1">
                      <HelpCircle className="w-3 h-3 text-amber-400" />
                      {k.diagnosticQuestions?.length || 0} Quizzes
                    </span>
                  </div>
                </div>

                {/* Right action buttons */}
                <div className="flex items-center gap-2 self-end sm:self-center">
                  <button
                    type="button"
                    onClick={(e) => handleDelete(k.id, k.title, e)}
                    className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                    title="Delete study kit"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                    <span>Study</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
