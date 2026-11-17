import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, TextInput, View, type LayoutChangeEvent } from 'react-native';
import { GestureDetector, ScrollView, usePanGesture } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { createShelf, deleteShelf, moveBookTo, moveShelf, renameShelf } from '../db/repo';
import type { Book, BookStatus } from '../db/types';
import { chunkRows, type ShelfGroup } from '../lib/shelving';
import { hashString, SHELF_HEIGHT, spineWidth } from '../lib/spine';
import { fonts, useTheme } from '../theme';
import { Spine } from './Spine';
import { Button, IconButton, Txt } from './ui';

const ROW_PAD = 10;
const GAP = 2;
const LEAN_COLORS = ['#9C4A2A', '#2F4A3A', '#3D3470', '#8A5A2B', '#1F3A5A'];

type ViewRef = React.ComponentRef<typeof View>;
type RowMeta = { key: string; shelfId: string | null; startIndex: number; books: Book[] };
type Rect = { x: number; y: number; w: number; h: number };
type DropTarget = { rowKey: string; shelfId: string | null; index: number; localIndex: number };

type Props = {
  groups: ShelfGroup[];
  status: BookStatus;
  editing: boolean;
  selectedId?: string | null;
  onSelect?: (book: Book) => void;
  header?: React.ReactNode;
  emptyText?: string;
};

export function Bookshelf({ groups, status, editing, selectedId, onSelect, header, emptyText }: Props) {
  const t = useTheme();
  const [width, setWidth] = useState(0);
  const rowsRef = useRef(new Map<string, RowMeta>());
  const viewsRef = useRef(new Map<string, ViewRef | null>());
  const rectsRef = useRef(new Map<string, Rect>());
  const rootRef = useRef<ViewRef>(null);
  const rootX = useSharedValue(0);
  const rootY = useSharedValue(0);
  const [dragging, setDragging] = useState<Book | null>(null);
  const [target, setTarget] = useState<DropTarget | null>(null);
  const targetRef = useRef<DropTarget | null>(null);
  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);

  const innerWidth = Math.max(0, width - ROW_PAD * 2);

  // Divide cada grupo em fileiras que cabem na largura e guarda onde cada fileira começa.
  const layout = useMemo(
    () =>
      groups.map((g) => {
        let start = 0;
        const rows: RowMeta[] = chunkRows(g.books, spineWidth, innerWidth, GAP).map((books, ri) => {
          const meta = { key: `${g.key}:${ri}`, shelfId: g.shelfId ?? null, startIndex: start, books };
          start += books.length;
          return meta;
        });
        return { group: g, rows };
      }),
    [groups, innerWidth],
  );

  useEffect(() => {
    rowsRef.current = new Map(layout.flatMap((l) => l.rows.map((r) => [r.key, r] as const)));
  }, [layout]);

  const measureRows = useCallback(() => {
    rootRef.current?.measureInWindow((x, y) => {
      rootX.set(x);
      rootY.set(y);
    });
    rectsRef.current.clear();
    rowsRef.current.forEach((_meta, key) => {
      viewsRef.current.get(key)?.measureInWindow((x, y, w, h) => rectsRef.current.set(key, { x, y, w, h }));
    });
  }, [rootX, rootY]);

  const computeTarget = useCallback((absX: number, absY: number, book: Book): DropTarget | null => {
    let best: { key: string; dist: number } | null = null;
    rectsRef.current.forEach((r, key) => {
      const dist = absY < r.y ? r.y - absY : absY > r.y + r.h ? absY - (r.y + r.h) : 0;
      if (!best || dist < best.dist) best = { key, dist };
    });
    if (!best) return null;
    const { key } = best as { key: string; dist: number };
    const meta = rowsRef.current.get(key);
    const rect = rectsRef.current.get(key);
    if (!meta || !rect) return null;
    let cursor = rect.x + ROW_PAD;
    let local = 0;
    for (const b of meta.books) {
      const w = spineWidth(b);
      if (absX < cursor + w / 2) break;
      cursor += w + GAP;
      local++;
    }
    let index = meta.startIndex + local;
    // Se o livro sai de antes do ponto de inserção na mesma prateleira, o índice anda uma casa.
    if (book.shelfId === meta.shelfId || (book.shelfId == null && meta.shelfId == null)) {
      const all = [...rowsRef.current.values()].filter((m) => m.shelfId === meta.shelfId).flatMap((m) => m.books);
      const from = all.findIndex((b) => b.id === book.id);
      if (from >= 0 && from < index) index -= 1;
    }
    return { rowKey: key, shelfId: meta.shelfId, index, localIndex: local };
  }, []);

  const startDrag = useCallback(
    (book: Book, x: number, y: number) => {
      measureRows();
      dragX.set(x);
      dragY.set(y);
      setDragging(book);
    },
    [measureRows, dragX, dragY],
  );

  const moveDrag = useCallback(
    (book: Book, x: number, y: number) => {
      dragX.set(x);
      dragY.set(y);
      const next = computeTarget(x, y, book);
      const prev = targetRef.current;
      if (next?.rowKey !== prev?.rowKey || next?.localIndex !== prev?.localIndex) {
        targetRef.current = next;
        setTarget(next);
      }
    },
    [computeTarget, dragX, dragY],
  );

  const endDrag = useCallback((book: Book, canceled: boolean) => {
    const tg = targetRef.current;
    if (!canceled && tg) moveBookTo(book.id, tg.shelfId, tg.index);
    targetRef.current = null;
    setTarget(null);
    setDragging(null);
  }, []);

  const overlayStyle = useAnimatedStyle(() => ({
    position: 'absolute',
    left: dragX.value - rootX.value - 14,
    top: dragY.value - rootY.value - 90,
    transform: [{ rotate: '-6deg' }, { scale: 1.08 }],
  }));

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  const total = groups.reduce((n, g) => n + g.books.length, 0);

  return (
    <View ref={rootRef} style={{ flex: 1 }} collapsable={false}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 140 }} scrollEnabled={!dragging} keyboardShouldPersistTaps="handled">
        {header}
        <View onLayout={onLayout}>
          {width > 0 && total === 0 && !editing ? (
            <Txt variant="italic" style={{ marginTop: 24, textAlign: 'center' }}>{emptyText ?? 'Nenhum livro aqui ainda.'}</Txt>
          ) : null}
          {width > 0 &&
            layout.map(({ group: g, rows }, gi) => {
              const isShelf = editing && g.shelfId != null;
              return (
                <View key={g.key} style={{ marginTop: 14 }}>
                  {isShelf ? (
                    <ShelfHeader
                      name={g.label}
                      first={gi === 0 || (gi === 1 && groups[0].shelfId == null)}
                      last={gi === groups.length - 1}
                      onRename={(n) => renameShelf(g.shelfId!, n)}
                      onMove={(d) => moveShelf(status, g.shelfId!, d)}
                      onDelete={() =>
                        Alert.alert('Excluir prateleira?', `Os livros de "${g.label}" vão para Recém-chegados.`, [
                          { text: 'Cancelar', style: 'cancel' },
                          { text: 'Excluir', style: 'destructive', onPress: () => deleteShelf(g.shelfId!) },
                        ])
                      }
                    />
                  ) : g.label ? (
                    <Txt variant="italic" style={{ marginBottom: 4 }}>{g.label}</Txt>
                  ) : null}
                  {rows.map(({ key: rowKey, books: row }, ri) => {
                    const used = row.reduce((s, b) => s + spineWidth(b) + GAP, 0);
                    const lean = !editing && ri === rows.length - 1 && innerWidth - used > 46;
                    return (
                      <View key={rowKey} style={{ marginTop: ri ? 10 : 0 }}>
                        <View
                          ref={(v) => {
                            viewsRef.current.set(rowKey, v);
                          }}
                          collapsable={false}
                          style={{
                            height: SHELF_HEIGHT,
                            backgroundColor: t.shelfBack,
                            borderTopLeftRadius: 8,
                            borderTopRightRadius: 8,
                            paddingHorizontal: ROW_PAD,
                            flexDirection: 'row',
                            alignItems: 'flex-end',
                            gap: GAP,
                          }}
                        >
                          {row.map((b, bi) => (
                            <React.Fragment key={b.id}>
                              {target?.rowKey === rowKey && target.localIndex === bi ? <DropIndicator /> : null}
                              {editing ? (
                                <DraggableSpine book={b} dim={dragging?.id === b.id} onStart={startDrag} onMove={moveDrag} onEnd={endDrag} />
                              ) : (
                                <Pressable onPress={() => onSelect?.(b)} accessibilityRole="button" accessibilityLabel={b.title}>
                                  <Spine book={b} highlight={selectedId === b.id ? t.gold : undefined} />
                                </Pressable>
                              )}
                            </React.Fragment>
                          ))}
                          {target?.rowKey === rowKey && target.localIndex >= row.length ? <DropIndicator /> : null}
                          {lean ? (
                            <View
                              style={{
                                width: 26,
                                height: 86,
                                marginLeft: 8,
                                borderTopLeftRadius: 2,
                                borderTopRightRadius: 2,
                                backgroundColor: LEAN_COLORS[hashString(g.key) % LEAN_COLORS.length],
                                transform: [{ translateX: 10 }, { translateY: -4 }, { rotate: '-14deg' }],
                              }}
                            />
                          ) : null}
                        </View>
                        <Plank />
                      </View>
                    );
                  })}
                </View>
              );
            })}
          {editing ? (
            <Button
              title="Nova prateleira"
              icon="add"
              style={{ marginTop: 16, borderStyle: 'dashed' }}
              onPress={() => createShelf(status, 'Nova prateleira')}
            />
          ) : null}
        </View>
      </ScrollView>
      {dragging ? (
        <Animated.View pointerEvents="none" style={overlayStyle}>
          <Spine book={dragging} highlight={t.gold} />
        </Animated.View>
      ) : null}
    </View>
  );
}

function Plank() {
  const t = useTheme();
  return (
    <View style={{ height: 11, backgroundColor: t.plank, borderRadius: 4, marginTop: -2, overflow: 'hidden' }}>
      <View style={{ height: 1.5, backgroundColor: t.plankLight, opacity: 0.8, marginTop: 1 }} />
    </View>
  );
}

function DropIndicator() {
  const t = useTheme();
  return <View style={{ width: 3, height: 96, backgroundColor: t.gold, borderRadius: 2, marginHorizontal: 1 }} />;
}

function DraggableSpine({
  book,
  dim,
  onStart,
  onMove,
  onEnd,
}: {
  book: Book;
  dim: boolean;
  onStart: (b: Book, x: number, y: number) => void;
  onMove: (b: Book, x: number, y: number) => void;
  onEnd: (b: Book, canceled: boolean) => void;
}) {
  const active = useRef(false);
  const pan = usePanGesture({
    activateAfterLongPress: 280,
    runOnJS: true,
    onActivate: (e) => {
      active.current = true;
      onStart(book, e.absoluteX, e.absoluteY);
    },
    onUpdate: (e) => {
      if (active.current) onMove(book, e.absoluteX, e.absoluteY);
    },
    onFinalize: (e) => {
      if (active.current) onEnd(book, e.canceled);
      active.current = false;
    },
  });
  return (
    <GestureDetector gesture={pan}>
      <View collapsable={false} accessibilityLabel={`${book.title}. Segure e arraste para mover.`}>
        <Spine book={book} dim={dim} />
      </View>
    </GestureDetector>
  );
}

function ShelfHeader({
  name,
  first,
  last,
  onRename,
  onMove,
  onDelete,
}: {
  name: string;
  first: boolean;
  last: boolean;
  onRename: (n: string) => void;
  onMove: (d: -1 | 1) => void;
  onDelete: () => void;
}) {
  const t = useTheme();
  const [value, setValue] = useState(name);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
      <TextInput
        value={value}
        onChangeText={setValue}
        onEndEditing={() => {
          const v = value.trim();
          if (v && v !== name) onRename(v);
          else setValue(name);
        }}
        accessibilityLabel="Nome da prateleira"
        style={{
          flex: 1,
          fontFamily: fonts.serifItalic,
          fontSize: 14,
          color: t.textSecondary,
          borderBottomWidth: 1,
          borderStyle: 'dashed',
          borderBottomColor: t.borderStrong,
          paddingVertical: 2,
        }}
      />
      <IconButton name="chevron-up" label="Subir prateleira" size={18} color={first ? t.border : t.textSecondary} onPress={() => !first && onMove(-1)} />
      <IconButton name="chevron-down" label="Descer prateleira" size={18} color={last ? t.border : t.textSecondary} onPress={() => !last && onMove(1)} />
      <IconButton name="trash-outline" label="Excluir prateleira" size={17} color={t.danger} onPress={onDelete} />
    </View>
  );
}
