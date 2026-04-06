# 🤖 J.A.R.V.I.S — AI Voice Assistant

Lokalna aplikacja głosowa wzorowana na JARVIS z Iron Man.  
**100% darmowa, 100% lokalna** — żadnych zewnętrznych API.

```
[Android App] ←─── WebSocket/HTTP ───→ [Gateway] ←──→ [Ollama / OpenClaw]
                                            ↕                    
                                       [Whisper STT]
                                       [Piper TTS]
```

## Stack

| Komponent | Technologia |
|-----------|-------------|
| Aplikacja | React Native (Expo) + TypeScript |
| STT | Whisper.cpp (faster-whisper) w Docker |
| TTS | Piper (polski głos: darkman) w Docker |
| LLM most | Node.js Fastify gateway |
| LLM lokalny | Ollama (llama3.2, mistral, etc.) |
| LLM alternatywny | OpenClaw (kompatybilny z OpenAI API) |

---

## 🐳 Uruchomienie serwera

### Wymagania
- Docker + Docker Compose
- Min. 8 GB RAM (16 GB dla GPU)
- GPU (opcjonalnie, znacznie przyspiesza STT/LLM)

### 1. Klonuj repo i uruchom

```bash
git clone https://github.com/TWOJ_LOGIN/jarvis-ai.git
cd jarvis-ai/docker-compose

# Zbuduj i uruchom wszystko
docker-compose up -d

# Pobierz model LLM (np. llama3.2)
docker exec -it jarvis-ollama ollama pull llama3.2
```

### 2. Sprawdź działanie

```bash
curl http://localhost:3000/health
# {"status":"ok","llm":"ollama","model":"llama3.2"}

# Test TTS
curl -X POST http://localhost:3000/tts \
  -H "Content-Type: application/json" \
  -d '{"text":"Witaj, jestem J.A.R.V.I.S."}' \
  --output test.wav
```

### CPU-only (bez GPU)

W `docker-compose.yml` zmień image whisper na:
```yaml
image: onerahmet/openai-whisper-asr-webservice:latest
```
i usuń sekcję `deploy` z ollama.

---

## 📱 Uruchomienie aplikacji Android

### Wymagania
- Node.js 20+
- Expo CLI
- Android Studio / fizyczne urządzenie

```bash
cd android-app
npm install

# Uruchom Expo
npm start

# Zeskanuj QR w Expo Go
# LUB zbuduj APK:
npx eas build --platform android --profile preview
```

### Konfiguracja IP serwera

W ustawieniach aplikacji (zakładka CONFIG) wpisz adres IP serwera:
```
http://192.168.1.XXX:3000
```

Znajdź IP komputera: `ip addr show` (Linux) lub `ipconfig` (Windows).

---

## 🔧 Zmiana modelu LLM

```bash
# Ollama — pobierz inny model
docker exec -it jarvis-ollama ollama pull mistral
docker exec -it jarvis-ollama ollama pull phi3

# Zmień w docker-compose.yml:
OLLAMA_MODEL=mistral
```

### OpenClaw zamiast Ollama

```bash
# W docker-compose.yml:
LLM_PROVIDER=openclaw
OPENCLAW_URL=http://openclaw:8080
```

Lub przełącz w aplikacji w zakładce CONFIG.

---

## 📁 Struktura projektu

```
jarvis-ai/
├── android-app/           # Expo React Native app
│   └── src/
│       ├── components/
│       │   └── JarvisAnimation.tsx   # Animacja HUD
│       ├── screens/
│       │   ├── MainScreen.tsx        # Główny ekran
│       │   └── SettingsScreen.tsx    # Ustawienia
│       ├── hooks/
│       │   └── useVoice.ts           # Nagrywanie + odtwarzanie
│       └── services/
│           └── api.ts                # Gateway client
├── gateway-server/        # Node.js Fastify bridge
│   └── src/index.ts
├── docker/
│   └── piper/             # TTS Docker + REST wrapper
└── docker-compose/
    └── docker-compose.yml
```

---

## 🎨 Animacja JARVIS

Animacja na ekranie głównym składa się z:
- **Pierścień zewnętrzny** — wolno obraca się zgodnie z ruchem wskazówek zegara, z podziałką
- **Pierścień środkowy** — obraca się przeciwnie, przerywane segmenty z dekoracją binarną
- **Pierścień wewnętrzny** — szybki, częściowy łuk z akcentem
- **Rdzeń** — pulsuje w rytm mowy lub amplitudy mikrofonu

Stany:
| Stan | Zachowanie |
|------|-----------|
| `idle` | Spokojne oddychanie rdzenia |
| `recording` | Rdzeń reaguje na amplitudę mikrofonu, kolor czerwony |
| `processing` | Delikatne pulsowanie, kolor niebieski |
| `playing` | Aktywne pulsowanie w rytm TTS, kolor cyan |

---

## Licencja

MIT — używaj i modyfikuj dowolnie.
