import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import * as fs from 'fs';
import fetch from 'node-fetch';
import FormData from 'form-data';

const app = Fastify({ logger: true });

const config = {
  llm: {
    provider: (process.env.LLM_PROVIDER || 'ollama') as 'ollama' | 'openclaw',
    ollama: {
      url: process.env.OLLAMA_URL || 'http://ollama:11434',
      model: process.env.OLLAMA_MODEL || 'llama3.2',
    },
    openclaw: {
      url: process.env.OPENCLAW_URL || 'http://openclaw:8080',
      model: process.env.OPENCLAW_MODEL || 'mistral',
    },
  },
  stt: { url: process.env.WHISPER_URL || 'http://whisper:9000' },
  tts: {
    url: process.env.PIPER_URL || 'http://piper:5500',
    voice: process.env.PIPER_VOICE || 'pl_PL-darkman-medium',
  },
  tmpDir: '/tmp/jarvis',
};

fs.mkdirSync(config.tmpDir, { recursive: true });

const SYSTEM_PROMPT = `You are J.A.R.V.I.S. — Just A Rather Very Intelligent System.
You are a helpful, precise, and slightly witty AI assistant.
Keep responses concise and natural for voice conversation (2-4 sentences max unless asked for detail).
Respond in the same language the user speaks.`;

async function queryLLM(messages: { role: string; content: string }[]): Promise<string> {
  const provider = config.llm.provider;

  try {
    if (provider === 'ollama') {
      const res = await fetch(`${config.llm.ollama.url}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: config.llm.ollama.model,
          messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
          stream: false,
        }),
      });
      if (!res.ok) throw new Error(`Ollama error: ${res.status}`);
      const data = (await res.json()) as any;
      return data.message?.content || '';
    }

    if (provider === 'openclaw') {
      const res = await fetch(`${config.llm.openclaw.url}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: config.llm.openclaw.model,
          messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
          max_tokens: 512,
        }),
      });
      if (!res.ok) throw new Error(`OpenClaw error: ${res.status}`);
      const data = (await res.json()) as any;
      return data.choices?.[0]?.message?.content || '';
    }
  } catch (e: any) {
    console.error('LLM Query Error:', e.message);
    return "Przepraszam, mam problem z połączeniem z moim mózgiem.";
  }

  throw new Error(`Unknown LLM provider: ${provider}`);
}

async function transcribeAudio(audioBuffer: Buffer, filename: string): Promise<string> {
  const form = new FormData();
  form.append('audio_file', audioBuffer, { filename, contentType: 'audio/m4a' });
  form.append('language', 'pl');
  form.append('task', 'transcribe');

  try {
    const res = await fetch(`${config.stt.url}/asr`, {
      method: 'POST',
      body: form as any,
      headers: form.getHeaders(),
    });

    const textResponse = await res.text();
    
    if (!res.ok) {
      console.error('STT Server Error Response:', textResponse);
      throw new Error(`STT server returned ${res.status}`);
    }

    try {
      const data = JSON.parse(textResponse);
      return (data.text || '').trim();
    } catch (parseError) {
      console.error('Failed to parse STT JSON. Raw response:', textResponse);
      // If it's not JSON but we got a 200, maybe it's just the text?
      if (textResponse && textResponse.length < 500) return textResponse.trim();
      throw new Error('Invalid JSON from STT server');
    }
  } catch (e: any) {
    console.error('Transcription Error:', e.message);
    throw e;
  }
}

async function synthesizeSpeech(text: string): Promise<Buffer> {
  const res = await fetch(`${config.tts.url}/synthesize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, voice: config.tts.voice }),
  });
  if (!res.ok) throw new Error(`TTS error: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function main() {
  await app.register(cors, { origin: '*' });
  await app.register(multipart, { limits: { fileSize: 50 * 1024 * 1024 } });

  app.get('/health', async () => ({
    status: 'ok',
    llm: config.llm.provider,
    model: config.llm.provider === 'ollama' ? config.llm.ollama.model : config.llm.openclaw.model,
  }));

  app.post('/provider', async (req: any) => {
    const { provider } = req.body as any;
    if (!['ollama', 'openclaw'].includes(provider)) throw new Error('Invalid provider');
    config.llm.provider = provider as any;
    return { ok: true, provider };
  });

  app.post('/chat', async (req: any) => {
    const { messages } = req.body as any;
    const text = await queryLLM(messages);
    return { text };
  });

  app.post('/voice', async (req, reply) => {
    try {
      const parts = req.parts();
      let audioBuffer: Buffer | null = null;
      let audioFilename = 'audio.m4a';
      let history: { role: string; content: string }[] = [];

      for await (const part of parts) {
        if (part.type === 'file' && part.fieldname === 'audio') {
          const chunks: Buffer[] = [];
          for await (const chunk of part.file) chunks.push(chunk);
          audioBuffer = Buffer.concat(chunks);
          audioFilename = part.filename || audioFilename;
        } else if (part.type === 'field' && part.fieldname === 'history') {
          try { history = JSON.parse(part.value as string); } catch {}
        }
      }

      if (!audioBuffer) { reply.status(400).send({ error: 'No audio provided' }); return; }

      let transcript = "";
      try {
        transcript = await transcribeAudio(audioBuffer, audioFilename);
      } catch (sttError: any) {
        reply.status(500).send({ error: `Błąd rozpoznawania mowy: ${sttError.message}` });
        return;
      }

      if (!transcript) { reply.status(422).send({ error: 'Nie udało się zrozumieć nagrania' }); return; }

      const messages = [...history, { role: 'user', content: transcript }];
      const responseText = await queryLLM(messages);
      const audioOut = await synthesizeSpeech(responseText);

      reply.header('X-Transcript', encodeURIComponent(transcript));
      reply.header('X-Response-Text', encodeURIComponent(responseText));
      reply.header('Content-Type', 'audio/wav');
      reply.send(audioOut);
    } catch (globalError: any) {
      console.error('Global Voice Route Error:', globalError);
      reply.status(500).send({ error: `Błąd wewnętrzny: ${globalError.message}` });
    }
  });

  app.post('/tts', async (req: any, reply) => {
    const { text } = req.body as any;
    const audio = await synthesizeSpeech(text);
    reply.header('Content-Type', 'audio/wav');
    reply.send(audio);
  });

  app.post('/stt', async (req, reply) => {
    const parts = req.parts();
    let audioBuffer: Buffer | null = null;
    let filename = 'audio.m4a';
    for await (const part of parts) {
      if (part.type === 'file') {
        const chunks: Buffer[] = [];
        for await (const chunk of part.file) chunks.push(chunk);
        audioBuffer = Buffer.concat(chunks);
        filename = part.filename || filename;
      }
    }
    if (!audioBuffer) { reply.status(400).send({ error: 'No audio' }); return; }
    const text = await transcribeAudio(audioBuffer, filename);
    return { text };
  });

  await app.listen({ port: 3000, host: '0.0.0.0' });
  console.log('🤖 J.A.R.V.I.S Gateway running on port 3000');
}

main().catch(err => { console.error(err); process.exit(1); });
