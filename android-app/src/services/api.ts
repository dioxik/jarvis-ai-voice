import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * JARVIS API Service
 * Communicates with the gateway server for voice, chat, and config.
 */

const STORAGE_KEY = '@jarvis_gateway_url';
const DEFAULT_GATEWAY = 'http://192.168.1.100:3000';

let gatewayUrl = DEFAULT_GATEWAY;

// Initialize from storage
export async function initApi() {
  try {
    const saved = await AsyncStorage.getItem(STORAGE_KEY);
    if (saved) {
      gatewayUrl = saved;
    }
  } catch (e) {
    console.error('Failed to load gateway URL', e);
  }
}

export async function setGatewayUrl(url: string) {
  let formatted = url.trim().replace(/\/$/, '');
  if (!formatted.startsWith('http')) {
    formatted = 'http://' + formatted;
  }
  gatewayUrl = formatted;
  try {
    await AsyncStorage.setItem(STORAGE_KEY, formatted);
  } catch (e) {
    console.error('Failed to save gateway URL', e);
  }
}

export function getGatewayUrl() {
  return gatewayUrl;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface VoiceResponse {
  audioBlob: Blob;
  transcript: string;
  responseText: string;
}

export interface HealthStatus {
  status: string;
  llm: string;
  model: string;
}

// ─── Health ───────────────────────────────────────────────────────────────────

export async function checkHealth(): Promise<HealthStatus> {
  try {
    const res = await fetch(`${gatewayUrl}/health`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Gateway error (${res.status}): ${text.slice(0, 50)}`);
    }
    return res.json();
  } catch (e: any) {
    if (e.message.includes('Network request failed')) {
      throw new Error('Błąd sieci: Sprawdź czy adres IP jest poprawny i czy telefon jest w tej samej sieci co serwer.');
    }
    throw e;
  }
}

// ─── Text chat ────────────────────────────────────────────────────────────────

export async function sendTextMessage(
  message: string,
  history: ChatMessage[]
): Promise<string> {
  const messages: ChatMessage[] = [...history, { role: 'user', content: message }];

  const res = await fetch(`${gatewayUrl}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages }),
  });

  if (!res.ok) throw new Error(`Chat error: ${res.status}`);
  const data = await res.json();
  return data.text as string;
}

// ─── Voice (STT + LLM + TTS) ─────────────────────────────────────────────────

export async function sendVoiceMessage(
  audioUri: string,
  history: ChatMessage[]
): Promise<VoiceResponse> {
  const formData = new FormData();

  // Use a more robust way to attach the file for React Native
  // The 'audio' field must match what the gateway expects
  formData.append('audio', {
    uri: audioUri,
    name: 'recording.m4a',
    type: 'audio/m4a',
  } as any);
  
  formData.append('history', JSON.stringify(history));

  const res = await fetch(`${gatewayUrl}/voice`, {
    method: 'POST',
    body: formData,
    headers: {
      'Accept': 'audio/wav',
      // Do NOT set Content-Type header manually when using FormData in RN
    },
  });

  if (!res.ok) {
    const errBody = await res.text();
    let msg = `Voice error ${res.status}`;
    try {
      const json = JSON.parse(errBody);
      msg = json.error || msg;
    } catch {
      msg = errBody.slice(0, 100) || msg;
    }
    throw new Error(msg);
  }

  const transcript = decodeURIComponent(res.headers.get('X-Transcript') || '');
  const responseText = decodeURIComponent(res.headers.get('X-Response-Text') || '');
  const responseBlob = await res.blob();

  return { audioBlob: responseBlob, transcript, responseText };
}

// ─── Provider switch ──────────────────────────────────────────────────────────

export async function switchProvider(provider: 'ollama' | 'openclaw'): Promise<void> {
  const res = await fetch(`${gatewayUrl}/provider`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider }),
  });
  if (!res.ok) throw new Error('Failed to switch provider');
}
