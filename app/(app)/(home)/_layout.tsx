import React from 'react';
import { Slot } from 'expo-router';

export default function HomeLayout() {
  // This "turns (home) into a route"
  // The index.tsx is the default child route
  return <Slot />;
}
