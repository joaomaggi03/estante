import { Ionicons } from '@expo/vector-icons';
import React, { useRef, useState } from 'react';
import { View, type GestureResponderEvent } from 'react-native';
import { useTheme } from '../theme';

type Props = {
  value: number | null;
  onChange?: (v: number) => void;
  size?: number;
};

/** Nota de 0,5 a 5 com meia estrela. Toque ou arraste para escolher. */
export function Stars({ value, onChange, size = 28 }: Props) {
  const t = useTheme();
  const width = useRef(0);
  const [preview, setPreview] = useState<number | null>(null);
  const shown = preview ?? value ?? 0;
  const gap = size * 0.2;

  const valueAt = (e: GestureResponderEvent) => {
    const x = e.nativeEvent.locationX;
    const raw = (x / Math.max(1, width.current)) * 5;
    return Math.max(0.5, Math.min(5, Math.ceil(raw * 2) / 2));
  };

  const interactive = !!onChange;

  return (
    <View
      accessibilityRole={interactive ? 'adjustable' : 'image'}
      accessibilityLabel={value ? `Nota ${value} de 5` : 'Sem nota'}
      accessibilityActions={interactive ? [{ name: 'increment' }, { name: 'decrement' }] : undefined}
      onAccessibilityAction={(e) => {
        if (!onChange) return;
        const cur = value ?? 0;
        if (e.nativeEvent.actionName === 'increment') onChange(Math.min(5, cur + 0.5));
        if (e.nativeEvent.actionName === 'decrement') onChange(Math.max(0.5, cur - 0.5));
      }}
      onLayout={(e) => (width.current = e.nativeEvent.layout.width)}
      onStartShouldSetResponder={() => interactive}
      onMoveShouldSetResponder={() => interactive}
      onResponderGrant={(e) => setPreview(valueAt(e))}
      onResponderMove={(e) => setPreview(valueAt(e))}
      onResponderRelease={(e) => {
        const v = valueAt(e);
        setPreview(null);
        onChange?.(v);
      }}
      onResponderTerminate={() => setPreview(null)}
      style={{ flexDirection: 'row', gap, alignSelf: 'flex-start' }}
    >
      {[1, 2, 3, 4, 5].map((i) => {
        const name = shown >= i ? 'star' : shown >= i - 0.5 ? 'star-half' : 'star-outline';
        return (
          <View key={i} pointerEvents="none">
            <Ionicons name={name} size={size} color={t.gold} />
          </View>
        );
      })}
    </View>
  );
}
