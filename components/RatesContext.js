// RatesContext.js — loads shift prices + days-per-month from Firestore once,
// then keeps them in React context so every screen reads the same live values.
import React, { createContext, useContext, useEffect, useState } from 'react';
import { db, doc, getDoc, onSnapshot } from './firebase';

const DEFAULT_RATES = { dayVal: 600, nightVal: 500, bothVal: 800, daysinamonth: 30 };

const RatesContext = createContext(DEFAULT_RATES);

export const RatesProvider = ({ children }) => {
  const [rates, setRates] = useState(DEFAULT_RATES);

  useEffect(() => {
    const ratesRef = doc(db, 'settings', 'rates');
    const unsub = onSnapshot(ratesRef, (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        setRates({
          dayVal:       Number(d.dayVal       ?? DEFAULT_RATES.dayVal),
          nightVal:     Number(d.nightVal     ?? DEFAULT_RATES.nightVal),
          bothVal:      Number(d.bothVal      ?? DEFAULT_RATES.bothVal),
          daysinamonth: Number(d.daysinamonth ?? DEFAULT_RATES.daysinamonth),
        });
      }
    });
    return unsub;
  }, []);

  return <RatesContext.Provider value={rates}>{children}</RatesContext.Provider>;
};

export const useRates = () => useContext(RatesContext);
