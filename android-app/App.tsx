import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StyleSheet, View, Text } from 'react-native';
import MainScreen from './src/screens/MainScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import { initApi } from './src/services/api';

const Tab = createBottomTabNavigator();

const CYAN = '#00d4ff';
const BG = '#000814';

function TabIcon({ focused, label }: { focused: boolean; label: string }) {
  return (
    <Text style={{ color: focused ? CYAN : '#1a4466', fontSize: 8, letterSpacing: 2 }}>
      {label}
    </Text>
  );
}

export default function App() {
  useEffect(() => {
    initApi();
  }, []);

  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: BG,
            borderTopColor: '#0a2a44',
            borderTopWidth: 0.5,
            height: 60,
            paddingBottom: 8,
          },
          tabBarActiveTintColor: CYAN,
          tabBarInactiveTintColor: '#1a4466',
          tabBarLabelStyle: { fontSize: 8, letterSpacing: 2 },
        }}
      >
        <Tab.Screen
          name="JARVIS"
          component={MainScreen}
          options={{
            tabBarIcon: ({ focused }) => <TabIcon focused={focused} label="◉" />,
          }}
        />
        <Tab.Screen
          name="CONFIG"
          component={SettingsScreen}
          options={{
            tabBarIcon: ({ focused }) => <TabIcon focused={focused} label="⚙" />,
          }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
