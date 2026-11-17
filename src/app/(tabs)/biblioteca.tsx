import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bookshelf } from '../../components/Bookshelf';
import { Cover } from '../../components/Cover';
import { Sheet } from '../../components/Sheet';
import { Stars } from '../../components/Stars';
import { Chip, Icon, IconButton, Txt, type IconName } from '../../components/ui';
import { useBooks, useSetting, useShelves } from '../../db/hooks';
import { initManualShelves, setSetting } from '../../db/repo';
import { STATUS_TAB_LABEL, type Book, type BookStatus } from '../../db/types';
import { formatDate } from '../../lib/dates';
import { buildGroups, DEFAULT_DIR, SORT_OPTIONS, sortLabel, type SortDir, type SortKey } from '../../lib/shelving';
import { fonts, useTheme } from '../../theme';

const TABS: BookStatus[] = ['read', 'want', 'reading'];

function normalize(s: string | null | undefined) {
  return (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function parseSort(v: string | null): { key: SortKey; dir: SortDir } {
  const [k, d] = (v ?? '').split(':');
  const key = (SORT_OPTIONS.some((o) => o.key === k) ? k : 'year') as SortKey;
  return { key, dir: d === 'asc' || d === 'desc' ? d : DEFAULT_DIR[key] };
}

export default function LibraryScreen() {
  const t = useTheme();
  const books = useBooks();
  const [status, setStatus] = useState<BookStatus>('read');
  const shelves = useShelves(status);
  const sort = parseSort(useSetting(`sort:${status}`));
  const manualReady = useSetting(`manualInit:${status}`) === '1';
  const [editing, setEditing] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Book | null>(null);

  const counts = useMemo(() => {
    const c: Record<BookStatus, number> = { read: 0, want: 0, reading: 0 };
    books.forEach((b) => c[b.status]++);
    return c;
  }, [books]);

  const tabBooks = useMemo(() => {
    const q = normalize(query.trim());
    return books.filter(
      (b) => b.status === status && (!q || normalize(b.title).includes(q) || normalize(b.author).includes(q)),
    );
  }, [books, status, query]);

  const effectiveSort: SortKey = editing ? 'manual' : sort.key;
  const groups = useMemo(
    () => buildGroups(tabBooks, effectiveSort, sort.dir, shelves),
    [tabBooks, effectiveSort, sort.dir, shelves],
  );

  const setSort = (key: SortKey, dir: SortDir) => setSetting(`sort:${status}`, `${key}:${dir}`);

  const startEditing = () => {
    setQuery('');
    setSearchOpen(false);
    setSelected(null);
    if (!manualReady) {
      // Primeira vez: a arrumação atual vira o ponto de partida da "Minha ordem".
      const base = buildGroups(
        books.filter((b) => b.status === status),
        sort.key === 'manual' ? 'year' : sort.key,
        sort.dir,
      );
      initManualShelves(
        status,
        base.map((g, i) => ({ label: g.label.trim() || `Prateleira ${i + 1}`, books: g.books })),
      );
      setSetting(`manualInit:${status}`, '1');
    }
    if (sort.key !== 'manual') setSort('manual', 'asc');
    setEditing(true);
  };

  const changeTab = (s: BookStatus) => {
    setStatus(s);
    setSelected(null);
    setEditing(false);
  };

  const header = (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8 }}>
        <Txt variant="title">{editing ? 'Editando estante' : 'Minha estante'}</Txt>
        {editing ? (
          <Pressable onPress={() => setEditing(false)} accessibilityRole="button" hitSlop={10}>
            <Txt variant="medium" color={t.accent}>Concluir</Txt>
          </Pressable>
        ) : (
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            <IconButton name="search-outline" label="Buscar na estante" size={19} color={t.textSecondary} onPress={() => setSearchOpen((v) => !v)} />
            <IconButton name="pencil-outline" label="Editar estante" size={16} color={t.borderStrong} onPress={startEditing} />
          </View>
        )}
      </View>
      {editing ? (
        <Txt variant="italic" style={{ marginTop: 2 }}>Segure e arraste um livro. Toque no nome para renomear.</Txt>
      ) : (
        <Txt variant="italic" style={{ marginTop: 2 }}>
          {books.length} {books.length === 1 ? 'livro' : 'livros'}, {counts.read} {counts.read === 1 ? 'lido' : 'lidos'}
        </Txt>
      )}
      {searchOpen && !editing ? (
        <TextInput
          autoFocus
          value={query}
          onChangeText={setQuery}
          placeholder="Buscar por título ou autor"
          placeholderTextColor={t.muted}
          style={{
            marginTop: 10,
            borderWidth: 1,
            borderColor: t.borderStrong,
            borderRadius: 8,
            paddingHorizontal: 10,
            paddingVertical: 7,
            fontFamily: fonts.sans,
            color: t.text,
            backgroundColor: t.surface,
          }}
        />
      ) : null}
      <View style={{ flexDirection: 'row', gap: 6, marginTop: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        {TABS.map((s) => (
          <Chip key={s} label={`${STATUS_TAB_LABEL[s]} ${counts[s]}`} active={status === s} onPress={() => changeTab(s)} />
        ))}
        <View style={{ flex: 1 }} />
        {!editing ? <Chip label={shortSort(sort.key)} icon="swap-vertical" onPress={() => setSortOpen(true)} /> : null}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={['top']}>
      <Bookshelf
        groups={groups}
        status={status}
        editing={editing}
        selectedId={selected?.id}
        onSelect={(b) => setSelected((cur) => (cur?.id === b.id ? null : b))}
        header={header}
        emptyText={query ? 'Nenhum livro encontrado.' : `Nenhum livro em "${STATUS_TAB_LABEL[status]}".`}
      />

      {selected && !editing ? (
        <Pressable
          onPress={() => router.push({ pathname: '/livro/[id]', params: { id: selected.id } })}
          accessibilityRole="button"
          accessibilityLabel={`Abrir ${selected.title}`}
          style={{
            position: 'absolute',
            left: 16,
            right: 16,
            bottom: 12,
            backgroundColor: t.surface,
            borderColor: t.border,
            borderWidth: 1,
            borderRadius: 12,
            padding: 10,
            flexDirection: 'row',
            gap: 10,
            alignItems: 'center',
          }}
        >
          <Cover book={selected} width={36} showText={false} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Txt variant="serif" size={15} numberOfLines={1}>{selected.title}</Txt>
            {selected.status === 'read' ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Stars value={selected.rating} size={12} />
                <Txt variant="caption">· terminado em {formatDate(selected.endDate)}</Txt>
              </View>
            ) : (
              <Txt variant="caption" numberOfLines={1}>{selected.author ?? ''}</Txt>
            )}
          </View>
          <Icon name="chevron-forward" size={18} color={t.muted} />
        </Pressable>
      ) : null}

      <Sheet visible={sortOpen} onClose={() => setSortOpen(false)} title="Ordenar estante">
        {SORT_OPTIONS.filter((o) => o.key !== 'manual' || manualReady).map((o) => {
          const active = sort.key === o.key;
          return (
            <Pressable
              key={o.key}
              onPress={() => {
                setSort(o.key, active ? sort.dir : DEFAULT_DIR[o.key]);
                setSortOpen(false);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: t.border }}
            >
              <Icon name={o.icon as IconName} size={18} color={t.textSecondary} />
              <Txt variant="serif" style={{ flex: 1 }} color={active ? t.accent : t.text}>{sortLabel(o.key, status)}</Txt>
              {active ? <Icon name="checkmark" size={18} color={t.accent} /> : null}
            </Pressable>
          );
        })}
        {sort.key !== 'manual' ? (
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
            <View style={{ flex: 1 }}>
              <Chip label="Decrescente" icon="arrow-down" active={sort.dir === 'desc'} onPress={() => setSort(sort.key, 'desc')} />
            </View>
            <View style={{ flex: 1 }}>
              <Chip label="Crescente" icon="arrow-up" active={sort.dir === 'asc'} onPress={() => setSort(sort.key, 'asc')} />
            </View>
          </View>
        ) : null}
      </Sheet>
    </SafeAreaView>
  );
}

function shortSort(key: SortKey): string {
  switch (key) {
    case 'manual': return 'Minha ordem';
    case 'year': return 'Ano';
    case 'recent': return 'Recentes';
    case 'rating': return 'Avaliação';
    case 'title': return 'Título';
    case 'author': return 'Autor';
    case 'size': return 'Tamanho';
    case 'color': return 'Cor';
  }
}
