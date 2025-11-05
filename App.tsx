/**
 * App.tsx — Root file
 * Only responsible for initializing Navigation + SafeAreaProvider
 */

import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import AppNavigator from './navigation/index'; // 👈 All navigation logic is here
import { initNotifications } from './utils/notifications';

export default function App() {
  React.useEffect(() => {
    initNotifications();
  }, []);
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" translucent={false} />
      <NavigationContainer>
        <AppNavigator />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}