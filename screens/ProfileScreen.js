// screens/ProfileScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Image, TouchableOpacity,
  Alert, SafeAreaView, Modal, Linking,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import {
  auth, db, doc, updateDoc, onSnapshot,
  arrayUnion, getStamp, fmtDate, getRealSurvival, lastValidDate,
} from '../firebase';
import { useRates } from '../RatesContext';
import { COLORS, RADIUS, SHADOW } from '../theme';
import {
  Card, Btn, SectionLabel, DetailRow,
  CountdownTimer, LoadingCard, ValidityStrip, ErrorMsg,
} from '../components/UI';

export default function ProfileScreen({ navigation }) {
  const rates = useRates();
  const [userData, setUserData]   = useState(null);
  const [loading,  setLoading]    = useState(true);
  const [fields,   setFields]     = useState({ name:'', father:'', phone:'', address:'' });
  const [editKeys, setEditKeys]   = useState({});
  const [seatModal,setSeatModal]  = useState(false);
  const [wifiModal,setWifiModal]  = useState({ visible: false, ssid:'', pass:'', label:'' });
  const user = auth.currentUser;

  // ── Live Firestore listener ──────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(db, 'users', user.uid), (snap) => {
      if (!snap.exists()) return;
      const d = snap.data();
      setUserData(d);
      setFields({ name: d.name||'', father: d.father||'', phone: d.phone||'', address: d.address||'' });
      setLoading(false);
      if (d.seatPending && d.seatNo) setSeatModal(true);
    });
    return unsub;
  }, [user]);

  // ── Validity range helpers ───────────────────────────────────────────────
  const srv = userData ? getRealSurvival(userData) : 0;
  const validUntil = srv > 0 ? `📅 Valid until: ${lastValidDate(srv)}` : srv < 0 ? '⛔ Membership expired' : null;

  const totalPayable = useCallback(() => {
    if (!fields.phone) return 0;
    const lastTwo = parseInt(fields.phone.slice(-2)) || 0;
    return rates.dayVal + lastTwo / 100;
  }, [fields.phone, rates]);

  const validityDates = () => {
    const today = new Date();
    const end   = new Date(today.getTime() + rates.daysinamonth * 86400000);
    return { from: fmtDate(today), to: fmtDate(end) };
  };

  // ── Profile save ─────────────────────────────────────────────────────────
  const saveProfile = async () => {
    const { name, father, phone, address } = fields;
    if (name.length < 6 || father.length < 6 || address.length < 6)
      return Alert.alert('Validation', 'Name, Father's Name & Address must each be at least 6 characters.');
    if (!/^\d{10}$/.test(phone))
      return Alert.alert('Validation', 'Phone must be exactly 10 digits.');
    await updateDoc(doc(db,'users',user.uid), {
      name, father, phone, address,
      history: arrayUnion(
        `Name:${userData?.name}→${name}`,
        `Father:${userData?.father}→${father}`,
        `Phone:${userData?.phone}→${phone}`,
        `Addr:${userData?.address}→${address}`,
      ),
    });
    setEditKeys({});
    Alert.alert('✅', 'Profile saved successfully.');
    return true;
  };

  // ── Photo update ─────────────────────────────────────────────────────────
  const pickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return Alert.alert('Permission needed', 'Please allow photo library access.');
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [1, 1], quality: 0.6, base64: true,
    });
    if (!result.canceled && result.assets[0].base64) {
      await updateDoc(doc(db,'users',user.uid), { photo: `data:image/jpeg;base64,${result.assets[0].base64}` });
    }
  };

  // ── Seat popup agree ─────────────────────────────────────────────────────
  const agreeSeat = async () => {
    await updateDoc(doc(db,'users',user.uid), { seatPending: false });
    setSeatModal(false);
  };

  // ── Wi-Fi connect ─────────────────────────────────────────────────────────
  const connectWifi = async (key) => {
    const { getDoc } = await import('firebase/firestore');
    const snap = await getDoc(doc(db,'users',user.uid));
    if (!snap.exists()) return;
    if (getRealSurvival(snap.data()) < -1) {
      Alert.alert('Fees Due', 'Please pay your fees to access the Wi-Fi network!');
      return;
    }
    const { getDoc: gd2 } = await import('firebase/firestore');
    const wSnap = await gd2(doc(db,'settings',key));
    if (!wSnap.exists() || !wSnap.data().ssid || !wSnap.data().pass) {
      Alert.alert('Wi-Fi not configured', 'Ask admin to set Wi-Fi details.');
      return;
    }
    const { ssid, pass } = wSnap.data();
    // Try deep link to library app first
    Linking.openURL(`mylibraryapp://wifi?ssid=${encodeURIComponent(ssid)}&pass=${encodeURIComponent(pass)}`)
      .catch(() => {
        setWifiModal({ visible: true, ssid, pass, label: key === 'wifi2' ? 'Network 2' : 'Network 1' });
      });
    setTimeout(() => {
      setWifiModal({ visible: true, ssid, pass, label: key === 'wifi2' ? 'Network 2' : 'Network 1' });
    }, 1500);
  };

  // ── Render ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <LoadingCard />
        </ScrollView>
      </SafeAreaView>
    );
  }

  const vd = validityDates();
  const total = totalPayable();
  const joined = !!userData?.joinDateISO;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        {/* ── Hero card ── */}
        <Card style={{ alignItems: 'center' }}>
          <TouchableOpacity onPress={pickPhoto}>
            <Image
              source={{ uri: userData?.photo || user?.photoURL || 'https://via.placeholder.com/80' }}
              style={styles.avatar}
            />
            <Text style={styles.avatarHint}>Tap to change</Text>
          </TouchableOpacity>

          <Text style={styles.statusLabel}>
            {joined ? `JOINED: ${userData.joinDate}` : 'NOT JOINED'}
          </Text>

          <CountdownTimer userData={userData} />

          {validUntil && (
            <View style={styles.validStrip}>
              <Text style={{ fontWeight: 'bold', color: srv > 0 ? COLORS.greenText : COLORS.red }}>
                {validUntil}
              </Text>
            </View>
          )}

          {userData?.seatNo && (
            <View style={styles.seatBadge}>
              <Text style={styles.seatBadgeTxt}>🪑 Seat No. {userData.seatNo}</Text>
            </View>
          )}

          {!joined && (
            <Btn label="Start Admission" onPress={() => navigation.navigate('Admission')} />
          )}
          {joined && (
            <>
              <Btn label="🛜 Connect to Internet"   onPress={() => connectWifi('wifi')}  variant="green" />
              <Btn label="🛜 Connect to Internet 2" onPress={() => connectWifi('wifi2')} variant="green"
                   style={{ backgroundColor: COLORS.greenDark, marginTop: 8 }} />
            </>
          )}
        </Card>

        {/* ── Profile fields ── */}
        <Card>
          {userData?.seatNo && (
            <DetailRow label="🪑 Seat No." value={String(userData.seatNo)} editable={false} />
          )}
          {['name','father','phone','address'].map((k) => (
            <DetailRow
              key={k}
              label={k === 'father' ? "Father's Name" : k.charAt(0).toUpperCase() + k.slice(1)}
              value={fields[k]}
              editable={!!editKeys[k]}
              onChangeText={(v) => setFields(f => ({ ...f, [k]: v }))}
              keyboardType={k === 'phone' ? 'phone-pad' : 'default'}
              multiline={k === 'address'}
              onEditPress={() => setEditKeys(e => ({ ...e, [k]: true }))}
            />
          ))}
          <Btn label="Update Folder Details" onPress={saveProfile} variant="green" />
        </Card>

        {/* ── Payment tools (joined members only) ── */}
        {joined && (
          <>
            <Card style={{ backgroundColor: '#f0f7ff' }}>
              <SectionLabel>☀️ Day Shift — ₹{rates.dayVal} per month</SectionLabel>
              <Text style={styles.shiftInfo}>
                Monthly total: <Text style={{ color: COLORS.primary, fontWeight: 'bold', fontSize: 18 }}>₹{total.toFixed(2)}</Text>
              </Text>
              <Text style={styles.shiftHint}>
                (Base ₹{rates.dayVal} + last 2 digits of phone ÷ 100)
              </Text>
              <ValidityStrip from={vd.from} to={vd.to} />
              <Btn
                label="Pay Now"
                onPress={() => navigation.navigate('Payment', { total, days: rates.daysinamonth, shift: `Day Shift (₹${rates.dayVal})`, phone: fields.phone })}
              />
            </Card>
            <Btn
              label="Membership Exit"
              onPress={() => navigation.navigate('Leave')}
              variant="outline"
              style={{ marginBottom: 10 }}
            />
          </>
        )}

        {/* ── Payment history ── */}
        <Card>
          <SectionLabel>Payment History</SectionLabel>
          <PaymentLog history={userData?.history} name={userData?.name} phone={userData?.phone} rates={rates} />
        </Card>

        <Btn label="Logout" onPress={handleLogout} variant="ghost" />
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ── Seat condition popup ── */}
      <Modal visible={seatModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={{ fontSize: 32, textAlign: 'center', marginBottom: 8 }}>🪑</Text>
            <Text style={styles.modalTitle}>Seat Assignment Notice</Text>
            <Text style={styles.modalBody}>
              Please check if the condition of the respective chair and light of{' '}
              <Text style={{ color: COLORS.primary, fontWeight: 'bold' }}>
                Seat No. {userData?.seatNo}
              </Text>{' '}
              is in good condition.{'\n\n'}
              If yes, tap Agree below.{'\n\n'}
              If not, contact manager{' '}
              <Text style={{ fontWeight: 'bold' }}>Vijay Pal Singh</Text> or call{' '}
              <Text style={{ color: COLORS.primary, fontWeight: 'bold' }}>📞 7500159996</Text>.
            </Text>
            <View style={styles.warningBox}>
              <Text style={{ fontSize: 13, lineHeight: 20 }}>
                ⚠️ <Text style={{ fontWeight: 'bold' }}>Warning:</Text> If you tap Agree, you are solely
                responsible for any break/tear/wear of Seat No. {userData?.seatNo}.
              </Text>
            </View>
            <Btn label="✅ Agree" onPress={agreeSeat} />
          </View>
        </View>
      </Modal>

      {/* ── Wi-Fi info modal ── */}
      <Modal visible={wifiModal.visible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={{ fontSize: 36, textAlign: 'center', marginBottom: 4 }}>📶</Text>
            <Text style={styles.modalTitle}>Connect to Wi-Fi</Text>
            <Text style={[styles.modalBody, { color: COLORS.muted, marginBottom: 12, textAlign: 'center' }]}>
              {wifiModal.label}
            </Text>
            <View style={styles.wifiDetails}>
              <Text style={styles.wifiDetailLabel}>Network Name (SSID)</Text>
              <Text style={styles.wifiDetailValue}>{wifiModal.ssid}</Text>
              <Text style={[styles.wifiDetailLabel, { marginTop: 10 }]}>Password</Text>
              <Text style={[styles.wifiDetailValue, { color: COLORS.dark }]}>{wifiModal.pass}</Text>
            </View>
            <Btn
              label="📥 Download Library App"
              onPress={() => Linking.openURL('https://github.com/Vishnu-Hack39965/App-Creation/releases/latest')}
            />
            <Btn label="Close" onPress={() => setWifiModal(w => ({ ...w, visible: false }))} variant="ghost" />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ── Logout helper ─────────────────────────────────────────────────────────────
const handleLogout = async () => {
  const { signOut } = await import('firebase/auth');
  if (auth.currentUser)
    await updateDoc(doc(db,'users',auth.currentUser.uid), { isOnline: false }).catch(() => {});
  signOut(auth);
};

// ── Payment log sub-component ─────────────────────────────────────────────────
const PaymentLog = ({ history, name, phone, rates }) => {
  const fmtDate = (d) => d ? d.toLocaleDateString('en-GB') : '';
  const validityRange = (stamp) => {
    try {
      const [dp, tp] = stamp.split(', ');
      const [dd, mm, yyyy] = dp.split('/');
      const from = new Date(`${yyyy}-${mm}-${dd}T${tp}`);
      const to   = new Date(from.getTime() + (rates?.daysinamonth||30) * 86400000);
      return `${fmtDate(from)}  ⟶  ${fmtDate(to)}`;
    } catch { return '—'; }
  };

  const items = [...(history || [])].reverse().slice(0, 20);
  if (!items.length) return <Text style={{ color: COLORS.muted, fontSize: 13 }}>No payment history.</Text>;

  return (
    <>
      {items.map((h, i) => {
        if (typeof h === 'string')
          return <Text key={i} style={styles.logLine}>• {h}</Text>;

        const icon = h.status === 'Verified' ? '✅' : h.status === 'Rejected' ? '❌' : h.status === 'OTP_Verified' ? '🔐' : '⏳';
        return (
          <View key={i} style={styles.logEntry}>
            <Text style={[styles.logLine, { fontWeight: 'bold' }]}>
              {icon} {h.status} — {h.shift}
            </Text>
            <Text style={styles.logLine}>₹{h.amt} · {h.days} days · {h.reqT}</Text>
            {h.status === 'Verified' && (
              <Text style={[styles.logLine, { color: COLORS.greenText }]}>
                🗓 {validityRange(h.actionT)}
              </Text>
            )}
          </View>
        );
      })}
    </>
  );
};

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: COLORS.bg },
  scroll: { padding: 15, paddingBottom: 30 },

  avatar: {
    width: 80, height: 80, borderRadius: 40,
    borderWidth: 2, borderColor: COLORS.border,
    marginBottom: 4, alignSelf: 'center',
  },
  avatarHint: { fontSize: 10, color: COLORS.muted, textAlign: 'center', marginBottom: 8 },
  statusLabel: { fontSize: 11, fontWeight: 'bold', color: COLORS.muted, textAlign: 'center' },

  validStrip: {
    backgroundColor: COLORS.greenBg, borderRadius: RADIUS.sm,
    padding: 8, marginTop: 8, alignItems: 'center',
  },
  seatBadge: {
    backgroundColor: '#e3f0fd', borderRadius: RADIUS.round,
    paddingHorizontal: 12, paddingVertical: 4, marginTop: 8,
  },
  seatBadgeTxt: { color: COLORS.primary, fontWeight: 'bold', fontSize: 12 },

  shiftInfo: { fontSize: 15, marginTop: 8 },
  shiftHint: { fontSize: 11, color: COLORS.muted, marginTop: 2, marginBottom: 4 },

  logLine:  { fontSize: 12, color: COLORS.dark, paddingVertical: 2 },
  logEntry: { paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: COLORS.border },

  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.8)',
    alignItems: 'center', justifyContent: 'center', padding: 20,
  },
  modalBox: {
    backgroundColor: COLORS.white, borderRadius: RADIUS.xl,
    padding: 24, width: '100%', maxWidth: 440,
    maxHeight: '90%',
  },
  modalTitle: {
    fontSize: 17, fontWeight: 'bold', textAlign: 'center',
    color: COLORS.dark, marginBottom: 12,
  },
  modalBody: { fontSize: 14, lineHeight: 22, color: '#333' },
  warningBox: {
    backgroundColor: COLORS.yellowBg, borderRadius: RADIUS.md,
    padding: 14, marginTop: 10, borderLeftWidth: 4, borderLeftColor: COLORS.yellow,
  },
  wifiDetails: {
    backgroundColor: '#f0f7ff', borderRadius: RADIUS.md, padding: 14, marginBottom: 12,
  },
  wifiDetailLabel: { fontSize: 10, color: COLORS.muted, fontWeight: 'bold', textTransform: 'uppercase' },
  wifiDetailValue: { fontSize: 17, fontWeight: 'bold', color: COLORS.primary, marginTop: 2 },
});
