// components/UI.js — shared atomic components used across all screens
import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator,
} from 'react-native';
import { COLORS, RADIUS, SHADOW, FONTS } from '../theme';
import { formatTime, getRealSurvival } from '../firebase';

// ── Button ───────────────────────────────────────────────────────────────────
export const Btn = ({ label, onPress, variant = 'blue', disabled = false, style }) => {
  const bgMap = {
    blue:    COLORS.primary,
    green:   COLORS.green,
    dark:    COLORS.dark,
    outline: 'transparent',
    ghost:   'transparent',
  };
  const txtMap = {
    blue:    COLORS.white,
    green:   COLORS.white,
    dark:    COLORS.white,
    outline: COLORS.red,
    ghost:   COLORS.muted,
  };
  const borderMap = {
    outline: { borderWidth: 1.5, borderColor: COLORS.red },
    ghost:   {},
  };
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.75}
      style={[
        styles.btn,
        { backgroundColor: bgMap[variant] || bgMap.blue, opacity: disabled ? 0.4 : 1 },
        borderMap[variant] || {},
        style,
      ]}
    >
      <Text style={[styles.btnTxt, { color: txtMap[variant] || COLORS.white }]}>{label}</Text>
    </TouchableOpacity>
  );
};

// ── Card ─────────────────────────────────────────────────────────────────────
export const Card = ({ children, style }) => (
  <View style={[styles.card, style]}>{children}</View>
);

// ── Section Label ─────────────────────────────────────────────────────────────
export const SectionLabel = ({ children, style }) => (
  <Text style={[styles.sectionLabel, style]}>{children}</Text>
);

// ── Detail Row (editable field) ───────────────────────────────────────────────
export const DetailRow = ({ label, value, onChangeText, editable = false, keyboardType = 'default', multiline = false, onEditPress }) => (
  <View style={styles.detailRow}>
    <View style={{ flex: 1 }}>
      <Text style={styles.detailLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        editable={editable}
        keyboardType={keyboardType}
        multiline={multiline}
        style={[
          styles.detailInput,
          editable && styles.detailInputEditable,
        ]}
      />
    </View>
    {onEditPress && (
      <TouchableOpacity onPress={onEditPress} style={{ paddingLeft: 10 }}>
        <Text style={{ fontSize: 18 }}>✏️</Text>
      </TouchableOpacity>
    )}
  </View>
);

// ── Countdown Timer (live, updates every second) ──────────────────────────────
export const CountdownTimer = ({ userData, style }) => {
  const [display, setDisplay] = useState('00:00:00:00');
  const [positive, setPositive] = useState(true);
  const timerRef = useRef(null);

  useEffect(() => {
    const tick = () => {
      const srv = getRealSurvival(userData);
      setDisplay(formatTime(srv));
      setPositive(srv >= 0);
    };
    tick();
    timerRef.current = setInterval(tick, 1000);
    return () => clearInterval(timerRef.current);
  }, [userData]);

  return (
    <Text style={[
      styles.countdown,
      { color: positive ? COLORS.green : COLORS.red },
      style,
    ]}>
      {display}
    </Text>
  );
};

// ── Loading Overlay ───────────────────────────────────────────────────────────
export const LoadingCard = ({ message = 'Loading your profile data…' }) => (
  <Card style={{ alignItems: 'center', paddingVertical: 40 }}>
    <ActivityIndicator size="large" color={COLORS.primary} style={{ marginBottom: 16 }} />
    <Text style={{ fontSize: 16, fontWeight: 'bold', color: COLORS.primary, marginBottom: 4 }}>Please wait…</Text>
    <Text style={{ fontSize: 13, color: COLORS.muted }}>{message}</Text>
  </Card>
);

// ── OTP Input ─────────────────────────────────────────────────────────────────
export const OtpInput = ({ value, onChangeText, placeholder = 'Enter 6-digit OTP' }) => (
  <TextInput
    value={value}
    onChangeText={onChangeText}
    placeholder={placeholder}
    keyboardType="number-pad"
    maxLength={6}
    style={styles.bigInput}
  />
);

// ── Error Message ─────────────────────────────────────────────────────────────
export const ErrorMsg = ({ msg }) => {
  if (!msg) return null;
  return <Text style={styles.errorMsg}>{msg}</Text>;
};

// ── Step Header ───────────────────────────────────────────────────────────────
export const StepHeader = ({ num, title }) => (
  <View style={styles.stepHeader}>
    <View style={styles.stepBadge}>
      <Text style={styles.stepBadgeTxt}>{num}</Text>
    </View>
    <Text style={styles.stepTitle}>{title}</Text>
  </View>
);

// ── Validity Strip ────────────────────────────────────────────────────────────
export const ValidityStrip = ({ from, to }) => (
  <View style={styles.validityStrip}>
    <Text style={styles.validityTxt}>{from}</Text>
    <Text style={{ color: COLORS.primary, fontSize: 16 }}>⟶</Text>
    <Text style={styles.validityTxt}>{to}</Text>
  </View>
);

// ── Spinner Dial (alarm-style number stepper) ─────────────────────────────────
export const SpinDial = ({ label, value, onChange, max = Infinity }) => {
  const step = (dir) => {
    let v = parseInt(value || 0) + dir;
    if (v < 0) v = max === Infinity ? 0 : max;
    if (v > max) v = 0;
    onChange(v);
  };
  return (
    <View style={styles.spinWrap}>
      <Text style={styles.spinLabel}>{label}</Text>
      <View style={styles.spinBox}>
        <TouchableOpacity onPress={() => step(1)} style={styles.spinBtn}>
          <Text style={styles.spinBtnTxt}>▲</Text>
        </TouchableOpacity>
        <TextInput
          value={String(value ?? 0)}
          onChangeText={(t) => onChange(parseInt(t) || 0)}
          keyboardType="number-pad"
          style={styles.spinInput}
        />
        <TouchableOpacity onPress={() => step(-1)} style={styles.spinBtn}>
          <Text style={styles.spinBtnTxt}>▼</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  btn: {
    width: '100%', padding: 15, borderRadius: RADIUS.md,
    alignItems: 'center', marginTop: 10,
  },
  btnTxt: { fontWeight: 'bold', fontSize: 15 },

  card: {
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.lg,
    padding: 20,
    marginBottom: 15,
    ...SHADOW.card,
  },

  sectionLabel: {
    fontSize: 10, color: COLORS.primary,
    fontWeight: 'bold', textTransform: 'uppercase',
    marginBottom: 8, letterSpacing: 0.5,
  },

  detailRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  detailLabel: {
    fontSize: 10, color: COLORS.primary,
    fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 4,
  },
  detailInput: { fontSize: 16, color: COLORS.dark, paddingVertical: 4 },
  detailInputEditable: {
    borderBottomWidth: 1.5, borderBottomColor: COLORS.primary,
    backgroundColor: '#fffde7',
  },

  countdown: {
    fontFamily: FONTS.mono, fontSize: 26,
    fontWeight: '900', letterSpacing: 1,
    textAlign: 'center', marginVertical: 8,
  },

  bigInput: {
    width: '100%', padding: 15, fontSize: 20,
    borderRadius: RADIUS.md, borderWidth: 2,
    borderColor: COLORS.borderMid, marginBottom: 8,
    backgroundColor: COLORS.white,
  },

  errorMsg: {
    color: COLORS.red, fontWeight: 'bold',
    fontSize: 13, marginBottom: 6,
  },

  stepHeader: {
    flexDirection: 'row', alignItems: 'center', marginBottom: 12,
  },
  stepBadge: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 10,
  },
  stepBadgeTxt: { color: COLORS.white, fontSize: 13, fontWeight: 'bold' },
  stepTitle: { fontSize: 15, fontWeight: 'bold', color: COLORS.dark },

  validityStrip: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, backgroundColor: COLORS.greenBg,
    borderRadius: RADIUS.sm, padding: 10, marginTop: 8,
  },
  validityTxt: { fontSize: 13, fontWeight: 'bold', color: COLORS.greenText },

  spinWrap: { alignItems: 'center', gap: 4 },
  spinLabel: {
    fontSize: 10, color: COLORS.muted,
    fontWeight: 'bold', textTransform: 'uppercase',
  },
  spinBox: {
    borderWidth: 2, borderColor: COLORS.primary,
    borderRadius: RADIUS.md, overflow: 'hidden', alignItems: 'center',
  },
  spinBtn: {
    backgroundColor: COLORS.primary, width: 44, height: 28,
    alignItems: 'center', justifyContent: 'center',
  },
  spinBtnTxt: { color: COLORS.white, fontSize: 16, fontWeight: 'bold' },
  spinInput: {
    width: 44, height: 36, textAlign: 'center',
    fontSize: 18, fontWeight: 'bold',
    fontFamily: FONTS.mono, backgroundColor: '#f9f9ff',
  },
});
