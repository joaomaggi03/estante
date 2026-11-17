import { router, Stack, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { Alert, ScrollView, TextInput, View } from 'react-native';
import { FinishSheet } from '../../../components/FinishSheet';
import { Cover } from '../../../components/Cover';
import { Stars } from '../../../components/Stars';
import { Button, Card, IconButton, Txt } from '../../../components/ui';
import { useBook } from '../../../db/hooks';
import { deleteBook, updateBook } from '../../../db/repo';
import { STATUS_LABEL, type Book } from '../../../db/types';
import { daysBetween, formatDate, todayISO } from '../../../lib/dates';
import { deleteImage } from '../../../lib/images';
import { fonts, useTheme } from '../../../theme';

function Info({ label, value }: { label: string; value: string }) {
  return (
    <Card style={{ flex: 1, padding: 10 }}>
      <Txt variant="caption">{label}</Txt>
      <Txt variant="medium" size={13}>{value}</Txt>
    </Card>
  );
}

/** Resenha editável direto na tela; salva ao sair do campo. */
function ReviewEditor({ book }: { book: Book }) {
  const t = useTheme();
  const [review, setReview] = useState(book.review ?? '');
  const save = () => {
    const v = review.trim() || null;
    if (v !== (book.review ?? null)) updateBook(book.id, { review: v });
  };
  return (
    <TextInput
      value={review}
      onChangeText={setReview}
      onBlur={save}
      multiline
      placeholder="Toque para escrever o que achou…"
      placeholderTextColor={t.muted}
      style={{ fontFamily: fonts.serif, fontSize: 16, lineHeight: 25, color: t.text, textAlignVertical: 'top', minHeight: 80, padding: 0 }}
    />
  );
}

export default function BookDetailScreen() {
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const book = useBook(id);
  const [finishing, setFinishing] = useState<Book | null>(null);

  if (!book) {
    return <Txt style={{ padding: 16 }}>Livro não encontrado.</Txt>;
  }

  const confirmDelete = () => {
    Alert.alert('Excluir livro?', `"${book.title}" será removido da estante. Isso não pode ser desfeito.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: () => {
          deleteImage(book.coverPath);
          deleteImage(book.spinePhotoPath);
          deleteBook(book.id);
          router.back();
        },
      },
    ]);
  };

  const duration =
    book.startDate && (book.endDate || book.status === 'reading')
      ? `${daysBetween(book.startDate, book.endDate ?? todayISO())} dias`
      : '—';
  const badge = book.status === 'read' ? { bg: t.successBg, fg: t.success } : { bg: t.card, fg: t.textSecondary };

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <View style={{ flexDirection: 'row', gap: 14 }}>
              <IconButton name="create-outline" label="Editar livro" onPress={() => router.push({ pathname: '/livro/[id]/editar', params: { id: book.id } })} />
              <IconButton name="trash-outline" label="Excluir livro" color={t.danger} onPress={confirmDelete} />
            </View>
          ),
        }}
      />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: 'row', gap: 14, alignItems: 'flex-end' }}>
          <Cover book={book} width={110} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Txt variant="title" size={21} numberOfLines={4}>{book.title}</Txt>
            {book.author ? <Txt variant="italic" style={{ marginBottom: 8 }}>{book.author}</Txt> : null}
            <View style={{ alignSelf: 'flex-start', backgroundColor: badge.bg, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 }}>
              <Txt variant="caption" color={badge.fg}>{STATUS_LABEL[book.status]}</Txt>
            </View>
          </View>
        </View>

        {book.status === 'read' ? (
          <View style={{ marginTop: 18 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Stars value={book.rating} onChange={(v) => updateBook(book.id, { rating: v })} />
              {book.rating ? <Txt variant="medium" size={16}>{String(book.rating).replace('.', ',')}</Txt> : null}
            </View>
            <Txt variant="caption" style={{ marginTop: 4 }}>Toque ou arraste nas estrelas</Txt>
          </View>
        ) : null}

        <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
          {book.status !== 'want' ? <Info label="Início" value={formatDate(book.startDate)} /> : <Info label="Adicionado" value={formatDate(book.createdAt.slice(0, 10))} />}
          {book.status === 'read' ? <Info label="Término" value={formatDate(book.endDate)} /> : null}
          {book.status !== 'want' ? <Info label="Duração" value={duration} /> : null}
          {book.pageCount ? <Info label="Páginas" value={String(book.pageCount)} /> : null}
        </View>

        {book.status === 'reading' ? (
          <Button title="Terminei" icon="checkmark" variant="primary" style={{ marginTop: 16 }} onPress={() => setFinishing(book)} />
        ) : null}
        {book.status === 'want' ? (
          <Button title="Começar a ler" icon="book-outline" variant="primary" style={{ marginTop: 16 }} onPress={() => updateBook(book.id, { status: 'reading' })} />
        ) : null}

        {book.status === 'read' ? (
          <>
            <Txt variant="heading" size={16} style={{ marginTop: 22, marginBottom: 6 }}>Minha resenha</Txt>
            {/* key: recomeça do texto salvo quando a resenha muda por fora (ex.: painel "Terminei"). */}
            <ReviewEditor key={`${book.id}:${book.review ?? ''}`} book={book} />
          </>
        ) : null}

        {book.isbn ? <Txt variant="caption" style={{ marginTop: 24, textAlign: 'center' }}>ISBN {book.isbn}</Txt> : null}
      </ScrollView>
      <FinishSheet book={finishing} onClose={() => setFinishing(null)} />
    </>
  );
}
