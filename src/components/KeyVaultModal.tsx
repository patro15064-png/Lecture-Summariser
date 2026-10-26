'use client';

import React, { useState } from 'react';
import { ShieldCheck, Key, Eye, EyeOff, Trash2, CheckCircle2, Lock, Sparkles, X } from 'lucide-react';

interface KeyVaultModalProps {
  isOpen: boolean;
  onClose: () => void;
  onKeySaved: (key: string) => void;
}

export function KeyVaultModal({ isOpen, onClose, onKeySaved }: KeyVaultModalProps) {
  const [apiKey, setApiKey] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('gemini_vault_key') || '';
    }
    return '';
  });
  const [showKey, setShowKey] = useState(false);
  const [savedStatus, setSavedStatus] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSave = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('gemini_vault_key', apiKey.trim());
      onKeySaved(apiKey.trim());
      setSavedStatus('Key securely saved to client storage.');
      setTimeout(() => {
        setSavedStatus(null);
        onClose();
      }, 1000);
    }
  };

  const handleClear = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('gemini_vault_key');
      setApiKey('');
      onKeySaved('');
      setSavedStatus('Key cleared. Running in Demo / Fallback mode.');
      setTimeout(() => setSavedStatus(null), 1500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-lg overflow-hidden border border-white/10 rounded-2xl bg-slate-950/95 shadow-2xl shadow-indigo-500/10 text-slate-100"
        role="dialog"
        aria-modal="true"
        aria-labelledby="vault-title"
      >
        {/* Top Glow Accent */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white transition-colors rounded-lg hover:bg-white/5"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-6 sm:p-8 space-y-6">
          {/* Header */}
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 id="vault-title" className="text-xl font-semibold tracking-tight text-white flex items-center gap-2">
                Zero-Trust Key Vault
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-normal">
                  Client-Side Only
                </span>
              </h2>
              <p className="text-sm text-slate-400 mt-1">
                Your Google Gemini API key resides solely in your browser&apos;s memory or local storage. It is transmitted strictly as a transient request header and never logged or stored in any database.
              </p>
            </div>
          </div>

          {/* Input Box */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-300 uppercase tracking-wider flex items-center justify-between">
              <span>Google Gemini API Key</span>
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-400 hover:text-indigo-300 hover:underline normal-case text-xs flex items-center gap-1"
              >
                <Sparkles className="w-3 h-3" /> Get Free Key
              </a>
            </label>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="AIzaSy..."
                className="w-full px-4 py-3 pr-24 text-sm bg-slate-900/90 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all font-mono"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-200 transition-colors"
                title={showKey ? 'Hide Key' : 'Show Key'}
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Feedback message */}
          {savedStatus && (
            <div className="flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{savedStatus}</span>
            </div>
          )}

          {/* Security Features List */}
          <div className="p-3.5 rounded-xl bg-slate-900/50 border border-white/5 space-y-2 text-xs text-slate-400">
            <div className="flex items-center gap-2 text-slate-300 font-medium">
              <Lock className="w-3.5 h-3.5 text-indigo-400" />
              <span>Security &amp; Privacy Guarantees:</span>
            </div>
            <ul className="list-disc list-inside space-y-1 text-slate-400 pl-1">
              <li>Stored only in client memory / localStorage.</li>
              <li>Sent strictly via transient <code className="text-indigo-300">x-gemini-key</code> header.</li>
              <li>Zero telemetry logging, zero database persistence.</li>
              <li>Without a key, the app functions 100% using built-in university datasets.</li>
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between gap-3 pt-2">
            {apiKey ? (
              <button
                type="button"
                onClick={handleClear}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg transition-colors border border-rose-500/20"
              >
                <Trash2 className="w-3.5 h-3.5" /> Discard Key
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-800 rounded-xl transition-colors border border-white/5"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="flex items-center gap-1.5 px-5 py-2.5 text-xs font-medium text-white bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 rounded-xl shadow-lg shadow-indigo-500/25 transition-all font-semibold"
              >
                <Key className="w-3.5 h-3.5" /> Save to Vault
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
