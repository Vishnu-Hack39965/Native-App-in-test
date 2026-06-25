// screens/AdminUserDetailScreen.js — full admin folder for one user
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TextInput,
  TouchableOpacity, Alert, SafeAreaView, Image,
} from 'react-native';
import {
  db, doc, getDoc, updateDoc, deleteDoc,
  arrayUnion, getStamp, getRealSurvival, formatTime, lastValidDate,
} from '../firebase';
import { COLORS, RADIUS } from '../theme';
import { Card, Btn, SectionLabel, CountdownTimer, SpinDial } from '../components/UI';

export default function AdminUserDetailScreen({ navigation, route }) {
  const { uid } = route.params;
  const [u,        setU]       = useState(null);
  const [seatNo,   setSeatNo]  = useState('');
  const [manualDays, setManualDays] = useState('');

  // Alarm-style editor state
  const [aeD,  setAeD]  = useState(0);
  const [aeH,  setAeH]  = useState(0);
  const [aeM,  setAeM]  = useState(0);
  const [aeS,  setAeS]  = useState(0);
  const [aePM, setAePM] = useState('+'); // '+' or '-'

  // Computed new survival from alarm editor
  const newSrv = Math.max(0, aeD + (aePM === '+' ? 1 : -1) * aeH / 24 + aeM / 1440 + aeS / 86400);
  const curSrv = u ? getRealSurvival(u) : 0;

  useEffect(() => {
    loadUser();
  }, [uid]);

  const loadUser = async () => {
    const snap = await getDoc(doc(db,'users',uid));
    if (!snap.exists()) return;
    const data = snap.data();
    setU(data);
    setSeatNo(data.seatNo ? String(data.seatNo) : '');

    // Pre-fill alarm editor with current survival time
    const srv = getRealSurvival(data);
    const abs = Math.max(0, srv);
    const ts  = Math.floor(abs * 86400);
    setAeD(Math.floor(ts / 86400));
    setAeH(Math.floor((ts % 86400) / 3600));
    setAeM(Math.floor((ts % 3600) / 60));
    setAeS(ts % 60);
    setAePM('+');
  };

  // ── Seat assignment ───────────────────────────────────────────────────────
  const adminSetSeat = async () => {
    const n = parseInt(seatNo);
    if (!n || n <= 0 || !Number.isInteger(n)) return Alert.alert('Invalid', 'Please enter a valid positive integer.');
    Alert.alert(
      'Confirm Seat',
      `Assign Seat No. ${n}?\n\nThe student will see a condition popup until they confirm.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Assign', onPress: async () => {
          await updateDoc(doc(db,'users',uid), {
            seatNo: n, seatPending: true,
            history: arrayUnion(`Admin assigned Seat No. ${n} at ${getStamp()}`),
          });
          Alert.alert('✅', `Seat No. ${n} assigned.`);
          loadUser();
        }},
      ]
    );
  };

  // ── Alarm-style survival editor ───────────────────────────────────────────
  const applyAlarmEdit = async () => {
    const oldFmt = formatTime(curSrv);
    const newFmt = formatTime(newSrv);
    Alert.alert(
      'Confirm Time Change',
      `FROM: ${oldFmt}\nTO:   ${newFmt}\n\nThis overwrites remaining time. Continue?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Apply', onPress: async () => {
          const snap = await getDoc(doc(db,'users',uid));
          if (!snap.exists()) return;
          const ud = snap.data();
          let newTotal;
          if (ud.joinDateISO) {
            const elapsed = (Date.now() - new Date(ud.joinDateISO).getTime()) / 86400000;
            newTotal = newSrv + elapsed;
          } else {
            newTotal = newSrv;
          }
          await updateDoc(doc(db,'users',uid), {
            totalPaidDays: newTotal,
            history: arrayUnion(`Admin set survival: ${oldFmt} → ${newFmt} at ${getStamp()}`),
          });
          Alert.alert('✅ Updated', 'Survival time updated.');
          loadUser();
        }},
      ]
    );
  };

  // ── Manual day adjustment ─────────────────────────────────────────────────
  const adminEditDays = async () => {
    const val = parseInt(manualDays);
    if (isNaN(val)) return Alert.alert('Invalid', 'Enter a whole integer (e.g. 30 or -5).');
    const newS = curSrv + val;
    Alert.alert(
      'Confirm Day Adjustment',
      `${val > 0 ? '+' : ''}${val} days\nFROM: ${formatTime(curSrv)}\nTO:   ${formatTime(newS)}\n\nContinue?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Apply', onPress: async () => {
          const snap = await getDoc(doc(db,'users',uid));
          if (!snap.exists()) return;
          const ud = snap.data();
          let newTotal;
          if (ud.joinDateISO) {
            const elapsed = (Date.now() - new Date(ud.joinDateISO).getTime()) / 86400000;
            newTotal = newS + elapsed;
          } else {
            newTotal = newS;
          }
          await updateDoc(doc(db,'users',uid), {
            totalPaidDays: newTotal,
            history: arrayUnion(`Admin adjusted ${val>0?'+':''}${val} days → ${formatTime(newS)} at ${getStamp()}`),
          });
          Alert.alert('✅', `Adjusted by ${val>0?'+':''}${val} days.`);
          loadUser();
        }},
      ]
    );
  };

  // ── Force exit ────────────────────────────────────────────────────────────
  const adminForceLeave = async () => {
    Alert.alert('Force Exit', 'Force stop this member\'s session?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Yes', style: 'destructive', onPress: async () => {
        const snap = await getDoc(doc(db,'users',uid));
        await updateDoc(doc(db,'users',uid), {
          totalPaidDays: getRealSurvival(snap.data()),
          joinDateISO:   null,
          history:       arrayUnion(`Force Exit by Admin at ${getStamp()}`),
        });
        navigation.goBack();
      }},
    ]);
  };

  if (!u) return null;

  const diff    = newSrv - curSrv;
  const diffFmt = (diff >= 0 ? '+' : '') + formatTime(Math.abs(diff));
  const diffColor = diff >= 0 ? COLORS.green : COLORS.red;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        {/* ── Header card ── */}
        <Card style={{ alignItems: 'center' }}>
          <Image
            source={{ uri: u.photo || 'https://via.placeholder.com/70' }}
            style={styles.avatar}
          />
          {u.joinDateISO ? (
            <CountdownTimer userData={u} style={{ fontSize: 22 }} />
          ) : (
            <Text style={[styles.staticTimer, { color: COLORS.muted }]}>
              {formatTime(u.totalPaidDays||0)} (Static)
            </Text>
          )}
          {u.joinDateISO && getRealSurvival(u) > 0 && (
            <Text style={{ color: COLORS.greenText, fontWeight: 'bold', marginTop: 4 }}>
              📅 Valid until: {lastValidDate(getRealSurvival(u))}
            </Text>
          )}
        </Card>

        {/* ── Profile info ── */}
        <Card>
          <Row label="Name"    value={u.name    || '—'} />
          <Row label="Father"  value={u.father  || '—'} />
          <Row label="Mobile"  value={u.phone   || '—'} />
          <Row label="Email"   value={u.email   || '—'} />
          <Row label="Address" value={u.address || '—'} />
        </Card>

        {/* ── Seat editor ── */}
        <Card>
          <SectionLabel>🪑 Seat Number (Admin Only)</SectionLabel>
          <View style={styles.rowInput}>
            <TextInput
              value={seatNo}
              onChangeText={setSeatNo}
              placeholder="Enter seat number"
              keyboardType="number-pad"
              style={[styles.input, { flex: 1 }]}
            />
            <Btn label="Set Seat" onPress={adminSetSeat} style={{ width: 100, marginLeft: 8, marginTop: 0 }} />
          </View>
          {u.seatNo && (
            <Text style={styles.seatStatus}>
              Current: Seat No. {u.seatNo} — {u.seatPending ? '⏳ Awaiting confirmation' : '✅ Confirmed'}
            </Text>
          )}
        </Card>

        {/* ── Alarm-style survival editor ── */}
        <Card>
          <SectionLabel>⏱ Set Survival Time</SectionLabel>
          <Text style={styles.hint}>Current time pre-filled. Hours column has +/− toggle.</Text>

          <View style={styles.currentBox}>
            <Text style={styles.currentLabel}>CURRENT LIVE SURVIVAL</Text>
            <CountdownTimer userData={u} style={{ fontSize: 18 }} />
          </View>

          <View style={styles.dialRow}>
            <SpinDial label="Days" value={aeD} onChange={setAeD} />
            <Text style={styles.colon}>:</Text>
            {/* Hours with +/- toggle */}
            <View style={{ alignItems: 'center' }}>
              <Text style={styles.spinLabel}>Hrs ±</Text>
              <View style={styles.pmToggle}>
                <TouchableOpacity onPress={() => setAePM('+')} style={[styles.pmBtn, aePM==='+' && styles.pmBtnActive]}>
                  <Text style={[styles.pmBtnTxt, aePM==='+' && { color: COLORS.white }]}>+</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setAePM('-')} style={[styles.pmBtn, aePM==='-' && styles.pmBtnActive]}>
                  <Text style={[styles.pmBtnTxt, aePM==='-' && { color: COLORS.white }]}>−</Text>
                </TouchableOpacity>
              </View>
              <SpinDial label="" value={aeH} onChange={setAeH} max={23} />
            </View>
            <Text style={styles.colon}>:</Text>
            <SpinDial label="Mins" value={aeM} onChange={setAeM} max={59} />
            <Text style={styles.colon}>:</Text>
            <SpinDial label="Secs" value={aeS} onChange={setAeS} max={59} />
          </View>

          <View style={[styles.diffBox, { backgroundColor: diff >= 0 ? COLORS.greenBg : COLORS.redBg }]}>
            <Text style={styles.diffLabel}>NEW TIME TO BE SET</Text>
            <Text style={[styles.diffNew]}>{formatTime(newSrv)}</Text>
            <Text style={[styles.diffDelta, { color: diffColor }]}>{diffFmt} vs current</Text>
          </View>

          <Btn label="✅ Apply New Survival Time" onPress={applyAlarmEdit} />
        </Card>

        {/* ── Manual day adjuster ── */}
        <Card>
          <SectionLabel>➕ Manual Day Adjustment</SectionLabel>
          <Text style={styles.hint}>Positive or negative whole number (e.g. +30 or −5).</Text>
          <View style={styles.rowInput}>
            <TextInput
              value={manualDays}
              onChangeText={setManualDays}
              placeholder="+30 or −5"
              keyboardType="numbers-and-punctuation"
              style={[styles.input, { flex: 1 }]}
            />
            <Btn label="Apply" onPress={adminEditDays} style={{ width: 80, marginLeft: 8, marginTop: 0 }} />
          </View>
        </Card>

        {/* ── History ── */}
        <Card>
          <SectionLabel>History</SectionLabel>
          <HistoryLog history={u.history} />
        </Card>

        <Btn label="FORCE EXIT" onPress={adminForceLeave} variant="outline" />
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const Row = ({ label, value }) => (
  <View style={styles.row}>
    <Text style={styles.rowLabel}>{label}</Text>
    <Text style={styles.rowValue}>{value}</Text>
  </View>
);

const HistoryLog = ({ history }) => {
  const items = [...(history||[])].reverse().slice(0, 30);
  if (!items.length) return <Text style={{ color: COLORS.muted, fontSize: 12 }}>No history.</Text>;
  return (
    <>
      {items.map((h, i) => {
        if (typeof h === 'string') return <Text key={i} style={styles.logLine}>• {h}</Text>;
        const icon = h.status==='Verified'?'✅':h.status==='Rejected'?'❌':h.status==='OTP_Verified'?'🔐':'⏳';
        return (
          <View key={i} style={styles.logEntry}>
            <Text style={[styles.logLine,{fontWeight:'bold'}]}>{icon} {h.status} — {h.shift}</Text>
            <Text style={styles.logLine}>₹{h.amt} · {h.days} days · {h.reqT}</Text>
          </View>
        );
      })}
    </>
  );
};

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: COLORS.bg },
  scroll: { padding: 15 },
  avatar: { width: 70, height: 70, borderRadius: 35, marginBottom: 10, borderWidth: 2, borderColor: COLORS.border },
  staticTimer: { fontFamily: 'Courier New', fontSize: 20, fontWeight: 'bold' },
  row:      { flexDirection: 'row', paddingVertical: 8, borderBottomWidth: 1, borderColor: COLORS.border },
  rowLabel: { fontWeight: 'bold', color: COLORS.muted, width: 75, fontSize: 13 },
  rowValue: { flex: 1, fontSize: 13, color: COLORS.dark },
  rowInput: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  input: {
    padding: 12, fontSize: 16, borderRadius: RADIUS.sm,
    borderWidth: 2, borderColor: COLORS.borderMid,
    backgroundColor: COLORS.white,
  },
  seatStatus: { fontSize: 12, color: COLORS.muted, marginTop: 6 },
  hint:      { fontSize: 12, color: COLORS.muted, marginBottom: 10, lineHeight: 17 },
  currentBox:{ backgroundColor: '#f0f4ff', borderRadius: RADIUS.sm, padding: 10, marginBottom: 14, alignItems: 'center' },
  currentLabel:{ fontSize: 10, color: COLORS.muted, fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 4 },
  dialRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, flexWrap: 'wrap' },
  colon:     { fontSize: 22, fontWeight: 'bold', color: COLORS.primary, marginBottom: 4, marginHorizontal: 2 },
  spinLabel: { fontSize: 10, color: COLORS.muted, fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 2 },
  pmToggle:  { flexDirection: 'row', borderWidth: 2, borderColor: COLORS.primary, borderRadius: RADIUS.sm, overflow: 'hidden', marginBottom: 4, width: 70 },
  pmBtn:     { flex: 1, padding: 5, alignItems: 'center', backgroundColor: COLORS.white },
  pmBtnActive:{ backgroundColor: COLORS.primary },
  pmBtnTxt:  { fontWeight: 'bold', fontSize: 16, color: COLORS.primary },
  diffBox:   { borderRadius: RADIUS.md, padding: 14, marginTop: 14, alignItems: 'center' },
  diffLabel: { fontSize: 10, color: COLORS.muted, fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 4 },
  diffNew:   { fontFamily: 'Courier New', fontSize: 20, fontWeight: '900', color: COLORS.primary, letterSpacing: 1 },
  diffDelta: { fontSize: 13, fontWeight: 'bold', marginTop: 4 },
  logLine:   { fontSize: 12, color: COLORS.dark, paddingVertical: 2 },
  logEntry:  { paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: COLORS.border },
});
