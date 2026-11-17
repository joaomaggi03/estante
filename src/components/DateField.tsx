import DateTimePicker from '@react-native-community/datetimepicker';
import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { formatDate, parseISODate, toISODate, todayISO } from '../lib/dates';
import { useTheme } from '../theme';
import { Icon, IconButton, Txt } from './ui';

type Props = {
  label: string;
  value: string | null;
  onChange: (v: string | null) => void;
  clearable?: boolean;
};

export function DateField({ label, value, onChange, clearable = true }: Props) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <View style={{ marginBottom: 12 }}>
      <Txt variant="label" style={{ marginBottom: 4 }}>{label}</Txt>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Pressable
          onPress={() => setOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={`${label}: ${value ? formatDate(value) : 'sem data'}`}
          style={{
            flex: 1,
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderWidth: StyleSheet.hairlineWidth * 2,
            borderColor: t.borderStrong,
            borderRadius: 8,
            paddingHorizontal: 10,
            paddingVertical: 9,
            backgroundColor: t.surface,
          }}
        >
          <Txt color={value ? t.text : t.muted}>{value ? formatDate(value) : 'Escolher data'}</Txt>
          <Icon name="calendar-outline" size={18} color={t.muted} />
        </Pressable>
        {clearable && value ? <IconButton name="close" label={`Limpar ${label}`} onPress={() => onChange(null)} color={t.muted} /> : null}
      </View>
      {open ? (
        <DateTimePicker
          value={parseISODate(value ?? todayISO())}
          mode="date"
          maximumDate={new Date(2100, 0, 1)}
          onChange={(event, date) => {
            setOpen(false);
            if (event.type === 'set' && date) onChange(toISODate(date));
          }}
        />
      ) : null}
    </View>
  );
}
