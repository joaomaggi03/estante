import { router } from 'expo-router';
import React, { useMemo } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, ProgressBar, Txt } from '../../components/ui';
import { useBooks, useGoal } from '../../db/hooks';
import { computeStats, formatNumber } from '../../lib/stats';
import { useTheme } from '../../theme';

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card style={{ flex: 1 }}>
      <Txt variant="label">{label}</Txt>
      <Txt variant="title" size={24}>{value}</Txt>
      {hint ? <Txt variant="caption">{hint}</Txt> : null}
    </Card>
  );
}

export default function NumbersScreen() {
  const t = useTheme();
  const books = useBooks();
  const goal = useGoal();
  const s = useMemo(() => computeStats(books), [books]);
  const year = new Date().getFullYear();
  const lastYears = s.years.slice(-8);
  const maxCount = Math.max(1, ...lastYears.map((y) => y.count));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        <Txt variant="title" style={{ marginBottom: 2 }}>Números</Txt>
        <Txt variant="italic" style={{ marginBottom: 14 }}>
          {s.totalRead} {s.totalRead === 1 ? 'livro lido' : 'livros lidos'} no total
        </Txt>

        <Pressable onPress={() => router.push('/ajustes')} accessibilityLabel="Editar meta anual">
          <Card style={{ marginBottom: 10 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
              <Txt variant="label">Meta {year}</Txt>
              <Txt variant="medium" size={12}>{s.readThisYear} de {goal}</Txt>
            </View>
            <ProgressBar value={s.readThisYear / goal} />
            <Txt variant="caption" style={{ marginTop: 6 }}>
              {s.readThisYear >= goal ? 'Meta batida!' : `Faltam ${goal - s.readThisYear} para a meta.`}
            </Txt>
          </Card>
        </Pressable>

        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
          <Metric label="Nota média" value={s.avgRating == null ? '—' : `${formatNumber(s.avgRating)} ★`} />
          <Metric label="Tempo médio" value={s.avgDays == null ? '—' : `${Math.round(s.avgDays)} dias`} hint="do início ao fim" />
        </View>

        <Card style={{ marginTop: 6 }}>
          <Txt variant="heading" size={16} style={{ marginBottom: 12 }}>Lidos por ano</Txt>
          {lastYears.length === 0 ? (
            <Txt variant="italic">Termine um livro para ver o gráfico.</Txt>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, height: 150 }}>
              {lastYears.map((y) => (
                <View key={y.year} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
                  <Txt variant="caption" color={t.text}>{y.count}</Txt>
                  <View
                    style={{
                      width: '70%',
                      height: Math.max(4, (y.count / maxCount) * 110),
                      backgroundColor: y.year === year ? t.gold : t.plank,
                      borderTopLeftRadius: 4,
                      borderTopRightRadius: 4,
                      marginTop: 4,
                    }}
                  />
                  <Txt variant="caption" style={{ marginTop: 4 }}>{y.year}</Txt>
                </View>
              ))}
            </View>
          )}
        </Card>

        {s.years.length ? (
          <Card style={{ marginTop: 10 }}>
            <Txt variant="heading" size={16} style={{ marginBottom: 8 }}>Por ano</Txt>
            <View style={{ flexDirection: 'row', paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: t.border }}>
              <Txt variant="caption" style={{ flex: 1 }}>Ano</Txt>
              <Txt variant="caption" style={{ width: 50, textAlign: 'right' }}>Livros</Txt>
              <Txt variant="caption" style={{ width: 70, textAlign: 'right' }}>Nota</Txt>
              <Txt variant="caption" style={{ width: 80, textAlign: 'right' }}>Dias/livro</Txt>
            </View>
            {[...s.years].reverse().map((y) => (
              <View key={y.year} style={{ flexDirection: 'row', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: t.border }}>
                <Txt variant="medium" style={{ flex: 1 }}>{y.year}</Txt>
                <Txt style={{ width: 50, textAlign: 'right' }}>{y.count}</Txt>
                <Txt style={{ width: 70, textAlign: 'right' }}>{y.avgRating == null ? '—' : `${formatNumber(y.avgRating)} ★`}</Txt>
                <Txt style={{ width: 80, textAlign: 'right' }}>{y.avgDays == null ? '—' : Math.round(y.avgDays)}</Txt>
              </View>
            ))}
          </Card>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
