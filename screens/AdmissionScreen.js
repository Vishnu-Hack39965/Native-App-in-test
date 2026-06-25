// screens/AdmissionScreen.js — 2-step admission wizard
import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  Alert, SafeAreaView, KeyboardAvoidingView, Platform,
} from 'react-native';
import {
  auth, db, doc, updateDoc, setDoc, deleteDoc,
  arrayUnion, getStamp,
} from '../firebase';
import { COLORS, RADIUS } from '../theme';
import { Card, Btn, StepHeader, OtpInput, ErrorMsg } from '../components/UI';

export default function AdmissionScreen({ navigation }) {
  const [step, setStep] = useState(1);
  const [otp,  setOtp]  = useState('');
  const [generatedOtp, setGeneratedOtp] = useState(null);
  const [otpError, setOtpError] = useState('');
  const user = auth.currentUser;

  // ── Step 1: validate profile + send signal ────────────────────────────────
  const checkStepOne = async () => {
    const uSnap = await (await import('firebase/firestore')).getDoc(doc(db,'users',user.uid));
    if (!uSnap.exists()) return;
    const u = uSnap.data();
    const n = u.name || '', f = u.father || '', a = u.address || '', p = u.phone || '';
    if (n.length < 6 || f.length < 6 || a.length < 6)
      return Alert.alert('Incomplete Profile', 'Name, Father\'s Name & Address must each be at least 6 characters.\n\nGo back and update your profile first.');
    if (!/^\d{10}$/.test(p))
      return Alert.alert('Phone invalid', 'Please enter a valid 10-digit phone number in your profile.');

    const code = Math.floor(100000 + Math.random() * 900000);
    setGeneratedOtp(code);
    await setDoc(doc(db, 'signals', `otp_${user.uid}`), {
      type: 'ADMISSION', otp: code,
      uid: user.uid, name: n, phone: p,
      timestamp: getStamp(), expiresAt: Date.now() + 120000,
    });
    setStep(2);
  };

  // ── Step 2: verify OTP ────────────────────────────────────────────────────
  const verifyJoin = async () => {
    setOtpError('');
    if (otp !== String(generatedOtp)) {
      setOtpError('Invalid OTP. Ask the admin for the code shown on their screen.');
      return;
    }
    const now = new Date();
    await updateDoc(doc(db,'users',user.uid), {
      joinDate:    now.toLocaleDateString('en-GB'),
      joinDateISO: now.toISOString(),
      history:     arrayUnion(`Joined Library on ${getStamp()}`),
    });
    await deleteDoc(doc(db,'signals',`otp_${user.uid}`)).catch(() => {});
    Alert.alert('🎉 Welcome!', 'Your membership is now active.', [
      { text: 'OK', onPress: () => navigation.goBack() },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          <Text style={styles.heading}>Admission Wizard</Text>

          {/* ── Step 1 ── */}
          <Card style={step === 1 ? styles.activeCard : styles.inactiveCard}>
            <StepHeader num={1} title="Verify Profile Folder" />
            <Text style={styles.hint}>
              Name, Father's Name, and Address must have 6+ letters and phone must be 10 digits.
            </Text>
            {step === 1 && (
              <Btn label="Check & Send Signal" onPress={checkStepOne} />
            )}
          </Card>

          {/* ── Step 2 ── */}
          {step >= 2 && (
            <Card style={styles.activeCard}>
              <StepHeader num={2} title="Verify Identity (OTP)" />
              <Text style={styles.hint}>
                Ask the admin for the OTP shown on their Signals screen.
              </Text>
              <OtpInput value={otp} onChangeText={setOtp} />
              <ErrorMsg msg={otpError} />
              <Btn label="Complete Admission" onPress={verifyJoin} variant="dark" />
            </Card>
          )}

          <Btn label="Cancel" onPress={() => navigation.goBack()} variant="ghost" />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: COLORS.bg },
  scroll:      { padding: 20 },
  heading:     { fontSize: 24, fontWeight: 'bold', color: COLORS.dark, marginBottom: 16 },
  hint:        { fontSize: 12, color: COLORS.muted, marginVertical: 8, lineHeight: 18 },
  activeCard:  { borderLeftWidth: 5, borderLeftColor: COLORS.primary },
  inactiveCard:{ opacity: 0.6 },
});
