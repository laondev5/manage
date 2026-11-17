import '../../global.css';
import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '@/lib/auth';
import { useOfflineFlush } from '@/lib/hooks';
import { useIntroSeen } from '@/lib/onboarding';
import { BrandSplash } from '@/components/brand-splash';

void SplashScreen.preventAutoHideAsync().catch(() => {
  // A second call (fast refresh) is harmless; the native splash stays until we hide it.
});

function Gate({ introSeen }: { introSeen: boolean | null }) {
  const { me, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const inAuth = segments[0] === '(auth)';
  const inIntro = segments[0] === 'intro';
  const screen = (segments as string[])[1];
  const isSetup = screen === 'mfa-setup';
  const isInvite = screen === 'invite';
  useOfflineFlush(Boolean(me) && !me?.mfaSetupRequired);

  useEffect(() => {
    if (loading || introSeen === null) return;
    if (!introSeen && !inAuth && !inIntro) {
      router.replace('/intro');
      return;
    }
    if (!me && !inAuth && !inIntro) {
      router.replace('/sign-in');
      return;
    }
    if (me?.mfaSetupRequired && !isSetup) {
      router.replace('/mfa-setup');
      return;
    }
    if (me && inAuth && !isSetup && !isInvite) {
      router.replace('/');
    }
  }, [me, loading, introSeen, inAuth, inIntro, isSetup, isInvite, router]);

  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#F5F7FB' } }} />;
}

function Shell() {
  const { loading } = useAuth();
  const introSeen = useIntroSeen();
  const [splashDone, setSplashDone] = useState(false);
  const [waited, setWaited] = useState(false);
  const ready = waited || (!loading && introSeen !== null);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      void SplashScreen.hideAsync();
    });
    const timer = setTimeout(() => setWaited(true), 3500);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
    };
  }, []);

  return (
    <>
      <StatusBar style="light" />
      <Gate introSeen={introSeen} />
      {splashDone ? null : <BrandSplash ready={ready} onFinish={() => setSplashDone(true)} />}
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <Shell />
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
