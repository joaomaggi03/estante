import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { fonts, useTheme } from '../../theme';

export default function TabsLayout() {
  const t = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: t.accent,
        tabBarInactiveTintColor: t.muted,
        tabBarStyle: { backgroundColor: t.bg, borderTopColor: t.border },
        tabBarLabelStyle: { fontFamily: fonts.sans, fontSize: 11 },
        sceneStyle: { backgroundColor: t.bg },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Início', tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" color={color as string} size={size} /> }}
      />
      <Tabs.Screen
        name="biblioteca"
        options={{ title: 'Biblioteca', tabBarIcon: ({ color, size }) => <Ionicons name="library-outline" color={color as string} size={size} /> }}
      />
      <Tabs.Screen
        name="adicionar"
        options={{ title: 'Adicionar', tabBarIcon: ({ color, size }) => <Ionicons name="scan-outline" color={color as string} size={size} /> }}
      />
      <Tabs.Screen
        name="numeros"
        options={{ title: 'Números', tabBarIcon: ({ color, size }) => <Ionicons name="bar-chart-outline" color={color as string} size={size} /> }}
      />
    </Tabs>
  );
}
