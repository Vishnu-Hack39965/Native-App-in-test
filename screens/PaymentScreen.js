// screens/PaymentScreen.js — 2-step payment wizard
import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Image,
  Alert, SafeAreaView, KeyboardAvoidingView, Platform, TouchableOpacity, TextInput,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import {
  auth, db, doc, updateDoc, setDoc, getDoc, deleteDoc,
  arrayUnion, getStamp, getRealSurvival,
} from '../firebase';
import { useRates } from '../RatesContext';
import { COLORS, RADIUS } from '../theme';
import { Card, Btn, StepHeader, OtpInput, ErrorMsg } from '../components/UI';

export default function PaymentScreen({ navigation, route }) {
  const rates = useRates();
  const { total, days, shift, phone } = route.params || {};

  const [step,       setStep]       = useState(1);
  const [payPhone,   setPayPhone]   = useState('');
  const [payUID,     setPayUID]     = useState('');
  const [screenshot, setScreenshot] = useState(null); // base64
  const [screenshotThumb, setScreenshotThumb] = useState(null);
  const [otp,        setOtp]        = useState('');
  const [generatedOtp, setGenOtp]   = useState(null);
  const [payId,      setPayId]      = useState(null);
  const [errors,     setErrors]     = useState({});
  const user = auth.currentUser;

  const setErr = (key, msg) => setErrors(e => ({ ...e, [key]: msg }));
  const clearErrors = () => setErrors({});

  // ── Open UPI app ──────────────────────────────────────────────────────────
  const openUpi = () => {
    const { Linking } = require('react-native');
    Linking.openURL(`upi://pay?pa=7500159996@ptsbi&pn=Library&am=${total}&cu=INR`).catch(() =>
      Alert.alert('No UPI app', 'Please install a UPI app (GPay, PhonePe, etc.) to pay.')
    );
  };

  // ── Pick screenshot ───────────────────────────────────────────────────────
  const pickScreenshot = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return Alert.alert('Permission needed');
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.6, base64: true,
    });
    if (!result.canceled && result.assets[0]) {
      setScreenshot(`data:image/jpeg;base64,${result.assets[0].base64}`);
      setScreenshotThumb(result.assets[0].uri);
    }
  };

  // ── Step 1 submit ─────────────────────────────────────────────────────────
  const checkPaymentInfo = async () => {
    clearErrors();
    let hasErr = false;
    if (!/^[6-9]\d{9}$/.test(payPhone)) { setErr('phone', 'Valid 10-digit phone required.'); hasErr = true; }
    if (!/^\d{12}$/.test(payUID))        { setErr('uid',   'Exact 12-digit UID required.'); hasErr = true; }
    if (!screenshot)                     { setErr('ss',    'Please attach a payment screenshot.'); hasErr = true; }
    if (hasErr) return;

    // Duplicate UID check
    const hs = await getDoc(doc(db,'payment_history',payUID));
    if (hs.exists()) { setErr('uid', 'This UID has already been used. Double-spend blocked.'); return; }

    const id   = Date.now();
    const code = Math.floor(100000 + Math.random() * 900000);
    setPayId(id); setGenOtp(code);

    await setDoc(doc(db,'signals',`pay_${user.uid}_${id}`), {
      type: 'PAYMENT', otp: code,
      uid: user.uid,
      name:          (await getDoc(doc(db,'users',user.uid))).data()?.name || '',
      phone:         phone || '',
      providedPhone: payPhone,
      providedUID:   payUID,
      screenshot,
      id, reqT: getStamp(),
      shift, days, amt: total,
      status: 'Pending',
    });

    await updateDoc(doc(db,'users',user.uid), {
      history: arrayUnion({ id, reqT: getStamp(), shift, days, amt: total, status: 'Pending' }),
    });

    setStep(2);
  };

  // ── Step 2: OTP confirm ───────────────────────────────────────────────────
  const verifyPayment = async () => {
    clearErrors();
    if (!generatedOtp) { setErr('otp', 'Session expired. Go back and retry.'); return; }
    if (otp !== String(generatedOtp)) { setErr('otp', 'Invalid OTP. Try again.'); return; }

    const hs = await getDoc(doc(db,'payment_history',payUID));
    if (hs.exists()) { setErr('otp', 'Duplicate UID detected. Blocked.'); return; }

    const sigId = `pay_${user.uid}_${payId}`;
    await updateDoc(doc(db,'signals',sigId), { status: 'OTP_Verified' });

    const uSnap = await getDoc(doc(db,'users',user.uid));
    if (uSnap.exists()) {
      const nh = uSnap.data().history.map(h =>
        h.id !== payId ? h : { ...h, status: 'OTP_Verified', otpT: getStamp() }
      );
      await updateDoc(doc(db,'users',user.uid), { history: nh });
    }

    Alert.alert('✅ OTP Verified', 'Waiting for admin confirmation. Your payment is now in review.', [
      { text: 'OK', onPress: () => navigation.goBack() },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.heading}>Payment Wizard</Text>

          {/* ── Summary bar ── */}
          <Card style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Amount Due</Text>
            <Text style={styles.summaryAmt}>₹{(total || 0).toFixed(2)}</Text>
            <Text style={styles.summaryInfo}>{shift} · {days} days</Text>
            <Btn label="📲 Open UPI App to Pay" onPress={openUpi} variant="green" style={{ marginTop: 10 }} />
          </Card>

          {/* ── Step 1 ── */}
          <Card style={step === 1 ? styles.activeCard : styles.inactiveCard}>
            <StepHeader num={1} title="Payment Information" />
            <Text style={styles.fieldLabel}>Phone number used to pay</Text>
            <TextInput
              value={payPhone} onChangeText={setPayPhone}
              placeholder="10-digit phone number"
              keyboardType="phone-pad" maxLength={10}
              style={styles.input}
            />
            <ErrorMsg msg={errors.phone} />

            <Text style={styles.fieldLabel}>Payment UID (12 digits)</Text>
            <TextInput
              value={payUID} onChangeText={setPayUID}
              placeholder="12-digit UPI Transaction ID"
              keyboardType="number-pad" maxLength={12}
              style={styles.input}
            />
            <ErrorMsg msg={errors.uid} />

            <Text style={styles.fieldLabel}>Payment Screenshot</Text>
            <TouchableOpacity onPress={pickScreenshot} style={styles.ssBox}>
              {screenshotThumb
                ? <Image source={{ uri: screenshotThumb }} style={styles.ssThumb} />
                : <Text style={styles.ssPlaceholder}>📎 Tap to attach screenshot</Text>
              }
            </TouchableOpacity>
            <ErrorMsg msg={errors.ss} />

            {step === 1 && (
              <Btn label="Verify Info & Get OTP" onPress={checkPaymentInfo} />
            )}
          </Card>

          {/* ── Step 2 ── */}
          {step >= 2 && (
            <Card style={styles.activeCard}>
              <StepHeader num={2} title="Final OTP Confirmation" />
              <Text style={styles.hint}>
                Ask the admin for the OTP shown on their Signals screen.
              </Text>
              <OtpInput value={otp} onChangeText={setOtp} />
              <ErrorMsg msg={errors.otp} />
              <Btn label="Confirm Payment Successful" onPress={verifyPayment} variant="dark" />
            </Card>
          )}

          <Btn label="Cancel & Go Back" onPress={() => navigation.goBack()} variant="ghost" />
          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: COLORS.bg },
  scroll:      { padding: 20 },
  heading:     { fontSize: 24, fontWeight: 'bold', color: COLORS.dark, marginBottom: 16 },
  summaryCard: { backgroundColor: COLORS.primary, alignItems: 'center' },
  summaryLabel:{ fontSize: 12, color: 'rgba(255,255,255,0.75)', fontWeight: 'bold', textTransform: 'uppercase' },
  summaryAmt:  { fontSize: 36, fontWeight: '900', color: COLORS.white, marginTop: 4 },
  summaryInfo: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 4 },
  activeCard:  { borderLeftWidth: 5, borderLeftColor: COLORS.primary },
  inactiveCard:{ opacity: 0.5 },
  fieldLabel:  { fontSize: 12, fontWeight: 'bold', color: COLORS.dark, marginTop: 10, marginBottom: 4 },
  input: {
    padding: 14, fontSize: 18, borderRadius: RADIUS.md,
    borderWidth: 2, borderColor: COLORS.borderMid,
    marginBottom: 4, backgroundColor: COLORS.white,
  },
  ssBox: {
    borderWidth: 2, borderColor: COLORS.borderMid, borderStyle: 'dashed',
    borderRadius: RADIUS.md, padding: 20, alignItems: 'center', marginBottom: 4,
    backgroundColor: '#fafafa', minHeight: 80, justifyContent: 'center',
  },
  ssPlaceholder: { color: COLORS.muted, fontSize: 14 },
  ssThumb:       { width: '100%', height: 160, borderRadius: RADIUS.md, resizeMode: 'contain' },
  hint:          { fontSize: 12, color: COLORS.muted, marginVertical: 8, lineHeight: 18 },
});
