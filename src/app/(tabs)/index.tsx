import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Cover } from '../../components/Cover';
import { FinishSheet } from '../../components/FinishSheet';
import { Button, Card, Icon, IconButton, ProgressBar, Txt } from '../../components/ui';
import { useBooks, useGoal, useSetting } from '../../db/hooks';
import type { Book } from '../../db/types';
import { daysBetween, formatDate, greeting, sinceLabel, todayISO, yearOf } from '../../lib/dates';
import { useTheme } from '../../theme';

export default function HomeScreen() {
  const t = useTheme();
  const books = useBooks();
  const goal = useGoal();
  const name = useSetting('name');
  const { width } = useWindowDimensions();
  const [finishing, setFinishing] = useState<Book | null>(null);
  const [page, setPage] = useState(0);

  const reading = useMemo(
    () => books.filter((b) => b.status === 'reading').sort((a, b) => (b.startDate ?? '').localeCompare(a.startDate ?? '')),
    [books],
  );
  const queue = useMemo(
    () => books.filter((b) => b.status === 'want').sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 12),
    [books],
  );
  const year = new Date().getFullYear();
  const readThisYear = books.filter((b) => b.status === 'read' && yearOf(b.endDate) === year).length;
  const pageWidth = width - 32;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View>
            <Txt variant="italic">{greeting()}{name ? `, ${name}` : ''}</Txt>
            <Txt variant="title" style={{ marginBottom: 14 }}>Lendo agora</Txt>
          </View>
          <IconButton name="settings-outline" label="Ajustes" color={t.muted} onPress={() => router.push('/ajustes')} />
        </View>

        {reading.length === 0 ? (
          <Card style={{ alignItems: 'flex-start', gap: 10, paddingVertical: 18 }}>
            <Txt variant="serif">Nenhum livro aberto no momento.</Txt>
            <Txt variant="label">Escolha um da fila ou adicione um novo para começar.</Txt>
            <Button title="Adicionar livro" icon="scan-outline" variant="primary" onPress={() => router.push('/adicionar')} />
          </Card>
        ) : (
          <>
            <FlatList
              data={reading}
              keyExtractor={(b) => b.id}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              style={{ marginHorizontal: -16 }}
              onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}
              renderItem={({ item }) => (
                <View style={{ width, paddingHorizontal: 16 }}>
                  <View style={{ width: pageWidth, flexDirection: 'row', gap: 14, alignItems: 'flex-end' }}>
                    <Pressable onPress={() => router.push({ pathname: '/livro/[id]', params: { id: item.id } })} accessibilityLabel={`Abrir ${item.title}`}>
                      <Cover book={item} width={110} />
                    </Pressable>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Txt variant="heading" numberOfLines={3}>{item.title}</Txt>
                      {item.author ? <Txt variant="italic" style={{ marginBottom: 10 }}>{item.author}</Txt> : null}
                      <Txt variant="caption">Começou em {formatDate(item.startDate, true)}</Txt>
                      <Txt variant="medium" style={{ marginBottom: 10 }}>
                        {item.startDate ? sinceLabel(daysBetween(item.startDate, todayISO())) : '—'}
                      </Txt>
                      <Button title="Terminei" icon="checkmark" onPress={() => setFinishing(item)} />
                    </View>
                  </View>
                </View>
              )}
            />
            {reading.length > 1 ? (
              <View style={{ flexDirection: 'row', gap: 5, justifyContent: 'center', marginTop: 12 }}>
                {reading.map((b, i) => (
                  <View key={b.id} style={{ width: i === page ? 16 : 5, height: 5, borderRadius: 3, backgroundColor: i === page ? t.accent : t.border }} />
                ))}
              </View>
            ) : null}
          </>
        )}

        <Pressable onPress={() => router.push('/ajustes')} accessibilityLabel="Editar meta anual">
          <Card style={{ marginTop: 18 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
              <Txt variant="label">Meta {year}</Txt>
              <Txt variant="medium" size={12}>{readThisYear} de {goal}</Txt>
            </View>
            <ProgressBar value={readThisYear / goal} />
          </Card>
        </Pressable>

        <Txt variant="heading" size={16} style={{ marginTop: 20, marginBottom: 10 }}>Próximos na fila</Txt>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {queue.map((b) => (
            <Pressable key={b.id} onPress={() => router.push({ pathname: '/livro/[id]', params: { id: b.id } })} accessibilityLabel={`Abrir ${b.title}`}>
              <Cover book={b} width={62} />
            </Pressable>
          ))}
          <Pressable
            onPress={() => router.push('/adicionar')}
            accessibilityLabel="Adicionar livro"
            style={{ width: 62, height: 93, borderWidth: 1, borderStyle: 'dashed', borderColor: t.borderStrong, borderRadius: 4, alignItems: 'center', justifyContent: 'center' }}
          >
            <Icon name="add" color={t.muted} />
          </Pressable>
        </ScrollView>
      </ScrollView>
      <FinishSheet book={finishing} onClose={() => setFinishing(null)} />
    </SafeAreaView>
  );
}
