import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, Switch, ActivityIndicator,
  Alert,
} from 'react-native';
import { setGatewayUrl, getGatewayUrl, checkHealth, switchProvider } from '../services/api';

const CYAN = '#00d4ff';
const BG = '#000814';
const PANEL = '#020f1e';
const BORDER = '#0a2a44';

export default function SettingsScreen() {
  const [gatewayInput, setGatewayInput] = useState(getGatewayUrl());
  const [health, setHealth] = useState<{ status: string; llm: string; model: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [useOllama, setUseOllama] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const testConnection = async () => {
    if (!gatewayInput.trim()) {
      setError('Wprowadź adres serwera');
      return;
    }
    
    setLoading(true);
    setError(null);
    try {
      // Apply the URL first
      setGatewayUrl(gatewayInput);
      // Update input field with formatted URL (e.g. adding http:// if missing)
      const currentUrl = getGatewayUrl();
      setGatewayInput(currentUrl);
      
      const h = await checkHealth();
      setHealth(h);
      setUseOllama(h.llm === 'ollama');
      Alert.alert('Sukces', 'Połączono z J.A.R.V.I.S Gateway');
    } catch (e: any) {
      console.error('Connection test error:', e);
      setError(e.message || 'Nie udało się nawiązać połączenia');
      setHealth(null);
    } finally {
      setLoading(false);
    }
  };

  const handleProviderToggle = async (value: boolean) => {
    setUseOllama(value);
    try {
      await switchProvider(value ? 'ollama' : 'openclaw');
    } catch (e: any) {
      setError('Błąd zmiany silnika: ' + e.message);
    }
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.title}>KONFIGURACJA</Text>

      {/* Gateway URL */}
      <View style={styles.section}>
        <Text style={styles.label}>ADRES GATEWAY (HTTPS/HTTP)</Text>
        <TextInput
          style={styles.input}
          value={gatewayInput}
          onChangeText={setGatewayInput}
          placeholder="https://twoja-domena.pl"
          placeholderTextColor="#1a4466"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
        />
        <Text style={styles.hint}>Upewnij się, że używasz pełnego adresu z http:// lub https://</Text>
        <TouchableOpacity style={styles.btn} onPress={testConnection} disabled={loading}>
          {loading ? (
            <ActivityIndicator color={CYAN} size="small" />
          ) : (
            <Text style={styles.btnText}>TESTUJ POŁĄCZENIE</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Health status */}
      {health && (
        <View style={styles.statusBox}>
          <Text style={styles.statusOk}>✓ POŁĄCZONO</Text>
          <Text style={styles.statusDetail}>LLM: {health.llm.toUpperCase()}</Text>
          <Text style={styles.statusDetail}>Model: {health.model}</Text>
        </View>
      )}

      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>✗ {error}</Text>
        </View>
      )}

      {/* Provider toggle */}
      <View style={styles.section}>
        <Text style={styles.label}>SILNIK LLM</Text>
        <View style={styles.toggleRow}>
          <Text style={[styles.toggleLabel, !useOllama && styles.toggleActive]}>OpenClaw</Text>
          <Switch
            value={useOllama}
            onValueChange={handleProviderToggle}
            thumbColor={useOllama ? CYAN : '#444'}
            trackColor={{ false: BORDER, true: '#004466' }}
          />
          <Text style={[styles.toggleLabel, useOllama && styles.toggleActive]}>Ollama</Text>
        </View>
      </View>

      {/* Info */}
      <View style={styles.section}>
        <Text style={styles.label}>INFORMACJE</Text>
        <Text style={styles.infoText}>
          STT: Whisper (lokalny Docker){'\n'}
          TTS: Piper PL (lokalny Docker){'\n'}
          Gateway: Node.js Fastify{'\n'}
          Wersja: 1.0.1
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  content: { padding: 24, paddingTop: 60, gap: 24 },
  title: {
    color: CYAN,
    fontSize: 16,
    letterSpacing: 6,
    fontWeight: '300',
    marginBottom: 8,
  },
  section: {
    borderColor: BORDER,
    borderWidth: 0.5,
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  label: {
    color: CYAN,
    fontSize: 9,
    letterSpacing: 3,
    opacity: 0.7,
  },
  hint: {
    color: '#446688',
    fontSize: 10,
    marginTop: -4,
    marginBottom: 4,
  },
  input: {
    backgroundColor: PANEL,
    borderColor: BORDER,
    borderWidth: 0.5,
    borderRadius: 8,
    color: '#c8e8f0',
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
    fontFamily: 'monospace',
  },
  btn: {
    backgroundColor: '#001a2e',
    borderColor: CYAN,
    borderWidth: 0.5,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  btnText: {
    color: CYAN,
    fontSize: 10,
    letterSpacing: 3,
  },
  statusBox: {
    backgroundColor: '#001a0a',
    borderColor: '#00aa44',
    borderWidth: 0.5,
    borderRadius: 8,
    padding: 12,
    gap: 4,
  },
  statusOk: { color: '#00cc66', fontSize: 11, letterSpacing: 2 },
  statusDetail: { color: '#88ccaa', fontSize: 12 },
  errorBox: {
    backgroundColor: '#1a0000',
    borderColor: '#ff4444',
    borderWidth: 0.5,
    borderRadius: 8,
    padding: 12,
  },
  errorText: { color: '#ff6666', fontSize: 12 },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  toggleLabel: {
    color: '#1a4466',
    fontSize: 12,
    letterSpacing: 1,
  },
  toggleActive: {
    color: CYAN,
  },
  infoText: {
    color: '#446688',
    fontSize: 12,
    lineHeight: 22,
    fontFamily: 'monospace',
  },
});
