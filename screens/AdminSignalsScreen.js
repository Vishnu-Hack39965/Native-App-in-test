// screens/AdminSignalsScreen.js — live signals pane for admin
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  SafeAreaView, Image, Alert, Modal,
} from 'react-native';
import {
  db, doc, collection, onSnapshot, deleteDoc, getDoc, setDoc,
  updateDoc, arrayUnion, getStamp, parseStamp,
} from '../firebase';
import { COLORS, RADIUS } from '../theme';
import { Btn } from '../components/UI';

const processingSignals = new Set();

export default function AdminSignalsScreen({ navigation }) {
  const [signals,    setSignals]    = useState([]);
  const [timers,     setTimers]     = useState({});
  const [ssModal,    setSsModal]    = useState({ visible: false, uri: '' });

  // ── Live signals listener ─────────────────────────────────────────────────
  useEffect(() => {
    const unsub = onSnapshot(collection(db,'signals'), (snap) => {
      const all = [];
      snap.forEach(d => {
        if (!processingSignals.has(d.id)) all.push({ ...d.data(), _id: d.id });
      });
      all.sort((a,b) => parseStamp(b.reqT||b.timestamp||'') - parseStamp(a.reqT||a.timestamp||''));
      setSignals(all);
    });
    return unsub;
  }, []);

  // ── Per-signal countdown timers ───────────────────────────────────────────
  useEffect(() => {
    const iv = setInterval(() => {
      const now = Date.now();
      const next = {};
      signals.forEach(sig => {
        const rem = Math.max(0, Math.floor((sig.expiresAt - now) / 1000));
        next[sig._id] = rem;
        if (rem === 0) deleteDoc(doc(db,'signals',sig._id)).catch(() => {});
      });
      setTimers(next);
    }, 1000);
    return () => clearInterval(iv);
  }, [signals]);

  // ── handlePay ─────────────────────────────────────────────────────────────
  const handlePay = async (sig, verdict) => {
    if (processingSignals.has(sig._id)) return;
    processingSignals.add(sig._id);
    try {
      const { screenshot } = sig;
      const ref  = doc(db,'users',sig.uid);
      const snap = await getDoc(ref);
      if (!snap.exists()) return;
      const u    = snap.data();
      const prev = u.totalPaidDays || 0;
      const newBal = verdict === 'OK' ? prev + sig.days : prev;

      if (verdict === 'OK') {
        const hRef  = doc(db,'payment_history',String(sig.providedUID));
        const hSnap = await getDoc(hRef);
        if (hSnap.exists()) {
          Alert.alert('⛔ Fraud Detected', 'UID already in payment history. Signal deleted.');
          await deleteDoc(doc(db,'signals',sig._id));
          return;
        }
        await setDoc(hRef, {
          uid: sig.uid, providedUID: String(sig.providedUID),
          providedPhone: String(sig.providedPhone),
          screenshot, shift: sig.shift, days: sig.days,
          amt: sig.amt, reqT: sig.reqT, actionT: getStamp(), finalNet: newBal,
        });
      }

      const nh = (u.history||[]).map(h => {
        if (typeof h !== 'object' || h.id !== sig.id) return h;
        return { ...h, status: verdict==='OK'?'Verified':'Rejected', actionT: getStamp(), finalNet: newBal };
      });
      await updateDoc(ref, { totalPaidDays: newBal, history: nh });
      await deleteDoc(doc(db,'signals',sig._id));
    } catch(e) { Alert.alert('Error', e.message); }
    finally    { processingSignals.delete(sig._id); }
  };

  const clearSignal = (sid) => deleteDoc(doc(db,'signals',sid)).catch(() => {});

  // ── Categorise ────────────────────────────────────────────────────────────
  const joinLeave = signals.filter(s => s.type !== 'PAYMENT');
  const otpV      = signals.filter(s => s.type === 'PAYMENT' && s.status === 'OTP_Verified');
  const pending   = signals.filter(s => s.type === 'PAYMENT' && s.status !== 'OTP_Verified');

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>

        {/* ── Join / Leave signals ── */}
        {joinLeave.length > 0 && (
          <>
            <SectionHdr color={COLORS.yellow} bg="#1a1a1a">
              📡 Join / Leave Signals ({joinLeave.length})
            </SectionHdr>
            {joinLeave.map(sig => (
              <View key={sig._id} style={styles.joinCard}>
                <View style={styles.timerRow}>
                  <Text style={styles.joinType}>📡 {sig.type}</Text>
                  <Text style={styles.timer}>{timers[sig._id] ?? '--'}s</Text>
                </View>
                <Text style={styles.sigName}>{sig.name}</Text>
                <Text style={styles.sigPhone}>📞 {sig.phone}</Text>
                <Text style={styles.sigStamp}>{sig.timestamp}</Text>
                <Text style={styles.otpDisplay}>OTP: {sig.otp}</Text>
                <TouchableOpacity onPress={() => clearSignal(sig._id)} style={styles.clearBtn}>
                  <Text style={{ color: COLORS.red, fontWeight: 'bold' }}>CLEAR</Text>
                </TouchableOpacity>
              </View>
            ))}
          </>
        )}

        {/* ── OTP Verified payments ── */}
        {otpV.length > 0 && (
          <>
            <SectionHdr color="#00e5ff" bg="#003333">
              🔐 OTP Verified — Awaiting Approval ({otpV.length})
            </SectionHdr>
            {otpV.map(sig => (
              <PayCard key={sig._id} sig={sig} enabled onApprove={() => handlePay(sig,'OK')} onReject={() => handlePay(sig,'REJ')} onViewSs={(uri) => setSsModal({ visible: true, uri })} timers={timers} />
            ))}
          </>
        )}

        {/* ── Pending payments ── */}
        {pending.length > 0 && (
          <>
            <SectionHdr color={COLORS.yellow} bg="#1a1100">
              ⏳ Pending — Awaiting User OTP ({pending.length})
            </SectionHdr>
            {pending.map(sig => (
              <PayCard key={sig._id} sig={sig} enabled={false} onApprove={() => {}} onReject={() => handlePay(sig,'REJ')} onViewSs={(uri) => setSsModal({ visible: true, uri })} timers={timers} />
            ))}
          </>
        )}

        {signals.length === 0 && (
          <Text style={styles.empty}>No active signals.</Text>
        )}
      </ScrollView>

      {/* ── Screenshot fullscreen modal ── */}
      <Modal visible={ssModal.visible} transparent animationType="fade">
        <TouchableOpacity
          style={styles.ssOverlay}
          activeOpacity={1}
          onPress={() => setSsModal({ visible: false, uri: '' })}
        >
          <Image source={{ uri: ssModal.uri }} style={styles.ssFullImg} resizeMode="contain" />
          <Text style={{ color: 'white', marginTop: 10, fontSize: 12 }}>Tap anywhere to close</Text>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────
const SectionHdr = ({ children, color, bg }) => (
  <View style={[styles.sectionHdr, { backgroundColor: bg }]}>
    <Text style={[styles.sectionHdrTxt, { color }]}>{children}</Text>
  </View>
);

const PayCard = ({ sig, enabled, onApprove, onReject, onViewSs, timers }) => {
  const [showSs, setShowSs] = useState(false);
  return (
    <View style={styles.payCard}>
      {/* Terminal header */}
      <View style={styles.terminal}>
        <View style={styles.timerRow}>
          <Text style={styles.terminalTxt}>[PAYMENT SIGNAL]</Text>
          <Text style={styles.timer}>{timers[sig._id] ?? '--'}s</Text>
        </View>
        <Text style={[styles.terminalTxt, { color: enabled ? '#00e5ff' : COLORS.yellow }]}>
          STATUS : {enabled ? '🔐 OTP_VERIFIED' : '⏳ PENDING'}
        </Text>
        <Text style={styles.terminalTxt}>--------------------------</Text>
        <Text style={styles.terminalTxt}>NAME     : {sig.name}</Text>
        <Text style={styles.terminalTxt}>PHONE    : {sig.phone}</Text>
        <Text style={styles.terminalTxt}>PAY PH   : {sig.providedPhone||'N/A'}</Text>
        <Text style={styles.terminalTxt}>PAY UID  : {sig.providedUID||'N/A'}</Text>
        <Text style={styles.terminalTxt}>SHIFT    : {sig.shift}</Text>
        <Text style={styles.terminalTxt}>DAYS     : {sig.days}</Text>
        <Text style={styles.terminalTxt}>AMOUNT   : ₹{sig.amt} ({sig.reqT})</Text>
        <Text style={styles.terminalTxt}>--------------------------</Text>
        <Text style={[styles.terminalTxt, { color: COLORS.yellow, fontSize: 20, fontWeight: 'bold', letterSpacing: 3 }]}>
          OTP : {sig.otp}
        </Text>
      </View>
      {/* Screenshot toggle */}
      <TouchableOpacity
        style={styles.ssToggle}
        onPress={() => { if(sig.screenshot) onViewSs(sig.screenshot); else Alert.alert('No screenshot'); }}
      >
        <Text style={{ color: '#0f0', fontSize: 12 }}>📷 View Screenshot</Text>
      </TouchableOpacity>
      {/* Action buttons */}
      <View style={styles.actionRow}>
        <TouchableOpacity
          onPress={onApprove} disabled={!enabled}
          style={[styles.actionBtn, { backgroundColor: COLORS.green, opacity: enabled ? 1 : 0.4 }]}
        >
          <Text style={styles.actionBtnTxt}>VERIFY</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onReject}
          style={[styles.actionBtn, { borderWidth: 1.5, borderColor: COLORS.red, backgroundColor: 'transparent' }]}
        >
          <Text style={[styles.actionBtnTxt, { color: COLORS.red }]}>REJECT</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: COLORS.bg },
  scroll: { padding: 15, paddingBottom: 30 },
  empty:  { color: COLORS.mutedLight, textAlign: 'center', padding: 40, fontSize: 14 },

  joinCard: {
    backgroundColor: '#1a1a1a', borderRadius: RADIUS.md, padding: 14,
    borderLeftWidth: 4, borderLeftColor: COLORS.yellow, marginBottom: 12,
  },
  timerRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  joinType:  { color: COLORS.yellow, fontWeight: 'bold', fontSize: 14 },
  timer:     { backgroundColor: '#333', color: COLORS.yellow, fontSize: 12, fontWeight: 'bold', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  sigName:   { color: COLORS.white, fontWeight: 'bold', fontSize: 15 },
  sigPhone:  { color: COLORS.green, fontSize: 12, marginTop: 2 },
  sigStamp:  { color: COLORS.muted, fontSize: 10, marginTop: 2 },
  otpDisplay:{ color: COLORS.yellow, fontSize: 22, fontWeight: 'bold', letterSpacing: 3, marginTop: 8 },
  clearBtn:  { marginTop: 10, padding: 10, borderWidth: 1, borderColor: COLORS.red, borderRadius: RADIUS.sm, alignItems: 'center' },

  sectionHdr:    { padding: 10, borderRadius: RADIUS.sm, marginBottom: 8, marginTop: 4 },
  sectionHdrTxt: { fontWeight: 'bold', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 },

  payCard: { marginBottom: 14 },
  terminal: {
    backgroundColor: '#000', borderWidth: 1, borderColor: '#333',
    borderRadius: 12, borderBottomLeftRadius: 0, borderBottomRightRadius: 0, padding: 12,
  },
  terminalTxt: { fontFamily: 'Courier New', color: '#0f0', fontSize: 12, lineHeight: 20 },
  ssToggle: {
    backgroundColor: '#111', borderWidth: 1, borderColor: '#333', borderTop: 0,
    padding: 10, alignItems: 'center',
  },
  actionRow: {
    flexDirection: 'row', gap: 10,
    backgroundColor: '#111', borderWidth: 1, borderColor: '#333',
    borderTopWidth: 0, borderBottomLeftRadius: 12, borderBottomRightRadius: 12, padding: 10,
  },
  actionBtn:    { flex: 1, padding: 14, borderRadius: RADIUS.sm, alignItems: 'center' },
  actionBtnTxt: { color: COLORS.white, fontWeight: 'bold', fontSize: 14 },

  ssOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.92)',
    alignItems: 'center', justifyContent: 'center',
  },
  ssFullImg: { width: '95%', height: '80%', borderRadius: RADIUS.sm },
});
