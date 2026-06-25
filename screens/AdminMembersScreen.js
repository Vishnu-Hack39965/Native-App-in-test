// screens/AdminMembersScreen.js — live members list
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Image,
  SafeAreaView, TouchableOpacity,
} from 'react-native';
import {
  db, collection, onSnapshot,
  getRealSurvival, formatTime, lastValidDate,
} from '../firebase';
import { COLORS, RADIUS, SHADOW } from '../theme';

export default function AdminMembersScreen({ navigation }) {
  const [groups, setGroups] = useState({ onJ_ok:'', onJ_exp:'', offJ_ok:'', offJ_exp:'', onNL:'', offNL:'' });
  const [members, setMembers] = useState([]);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const unsub = onSnapshot(collection(db,'users'), (snap) => {
      const all = [];
      snap.forEach(d => all.push({ uid: d.id, ...d.data() }));
      setMembers(all);
    });
    return unsub;
  }, []);

  // Tick every second to update live countdown timers
  useEffect(() => {
    const iv = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(iv);
  }, []);

  // Categorise
  const cats = { onJ_ok:[], onJ_exp:[], offJ_ok:[], offJ_exp:[], onNL:[], offNL:[] };
  members.forEach(u => {
    const srv  = getRealSurvival(u);
    const isJ  = !!u.joinDateISO;
    const isO  = !!u.isOnline;
    if      (isJ && isO  && srv >= 0) cats.onJ_ok.push(u);
    else if (isJ && isO  && srv <  0) cats.onJ_exp.push(u);
    else if (isJ && !isO && srv >= 0) cats.offJ_ok.push(u);
    else if (isJ && !isO && srv <  0) cats.offJ_exp.push(u);
    else if (!isJ && isO)             cats.onNL.push(u);
    else                               cats.offNL.push(u);
  });

  const renderGroup = (label, arr) => {
    if (!arr.length) return null;
    return (
      <View key={label}>
        <Text style={styles.groupLabel}>{label}</Text>
        {arr.map(u => <MemberCard key={u.uid} u={u} onPress={() => navigation.navigate('AdminUserDetail', { uid: u.uid })} />)}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {renderGroup('🟢 Online & Joined (Active)',   cats.onJ_ok)}
        {renderGroup('🔴 Online & Joined (Expired)',  cats.onJ_exp)}
        {renderGroup('🟢 Offline & Joined (Active)',  cats.offJ_ok)}
        {renderGroup('🔴 Offline & Joined (Expired)', cats.offJ_exp)}
        {renderGroup('🔵 Online (Not Joined)',         cats.onNL)}
        {renderGroup('⚫ Offline (Not Joined)',        cats.offNL)}
        {members.length === 0 && (
          <Text style={styles.empty}>No members yet.</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const MemberCard = ({ u, onPress }) => {
  const srv     = getRealSurvival(u);
  const isJoined= !!u.joinDateISO;
  const isOnline= !!u.isOnline;
  const [display, setDisplay] = useState(formatTime(srv));
  const [pos, setPos] = useState(srv >= 0);

  useEffect(() => {
    const iv = setInterval(() => {
      const s = getRealSurvival(u);
      setDisplay(formatTime(s));
      setPos(s >= 0);
    }, 1000);
    return () => clearInterval(iv);
  }, [u]);

  return (
    <TouchableOpacity onPress={onPress} style={styles.card} activeOpacity={0.75}>
      <View style={styles.cardLeft}>
        <Image
          source={{ uri: u.photo || 'https://via.placeholder.com/45' }}
          style={styles.avatar}
        />
        <View>
          <View style={styles.nameRow}>
            <Text style={styles.name}>{u.name || '—'}</Text>
            {u.seatNo && (
              <View style={styles.seatBadge}>
                <Text style={styles.seatBadgeTxt}>🪑 {u.seatNo}</Text>
              </View>
            )}
          </View>
          <View style={[styles.onlineBadge, { backgroundColor: isOnline ? COLORS.greenBg : COLORS.redBg }]}>
            <Text style={{ color: isOnline ? COLORS.greenText : COLORS.red, fontSize: 10, fontWeight: 'bold' }}>
              {isOnline ? '● Online' : '○ Offline'}
            </Text>
          </View>
        </View>
      </View>
      <View style={styles.cardRight}>
        {isJoined ? (
          <>
            <Text style={[styles.timer, { color: pos ? COLORS.green : COLORS.red }]}>{display}</Text>
            <Text style={[styles.validTxt, { color: pos ? COLORS.greenText : COLORS.red }]}>
              {pos ? `📅 Until: ${lastValidDate(srv)}` : '⛔ Expired'}
            </Text>
          </>
        ) : (
          <Text style={styles.staticTimer}>{formatTime(u.totalPaidDays||0)} (Static)</Text>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: COLORS.bg },
  scroll: { padding: 12, paddingBottom: 30 },
  empty:  { color: COLORS.mutedLight, textAlign: 'center', padding: 40 },
  groupLabel: {
    fontSize: 10, color: COLORS.primary, fontWeight: 'bold',
    textTransform: 'uppercase', marginTop: 16, marginBottom: 6,
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md, padding: 14,
    marginBottom: 10, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'space-between',
    ...SHADOW.card,
  },
  cardLeft:   { flexDirection: 'row', alignItems: 'center', flex: 1 },
  avatar:     { width: 45, height: 45, borderRadius: 23, marginRight: 12, borderWidth: 2, borderColor: COLORS.border },
  nameRow:    { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  name:       { fontWeight: 'bold', fontSize: 14, color: COLORS.dark },
  seatBadge:  { backgroundColor: '#e3f0fd', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 },
  seatBadgeTxt:{ color: COLORS.primary, fontSize: 10, fontWeight: 'bold' },
  onlineBadge:{ borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, marginTop: 3, alignSelf: 'flex-start' },
  cardRight:  { alignItems: 'flex-end', flexShrink: 0 },
  timer:      { fontFamily: 'Courier New', fontWeight: 'bold', fontSize: 13 },
  validTxt:   { fontSize: 11, fontWeight: 'bold', marginTop: 2 },
  staticTimer:{ color: COLORS.muted, fontFamily: 'Courier New', fontSize: 12 },
});  
