import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  StyleSheet, StatusBar, ActivityIndicator,
} from 'react-native';
import * as FileSystem from 'expo-file-system';
import JarvisAnimation from '../components/JarvisAnimation';
import { useVoice } from '../hooks/useVoice';
import { useWakeWord } from '../hooks/useWakeWord';
import { sendVoiceMessage, ChatMessage } from '../services/api';
import { logger } from '../services/logger';

const CYAN = '#00d4ff';
const BG = '#000814';
const PANEL = '#020f1e';
const BORDER = '#0a2a44';

export default function MainScreen() {
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [handsFree, setHandsFree] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const { state, amplitude, startRecording, stopRecording, playAudio, setState } = useVoice();

  // Auto-dismiss error after 5 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // ── Wake Word Integration ──────────────────────────────────────────────────
  const onWake = useCallback(() => {
    if (state === 'idle') {
      logger.log('Wykryto słowo kluczowe: JARVIS', 'info');
      handleStart();
    }
  }, [state]);

  const { isListening: isWakeListening, startListening: startWake, stopListening: stopWake } = useWakeWord(onWake);

  useEffect(() => {
    if (handsFree && state === 'idle') {
      startWake();
    } else {
      stopWake();
    }
  }, [handsFree, state, startWake, stopWake]);

  // ── Voice processing ───────────────────────────────────────────────────────
  const processVoice = useCallback(async () => {
    const uri = await stopRecording();
    if (!uri) {
      logger.log('Nie wykryto mowy, powrót do trybu czuwania', 'info');
      setState('idle');
      return;
    }

    try {
      setState('processing');
      logger.log('Przesyłanie nagrania do serwera...', 'info');
      const { audioBlob, transcript, responseText } = await sendVoiceMessage(uri, history);

      setHistory(prev => [
        ...prev,
        { role: 'user', content: transcript },
        { role: 'assistant', content: responseText },
      ]);
      scrollRef.current?.scrollToEnd({ animated: true });
      logger.log('Otrzymano odpowiedź: ' + responseText, 'info');

      const tmpPath = `${FileSystem.cacheDirectory}jarvis_response_${Date.now()}.wav`;
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(',')[1];
        await FileSystem.writeAsStringAsync(tmpPath, base64, {
          encoding: FileSystem.EncodingType.Base64,
        });
        
        await playAudio(tmpPath, () => {
          if (handsFree) {
            logger.log('Tryb Hands-free: powrót do nasłuchiwania', 'info');
            setTimeout(() => {
              if (handsFree) handleStart();
            }, 800);
          }
        });
      };
      reader.readAsDataURL(audioBlob);
    } catch (e: any) {
      const msg = e.message || 'Błąd połączenia';
      setError(msg);
      logger.log('Błąd API: ' + msg, 'error');
      setState('idle');
    }
  }, [state, history, stopRecording, playAudio, handsFree, setState]);

  const handleStart = async () => {
    setError(null);
    try {
      await startRecording(processVoice);
    } catch (e: any) {
      const msg = e.message || 'Błąd mikrofonu';
      setError(msg);
      logger.log('Błąd nagrywania: ' + msg, 'error');
    }
  };

  const handleVoicePress = useCallback(async () => {
    if (state === 'recording') {
      await processVoice();
    } else if (state === 'idle') {
      await handleStart();
    }
  }, [state, processVoice]);

  const modeLabel = {
    idle: handsFree ? 'Nasłuchuję "Jarvis"...' : 'Naciśnij i mów',
    recording: 'Słucham...',
    processing: 'Przetwarzam...',
    playing: 'Odpowiadam...',
    listening: 'Oczekiwanie...',
  }[state];

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={BG} />

      <View style={styles.header}>
        <Text style={styles.headerText}>J.A.R.V.I.S</Text>
        <Text style={styles.headerSub}>SYSTEM ACTIVE</Text>
      </View>

      <View style={styles.orbContainer}>
        <JarvisAnimation mode={state === 'listening' ? 'idle' : state as any} amplitude={amplitude} size={300} />
      </View>

      <View style={styles.statusBar}>
        {state === 'processing' && (
          <ActivityIndicator size="small" color={CYAN} style={{ marginRight: 8 }} />
        )}
        <Text style={styles.statusText}>{modeLabel}</Text>
      </View>

      {error && (
        <View style={styles.errorToast}>
          <Text style={styles.errorText}>⚠ {error}</Text>
        </View>
      )}

      <ScrollView
        ref={scrollRef}
        style={styles.chatScroll}
        contentContainerStyle={styles.chatContent}
        showsVerticalScrollIndicator={false}
      >
        {history.length === 0 && (
          <Text style={styles.emptyText}>Rozmowa pojawi się tutaj</Text>
        )}
        {history.map((msg, i) => (
          <View key={i} style={[
            styles.bubble,
            msg.role === 'user' ? styles.bubbleUser : styles.bubbleAssistant,
          ]}>
            <Text style={styles.bubbleRole}>
              {msg.role === 'user' ? 'TY' : 'JARVIS'}
            </Text>
            <Text style={styles.bubbleText}>{msg.content}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.controls}>
        <TouchableOpacity
          style={[
            styles.voiceBtn,
            state === 'recording' && styles.voiceBtnActive,
            (state === 'processing' || state === 'playing') && styles.voiceBtnDisabled,
          ]}
          onPress={handleVoicePress}
          disabled={state === 'processing' || state === 'playing'}
          activeOpacity={0.7}
        >
          <Text style={styles.voiceBtnIcon}>
            {state === 'recording' ? '⏹' : '🎤'}
          </Text>
        </TouchableOpacity>

        <View style={styles.bottomRow}>
          <TouchableOpacity
            style={[styles.modeBtn, handsFree && styles.modeBtnActive]}
            onPress={() => {
              setHandsFree(!handsFree);
              logger.log('Tryb Hands-free: ' + (!handsFree ? 'WŁĄCZONY' : 'WYŁĄCZONY'), 'info');
            }}
          >
            <Text style={styles.modeBtnText}>HANDS-FREE: {handsFree ? 'ON' : 'OFF'}</Text>
          </TouchableOpacity>

          {history.length > 0 && (
            <TouchableOpacity
              style={styles.clearBtn}
              onPress={() => setHistory([])}
            >
              <Text style={styles.clearBtnText}>Wyczyść</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG, alignItems: 'center' },
  header: { paddingTop: 52, paddingBottom: 8, alignItems: 'center' },
  headerText: { color: CYAN, fontSize: 18, letterSpacing: 8, fontWeight: '300' },
  headerSub: { color: CYAN, fontSize: 9, letterSpacing: 4, opacity: 0.5, marginTop: 2 },
  orbContainer: { marginVertical: 12 },
  statusBar: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  statusText: { color: CYAN, fontSize: 11, letterSpacing: 2, opacity: 0.7 },
  errorToast: {
    position: 'absolute',
    top: 120,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(255, 0, 0, 0.85)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    zIndex: 1000,
    borderColor: '#ff4444',
    borderWidth: 1,
  },
  errorText: { color: '#fff', fontSize: 12, textAlign: 'center', fontWeight: 'bold' },
  chatScroll: { flex: 1, width: '100%' },
  chatContent: { paddingHorizontal: 16, paddingBottom: 16, gap: 8 },
  emptyText: { color: CYAN, opacity: 0.25, fontSize: 12, letterSpacing: 2, textAlign: 'center', marginTop: 20 },
  bubble: { borderRadius: 12, padding: 12, maxWidth: '90%', borderWidth: 0.5 },
  bubbleUser: { alignSelf: 'flex-end', backgroundColor: '#001a2e', borderColor: BORDER },
  bubbleAssistant: { alignSelf: 'flex-start', backgroundColor: PANEL, borderColor: CYAN, borderWidth: 0.5 },
  bubbleRole: { color: CYAN, fontSize: 9, letterSpacing: 3, opacity: 0.6, marginBottom: 4 },
  bubbleText: { color: '#c8e8f0', fontSize: 14, lineHeight: 20 },
  controls: { width: '100%', alignItems: 'center', paddingBottom: 36, paddingTop: 12, gap: 12 },
  voiceBtn: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#001a2e', borderColor: CYAN, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  voiceBtnActive: { backgroundColor: '#1a0000', borderColor: '#ff4444', borderWidth: 2 },
  voiceBtnDisabled: { opacity: 0.4 },
  voiceBtnIcon: { fontSize: 28 },
  bottomRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  modeBtn: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, borderColor: BORDER, borderWidth: 0.5 },
  modeBtnActive: { borderColor: CYAN, backgroundColor: '#001a2e' },
  modeBtnText: { color: CYAN, opacity: 0.7, fontSize: 10, letterSpacing: 1 },
  clearBtn: { paddingHorizontal: 20, paddingVertical: 6, borderRadius: 20, borderColor: BORDER, borderWidth: 0.5 },
  clearBtnText: { color: CYAN, opacity: 0.5, fontSize: 11, letterSpacing: 2 },
});
