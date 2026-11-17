import React, { useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { Spine, type SpineMode } from '../components/Spine';
import { Button, Card, Field, Segmented, Txt } from '../components/ui';
import { useTheme } from '../theme';
import { useBooks, useGoal, useSetting } from '../db/hooks';
import { setSetting } from '../db/repo';
import { exportBackup, importBackup } from '../lib/backup';

export default function SettingsScreen() {
  const goal = useGoal();
  const savedName = useSetting('name');
  const savedKey = useSetting('googleBooksKey');
  const [gKey, setGKey] = useState(savedKey ?? '');
  const books = useBooks();
  const t = useTheme();
  const spineMode: SpineMode = useSetting('spineStyle') === 'cover' ? 'cover' : 'generated';
  const previewBooks = [...books].sort((a, b) => Number(!!(b.coverPath ?? b.coverUrl)) - Number(!!(a.coverPath ?? a.coverUrl))).slice(0, 9);
  const year = new Date().getFullYear();
  const [goalText, setGoalText] = useState(String(goal));
  const [name, setName] = useState(savedName ?? '');
  const [busy, setBusy] = useState<'export' | 'import' | null>(null);
  const [progress, setProgress] = useState<string | null>(null);

  const saveGoal = () => {
    const n = parseInt(goalText, 10);
    if (Number.isFinite(n) && n > 0) setSetting(`goal:${year}`, String(n));
    else setGoalText(String(goal));
  };

  const doExport = async () => {
    setBusy('export');
    try {
      await exportBackup();
    } catch (e) {
      Alert.alert('Não foi possível exportar', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const doImport = async () => {
    setBusy('import');
    try {
      const r = await importBackup(setProgress);
      if (r) Alert.alert('Backup importado', `${r.added} livros novos, ${r.updated} atualizados.`);
    } catch (e) {
      Alert.alert('Não foi possível importar', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
      setProgress(null);
    }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }} keyboardShouldPersistTaps="handled">
      <Card>
        <Txt variant="heading" size={16} style={{ marginBottom: 10 }}>Você</Txt>
        <Field label="Seu nome (aparece na saudação)" value={name} onChangeText={setName} onEndEditing={() => setSetting('name', name.trim())} placeholder="João" />
        <Field
          label={`Meta de livros em ${year}`}
          value={goalText}
          onChangeText={(v) => setGoalText(v.replace(/\D/g, ''))}
          onEndEditing={saveGoal}
          keyboardType="number-pad"
        />
      </Card>

      <Card>
        <Txt variant="heading" size={16} style={{ marginBottom: 4 }}>Lombadas</Txt>
        <Txt variant="label" style={{ marginBottom: 10 }}>
          Como desenhar a lombada dos livros que não têm foto da lombada real. Livros sem capa sempre usam a lombada gerada.
        </Txt>
        <Segmented<SpineMode>
          options={[
            { value: 'generated', label: 'Gerada' },
            { value: 'cover', label: 'Faixa da capa' },
          ]}
          value={spineMode}
          onChange={(v) => setSetting('spineStyle', v)}
        />
        {previewBooks.length ? (
          <View style={{ marginTop: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 112, paddingHorizontal: 10, backgroundColor: t.shelfBack, borderTopLeftRadius: 8, borderTopRightRadius: 8, overflow: 'hidden' }}>
              {previewBooks.map((b) => (
                <Spine key={b.id} book={b} />
              ))}
            </View>
            <View style={{ height: 11, backgroundColor: t.plank, borderRadius: 4, marginTop: -2 }} />
          </View>
        ) : null}
      </Card>

      <Card>
        <Txt variant="heading" size={16} style={{ marginBottom: 4 }}>Busca de livros</Txt>
        <Txt variant="label" style={{ marginBottom: 10 }}>
          O app consulta BrasilAPI, Open Library e Google Books. Sem chave, o Google Books costuma recusar por excesso de uso; com uma chave gratuita sua, ele volta a ajudar a completar capa, autor e páginas.
        </Txt>
        <Field
          label="Chave da Google Books API (opcional)"
          value={gKey}
          onChangeText={setGKey}
          onEndEditing={() => setSetting('googleBooksKey', gKey.trim())}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="AIza…"
        />
      </Card>

      <Card>
        <Txt variant="heading" size={16} style={{ marginBottom: 4 }}>Backup</Txt>
        <Txt variant="label" style={{ marginBottom: 12 }}>
          Exporta seus {books.length} livros e prateleiras num arquivo JSON. As capas são baixadas de novo ao importar; fotos de lombada não entram no backup.
        </Txt>
        <View style={{ gap: 8 }}>
          <Button title="Exportar backup" icon="share-outline" onPress={doExport} loading={busy === 'export'} />
          <Button title="Importar backup" icon="download-outline" onPress={doImport} loading={busy === 'import'} />
        </View>
        {progress ? <Txt variant="caption" style={{ marginTop: 8 }}>{progress}</Txt> : null}
        <Txt variant="caption" style={{ marginTop: 10 }}>Importar mescla com o que já existe: adiciona os novos e atualiza os iguais, sem apagar nada.</Txt>
      </Card>
    </ScrollView>
  );
}
