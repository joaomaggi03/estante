import { Inter_400Regular, Inter_500Medium } from '@expo-google-fonts/inter';
import { Lora_400Regular, Lora_400Regular_Italic, Lora_500Medium } from '@expo-google-fonts/lora';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SpineModeProvider } from '../components/Spine';
import { initDb } from '../db/database';
import { fonts, useTheme } from '../theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const t = useTheme();
  const [loaded, error] = useFonts({ Lora_400Regular, Lora_400Regular_Italic, Lora_500Medium, Inter_400Regular, Inter_500Medium });

  const [dbReady, setDbReady] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);

  useEffect(() => {
    initDb()
      .then(() => setDbReady(true))
      .catch((e) => setDbError(e instanceof Error ? e.message : String(e)));
  }, []);

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(t.bg).catch(() => {});
  }, [t.bg]);

  const fontsDone = loaded || !!error;
  useEffect(() => {
    if ((fontsDone && dbReady) || dbError) SplashScreen.hideAsync().catch(() => {});
  }, [fontsDone, dbReady, dbError]);

  if (dbError) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: t.bg }}>
        <Text style={{ color: t.text, textAlign: 'center' }}>Não foi possível abrir os dados do app: {dbError}</Text>
      </View>
    );
  }
  if (!fontsDone || !dbReady) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: t.bg }}>
      <StatusBar style={t.dark ? 'light' : 'dark'} />
      <SpineModeProvider>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: t.bg },
          headerTintColor: t.text,
          headerTitleStyle: { fontFamily: fonts.serifMedium, fontSize: 18 },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: t.bg },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="livro/novo" options={{ title: 'Novo livro' }} />
        <Stack.Screen name="livro/[id]/index" options={{ title: '' }} />
        <Stack.Screen name="livro/[id]/editar" options={{ title: 'Editar livro' }} />
        <Stack.Screen name="ajustes" options={{ title: 'Ajustes' }} />
      </Stack>
      </SpineModeProvider>
    </GestureHandlerRootView>
  );
}
