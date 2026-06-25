// App.js — root entry point
import 'react-native-gesture-handler'; // <-- Moved to the very top
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { RatesProvider } from './components/RatesContext';
import AppNavigator from './navigation/AppNavigator';

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <RatesProvider>
        <StatusBar style="light" />
        <AppNavigator />
      </RatesProvider>
    </GestureHandlerRootView>
  );
}
