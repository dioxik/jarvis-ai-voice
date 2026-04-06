/**
 * JARVIS API Service
 * Communicates with the gateway server for voice, chat, and config.
 */

const DEFAULT_GATEWAY = 'http://localhost:3000'; // Default, change in settings if needed

let gatewayUrl = DEFAULT_GATEWAY;

export function setGatewayUrl(url: string) {
  gatewayUrl = url.replace(/\/$/, '');
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
  const res = await fetch(`${gatewayUrl}/health`);
  if (!res.ok) throw new Error('Gateway unreachable');
  return res.json();
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

  // Attach audio blob
  const audioResponse = await fetch(audioUri);
  const audioBlob = await audioResponse.blob();
  formData.append('audio', audioBlob, 'recording.m4a');
  formData.append('history', JSON.stringify(history));

  const res = await fetch(`${gatewayUrl}/voice`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Voice error ${res.status}: ${errBody}`);
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
