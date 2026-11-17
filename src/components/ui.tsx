import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { fonts, useTheme } from '../theme';

export type IconName = React.ComponentProps<typeof Ionicons>['name'];

type TxtProps = TextProps & {
  variant?: 'title' | 'heading' | 'serif' | 'italic' | 'body' | 'label' | 'caption' | 'medium';
  color?: string;
  size?: number;
};

export function Txt({ variant = 'body', color, size, style, ...rest }: TxtProps) {
  const t = useTheme();
  const base: Record<NonNullable<TxtProps['variant']>, TextStyle> = {
    title: { fontFamily: fonts.serif, fontSize: 24, color: t.text },
    heading: { fontFamily: fonts.serifMedium, fontSize: 18, color: t.text },
    serif: { fontFamily: fonts.serif, fontSize: 16, color: t.text, lineHeight: 24 },
    italic: { fontFamily: fonts.serifItalic, fontSize: 13, color: t.textSecondary },
    body: { fontFamily: fonts.sans, fontSize: 14, color: t.text },
    medium: { fontFamily: fonts.sansMedium, fontSize: 14, color: t.text },
    label: { fontFamily: fonts.sans, fontSize: 12, color: t.textSecondary },
    caption: { fontFamily: fonts.sans, fontSize: 11, color: t.muted },
  };
  return (
    <Text
      style={[base[variant], color ? { color } : null, size ? { fontSize: size } : null, style]}
      {...rest}
    />
  );
}

export function Icon({ name, size = 20, color }: { name: IconName; size?: number; color?: string }) {
  const t = useTheme();
  return <Ionicons name={name} size={size} color={color ?? t.text} />;
}

export function IconButton({
  name,
  onPress,
  color,
  size = 20,
  label,
}: {
  name: IconName;
  onPress: () => void;
  color?: string;
  size?: number;
  label: string;
}) {
  return (
    <Pressable onPress={onPress} hitSlop={10} accessibilityRole="button" accessibilityLabel={label} style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1, padding: 4 })}>
      <Icon name={name} size={size} color={color} />
    </Pressable>
  );
}

export function Button({
  title,
  onPress,
  variant = 'secondary',
  icon,
  loading,
  style,
  disabled,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  icon?: IconName;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
}) {
  const t = useTheme();
  const bg = variant === 'primary' ? t.accent : 'transparent';
  const fg = variant === 'primary' ? t.onAccent : variant === 'danger' ? t.danger : t.accent;
  const border = variant === 'secondary' ? t.borderStrong : variant === 'danger' ? t.danger : 'transparent';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, borderColor: border, opacity: pressed || disabled ? 0.6 : 1 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} size="small" />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={17} color={fg} /> : null}
          <Text style={{ fontFamily: fonts.sansMedium, fontSize: 14, color: fg }}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

export function Chip({
  label,
  active,
  onPress,
  icon,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
  icon?: IconName;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
      style={[
        styles.chip,
        active
          ? { backgroundColor: t.accent, borderColor: t.accent }
          : { borderColor: t.borderStrong, backgroundColor: 'transparent' },
      ]}
    >
      {icon ? <Ionicons name={icon} size={13} color={active ? t.onAccent : t.accent} /> : null}
      <Text style={{ fontFamily: fonts.sans, fontSize: 12, color: active ? t.onAccent : t.textSecondary }}>{label}</Text>
    </Pressable>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  return <View style={[{ backgroundColor: t.card, borderRadius: 12, padding: 12 }, style]}>{children}</View>;
}

export function Field({ label, style, ...props }: TextInputProps & { label?: string }) {
  const t = useTheme();
  return (
    <View style={{ marginBottom: 12 }}>
      {label ? <Txt variant="label" style={{ marginBottom: 4 }}>{label}</Txt> : null}
      <TextInput
        placeholderTextColor={t.muted}
        style={[
          {
            borderWidth: StyleSheet.hairlineWidth * 2,
            borderColor: t.borderStrong,
            borderRadius: 8,
            paddingHorizontal: 10,
            paddingVertical: 8,
            fontFamily: fonts.sans,
            fontSize: 15,
            color: t.text,
            backgroundColor: t.surface,
          },
          style,
        ]}
        {...props}
      />
    </View>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const t = useTheme();
  return (
    <View style={[styles.segmented, { borderColor: t.borderStrong }]}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={{ flex: 1, paddingVertical: 8, alignItems: 'center', backgroundColor: active ? t.accent : 'transparent' }}
          >
            <Text style={{ fontFamily: fonts.sans, fontSize: 13, color: active ? t.onAccent : t.textSecondary }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function ProgressBar({ value, color }: { value: number; color?: string }) {
  const t = useTheme();
  return (
    <View style={{ height: 6, backgroundColor: t.border, borderRadius: 3, overflow: 'hidden' }}>
      <View style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%`, height: '100%', backgroundColor: color ?? t.gold, borderRadius: 3 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    borderWidth: 1,
  },
  segmented: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
});
