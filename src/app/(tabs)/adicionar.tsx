import { CameraView, useCameraPermissions } from 'expo-camera';
import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Cover } from '../../components/Cover';
import { Button, Field, Icon, IconButton, Txt } from '../../components/ui';
import { isIsbn, lookupIsbn, searchByTitle, type LookupResult } from '../../lib/lookup';
import { putDraft } from '../../lib/draft';
import { useTheme } from '../../theme';

function openForm(r: Partial<LookupResult> | null, isbn?: string, pending?: Promise<LookupResult | null>) {
  // Começa a baixar a capa já, enquanto o formulário abre.
  if (r?.coverUrl) Image.prefetch(r.coverUrl, 'memory-disk').catch(() => {});
  pending?.then((full) => {
    if (full?.coverUrl && full.coverUrl !== r?.coverUrl) Image.prefetch(full.coverUrl, 'memory-disk').catch(() => {});
  });
  const draft = putDraft(
    r
      ? { title: r.title ?? '', author: r.author ?? null, isbn: r.isbn ?? isbn ?? null, pageCount: r.pageCount ?? null, coverUrl: r.coverUrl ?? null }
      : isbn
        ? { title: '', isbn }
        : {},
    pending,
  );
  router.push({ pathname: '/livro/novo', params: r?.source ? { source: r.source, draft } : { draft } });
}

export default function AddScreen() {
  const t = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [focused, setFocused] = useState(false);
  const [torch, setTorch] = useState(false);
  const [busy, setBusy] = useState(false);
  const lastScan = useRef<string | null>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<LookupResult[]>([]);
  const [searching, setSearching] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      lastScan.current = null;
      return () => setFocused(false);
    }, []),
  );

  const handleIsbn = async (raw: string) => {
    if (busy || lastScan.current === raw) return;
    lastScan.current = raw;
    setBusy(true);
    try {
      const { first, full } = await lookupIsbn(raw);
      if (first) openForm(first, undefined, full);
      else
        Alert.alert('Livro não encontrado', 'Não achamos esse ISBN nas bases públicas. Você pode cadastrar manualmente.', [
          { text: 'Cadastrar manualmente', onPress: () => openForm(null, raw) },
          { text: 'Tentar de novo', style: 'cancel', onPress: () => (lastScan.current = null) },
        ]);
    } finally {
      setBusy(false);
    }
  };

  // Busca por título com espera de 450 ms após a última tecla; só a busca mais recente vale.
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchSeq = useRef(0);
  useEffect(() => () => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
  }, []);

  const onQueryChange = (text: string) => {
    setQuery(text);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    const seq = ++searchSeq.current;
    const q = text.trim();
    if (q.length < 3 || isIsbn(q)) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    searchTimer.current = setTimeout(async () => {
      const r = await searchByTitle(q);
      if (seq === searchSeq.current) {
        setResults(r);
        setSearching(false);
      }
    }, 450);
  };

  const showCamera = focused && permission?.granted;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <Txt variant="title">Adicionar livro</Txt>
          {showCamera ? <IconButton name={torch ? 'flash' : 'flash-outline'} label="Lanterna" color={t.textSecondary} onPress={() => setTorch((v) => !v)} /> : null}
        </View>

        <View style={{ height: 240, borderRadius: 14, overflow: 'hidden', backgroundColor: '#2C2C2A', alignItems: 'center', justifyContent: 'center' }}>
          {showCamera ? (
            <>
              <CameraView
                style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
                facing="back"
                enableTorch={torch}
                barcodeScannerSettings={{ barcodeTypes: ['ean13'] }}
                onBarcodeScanned={busy ? undefined : ({ data }) => (isIsbn(data) ? handleIsbn(data) : undefined)}
              />
              <View style={{ width: 210, height: 110, borderWidth: 2, borderColor: '#C9A46A', borderRadius: 10 }} />
              <View style={{ position: 'absolute', bottom: 12 }}>
                {busy ? <ActivityIndicator color="#F5ECD9" /> : <Txt variant="caption" color="#E9DCC2">Aponte para o código de barras</Txt>}
              </View>
            </>
          ) : permission && !permission.granted ? (
            <View style={{ alignItems: 'center', gap: 10, padding: 16 }}>
              <Icon name="camera-outline" size={28} color="#E9DCC2" />
              <Txt color="#E9DCC2" style={{ textAlign: 'center' }}>Permita a câmera para ler o código de barras.</Txt>
              <Button title="Permitir câmera" variant="primary" onPress={requestPermission} />
            </View>
          ) : (
            <ActivityIndicator color="#E9DCC2" />
          )}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 14 }}>
          <View style={{ flex: 1, height: 1, backgroundColor: t.border }} />
          <Txt variant="caption">ou busque pelo título ou ISBN</Txt>
          <View style={{ flex: 1, height: 1, backgroundColor: t.border }} />
        </View>

        <Field
          value={query}
          onChangeText={onQueryChange}
          placeholder="Torto arado"
          returnKeyType="search"
          onSubmitEditing={() => (isIsbn(query) ? handleIsbn(query) : undefined)}
          autoCorrect={false}
        />
        {isIsbn(query) ? <Button title="Buscar ISBN" icon="search" onPress={() => handleIsbn(query)} loading={busy} /> : null}
        {searching ? <ActivityIndicator color={t.accent} style={{ marginVertical: 12 }} /> : null}

        {results.map((r, i) => (
          <Pressable
            key={`${r.isbn ?? r.title}-${i}`}
            onPress={() => openForm(r)}
            accessibilityRole="button"
            style={({ pressed }) => ({ flexDirection: 'row', gap: 10, alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: t.border, opacity: pressed ? 0.6 : 1 })}
          >
            <Cover book={{ title: r.title, author: r.author, coverPath: null, coverUrl: r.coverUrl, spineColor: null }} width={36} showText={false} />
            <View style={{ flex: 1 }}>
              <Txt variant="serif" size={15} numberOfLines={2}>{r.title}</Txt>
              <Txt variant="label" numberOfLines={1}>{[r.author, r.year].filter(Boolean).join(' · ')}</Txt>
            </View>
          </Pressable>
        ))}

        <Pressable onPress={() => openForm(null)} style={{ marginTop: 18, alignSelf: 'center' }} accessibilityRole="button">
          <Txt variant="medium" color={t.accent}>Cadastrar manualmente</Txt>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
