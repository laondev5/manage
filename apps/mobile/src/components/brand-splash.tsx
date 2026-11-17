import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, Ellipse, RadialGradient, Rect, Stop } from 'react-native-svg';
import logoLight from '../../assets/logo-light.png';

const LOGO_ASPECT = 1900 / 449;
const LOGO_WIDTH = 200;

/**
 * Brand cover shown over the app while the session and first-launch state load.
 * The native splash renders the same lockup on the same navy, so the handoff is
 * a scale/fade rather than a different screen.
 */
export function BrandSplash({ ready, onFinish }: { ready: boolean; onFinish: () => void }) {
  const [timelineDone, setTimelineDone] = useState(false);
  const exiting = useRef(false);
  const [exit] = useState(() => new Animated.Value(1));
  const [logo] = useState(() => new Animated.Value(0));
  const [wordmark] = useState(() => new Animated.Value(0));
  const [tagline] = useState(() => new Animated.Value(0));
  const [progress] = useState(() => new Animated.Value(0));
  const [ringA] = useState(() => new Animated.Value(0));
  const [ringB] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const animation = Animated.parallel([      Animated.timing(logo, {
        toValue: 1,
        duration: 520,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.delay(120),
        Animated.timing(ringA, {
          toValue: 1,
          duration: 1500,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
      Animated.sequence([
        Animated.delay(420),
        Animated.timing(ringB, {
          toValue: 1,
          duration: 1500,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
      Animated.sequence([
        Animated.delay(320),
        Animated.timing(wordmark, {
          toValue: 1,
          duration: 460,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
      Animated.sequence([
        Animated.delay(560),
        Animated.timing(tagline, {
          toValue: 1,
          duration: 420,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
      Animated.sequence([
        Animated.delay(460),
        Animated.timing(progress, {
          toValue: 1,
          duration: 1180,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    ]);
    animation.start(({ finished }) => {
      if (finished) setTimelineDone(true);
    });
    // Backgrounded tabs pause JS animation frames; never trap the app behind the cover.
    const cap = setTimeout(() => setTimelineDone(true), 5000);
    return () => {
      clearTimeout(cap);
      animation.stop();
    };
  }, [logo, wordmark, tagline, progress, ringA, ringB]);

  useEffect(() => {
    if (!ready || !timelineDone || exiting.current) return;
    exiting.current = true;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      onFinish();
    };
    const cap = setTimeout(finish, 700);
    Animated.timing(exit, {
      toValue: 0,
      duration: 360,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        clearTimeout(cap);
        finish();
      }
    });
    return () => clearTimeout(cap);
  }, [ready, timelineDone, exit, onFinish]);

  const logoScale = logo.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] });
  const logoShift = logo.interpolate({ inputRange: [0, 1], outputRange: [10, 0] });

  const ringStyle = (value: Animated.Value, scaleTo: number) => ({
    opacity: value.interpolate({ inputRange: [0, 0.08, 1], outputRange: [0, 0.34, 0] }),
    transform: [
      { scale: value.interpolate({ inputRange: [0, 1], outputRange: [0.55, scaleTo] }) },
    ],
  });

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, styles.root, { opacity: exit }]}
      accessibilityLabel="Manage is starting"
    >
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
        <Defs>
          <RadialGradient id="splashGlow" cx="50%" cy="36%" rx="72%" ry="52%">
            <Stop offset="0" stopColor="#2457D6" stopOpacity="0.34" />
            <Stop offset="0.55" stopColor="#2457D6" stopOpacity="0.08" />
            <Stop offset="1" stopColor="#101D35" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="#101D35" />
        <Ellipse cx="50%" cy="36%" rx="78%" ry="56%" fill="url(#splashGlow)" />
      </Svg>

      <View className="flex-1 items-center justify-center px-8">
        <View style={{ width: LOGO_WIDTH, height: LOGO_WIDTH / LOGO_ASPECT }} className="items-center justify-center">
          <Animated.View style={[styles.ring, ringStyle(ringA, 2.5)]} />
          <Animated.View style={[styles.ring, ringStyle(ringB, 1.9)]} />
          <Animated.View style={{ opacity: logo, transform: [{ scale: logoScale }, { translateY: logoShift }] }}>
            <Image
              source={logoLight}
              style={{ width: LOGO_WIDTH, height: LOGO_WIDTH / LOGO_ASPECT }}
              resizeMode="contain"
              accessibilityIgnoresInvertColors
            />
          </Animated.View>
        </View>

        <Animated.Text
          style={{
            opacity: wordmark,
            transform: [{ translateY: wordmark.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
          }}
          className="mt-6 text-[19px] font-semibold tracking-[0.2px] text-white"
        >
          Site attendance, verified.
        </Animated.Text>

        <Animated.Text style={{ opacity: tagline }} className="mt-2 text-[11px] font-semibold uppercase tracking-[2px] text-[#8FA3C8]">
          Worksite attendance · oversight
        </Animated.Text>

        <View className="mt-10 h-[3px] w-[132px] overflow-hidden rounded-full bg-white/15">
          <Animated.View
            style={{
              width: '100%',
              height: '100%',
              backgroundColor: '#5B87F2',
              transform: [{ translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [-132, 0] }) }],
            }}
          />
        </View>
      </View>

      <Text className="pb-10 text-center text-[10.5px] tracking-[0.4px] text-white/35">
        Invitation-only access
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    zIndex: 50,
    elevation: 50,
  },
  ring: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    borderWidth: 1,
    borderColor: 'rgba(143, 180, 255, 0.55)',
  },
});
