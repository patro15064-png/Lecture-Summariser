'use client';

import React, { useState } from 'react';
import { 
  X, 
  Key, 
  Trash2, 
  RefreshCw, 
  Eye, 
  EyeOff, 
  Cpu
} from 'lucide-react';
import { 
  ApiProvider, 
  UserApiSettings 
} from '@/types/lecture';
import { 
  testProviderConnection, 
  saveUserApiSettings, 
  clearAllUserApiKeys
} from '@/lib/providerSettings';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: UserApiSettings;
  onUpdateSettings: (newSettings: UserApiSettings) => void;
}

export function SettingsModal({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
}: SettingsModalProps) {
  const [activeProvider, setActiveProvider] = useState<ApiProvider>('gemini');
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [testingStatus, setTestingStatus] = useState<Record<string, boolean>>({});
  const [localSettings, setLocalSettings] = useState<UserApiSettings>(settings);

  if (!isOpen) return null;

  const toggleShowKey = (provider: string) => {
    setShowKeys((prev) => ({ ...prev, [provider]: !prev[provider] }));
  };

  const handleKeyChange = (provider: ApiProvider, val: string) => {
    setLocalSettings((prev) => {
      const updated = {
        ...prev,
        ...(val.trim().length > 0 ? { singleProvider: provider, singleModel: prev.providers[provider].defaultModel || '' } : {}),
        providers: {
          ...prev.providers,
          [provider]: {
            ...prev.providers[provider],
            apiKey: val,
            status: 'untested' as const,
          },
        },
      };
      saveUserApiSettings(updated);
      onUpdateSettings(updated);
      return updated;
    });
  };

  const handleBaseUrlChange = (provider: ApiProvider, val: string) => {
    setLocalSettings((prev) => {
      const updated = {
        ...prev,
        providers: {
          ...prev.providers,
          [provider]: {
            ...prev.providers[provider],
            baseUrl: val,
          },
        },
      };
      saveUserApiSettings(updated);
      onUpdateSettings(updated);
      return updated;
    });
  };

  const handleModelChange = (provider: ApiProvider, val: string) => {
    setLocalSettings((prev) => {
      const updated = {
        ...prev,
        providers: {
          ...prev.providers,
          [provider]: {
            ...prev.providers[provider],
            defaultModel: val,
          },
        },
        ...(prev.useSingleModel && prev.singleProvider === provider
          ? { singleModel: val }
          : {}),
      };
      saveUserApiSettings(updated);
      onUpdateSettings(updated);
      return updated;
    });
  };

  const handleTestConnection = async (provider: ApiProvider) => {
    setTestingStatus((prev) => ({ ...prev, [provider]: true }));
    const config = localSettings.providers[provider];

    const result = await testProviderConnection(
      provider,
      config?.apiKey || '',
      config?.baseUrl
    );

    setLocalSettings((prev) => {
      const updated = {
        ...prev,
        providers: {
          ...prev.providers,
          [provider]: {
            ...prev.providers[provider],
            status: result.status,
            statusMessage: result.message,
          },
        },
      };
      saveUserApiSettings(updated);
      onUpdateSettings(updated);
      return updated;
    });

    setTestingStatus((prev) => ({ ...prev, [provider]: false }));
  };

  const handleClearKeys = () => {
    if (confirm('Clear all API keys from browser memory?')) {
      clearAllUserApiKeys();
      const cleared: UserApiSettings = {
        ...localSettings,
        providers: Object.fromEntries(
          Object.entries(localSettings.providers).map(([k, v]) => [
            k,
            { ...v, apiKey: '', status: 'untested' },
          ])
        ) as UserApiSettings['providers'],
      };
      setLocalSettings(cleared);
      onUpdateSettings(cleared);
    }
  };

  const currentProviderConfig = localSettings.providers[activeProvider];

  const providerList: Array<{ id: ApiProvider; name: string; tag: string }> = [
    { id: 'gemini', name: 'Google Gemini', tag: 'Native Audio' },
    { id: 'openai', name: 'OpenAI Whisper & GPT', tag: 'Cloud' },
    { id: 'groq', name: 'Groq', tag: 'Fast Whisper' },
    { id: 'anthropic', name: 'Anthropic Claude', tag: 'Proxied' },
    { id: 'openrouter', name: 'OpenRouter', tag: 'Multi-Model' },
    { id: 'custom', name: 'Custom OpenAI-Compatible', tag: 'Ollama/vLLM' },
    { id: 'local', name: 'Local In-Browser Mode', tag: 'Zero Key' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-4xl rounded-3xl border border-white/10 bg-slate-900/95 p-6 sm:p-8 shadow-2xl text-slate-100 space-y-6 max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-600 shadow-md shadow-indigo-500/20 text-white">
            <Key className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              Bring Your Own API (BYO API) Settings
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-medium">
                Zero-Trust
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Keys remain exclusively in browser memory and are never persisted server-side or logged.
            </p>
          </div>
        </div>

        {/* Provider Tabs Header */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
          {providerList.map((p) => {
            const isSelected = activeProvider === p.id;
            const hasKey = Boolean(localSettings.providers[p.id]?.apiKey) || p.id === 'local';

            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setActiveProvider(p.id)}
                className={`p-3 rounded-2xl border text-left transition-all duration-200 flex flex-col justify-between gap-1.5 ${
                  isSelected
                    ? 'border-indigo-500 bg-indigo-950/40 shadow-lg shadow-indigo-500/20'
                    : 'border-white/5 bg-slate-950/50 hover:border-white/15'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-slate-400">{p.tag}</span>
                  <span
                    className={`w-2 h-2 rounded-full ${
                      hasKey ? 'bg-emerald-400' : 'bg-slate-600'
                    }`}
                  />
                </div>
                <span className="text-xs font-semibold text-white leading-tight line-clamp-1">
                  {p.name}
                </span>
              </button>
            );
          })}
        </div>

        {/* Active Provider Configuration Box */}
        <div className="p-6 rounded-2xl border border-white/10 bg-slate-950/70 space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-white/5">
            <div>
              <h3 className="text-base font-bold text-white">
                {providerList.find((p) => p.id === activeProvider)?.name} Configuration
              </h3>
              <p className="text-xs text-slate-400">
                {activeProvider === 'gemini' && 'Used for native multimodal audio transcription and high-yield structured curriculum generation.'}
                {activeProvider === 'openai' && 'Used for Whisper verbose_json transcription and GPT-4o analysis.'}
                {activeProvider === 'groq' && 'High-speed cloud Whisper transcription with segment and word timestamps.'}
                {activeProvider === 'anthropic' && 'Claude 3.5 Sonnet / Haiku intelligence routed through stateless CORS proxy.'}
                {activeProvider === 'openrouter' && 'Access any open or proprietary model through unified API.'}
                {activeProvider === 'custom' && 'Connect your local Ollama, LM Studio, or vLLM server.'}
                {activeProvider === 'local' && 'Run Whisper locally in browser via Transformers.js with zero server calls.'}
              </p>
            </div>

            {/* Connection Status Badge */}
            {activeProvider !== 'local' && (
              <span
                className={`px-3 py-1 rounded-full text-xs font-mono font-semibold border ${
                  currentProviderConfig?.status === 'valid'
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : currentProviderConfig?.status === 'rate_limited'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : currentProviderConfig?.status === 'cors_blocked'
                    ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                    : currentProviderConfig?.status === 'invalid'
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                    : 'bg-slate-800 text-slate-400 border-white/5'
                }`}
              >
                {currentProviderConfig?.status ? currentProviderConfig.status.toUpperCase() : 'UNTESTED'}
              </span>
            )}
          </div>

          {activeProvider !== 'local' ? (
            <div className="space-y-4">
              {/* API Key Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                  <span>API Key</span>
                  <span className="text-[10px] text-slate-500">Stored in browser memory</span>
                </label>
                <div className="relative">
                  <input
                    type={showKeys[activeProvider] ? 'text' : 'password'}
                    value={currentProviderConfig?.apiKey || ''}
                    onChange={(e) => handleKeyChange(activeProvider, e.target.value)}
                    placeholder={`Enter your ${providerList.find((p) => p.id === activeProvider)?.name} key...`}
                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 pr-20 font-mono shadow-inner"
                  />
                  <button
                    type="button"
                    onClick={() => toggleShowKey(activeProvider)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1"
                  >
                    {showKeys[activeProvider] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Base URL Input for Custom/OpenAI */}
              {(activeProvider === 'custom' || activeProvider === 'openai') && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Endpoint Base URL
                  </label>
                  <input
                    type="text"
                    value={currentProviderConfig?.baseUrl || ''}
                    onChange={(e) => handleBaseUrlChange(activeProvider, e.target.value)}
                    placeholder="https://api.openai.com/v1 or http://localhost:11434/v1"
                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>
              )}

              {/* Default Model Selector / Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Model Identifier
                </label>
                <input
                  type="text"
                  value={currentProviderConfig?.defaultModel || ''}
                  onChange={(e) => handleModelChange(activeProvider, e.target.value)}
                  placeholder="e.g. gemini-2.0-flash, gpt-4o-mini, llama-3.3-70b-versatile"
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              {/* Test Connection Button */}
              <div className="flex items-center justify-between pt-2">
                <span className="text-xs text-slate-400">
                  {currentProviderConfig?.statusMessage || 'Click test to verify connectivity.'}
                </span>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const updated = {
                        ...localSettings,
                        singleProvider: activeProvider,
                        singleModel: localSettings.providers[activeProvider].defaultModel || '',
                      };
                      setLocalSettings(updated);
                      saveUserApiSettings(updated);
                      onUpdateSettings(updated);
                    }}
                    className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
                      localSettings.singleProvider === activeProvider
                        ? 'bg-purple-600/40 text-purple-200 border-purple-500'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-white/10'
                    }`}
                  >
                    {localSettings.singleProvider === activeProvider ? '✓ Active Provider' : 'Set as Active'}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleTestConnection(activeProvider)}
                    disabled={testingStatus[activeProvider] || !currentProviderConfig?.apiKey}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-all disabled:opacity-40"
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 ${testingStatus[activeProvider] ? 'animate-spin' : ''}`}
                    />
                    <span>{testingStatus[activeProvider] ? 'Testing...' : 'Test Connection'}</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-slate-900 border border-white/5 space-y-2 text-xs text-slate-300 leading-relaxed">
              <span className="font-semibold text-white block">In-Browser Transformers.js Whisper Mode</span>
              <p>
                Runs quantized Whisper directly inside a client-side Web Worker using WebAssembly or WebGPU. No network token costs or external API calls. Note: initial model download is ~40MB.
              </p>
            </div>
          )}
        </div>

        {/* Global Model Routing Option */}
        <div className="p-5 rounded-2xl border border-white/10 bg-slate-950/60 space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <Cpu className="w-4 h-4 text-purple-400" />
                <span>Single-Model Simplicity</span>
              </h4>
              <p className="text-xs text-slate-400">
                Use one model across all analysis agents (extractor, graph, golden moments, flashcards, quizzes).
              </p>
            </div>

            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={localSettings.useSingleModel}
                onChange={(e) => {
                  const updated = { ...localSettings, useSingleModel: e.target.checked };
                  setLocalSettings(updated);
                  saveUserApiSettings(updated);
                  onUpdateSettings(updated);
                }}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600" />
            </label>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-white/10 text-xs text-slate-400">
          <button
            type="button"
            onClick={handleClearKeys}
            className="flex items-center gap-1.5 text-rose-400 hover:text-rose-300 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            <span>Clear All Keys</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
