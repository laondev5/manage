import { useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  type TextInputProps,
  View,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import logoSource from '../../assets/logo.png';
import { IconAlert, IconArrowLeft, IconCheck, IconInfo, IconRefresh } from './icons';

export const shadowSoft = {
  shadowColor: '#101D35',
  shadowOpacity: 0.07,
  shadowRadius: 18,
  shadowOffset: { width: 0, height: 8 },
  elevation: 3,
};

export const shadowFloat = {
  shadowColor: '#101D35',
  shadowOpacity: 0.14,
  shadowRadius: 24,
  shadowOffset: { width: 0, height: 10 },
  elevation: 12,
};

export function cx(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ');
}

export function Screen({
  children,
  scroll = true,
  refreshing = false,
  onRefresh,
  footer,
}: {
  children: ReactNode;
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  footer?: ReactNode;
}) {
  const body = scroll ? (
    <ScrollView
      contentContainerStyle={{ paddingBottom: footer ? 108 : 124 }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2457D6" colors={['#2457D6']} />
        ) : undefined
      }
    >
      {children}
    </ScrollView>
  ) : (
    <View className="flex-1">{children}</View>
  );
  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        {body}
        {footer}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function Header({
  title,
  subtitle,
  right,
  onBack,
  eyebrow,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  onBack?: () => void;
  eyebrow?: string;
}) {
  return (
    <View className="px-5 pb-2 pt-2">
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-2.5">
          {onBack ? (
            <Pressable
              onPress={onBack}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              className="h-10 w-10 items-center justify-center rounded-full bg-white"
              style={shadowSoft}
            >
              <IconArrowLeft size={18} color="#14213D" />
            </Pressable>
          ) : (
            <Image source={logoSource} style={{ height: 21, width: 21 * (1900 / 449) }} resizeMode="contain" />
          )}
        </View>
        {right}
      </View>
      {eyebrow ? (
        <Text className="mt-6 text-[11px] font-bold uppercase tracking-[1.4px] text-faint">{eyebrow}</Text>
      ) : null}
      <Text className={cx('text-[30px] font-bold leading-[36px] tracking-[-0.6px] text-ink', eyebrow ? 'mt-1.5' : 'mt-5')}>
        {title}
      </Text>
      {subtitle ? (
        <Text className="mt-1.5 text-[13.5px] leading-5 text-muted">{subtitle}</Text>
      ) : null}
    </View>
  );
}

export function Card({
  children,
  className,
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: object;
}) {
  return (
    <View className={cx('rounded-[24px] bg-white', className)} style={[shadowSoft, style]}>
      {children}
    </View>
  );
}

/** A navy feature panel, with the soft ring motif from the reference design. */
export function HeroCard({
  children,
  className,
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: object;
}) {
  return (
    <View
      className={cx('overflow-hidden rounded-[26px] bg-navy', className)}
      style={[shadowFloat, style]}
    >
      <View
        pointerEvents="none"
        className="absolute -right-16 -top-20 h-56 w-56 rounded-full border border-white/10"
      />
      <View
        pointerEvents="none"
        className="absolute -bottom-24 -left-10 h-48 w-48 rounded-full border border-white/5"
      />
      {children}
    </View>
  );
}

export function ProgressRing({
  progress,
  size = 74,
  stroke = 7,
  color = '#FFFFFF',
  track = 'rgba(255,255,255,0.18)',
  children,
}: {
  progress: number;
  size?: number;
  stroke?: number;
  color?: string;
  track?: string;
  children?: ReactNode;
}) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(1, progress));
  return (
    <View style={{ width: size, height: size }} className="items-center justify-center">
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={radius} stroke={track} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={circumference * (1 - clamped)}
          strokeLinecap="round"
        />
      </Svg>
      {children}
    </View>
  );
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <View className="mb-3 mt-6 flex-row items-center justify-between">
      <Text className="text-[11px] font-bold uppercase tracking-[1.3px] text-faint">{children}</Text>
      {right}
    </View>
  );
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'navy';

export function Button({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  icon,
  size = 'md',
  block = true,
}: {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  block?: boolean;
}) {
  const container =
    variant === 'primary'
      ? 'bg-cobalt'
      : variant === 'navy'
        ? 'bg-navy'
        : variant === 'danger'
          ? 'bg-danger-soft border border-danger-border'
          : variant === 'secondary'
            ? 'bg-white border border-line-strong'
            : 'bg-transparent';
  const text =
    variant === 'primary' || variant === 'navy'
      ? 'text-white'
      : variant === 'danger'
        ? 'text-danger'
        : variant === 'secondary'
          ? 'text-ink'
          : 'text-cobalt';
  const height = size === 'lg' ? 'h-[56px]' : size === 'sm' ? 'h-9' : 'h-[52px]';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      className={cx(
        'flex-row items-center justify-center gap-2 rounded-[17px] px-5',
        height,
        container,
        block && 'w-full',
        (disabled || loading) && 'opacity-50',
      )}
      style={variant === 'primary' || variant === 'navy' ? shadowSoft : undefined}
    >
      {loading ? (
        <ActivityIndicator size="small" color={variant === 'primary' || variant === 'navy' ? '#fff' : '#2457D6'} />
      ) : (
        icon
      )}
      <Text className={cx('text-[15px] font-semibold', text, size === 'sm' && 'text-[13px]')}>{label}</Text>
    </Pressable>
  );
}

export function Field({
  label,
  hint,
  error,
  children,
  optional = false,
}: {
  label: string;
  hint?: string;
  error?: string | null;
  children: ReactNode;
  optional?: boolean;
}) {
  return (
    <View className="mb-4">
      <View className="mb-2 flex-row items-baseline justify-between">
        <Text className="text-[13px] font-semibold text-ink">{label}</Text>
        {optional ? <Text className="text-[11.5px] text-faint">Optional</Text> : null}
      </View>
      {children}
      {error ? <Text className="mt-1.5 text-[12px] text-danger">{error}</Text> : null}
      {!error && hint ? <Text className="mt-1.5 text-[11.5px] leading-4 text-faint">{hint}</Text> : null}
    </View>
  );
}

export function Input({
  error,
  secure = false,
  ...rest
}: TextInputProps & { error?: boolean; secure?: boolean }) {
  return (
    <TextInput
      {...rest}
      secureTextEntry={secure}
      placeholderTextColor="#98A4B8"
      className={cx(
        'h-[52px] w-full rounded-[16px] bg-white px-4 text-[15px] text-ink',
        error ? 'border border-danger' : 'border border-transparent',
      )}
      style={[{ borderWidth: error ? 1 : 0 }, rest.style]}
    />
  );
}

export function PasswordInput(props: TextInputProps & { error?: boolean }) {
  const [visible, setVisible] = useState(false);
  return (
    <View>
      <Input {...props} secure={!visible} className={undefined} />
      <Pressable
        onPress={() => setVisible((value) => !value)}
        hitSlop={10}
        className="absolute bottom-0 right-3.5 h-[52px] justify-center"
      >
        <Text className="text-[12px] font-semibold text-cobalt">{visible ? 'Hide' : 'Show'}</Text>
      </Pressable>
    </View>
  );
}

type Tone = 'blue' | 'amber' | 'red' | 'slate' | 'navy' | 'success-soft';

export function Badge({ tone = 'slate', children }: { tone?: Tone; children: ReactNode }) {
  const styles: Record<Tone, string> = {
    blue: 'bg-cobalt-soft',
    amber: 'bg-amber-soft',
    red: 'bg-danger-soft',
    slate: 'bg-[#EEF2F8]',
    navy: 'bg-navy',
    'success-soft': 'bg-cobalt-soft',
  };
  const text: Record<Tone, string> = {
    blue: 'text-cobalt',
    amber: 'text-amber',
    red: 'text-danger',
    slate: 'text-muted',
    navy: 'text-white',
    'success-soft': 'text-cobalt',
  };
  return (
    <View className={cx('flex-row items-center gap-1 self-start rounded-full px-2.5 py-1', styles[tone])}>
      {tone === 'blue' || tone === 'success-soft' ? <IconCheck size={11} color="#2457D6" strokeWidth={2.4} /> : null}
      <Text className={cx('text-[11px] font-semibold', text[tone])}>{children}</Text>
    </View>
  );
}

export function Avatar({ name, size = 40, tone = 'light' }: { name: string; size?: number; tone?: 'light' | 'navy' }) {
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
  return (
    <View
      style={{ width: size, height: size, borderRadius: size / 2 }}
      className={tone === 'navy' ? 'items-center justify-center bg-navy' : 'items-center justify-center bg-cobalt-soft'}
    >
      <Text
        style={{ fontSize: size * 0.34 }}
        className={tone === 'navy' ? 'font-bold text-white' : 'font-bold text-cobalt'}
      >
        {letters || '?'}
      </Text>
    </View>
  );
}

export function IconTile({
  children,
  tone = 'canvas',
  size = 42,
}: {
  children: ReactNode;
  tone?: 'canvas' | 'blue' | 'amber' | 'navy';
  size?: number;
}) {
  const styles = {
    canvas: 'bg-[#F1F5FB]',
    blue: 'bg-cobalt-soft',
    amber: 'bg-amber-soft',
    navy: 'bg-navy',
  } as const;
  return (
    <View
      style={{ width: size, height: size, borderRadius: size * 0.36 }}
      className={cx('items-center justify-center', styles[tone])}
    >
      {children}
    </View>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon?: ReactNode;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <View className="items-center px-6 py-10">
      {icon ? <IconTile tone="blue" size={52}>{icon}</IconTile> : null}
      <Text className="mt-4 text-center text-[17px] font-bold text-ink">{title}</Text>
      <Text className="mt-1.5 text-center text-[13px] leading-5 text-muted">{body}</Text>
      {action ? <View className="mt-4">{action}</View> : null}
    </View>
  );
}

export function ErrorNote({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View className="mb-4 flex-row items-start gap-2.5 rounded-[18px] bg-danger-soft px-4 py-3.5">
      <IconAlert size={16} />
      <View className="flex-1">
        <Text className="text-[13px] leading-5 text-danger">{message}</Text>
        {onRetry ? (
          <Pressable onPress={onRetry} className="mt-2 flex-row items-center gap-1.5">
            <IconRefresh size={13} />
            <Text className="text-[12.5px] font-semibold text-danger">Try again</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export function Notice({
  children,
  tone = 'info',
}: {
  children: ReactNode;
  tone?: 'info' | 'success' | 'warn';
}) {
  const styles =
    tone === 'success'
      ? 'bg-cobalt-soft'
      : tone === 'warn'
        ? 'bg-amber-soft'
        : 'bg-white';
  return (
    <View className={cx('mb-4 flex-row items-start gap-2.5 rounded-[18px] px-4 py-3.5', styles)}>
      {tone === 'success' ? <IconCheck size={16} /> : tone === 'warn' ? <IconAlert size={16} /> : <IconInfo size={16} />}
      <Text className="flex-1 text-[12.5px] leading-5 text-muted">{children}</Text>
    </View>
  );
}

export function Loading({ label = 'Loading' }: { label?: string }) {
  return (
    <View className="items-center justify-center py-16">
      <ActivityIndicator color="#2457D6" />
      <Text className="mt-3 text-[13px] text-muted">{label}…</Text>
    </View>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (value: T) => void;
  options: Array<{ value: T; label: string }>;
}) {
  return (
    <View className="flex-row rounded-[18px] bg-[#E9EEF7] p-1">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            className={cx('flex-1 items-center justify-center rounded-[14px] py-2.5', active && 'bg-white')}
            style={active ? shadowSoft : undefined}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
          >
            <Text className={cx('text-[12.5px] font-semibold', active ? 'text-ink' : 'text-muted')}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Divider() {
  return <View className="h-px w-full bg-line" />;
}

export function KeyValue({ label, value }: { label: string; value: ReactNode }) {
  return (
    <View className="flex-row items-center justify-between py-2.5">
      <Text className="text-[12.5px] text-muted">{label}</Text>
      {typeof value === 'string' || typeof value === 'number' ? (
        <Text className="text-[13px] font-semibold text-ink">{value}</Text>
      ) : (
        <View className="items-end">{value}</View>
      )}
    </View>
  );
}

export function Stat({
  label,
  value,
  hint,
  icon,
  tone = 'default',
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: ReactNode;
  tone?: 'default' | 'amber' | 'blue';
}) {
  return (
    <Card
      className={cx(
        'flex-1 p-4',
        tone === 'amber' && 'bg-amber-soft',
        tone === 'blue' && 'bg-cobalt-soft',
      )}
    >
      <View className="flex-row items-center justify-between">
        <Text className="text-[11.5px] font-semibold text-muted">{label}</Text>
        {icon ?? null}
      </View>
      <Text className="mt-2 text-[30px] font-bold leading-8 tracking-[-0.5px] text-ink">{value}</Text>
      {hint ? <Text className="mt-1 text-[11px] text-muted">{hint}</Text> : null}
    </Card>
  );
}
