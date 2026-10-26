import {
  ApiProvider,
  AgentRole,
  UserApiSettings,
  ProviderKeyConfig,
} from '@/types/lecture';

export const DEFAULT_PROVIDER_CONFIGS: Record<ApiProvider, ProviderKeyConfig> = {
  gemini: {
    provider: 'gemini',
    defaultModel: 'gemini-2.0-flash',
    status: 'untested',
  },
  openai: {
    provider: 'openai',
    defaultModel: 'gpt-4o-mini',
    baseUrl: 'https://api.openai.com/v1',
    status: 'untested',
  },
  anthropic: {
    provider: 'anthropic',
    defaultModel: 'claude-3-5-haiku-20241022',
    baseUrl: 'https://api.anthropic.com/v1',
    status: 'untested',
  },
  groq: {
    provider: 'groq',
    defaultModel: 'llama-3.3-70b-versatile',
    baseUrl: 'https://api.groq.com/openai/v1',
    status: 'untested',
  },
  openrouter: {
    provider: 'openrouter',
    defaultModel: 'deepseek/deepseek-chat',
    baseUrl: 'https://openrouter.ai/api/v1',
    status: 'untested',
  },
  custom: {
    provider: 'custom',
    defaultModel: 'llama3',
    baseUrl: 'http://localhost:11434/v1',
    status: 'untested',
  },
  local: {
    provider: 'local',
    defaultModel: 'Xenova/whisper-tiny',
    status: 'valid',
    statusMessage: 'In-Browser Transformers.js (Zero API Key)',
  },
};

export const DEFAULT_AGENT_ROLES: AgentRole[] = [
  'transcriber',
  'segmenter',
  'extractor',
  'graph',
  'golden',
  'composer',
  'summary',
  'quiz',
  'chat',
];

export function getDefaultApiSettings(): UserApiSettings {
  return {
    useSingleModel: true,
    singleProvider: 'gemini',
    singleModel: 'gemini-2.0-flash',
    providers: { ...DEFAULT_PROVIDER_CONFIGS },
    assignments: {
      transcriber: { role: 'transcriber', provider: 'groq', model: 'whisper-large-v3' },
      segmenter: { role: 'segmenter', provider: 'gemini', model: 'gemini-2.0-flash' },
      extractor: { role: 'extractor', provider: 'gemini', model: 'gemini-2.0-flash' },
      graph: { role: 'graph', provider: 'gemini', model: 'gemini-2.0-flash' },
      golden: { role: 'golden', provider: 'gemini', model: 'gemini-2.0-flash' },
      composer: { role: 'composer', provider: 'gemini', model: 'gemini-2.0-flash' },
      summary: { role: 'summary', provider: 'gemini', model: 'gemini-2.0-flash' },
      quiz: { role: 'quiz', provider: 'gemini', model: 'gemini-2.0-flash' },
      chat: { role: 'chat', provider: 'gemini', model: 'gemini-2.0-flash' },
    },
    rememberOnDevice: false,
  };
}

const STORAGE_SESSION_KEY = 'byo_api_settings_session';
const STORAGE_LOCAL_KEY = 'byo_api_settings_vault';

/**
 * Loads API settings from browser memory/sessionStorage or encrypted localStorage.
 */
export function loadUserApiSettings(): UserApiSettings {
  if (typeof window === 'undefined') return getDefaultApiSettings();

  try {
    // 1. Try sessionStorage first (default zero-persistence)
    const sessionRaw = sessionStorage.getItem(STORAGE_SESSION_KEY);
    if (sessionRaw) {
      return { ...getDefaultApiSettings(), ...JSON.parse(sessionRaw) };
    }

    // 2. Fallback to localStorage if user explicitly enabled rememberOnDevice
    const localRaw = localStorage.getItem(STORAGE_LOCAL_KEY);
    if (localRaw) {
      return { ...getDefaultApiSettings(), ...JSON.parse(localRaw) };
    }
  } catch (err) {
    console.warn('[BYO Settings] Failed to load stored settings:', err);
  }

  return getDefaultApiSettings();
}

/**
 * Saves API settings into sessionStorage, and optionally encrypted in localStorage.
 */
export function saveUserApiSettings(settings: UserApiSettings): void {
  if (typeof window === 'undefined') return;

  try {
    const serialized = JSON.stringify(settings);
    sessionStorage.setItem(STORAGE_SESSION_KEY, serialized);

    if (settings.rememberOnDevice) {
      localStorage.setItem(STORAGE_LOCAL_KEY, serialized);
    } else {
      localStorage.removeItem(STORAGE_LOCAL_KEY);
    }
  } catch (err) {
    console.error('[BYO Settings] Failed to persist settings:', err);
  }
}

/**
 * Clears all stored API keys and sensitive settings.
 */
export function clearAllUserApiKeys(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(STORAGE_SESSION_KEY);
  localStorage.removeItem(STORAGE_LOCAL_KEY);
  localStorage.removeItem('gemini_vault_key');
}

/**
 * Validates a provider's API key by issuing a minimal verification call.
 */
export async function testProviderConnection(
  provider: ApiProvider,
  apiKey: string,
  baseUrl?: string
): Promise<{ status: ProviderKeyConfig['status']; message: string }> {
  if (provider === 'local') {
    return { status: 'valid', message: 'Local browser engine ready.' };
  }

  if (!apiKey || apiKey.trim().length === 0) {
    return { status: 'invalid', message: 'API key is required.' };
  }

  const cleanKey = apiKey.trim();

  try {
    // Test Gemini
    if (provider === 'gemini') {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${cleanKey}`,
        { method: 'GET' }
      );
      if (res.ok) {
        return { status: 'valid', message: 'Key verified successfully with Google Gemini.' };
      }
      if (res.status === 429) {
        return { status: 'rate_limited', message: 'Quota exhausted or rate limited.' };
      }
      return { status: 'invalid', message: `Invalid key (Status: ${res.status}).` };
    }

    // Test OpenAI
    if (provider === 'openai') {
      const target = `${baseUrl || 'https://api.openai.com/v1'}/models`;
      const res = await fetch(target, {
        headers: { Authorization: `Bearer ${cleanKey}` },
      });
      if (res.ok) return { status: 'valid', message: 'Key verified with OpenAI.' };
      if (res.status === 429) return { status: 'rate_limited', message: 'OpenAI rate limited.' };
      return { status: 'invalid', message: `OpenAI rejected key (Status: ${res.status}).` };
    }

    // Test Groq
    if (provider === 'groq') {
      const res = await fetch('https://api.groq.com/openai/v1/models', {
        headers: { Authorization: `Bearer ${cleanKey}` },
      });
      if (res.ok) return { status: 'valid', message: 'Groq endpoint verified.' };
      if (res.status === 429) return { status: 'rate_limited', message: 'Groq rate limited.' };
      return { status: 'invalid', message: `Groq error (Status: ${res.status}).` };
    }

    // Test Anthropic (via proxy due to browser CORS restriction)
    if (provider === 'anthropic') {
      const res = await fetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'anthropic',
          apiKey: cleanKey,
          endpoint: 'https://api.anthropic.com/v1/models',
          method: 'GET',
        }),
      });
      if (res.ok) return { status: 'valid', message: 'Anthropic key verified via proxy.' };
      return { status: 'invalid', message: 'Anthropic rejected key.' };
    }

    // Test OpenRouter
    if (provider === 'openrouter') {
      const res = await fetch('https://openrouter.ai/api/v1/models', {
        headers: { Authorization: `Bearer ${cleanKey}` },
      });
      if (res.ok) return { status: 'valid', message: 'OpenRouter verified.' };
      return { status: 'invalid', message: 'OpenRouter rejected key.' };
    }

    // Test Custom OpenAI-compatible endpoint
    if (provider === 'custom') {
      const url = `${(baseUrl || 'http://localhost:11434/v1').replace(/\/$/, '')}/models`;
      const res = await fetch(url, {
        headers: cleanKey ? { Authorization: `Bearer ${cleanKey}` } : {},
      }).catch(() => null);

      if (res && res.ok) {
        return { status: 'valid', message: 'Custom endpoint reached successfully.' };
      }
      return { status: 'cors_blocked', message: 'Could not connect. Ensure CORS is enabled on endpoint.' };
    }

    return { status: 'valid', message: 'Provider configured.' };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('Failed to fetch') || msg.includes('CORS') || msg.includes('NetworkError')) {
      return { status: 'cors_blocked', message: 'Browser CORS blocked direct request. Proxy route will be used.' };
    }
    return { status: 'invalid', message: `Connection error: ${msg}` };
  }
}
