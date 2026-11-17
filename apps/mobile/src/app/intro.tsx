import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  FlatList,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { BrandMark } from '@/components/brand';
import {
  IllustrationAlert,
  IllustrationClock,
  IllustrationEvidence,
  IllustrationSite,
} from '@/components/illustrations';
import { Button } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { markIntroSeen, useIntroSeen } from '@/lib/onboarding';

const STEPS = [
  {
    eyebrow: 'Welcome',
    title: 'Every shift, on the record.',
    body: 'Manage is the attendance workspace for site teams. Staff clock in from their phone; owners see verified presence instead of guesswork.',
    Illustration: IllustrationSite,
  },
  {
    eyebrow: 'Clock in',
    title: 'Clock in inside the site radius.',
    body: 'Location is checked on your phone and re-checked on the server. One open shift per person, so overlapping times cannot be manufactured.',
    Illustration: IllustrationClock,
  },
  {
    eyebrow: 'Stay informed',
    title: 'Know when someone leaves.',
    body: 'When a staff member steps outside the site boundary, Manage records the departure and alerts the owner through durable email and push delivery.',
    Illustration: IllustrationAlert,
  },
  {
    eyebrow: 'Evidence',
    title: 'Corrections are reviewed, never silent.',
    body: 'Every change keeps who asked, who approved, and why. Owners cannot approve their own corrections, and the audit trail stays append-only.',
    Illustration: IllustrationEvidence,
  },
] as const;

export default function IntroScreen() {
  const router = useRouter();
  const { replay } = useLocalSearchParams<{ replay?: string }>();
  const isReplay = replay === '1';
  const { me } = useAuth();
  const seen = useIntroSeen();
  const { width } = useWindowDimensions();
  const listRef = useRef<FlatList<(typeof STEPS)[number]>>(null);
  const [index, setIndex] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const fade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (seen && !isReplay) {
      router.replace(me ? '/' : '/sign-in');
    }
  }, [seen, isReplay, me, router]);

  const finish = useCallback(async () => {
    if (leaving) return;
    setLeaving(true);
    await markIntroSeen();
    if (isReplay && router.canGoBack()) {
      router.back();
    } else {
      router.replace(me ? '/' : '/sign-in');
    }
  }, [leaving, isReplay, me, router]);

  const goTo = useCallback(
    (next: number) => {
      if (next < 0 || next >= STEPS.length) return;
      fade.setValue(0.35);
      Animated.timing(fade, { toValue: 1, duration: 260, useNativeDriver: true }).start();
      listRef.current?.scrollToIndex({ index: next, animated: true });
      setIndex(next);
    },
    [fade],
  );

  const onScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(event.nativeEvent.contentOffset.x / width);
    if (next !== index) setIndex(Math.max(0, Math.min(STEPS.length - 1, next)));
  };

  const last = index === STEPS.length - 1;
  const artWidth = Math.min(width - 96, 320);

  return (
    <SafeAreaView className="flex-1 bg-canvas">
      <View className="flex-row items-center justify-between px-5 pt-3">
        <View className="flex-row items-center gap-2.5">
          <BrandMark size={34} />
          <Text className="text-[17px] font-bold tracking-[-0.3px] text-ink">Manage</Text>
        </View>
        <Pressable
          onPress={() => void finish()}
          accessibilityRole="button"
          accessibilityLabel="Skip the introduction"
          hitSlop={10}
          className="rounded-lg px-2 py-1"
        >
          <Text className="text-[14px] font-semibold text-cobalt">Skip</Text>
        </Pressable>
      </View>

      <FlatList
        ref={listRef}
        data={STEPS}
        keyExtractor={(step) => step.eyebrow}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        renderItem={({ item }) => (
          <View style={{ width }} className="flex-1 justify-center px-7">
            <Animated.View style={{ opacity: fade }} className="items-center">
              <item.Illustration width={artWidth} />
              <Text className="mt-8 text-[11px] font-bold uppercase tracking-[1.8px] text-cobalt">
                {item.eyebrow}
              </Text>
              <Text className="mt-3 text-center text-[25px] font-bold leading-[31px] tracking-[-0.5px] text-ink">
                {item.title}
              </Text>
              <Text className="mt-3 max-w-[330px] text-center text-[14px] leading-[21px] text-muted">
                {item.body}
              </Text>
            </Animated.View>
          </View>
        )}
      />

      <View className="px-7 pb-4">
        <View className="mb-6 flex-row items-center justify-between">
          <View className="flex-row items-center gap-1.5" accessibilityLabel={`Step ${index + 1} of ${STEPS.length}`}>
            {STEPS.map((step, i) => (
              <View
                key={step.eyebrow}
                className={i === index ? 'h-[6px] w-[22px] rounded-full bg-cobalt' : 'h-[6px] w-[6px] rounded-full bg-line-strong'}
              />
            ))}
          </View>
          <Text className="text-[12px] font-medium text-faint">
            {index + 1} of {STEPS.length}
          </Text>
        </View>

        <Button
          label={leaving ? 'Opening Manage' : last ? 'Get started' : 'Next'}
          onPress={() => {
            if (last) {
              void finish();
            } else {
              goTo(index + 1);
            }
          }}
          size="lg"
          loading={leaving}
        />

        {index > 0 ? (
          <Pressable
            onPress={() => goTo(index - 1)}
            accessibilityRole="button"
            className="mt-3 items-center py-2"
            disabled={leaving}
          >
            <Text className="text-[13.5px] font-semibold text-muted">Back</Text>
          </Pressable>
        ) : (
          <Text className="mt-3 py-2 text-center text-[12px] text-faint">
            You can revisit this introduction any time from Account.
          </Text>
        )}
      </View>
    </SafeAreaView>
  );
}
