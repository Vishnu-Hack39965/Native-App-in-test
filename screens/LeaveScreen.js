// screens/LeaveScreen.js — Membership Exit wizard
import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  Alert, SafeAreaView, Linking, KeyboardAvoidingView, Platform,
} from 'react-native';
import {
  auth, db, doc, updateDoc, setDoc, deleteDoc,
  arrayUnion, getStamp, getRealSurvival,
} from '../firebase';
import { COLORS } from '../theme';
import { Card, Btn, StepHeader, OtpInput, ErrorMsg } from '../components/UI';

export default function LeaveScreen({ navigation }) {
  const [step, setStep] = useState(1);
  const [otp,  setOtp]  = useState('');
  const [generatedOtp, setGeneratedOtp] = useState(null);
  const [otpError, setOtpError] = useState('');
  const [duesError, setDuesError] = useState('');
  const user = auth.currentUser;

  // ── Step 1: check dues ────────────────────────────────────────────────────
  const checkLeaveFees = async () => {
    setDuesError('');
    const { getDoc } = await import('firebase/firestore');
    const snap = await getDoc(doc(db,'users',user.uid));
    if (!snap.exists()) return;
    const u = snap.data();
    const srv = getRealSurvival(u);

    if (srv < 0) {
      setDuesError(`⚠️ You have dues! Please pay ${Math.abs(Math.floor(srv))} day(s) before exiting.`);
      return;
    }

    const code = Math.floor(100000 + Math.random() * 900000);
    setGeneratedOtp(code);
    await setDoc(doc(db,'signals',`leave_${user.uid}`), {
      type: 'EXIT', otp: code,
      uid: user.uid, name: u.name, phone: u.phone,
      timestamp: getStamp(), expiresAt: Date.now() + 120000,
    });
    setStep(2);
  };

  // ── Step 2: verify OTP & exit ─────────────────────────────────────────────
  const verifyLeave = async () => {
    setOtpError('');
    if (otp !== String(generatedOtp)) {
      setOtpError('Invalid OTP. Ask the admin for the code shown on their Signals screen.');
      return;
    }
    const { getDoc } = await import('firebase/firestore');
    const snap = await getDoc(doc(db,'users',user.uid));
    const u = snap.data();
    const lb = getRealSurvival(u);

    await updateDoc(doc(db,'users',user.uid), {
      totalPaidDays: lb,
      joinDateISO:   null,
      history:       arrayUnion(
        `Left Library on ${getStamp()}`,
        `Last Balance: ${Math.floor(lb)} days`,
      ),
    });
    await deleteDoc(doc(db,'signals',`leave_${user.uid}`)).catch(() => {});

    // Try deep link to forget Wi-Fi
    Linking.openURL('mylibraryapp://forgetwifi').catch(() => {});

    Alert.alert('Membership Ended', 'Your session has been closed. Balance days saved.', [
      { text: 'OK', onPress: () => navigation.goBack() },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.heading}>Membership Exit</Text>

          {/* ── Step 1 ── */}
          <Card style={step === 1 ? styles.activeCard : styles.inactiveCard}>
            <StepHeader num={1} title="Check Balance" />
            {duesError ? <ErrorMsg msg={duesError} /> : null}
            {step === 1 && (
              <Btn label="Verify Fees & Signal" onPress={checkLeaveFees} />
            )}
          </Card>

          {/* ── Step 2 ── */}
          {step >= 2 && (
            <Card style={styles.activeCard}>
              <StepHeader num={2} title="Final Approval" />
              <Text style={styles.hint}>Ask the admin for the OTP shown on their Signals screen.</Text>
              <OtpInput value={otp} onChangeText={setOtp} />
              <ErrorMsg msg={otpError} />
              <Btn label="Confirm Exit" onPress={verifyLeave} variant="dark" />
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
