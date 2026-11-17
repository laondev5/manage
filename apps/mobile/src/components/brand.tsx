import { Image, Text, View } from 'react-native';
import markSource from '../../assets/mark.png';
import logoSource from '../../assets/logo.png';
import { cx } from './ui';

type MarkProps = {
  size?: number;
  className?: string;
};

/** The horizontal Manage logo, sized by height. */
export function BrandLockup({ height = 20, className }: { height?: number; className?: string }) {
  return (
    <Image
      source={logoSource}
      style={{ height, width: height * (1900 / 449) }}
      resizeMode="contain"
      className={className}
      accessibilityIgnoresInvertColors
    />
  );
}

/** The Manage symbol on a white tile, for navy and photographic surfaces. */
export function BrandMark({ size = 40, className }: MarkProps) {
  return (
    <View
      className={cx('items-center justify-center overflow-hidden rounded-xl bg-white', className)}
      style={{ width: size, height: size, borderRadius: size * 0.26 }}
    >
      <Image
        source={markSource}
        style={{ width: size * 0.74, height: size * 0.74 }}
        resizeMode="contain"
        accessibilityIgnoresInvertColors
      />
    </View>
  );
}

export function BrandWordmark({
  size = 17,
  tone = 'light',
  className,
}: {
  size?: number;
  tone?: 'light' | 'dark';
  className?: string;
}) {
  return (
    <Text
      className={cx(tone === 'light' ? 'text-white' : 'text-ink', className)}
      style={{ fontSize: size, fontWeight: '700', letterSpacing: -0.3 }}
    >
      Manage
    </Text>
  );
}
