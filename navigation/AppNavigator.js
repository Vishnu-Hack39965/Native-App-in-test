// navigation/AppNavigator.js
import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, View, ActivityIndicator } from 'react-native';
import { onAuthStateChanged } from 'firebase/auth';
import { getDoc, doc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { ADMIN_EMAILS, COLORS } from '../theme';

import LoginScreen          from '../screens/LoginScreen';
import ProfileScreen        from '../screens/ProfileScreen';
import AdmissionScreen      from '../screens/AdmissionScreen';
import LeaveScreen          from '../screens/LeaveScreen';
import PaymentScreen        from '../screens/PaymentScreen';
import AdminSignalsScreen   from '../screens/AdminSignalsScreen';
import AdminMembersScreen   from '../screens/AdminMembersScreen';
import AdminDataScreen      from '../screens/AdminDataScreen';
import AdminUserDetailScreen from '../screens/AdminUserDetailScreen';

const Stack = createNativeStackNavigator();
const Tab   = createBottomTabNavigator();

// ── Admin bottom-tab navigator ────────────────────────────────────────────────
const AdminTabs = () => (
  <Tab.Navigator
    screenOptions={{
      tabBarActiveTintColor:   COLORS.primary,
      tabBarInactiveTintColor: COLORS.muted,
      headerShown: false,
    }}
  >
    <Tab.Screen
      name="Signals"
      component={AdminSignalsScreen}
      options={{ tabBarLabel: 'Signals 📡', tabBarIcon: () => <Text>📡</Text> }}
    />
    <Tab.Screen
      name="Members"
      component={AdminMembersScreen}
      options={{ tabBarLabel: 'Members 👥', tabBarIcon: () => <Text>👥</Text> }}
    />
    <Tab.Screen
      name="Data"
      component={AdminDataScreen}
      options={{ tabBarLabel: 'Data 🛠', tabBarIcon: () => <Text>🛠</Text> }}
    />
  </Tab.Navigator>
);

// ── Root navigator ────────────────────────────────────────────────────────────
export default function AppNavigator() {
  const [user,    setUser]    = useState(undefined); // undefined = loading
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        // Mark online
        try {
          await updateDoc(doc(db,'users',u.uid), { isOnline: true, email: u.email });
        } catch {
          const { setDoc } = await import('firebase/firestore');
          await setDoc(doc(db,'users',u.uid), {
            name: u.displayName, email: u.email, photo: u.photoURL,
            isOnline: true, totalPaidDays: 0, history: [],
          });
        }
        setIsAdmin(ADMIN_EMAILS.includes(u.email));
      }
      setUser(u || null);
    });
    return unsub;
  }, []);

  // Loading state
  if (user === undefined) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.bg }}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={{ marginTop: 12, color: COLORS.muted }}>Loading…</Text>
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerStyle:     { backgroundColor: COLORS.primary },
          headerTintColor: '#fff',
          headerTitleStyle:{ fontWeight: 'bold' },
        }}
      >
        {!user ? (
          // ── Unauthenticated ──
          <Stack.Screen
            name="Login"
            component={LoginScreen}
            options={{ headerShown: false }}
          />
        ) : (
          // ── Authenticated ──
          <>
            <Stack.Screen
              name="Profile"
              component={ProfileScreen}
              options={{ title: 'Rakshapal Singh Library' }}
            />
            <Stack.Screen
              name="Admission"
              component={AdmissionScreen}
              options={{ title: 'Admission Wizard' }}
            />
            <Stack.Screen
              name="Leave"
              component={LeaveScreen}
              options={{ title: 'Membership Exit' }}
            />
            <Stack.Screen
              name="Payment"
              component={PaymentScreen}
              options={{ title: 'Pay Fees' }}
            />
            {isAdmin && (
              <>
                <Stack.Screen
                  name="Admin"
                  component={AdminTabs}
                  options={{ title: 'Admin Panel 🛠', headerBackVisible: false }}
                />
                <Stack.Screen
                  name="AdminUserDetail"
                  component={AdminUserDetailScreen}
                  options={{ title: 'Member Folder' }}
                />
              </>
            )}
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
