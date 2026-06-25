// screens/LoginScreen.js
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Image,
  ActivityIndicator, Alert, SafeAreaView,
} from 'react-native';
import { signInWithCredential, GoogleAuthProvider } from 'firebase/auth';
import { auth } from '../firebase';
import { COLORS, RADIUS } from '../theme';
import { Btn } from '../components/UI';

// ── NOTE ─────────────────────────────────────────────────────────────────────
// Google Sign-In in React Native requires a native module.
// For Expo: install `expo-auth-session` + `expo-web-browser`.
// For bare RN: install `@react-native-google-signin/google-signin`.
// The stub below shows both paths; un-comment the one you use.
// ─────────────────────────────────────────────────────────────────────────────

// ── EXPO path (un-comment to use) ────────────────────────────────────────────
// import * as Google from 'expo-auth-session/providers/google';
// import * as WebBrowser from 'expo-web-browser';
// WebBrowser.maybeCompleteAuthSession();

// ── Bare RN path (un-comment to use) ─────────────────────────────────────────
// import { GoogleSignin } from '@react-native-google-signin/google-signin';
// GoogleSignin.configure({ webClientId: 'YOUR_WEB_CLIENT_ID' });

export default function LoginScreen() {
  const [loading, setLoading] = useState(false);

  // ── EXPO Google Sign-In ───────────────────────────────────────────────────
  // const [request, response, promptAsync] = Google.useAuthRequest({
  //   androidClientId: 'YOUR_ANDROID_CLIENT_ID',
  //   iosClientId:     'YOUR_IOS_CLIENT_ID',
  //   webClientId:     'YOUR_WEB_CLIENT_ID',
  // });
  // React.useEffect(() => {
  //   if (response?.type === 'success') {
  //     const { id_token } = response.params;
  //     const cred = GoogleAuthProvider.credential(id_token);
  //     signInWithCredential(auth, cred).catch((e) => Alert.alert('Login failed', e.message));
  //   }
  // }, [response]);
  // const handleLogin = () => promptAsync();

  // ── Bare RN Google Sign-In ────────────────────────────────────────────────
  const handleLogin = async () => {
    setLoading(true);
    try {
      // await GoogleSignin.hasPlayServices();
      // const userInfo = await GoogleSignin.signIn();
      // const cred = GoogleAuthProvider.credential(userInfo.idToken);
      // await signInWithCredential(auth, cred);

      // STUB — replace with your chosen SDK call above:
      Alert.alert(
        'Setup required',
        'Un-comment one of the Google Sign-In paths in LoginScreen.js and add your Client IDs.',
      );
    } catch (e) {
      Alert.alert('Login error', e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.logoWrap}>
          <Text style={styles.emoji}>📚</Text>
          <Text style={styles.title}>Rakshapal Singh{'\n'}Library</Text>
          <Text style={styles.subtitle}>Member Portal</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.welcomeTxt}>Welcome</Text>
          <Text style={styles.desc}>
            Sign in with your Google account to access your membership, pay fees, and connect to library Wi-Fi.
          </Text>

          {loading ? (
            <ActivityIndicator color={COLORS.primary} size="large" style={{ marginTop: 20 }} />
          ) : (
            <Btn label="🔑  Sign in with Google" onPress={handleLogin} variant="blue" />
          )}
        </View>

        <Text style={styles.footer}>Library Management System v2.0</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: COLORS.bg },
  container: {
    flex: 1, paddingHorizontal: 20,
    justifyContent: 'center',
  },
  logoWrap:  { alignItems: 'center', marginBottom: 32 },
  emoji:     { fontSize: 64, marginBottom: 10 },
  title: {
    fontSize: 26, fontWeight: '900',
    color: COLORS.dark, textAlign: 'center',
    lineHeight: 32, marginBottom: 6,
  },
  subtitle: {
    fontSize: 13, color: COLORS.muted,
    fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.xl,
    padding: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08, shadowRadius: 16, elevation: 5,
  },
  welcomeTxt: {
    fontSize: 22, fontWeight: 'bold', color: COLORS.dark, marginBottom: 8,
  },
  desc: {
    fontSize: 14, color: COLORS.muted, lineHeight: 21,
  },
  footer: {
    textAlign: 'center', fontSize: 11,
    color: COLORS.mutedLight, marginTop: 32,
  },
});
