import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  StyleSheet, StatusBar, ActivityIndicator, Alert,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import * as FileSystem from 'expo-file-system';
import JarvisAnimation from '../components/JarvisAnimation';
import { useVoice } from '../hooks/useVoice';
import {
  sendVoiceMessage,
  ChatMessage,
} from '../services/api';

export default function MainScreen() {
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  const { state, amplitude, startRecording, stopRecording, playAudio } = useVoice();

  // ── Voice button handler ───────────────────────────────────────────────────
  const handleVoicePress = useCallback(async () => {
    setError(null);

    if (state === 'recording') {
      // Stop, send to gateway, play response
      const uri = await stopRecording();
      if (!uri) return;

      try {
        const { audioBlob, transcript, responseText } = await sendVoiceMessage(uri, history);

        // Add to chat history
        setHistory(prev => [
          ...prev,
          { role: 'user', content: transcript },
          { role: 'assistant', content: responseText },
        ]);
        scrollRef.current?.scrollToEnd({ animated: true });

        // Save audio blob to temp file and play
        const tmpPath = `${FileSystem.cacheDirectory}jarvis_response_${Date.now()}.wav`;
        const reader = new FileReader();
        reader.onload = async () => {
          const base64 = (reader.result as string).split(',')[1];
          await FileSystem.writeAsStringAsync(tmpPath, base64, {
            encoding: FileSystem.EncodingType.Base64,
          });
          await playAudio(tmpPath);
        };
        reader.readAsDataURL(audioBlob);
      } catch (e: any) {
        setError(e.message || 'Connection error');
        // Voice state will reset via hook
      }
    } else if (state === 'idle') {
      await startRecording().catch(e => setError(e.message));
    }
  }, [state, history, startRecording, stopRecording, playAudio]);

  const modeLabel = {
    idle: 'Naciśnij i mów',
    recording: 'Słucham... (zwolnij aby wysłać)',
    processing: 'Przetwarzam...',
    playing: 'Odpowiadam...',
  }[state];

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#000814" />

      {/* Top header */}
      <View style={styles.header}>
        <Text style={styles.headerText}>J.A.R.V.I.S</Text>
        <Text style={styles.headerSub}>AI VOICE ASSISTANT</Text>
      </View>

      {/* Animated JARVIS orb */}
      <View style={styles.orbContainer}>
        <JarvisAnimation mode={state} amplitude={amplitude} size={300} />
      </View>

      {/* Status */}
      <View style={styles.statusBar}>
        {state === 'processing' && (
          <ActivityIndicator size="small" color="#00d4ff" style={{ marginRight: 8 }} />
        )}
        <Text style={styles.statusText}>{modeLabel}</Text>
      </View>

      {/* Error */}
      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>⚠ {error}</Text>
        </View>
      )}

      {/* Chat history */}
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

      {/* Voice button */}
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
  );
}

const CYAN = '#00d4ff';
const BG = '#000814';
const PANEL = '#020f1e';
const BORDER = '#0a2a44';

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
    alignItems: 'center',
  },
  header: {
    paddingTop: 52,
    paddingBottom: 8,
    alignItems: 'center',
  },
  headerText: {
    color: CYAN,
    fontSize: 18,
    letterSpacing: 8,
    fontWeight: '300',
  },
  headerSub: {
    color: CYAN,
    fontSize: 9,
    letterSpacing: 4,
    opacity: 0.5,
    marginTop: 2,
  },
  orbContainer: {
    marginVertical: 12,
  },
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusText: {
    color: CYAN,
    fontSize: 11,
    letterSpacing: 2,
    opacity: 0.7,
  },
  errorBox: {
    backgroundColor: '#1a0000',
    borderColor: '#ff4444',
    borderWidth: 0.5,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginHorizontal: 20,
    marginBottom: 8,
  },
  errorText: {
    color: '#ff6666',
    fontSize: 12,
  },
  chatScroll: {
    flex: 1,
    width: '100%',
  },
  chatContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 8,
  },
  emptyText: {
    color: CYAN,
    opacity: 0.25,
    fontSize: 12,
    letterSpacing: 2,
    textAlign: 'center',
    marginTop: 20,
  },
  bubble: {
    borderRadius: 12,
    padding: 12,
    maxWidth: '90%',
    borderWidth: 0.5,
  },
  bubbleUser: {
    alignSelf: 'flex-end',
    backgroundColor: '#001a2e',
    borderColor: BORDER,
  },
  bubbleAssistant: {
    alignSelf: 'flex-start',
    backgroundColor: PANEL,
    borderColor: CYAN,
    borderWidth: 0.5,
    shadowColor: CYAN,
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  bubbleRole: {
    color: CYAN,
    fontSize: 9,
    letterSpacing: 3,
    opacity: 0.6,
    marginBottom: 4,
  },
  bubbleText: {
    color: '#c8e8f0',
    fontSize: 14,
    lineHeight: 20,
  },
  controls: {
    width: '100%',
    alignItems: 'center',
    paddingBottom: 36,
    paddingTop: 12,
    gap: 12,
  },
  voiceBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#001a2e',
    borderColor: CYAN,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceBtnActive: {
    backgroundColor: '#1a0000',
    borderColor: '#ff4444',
    borderWidth: 2,
  },
  voiceBtnDisabled: {
    opacity: 0.4,
  },
  voiceBtnIcon: {
    fontSize: 28,
  },
  clearBtn: {
    paddingHorizontal: 20,
    paddingVertical: 6,
    borderRadius: 20,
    borderColor: BORDER,
    borderWidth: 0.5,
  },
  clearBtnText: {
    color: CYAN,
    opacity: 0.5,
    fontSize: 11,
    letterSpacing: 2,
  },
});
