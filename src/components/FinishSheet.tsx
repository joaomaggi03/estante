import React, { useState } from 'react';
import { View } from 'react-native';
import { updateBook } from '../db/repo';
import type { Book } from '../db/types';
import { todayISO } from '../lib/dates';
import { useTheme } from '../theme';
import { DateField } from './DateField';
import { Sheet } from './Sheet';
import { Stars } from './Stars';
import { Button, Field } from './ui';

type Props = {
  book: Book | null;
  onClose: () => void;
  onDone?: (book: Book) => void;
};

/** Painel "Terminou?": nota, resenha e data de término. */
export function FinishSheet({ book, onClose, onDone }: Props) {
  return (
    <Sheet visible={!!book} onClose={onClose} title="Terminou?" subtitle={book?.title}>
      {/* key: o formulário recomeça do zero a cada livro. */}
      {book ? <FinishForm key={book.id} book={book} onClose={onClose} onDone={onDone} /> : null}
    </Sheet>
  );
}

function FinishForm({ book, onClose, onDone }: Props & { book: Book }) {
  const t = useTheme();
  const [rating, setRating] = useState<number | null>(book.rating);
  const [review, setReview] = useState(book.review ?? '');
  const [endDate, setEndDate] = useState<string | null>(todayISO());

  const save = () => {
    const updated = updateBook(book.id, {
      status: 'read',
      rating,
      review: review.trim() || null,
      endDate: endDate ?? todayISO(),
    });
    onClose();
    if (updated) onDone?.(updated);
  };

  return (
    <>
      <View style={{ marginBottom: 14 }}>
        <Stars value={rating} onChange={setRating} size={34} />
      </View>
      <Field
        placeholder="O que achou do livro…"
        value={review}
        onChangeText={setReview}
        multiline
        style={{ minHeight: 90, textAlignVertical: 'top', fontFamily: 'Lora_400Regular_Italic', color: t.text }}
      />
      <DateField label="Terminado em" value={endDate} onChange={setEndDate} clearable={false} />
      <Button title="Colocar na estante" variant="primary" icon="library-outline" onPress={save} />
    </>
  );
}
