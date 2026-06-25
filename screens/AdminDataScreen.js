// screens/AdminDataScreen.js — Wi-Fi / Payment History / Rates management
import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TextInput, Image,
  TouchableOpacity, Alert, SafeAreaView, Modal,
} from 'react-native';
import {
  db, doc, setDoc, getDoc, collection, onSnapshot,
  parseStamp, getStamp,
} from '../firebase';
import { useRates } from '../RatesContext';
import { COLORS, RADIUS } from '../theme';
import { Card, Btn, SectionLabel } from '../components/UI';

const TABS = ['📶 Wi-Fi', '💳 History', '⚙️ Rates'];

export default function AdminDataScreen() {
  const [tab, setTab] = useState(0);
  const rates = useRates();

  return (
    <SafeAreaView style={styles.safe}>
      {/* Sub-tab bar */}
      <View style={styles.tabBar}>
        {TABS.map((t, i) => (
          <TouchableOpacity
            key={i}
            onPress={() => setTab(i)}
            style={[styles.tabBtn, tab === i && styles.tabBtnActive]}
          >
            <Text style={[styles.tabBtnTxt, tab === i && styles.tabBtnTxtActive]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        {tab === 0 && <WifiPane />}
        {tab === 1 && <PayHistoryPane />}
        {tab === 2 && <RatesPane currentRates={rates} />}
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Wi-Fi pane ────────────────────────────────────────────────────────────────
const WifiPane = () => {
  const [wifi1, setWifi1] = useState({ ssid: '', pass: '' });
  const [wifi2, setWifi2] = useState({ ssid: '', pass: '' });

  useEffect(() => {
    getDoc(doc(db,'settings','wifi')).then(s  => { if(s.exists())  setWifi1(s.data()); });
    getDoc(doc(db,'settings','wifi2')).then(s2 => { if(s2.exists()) setWifi2(s2.data()); });
  }, []);

  const save = async (key, data) => {
    if (!data.ssid || !data.pass) return Alert.alert('Required', 'Both SSID and password are needed.');
    await setDoc(doc(db,'settings',key), data);
    Alert.alert('✅', `Wi-Fi ${key === 'wifi2' ? '2' : '1'} settings saved.`);
  };

  return (
    <>
      <Card>
        <SectionLabel>📶 Library Wi-Fi 1</SectionLabel>
        <TextInput value={wifi1.ssid} onChangeText={v => setWifi1(w => ({...w, ssid: v}))} placeholder="Wi-Fi 1 Name" style={styles.input} />
        <TextInput value={wifi1.pass} onChangeText={v => setWifi1(w => ({...w, pass: v}))} placeholder="Wi-Fi 1 Password" style={styles.input} />
        <Btn label="Update Wi-Fi 1" onPress={() => save('wifi', wifi1)} />
      </Card>
      <Card>
        <SectionLabel>📶 Library Wi-Fi 2</SectionLabel>
        <TextInput value={wifi2.ssid} onChangeText={v => setWifi2(w => ({...w, ssid: v}))} placeholder="Wi-Fi 2 Name" style={styles.input} />
        <TextInput value={wifi2.pass} onChangeText={v => setWifi2(w => ({...w, pass: v}))} placeholder="Wi-Fi 2 Password" style={styles.input} />
        <Btn label="Update Wi-Fi 2" onPress={() => save('wifi2', wifi2)} />
      </Card>
    </>
  );
};

// ── Payment History pane ───────────────────────────────────────────────────────
const PayHistoryPane = () => {
  const [records, setRecords] = useState([]);
  const [expanded, setExpanded] = useState({});
  const [ssModal, setSsModal] = useState({ visible: false, uri: '' });
  const rates = useRates();

  useEffect(() => {
    const unsub = onSnapshot(collection(db,'payment_history'), async (snap) => {
      const recs = [];
      const fetches = [];
      snap.forEach(d => {
        const r = { id: d.id, ...d.data() };
        recs.push(r);
        if (r.uid) {
          fetches.push(
            getDoc(doc(db,'users',r.uid)).then(us => {
              if (us.exists()) {
                const u = us.data();
                r._name = u.name || '—'; r._phone = u.phone || '—';
                r._photo = u.photo || ''; r._father = u.father || '—';
                r._addr = u.address || '—';
              }
            }).catch(() => {})
          );
        }
      });
      await Promise.all(fetches);
      recs.sort((a,b) => parseStamp(b.actionT) - parseStamp(a.actionT));
      setRecords(recs);
    });
    return unsub;
  }, []);

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-GB') : '';

  const validityRange = (stamp) => {
    try {
      const [dp, tp] = stamp.split(', ');
      const [dd, mm, yyyy] = dp.split('/');
      const from = new Date(`${yyyy}-${mm}-${dd}T${tp}`);
      const to   = new Date(from.getTime() + (rates?.daysinamonth||30) * 86400000);
      return `${from.toLocaleDateString('en-GB')}  ⟶  ${to.toLocaleDateString('en-GB')}`;
    } catch { return '—'; }
  };

  if (!records.length) return <Text style={styles.empty}>No verified payments yet.</Text>;

  return (
    <>
      {records.map((r, i) => (
        <View key={r.id} style={styles.phCard}>
          <TouchableOpacity
            style={styles.phHeader}
            onPress={() => setExpanded(e => ({ ...e, [r.id]: !e[r.id] }))}
          >
            <View style={styles.phLeft}>
              {r._photo ? <Image source={{ uri: r._photo }} style={styles.phAvatar} /> : null}
              <View>
                <Text style={styles.phAmt}>₹{r.amt} — {r.shift}</Text>
                <Text style={styles.phSub}>{r._name || '—'} | 📞 {r.providedPhone || '—'}</Text>
                <Text style={styles.phDate}>✅ {r.actionT || '—'}</Text>
              </View>
            </View>
            <View style={styles.phRight}>
              <View style={styles.verifiedBadge}><Text style={styles.verifiedTxt}>Verified</Text></View>
              <Text style={{ fontSize: 12, color: COLORS.muted }}>{expanded[r.id] ? '▲' : '▼'}</Text>
            </View>
          </TouchableOpacity>

          {expanded[r.id] && (
            <View style={styles.phBody}>
              {/* User profile row */}
              <View style={styles.userRow}>
                {r._photo ? <Image source={{ uri: r._photo }} style={styles.phAvatarLg} /> : null}
                <View>
                  <Text style={styles.userName}>{r._name || '—'}</Text>
                  <Text style={styles.userSub}>Father: {r._father || '—'}</Text>
                  <Text style={styles.userSub}>Address: {r._addr || '—'}</Text>
                </View>
              </View>
              {/* Details table */}
              {[
                ['👤 User UID',      r.uid],
                ['📱 Profile Phone', r._phone],
                ['💳 UPI Txn UID',   r.providedUID],
                ['📞 Pay Phone',     r.providedPhone],
                ['🏷 Shift',         r.shift],
                ['📅 Days Added',    `${r.days} days`],
                ['💰 Amount',        `₹${r.amt}`],
                ['🕐 Requested',     r.reqT || '—'],
                ['✅ Verified',      r.actionT],
                ['📊 Final Balance', `${Math.floor(r.finalNet)} days`],
                ['🗓 Validity',      validityRange(r.actionT)],
              ].map(([lbl, val]) => (
                <View key={lbl} style={styles.tableRow}>
                  <Text style={styles.tableLabel}>{lbl}</Text>
                  <Text style={styles.tableVal}>{val}</Text>
                </View>
              ))}
              {/* Screenshot */}
              {r.screenshot && (
                <TouchableOpacity onPress={() => setSsModal({ visible: true, uri: r.screenshot })} style={styles.ssBtn}>
                  <Text style={{ color: COLORS.primary, fontWeight: 'bold', fontSize: 12 }}>🖼 View Screenshot</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      ))}

      <Modal visible={ssModal.visible} transparent animationType="fade">
        <TouchableOpacity
          style={styles.ssOverlay}
          activeOpacity={1}
          onPress={() => setSsModal({ visible: false, uri: '' })}
        >
          <Image source={{ uri: ssModal.uri }} style={styles.ssFullImg} resizeMode="contain" />
          <Text style={{ color: 'white', marginTop: 10, fontSize: 12 }}>Tap to close</Text>
        </TouchableOpacity>
      </Modal>
    </>
  );
};

// ── Rates pane ────────────────────────────────────────────────────────────────
const RatesPane = ({ currentRates }) => {
  const [dayVal,       setDayVal]       = useState('');
  const [nightVal,     setNightVal]     = useState('');
  const [bothVal,      setBothVal]      = useState('');
  const [daysinamonth, setDaysinamonth] = useState('');

  useEffect(() => {
    setDayVal(String(currentRates.dayVal));
    setNightVal(String(currentRates.nightVal));
    setBothVal(String(currentRates.bothVal));
    setDaysinamonth(String(currentRates.daysinamonth));
  }, [currentRates]);

  const saveRates = async () => {
    const nD = Number(dayVal), nN = Number(nightVal), nB = Number(bothVal), nM = Number(daysinamonth);
    if (!nD || !nN || !nB || !nM) return Alert.alert('Invalid', 'All fields must be valid positive numbers.');
    const changes = [];
    if (nD !== currentRates.dayVal)       changes.push(`☀️ Day:   ₹${currentRates.dayVal} → ₹${nD}`);
    if (nN !== currentRates.nightVal)     changes.push(`🌙 Night: ₹${currentRates.nightVal} → ₹${nN}`);
    if (nB !== currentRates.bothVal)      changes.push(`🌓 Both:  ₹${currentRates.bothVal} → ₹${nB}`);
    if (nM !== currentRates.daysinamonth) changes.push(`📅 Days:  ${currentRates.daysinamonth} → ${nM}`);
    if (!changes.length) return Alert.alert('No changes', 'Nothing has changed.');
    Alert.alert('Confirm Changes', changes.join('\n'), [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Save', onPress: async () => {
        await setDoc(doc(db,'settings','rates'), { dayVal: nD, nightVal: nN, bothVal: nB, daysinamonth: nM });
        Alert.alert('✅', 'Rates saved. All prices updated instantly.');
      }},
    ]);
  };

  return (
    <Card>
      <SectionLabel>Shift Prices & Validity Days</SectionLabel>
      <Text style={styles.ratesHint}>Changes apply instantly for all users.</Text>
      {[
        ['☀️ Day Shift (₹)',   dayVal,       setDayVal],
        ['🌙 Night Shift (₹)', nightVal,     setNightVal],
        ['🌓 Both Shifts (₹)', bothVal,      setBothVal],
        ['📅 Days / Month',    daysinamonth, setDaysinamonth],
      ].map(([lbl, val, setter]) => (
        <View key={lbl} style={styles.rateRow}>
          <Text style={styles.rateLabel}>{lbl}</Text>
          <TextInput
            value={val}
            onChangeText={setter}
            keyboardType="number-pad"
            style={styles.rateInput}
          />
        </View>
      ))}
      <Btn label="💾 Save Rate Changes" onPress={saveRates} />
    </Card>
  );
};

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: COLORS.bg },
  scroll: { padding: 15, paddingBottom: 30 },
  empty:  { color: COLORS.mutedLight, textAlign: 'center', padding: 40 },
  tabBar: { flexDirection: 'row', gap: 6, padding: 10, backgroundColor: COLORS.white, borderBottomWidth: 1, borderColor: COLORS.border },
  tabBtn: { flex: 1, padding: 10, borderRadius: RADIUS.sm, borderWidth: 2, borderColor: COLORS.borderMid, alignItems: 'center' },
  tabBtnActive:   { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  tabBtnTxt:      { fontWeight: 'bold', color: COLORS.muted, fontSize: 11 },
  tabBtnTxtActive:{ color: COLORS.primary },
  input: {
    padding: 12, borderRadius: RADIUS.sm, borderWidth: 1,
    borderColor: COLORS.borderMid, marginBottom: 10, fontSize: 15,
    backgroundColor: COLORS.white,
  },
  phCard: {
    backgroundColor: COLORS.white, borderRadius: RADIUS.md,
    marginBottom: 12, overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.04, shadowOffset: {width:0,height:2}, shadowRadius:4, elevation:2,
  },
  phHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14 },
  phLeft:   { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  phRight:  { alignItems: 'flex-end', gap: 4 },
  phAvatar: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: COLORS.border },
  phAvatarLg:{ width: 48, height: 48, borderRadius: 24, borderWidth: 2, borderColor: COLORS.primary, marginRight: 12 },
  phAmt:    { fontWeight: 'bold', fontSize: 13 },
  phSub:    { fontSize: 11, color: COLORS.muted, fontWeight: '600' },
  phDate:   { fontSize: 10, color: COLORS.muted },
  verifiedBadge:{ backgroundColor: COLORS.greenBg, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  verifiedTxt:  { fontSize: 11, fontWeight: 'bold', color: COLORS.greenText },
  phBody:   { padding: 14, backgroundColor: '#fafafa', borderTopWidth: 1, borderColor: '#eee' },
  userRow:  { flexDirection: 'row', alignItems: 'center', marginBottom: 10, paddingBottom: 10, borderBottomWidth: 1, borderColor: COLORS.border },
  userName: { fontWeight: 'bold', fontSize: 14 },
  userSub:  { fontSize: 12, color: COLORS.muted },
  tableRow: { flexDirection: 'row', paddingVertical: 4, borderBottomWidth: 1, borderColor: COLORS.border },
  tableLabel:{ fontSize: 12, color: COLORS.muted, width: '42%' },
  tableVal:  { fontSize: 12, color: COLORS.dark, flex: 1, fontWeight: '500' },
  ssBtn: {
    marginTop: 10, backgroundColor: '#f0f4ff',
    borderWidth: 1, borderColor: COLORS.primary,
    padding: 10, borderRadius: RADIUS.sm, alignItems: 'center',
  },
  ssOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' },
  ssFullImg: { width: '95%', height: '80%', borderRadius: RADIUS.sm },
  ratesHint: { fontSize: 12, color: COLORS.muted, marginBottom: 12, lineHeight: 17 },
  rateRow:   { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  rateLabel: { fontSize: 12, fontWeight: 'bold', color: COLORS.muted, flex: 1 },
  rateInput: {
    flex: 1, padding: 10, borderWidth: 2, borderColor: COLORS.borderMid,
    borderRadius: RADIUS.sm, fontSize: 16, fontWeight: 'bold', textAlign: 'center',
  },
});
