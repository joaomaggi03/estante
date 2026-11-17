import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, View } from 'react-native';
import { applyStatusRules, createBook, findDuplicate, getBook, updateBook, type BookDraft } from '../db/repo';
import type { Book, BookStatus } from '../db/types';
import { attachCoverInBackground, deleteImage, extractColor, saveLocalImage } from '../lib/images';
import type { LookupResult } from '../lib/lookup';
import { chooseImage, takePhoto } from '../lib/pickers';
import { useTheme } from '../theme';
import { Cover } from './Cover';
import { DateField } from './DateField';
import { Spine } from './Spine';
import { Stars } from './Stars';
import { Button, Field, Icon, Segmented, Txt } from './ui';

type Props = {
  existing?: Book | null;
  initial?: Partial<BookDraft> | null;
  /** Busca ainda em andamento que pode completar autor, páginas e capa. */
  pending?: Promise<LookupResult | null> | null;
  source?: string | null;
};

/** Completa no banco os campos que ficaram vazios, quando a busca lenta termina depois de salvar. */
function fillMissingLater(bookId: string, pending: Promise<LookupResult | null>) {
  pending.then((full) => {
    const b = full ? getBook(bookId) : null;
    if (!b || !full) return;
    const patch: Partial<Book> = {};
    if (!b.author && full.author) patch.author = full.author;
    if (!b.pageCount && full.pageCount) patch.pageCount = full.pageCount;
    const newCover = !b.coverPath && !b.coverUrl && full.coverUrl ? full.coverUrl : null;
    if (newCover) patch.coverUrl = newCover;
    if (Object.keys(patch).length) updateBook(bookId, patch);
    if (newCover) attachCoverInBackground(bookId, { coverUrl: newCover, needColor: !b.spineColor }, updateBook);
  });
}

const STATUS_OPTIONS: { value: BookStatus; label: string }[] = [
  { value: 'want', label: 'Quero ler' },
  { value: 'reading', label: 'Lendo' },
  { value: 'read', label: 'Lido' },
];

export function BookForm({ existing, initial, pending, source }: Props) {
  const t = useTheme();
  const start = existing ?? initial ?? {};
  const [title, setTitle] = useState(start.title ?? '');
  const [author, setAuthor] = useState(start.author ?? '');
  const [pages, setPages] = useState(start.pageCount ? String(start.pageCount) : '');
  const [isbn, setIsbn] = useState(start.isbn ?? '');
  const [status, setStatus] = useState<BookStatus>(start.status ?? 'want');
  const [startDate, setStartDate] = useState<string | null>(start.startDate ?? null);
  const [endDate, setEndDate] = useState<string | null>(start.endDate ?? null);
  const [rating, setRating] = useState<number | null>(start.rating ?? null);
  const [review, setReview] = useState(start.review ?? '');
  const [coverUrl, setCoverUrl] = useState<string | null>(start.coverUrl ?? null);
  const [coverPath, setCoverPath] = useState<string | null>(start.coverPath ?? null);
  const [spineColor, setSpineColor] = useState<string | null>(start.spineColor ?? null);
  const [spinePhoto, setSpinePhoto] = useState<string | null>(start.spinePhotoPath ?? null);
  const [saving, setSaving] = useState(false);
  const [loadingMore, setLoadingMore] = useState(!!pending);
  const [extraSource, setExtraSource] = useState<string | null>(null);
  const coverPathRef = useRef(coverPath);
  useEffect(() => {
    coverPathRef.current = coverPath;
  }, [coverPath]);

  // Quando as fontes lentas terminam, preenche só os campos que ainda estão vazios.
  useEffect(() => {
    if (!pending) return;
    let alive = true;
    pending.then((full) => {
      if (!alive) return;
      setLoadingMore(false);
      if (!full) return;
      setAuthor((a) => a || full.author || '');
      setPages((p) => p || (full.pageCount ? String(full.pageCount) : ''));
      if (!coverPathRef.current) setCoverUrl((c) => c ?? full.coverUrl);
      setExtraSource(full.source);
    });
    return () => {
      alive = false;
    };
  }, [pending]);

  const changeStatus = (s: BookStatus) => {
    const next = applyStatusRules({ status: s, startDate, endDate }, status);
    setStatus(s);
    setStartDate(next.startDate ?? null);
    setEndDate(next.endDate ?? null);
  };

  const changeCover = async () => {
    const uri = await chooseImage('Capa do livro', [2, 3]);
    if (!uri) return;
    const saved = await saveLocalImage(uri, 'capa');
    setCoverPath(saved);
    setCoverUrl(null);
    setSpineColor(await extractColor(saved));
  };

  const shootSpine = async () => {
    const uri = await takePhoto(true);
    if (!uri) return;
    setSpinePhoto(await saveLocalImage(uri, 'lombada'));
  };

  const doSave = async () => {
    setSaving(true);
    try {
      // A capa é baixada (e a cor extraída) depois de salvar, em segundo plano.
      const finalCoverPath = coverPath;
      const finalColor = spineColor;

      const pageCount = pages ? parseInt(pages, 10) || null : null;
      const data: BookDraft = {
        title: title.trim(),
        author: author.trim() || null,
        isbn: isbn.replace(/[^0-9Xx]/g, '') || null,
        status,
        startDate: status === 'want' ? null : startDate,
        endDate: status === 'read' ? endDate : null,
        rating: status === 'read' ? rating : null,
        review: status === 'read' ? review.trim() || null : null,
        coverUrl,
        coverPath: finalCoverPath,
        pageCount,
        spineColor: finalColor,
        spinePhotoPath: spinePhoto,
      };

      if (existing) {
        if (existing.coverPath && existing.coverPath !== finalCoverPath) deleteImage(existing.coverPath);
        if (existing.spinePhotoPath && existing.spinePhotoPath !== spinePhoto) deleteImage(existing.spinePhotoPath);
        updateBook(existing.id, data);
        attachCoverInBackground(existing.id, { coverUrl, coverPath: finalCoverPath, needColor: !finalColor }, updateBook);
        router.back();
      } else {
        const book = createBook(data);
        attachCoverInBackground(book.id, { coverUrl, coverPath: finalCoverPath, needColor: !finalColor }, updateBook);
        // Salvou antes de a busca terminar: o que chegar depois completa o livro já salvo.
        if (pending && loadingMore) fillMissingLater(book.id, pending);
        router.replace({ pathname: '/livro/[id]', params: { id: book.id } });
      }
    } finally {
      setSaving(false);
    }
  };

  const save = () => {
    if (!title.trim()) {
      Alert.alert('Falta o título', 'Digite o título do livro para salvar.');
      return;
    }
    if (!existing) {
      const dup = findDuplicate(isbn.replace(/[^0-9Xx]/g, ''), title, author);
      if (dup) {
        Alert.alert('Esse livro já está na estante', `"${dup.title}" já foi cadastrado.`, [
          { text: 'Abrir o existente', onPress: () => router.replace({ pathname: '/livro/[id]', params: { id: dup.id } }) },
          { text: 'Cadastrar mesmo assim', onPress: doSave },
          { text: 'Cancelar', style: 'cancel' },
        ]);
        return;
      }
    }
    doSave();
  };

  const previewBook = { title: title || 'Título', author, coverPath: coverPath ?? coverUrl, spineColor, spinePhotoPath: spinePhoto, pageCount: pages ? parseInt(pages, 10) || null : null };

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
      <View style={{ flexDirection: 'row', gap: 12, marginBottom: 4 }}>
        <Pressable onPress={changeCover} accessibilityRole="button" accessibilityLabel="Trocar capa">
          <Cover book={previewBook} width={84} />
          <View style={{ position: 'absolute', right: 4, bottom: 4, backgroundColor: t.overlay, borderRadius: 12, padding: 4 }}>
            <Icon name="camera-outline" size={14} color="#F5ECD9" />
          </View>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Field label="Título" value={title} onChangeText={setTitle} placeholder="O nome do vento" />
          <Field label="Autor" value={author} onChangeText={setAuthor} placeholder="Patrick Rothfuss" />
        </View>
      </View>

      {loadingMore ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
          <ActivityIndicator size="small" color={t.muted} />
          <Txt variant="caption">Buscando autor, páginas e capa em outras fontes…</Txt>
        </View>
      ) : null}

      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Field label="Páginas" value={pages} onChangeText={(v) => setPages(v.replace(/\D/g, ''))} keyboardType="number-pad" placeholder="320" />
        </View>
        <View style={{ flex: 1.4 }}>
          <Field label="ISBN" value={isbn} onChangeText={setIsbn} keyboardType="number-pad" placeholder="9788599296493" />
        </View>
      </View>

      <Txt variant="label" style={{ marginBottom: 4 }}>Status</Txt>
      <View style={{ marginBottom: 12 }}>
        <Segmented options={STATUS_OPTIONS} value={status} onChange={changeStatus} />
      </View>

      {status !== 'want' ? <DateField label="Início da leitura" value={startDate} onChange={setStartDate} /> : null}
      {status === 'read' ? (
        <>
          <DateField label="Término" value={endDate} onChange={setEndDate} />
          <Txt variant="label" style={{ marginBottom: 6 }}>Nota</Txt>
          <View style={{ marginBottom: 12 }}>
            <Stars value={rating} onChange={setRating} />
          </View>
          <Field
            label="Minha resenha"
            value={review}
            onChangeText={setReview}
            multiline
            placeholder="O que achou do livro…"
            style={{ minHeight: 100, textAlignVertical: 'top', fontFamily: 'Lora_400Regular' }}
          />
        </>
      ) : null}

      <Txt variant="label" style={{ marginBottom: 6 }}>Lombada</Txt>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 12, marginBottom: 20 }}>
        <Spine book={previewBook} />
        <View style={{ flex: 1, gap: 6 }}>
          <Txt variant="label">{spinePhoto ? 'Foto da lombada real' : spineColor ? 'Cor tirada da capa' : 'Cor gerada pelo título'}</Txt>
          <Button title={spinePhoto ? 'Fotografar de novo' : 'Fotografar a lombada real'} icon="camera-outline" variant="ghost" onPress={shootSpine} style={{ alignSelf: 'flex-start', paddingHorizontal: 0 }} />
          {spinePhoto ? (
            <Button title="Usar lombada gerada" variant="ghost" onPress={() => setSpinePhoto(null)} style={{ alignSelf: 'flex-start', paddingHorizontal: 0 }} />
          ) : null}
        </View>
      </View>

      <Button title="Salvar" variant="primary" onPress={save} loading={saving} />
      {extraSource ?? source ? (
        <Txt variant="caption" style={{ textAlign: 'center', marginTop: 10 }}>Dados de {extraSource ?? source} · tudo editável</Txt>
      ) : null}
    </ScrollView>
  );
}
