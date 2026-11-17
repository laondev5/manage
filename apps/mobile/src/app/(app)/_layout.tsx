import type { ReactElement } from 'react';
import { View } from 'react-native';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/lib/auth';
import {
  IconOverview,
  IconBuilding,
  IconBell,
  IconUsers,
  IconClock,
  IconScroll,
  IconShield,
  type IconProps,
} from '@/components/icons';

const ACTIVE = '#FFFFFF';
const INACTIVE = '#7C89A0';

// `href: null` removes a tab from the bar but also blocks navigation to it on
// web, so routes pushed from inside the app (site detail, onboarding, owner
// history/reports) would bounce back to Today/Home. Hiding the button keeps the
// route reachable.
const hiddenTab = {
  tabBarButton: () => null,
  tabBarItemStyle: { display: 'none' as const },
};

function tabIcon(Glyph: (props: IconProps) => ReactElement) {
  return ({ focused }: { focused: boolean }) => (
    <View
      className={
        focused
          ? 'h-[34px] w-[34px] items-center justify-center rounded-full bg-navy'
          : 'h-[34px] w-[34px] items-center justify-center rounded-full'
      }
    >
      <Glyph size={17} color={focused ? ACTIVE : INACTIVE} strokeWidth={focused ? 2.1 : 1.8} />
    </View>
  );
}

export default function AppLayout() {
  const { me, isOwner } = useAuth();
  const insets = useSafeAreaInsets();
  const owner = me ? isOwner : false;

  const tabs: ReactElement[] = [
    <Tabs.Screen
      key="index"
      name="index"
      options={{
        title: owner ? 'Home' : 'Today',
        tabBarAccessibilityLabel: owner ? 'Home' : 'Today',
        tabBarIcon: tabIcon(owner ? IconOverview : IconClock),
      }}
    />,
  ];

  if (owner) {
    tabs.push(
      <Tabs.Screen
        key="sites"
        name="sites"
        options={{ title: 'Sites', tabBarAccessibilityLabel: 'Sites', tabBarIcon: tabIcon(IconBuilding) }}
      />,
      <Tabs.Screen
        key="alerts"
        name="alerts"
        options={{ title: 'Alerts', tabBarAccessibilityLabel: 'Alerts', tabBarIcon: tabIcon(IconBell) }}
      />,
      <Tabs.Screen
        key="team"
        name="team"
        options={{ title: 'Team', tabBarAccessibilityLabel: 'Team', tabBarIcon: tabIcon(IconUsers) }}
      />,
    );
  } else {
    tabs.push(
      <Tabs.Screen
        key="reports"
        name="reports"
        options={{ title: 'Reports', tabBarAccessibilityLabel: 'Reports', tabBarIcon: tabIcon(IconScroll) }}
      />,
      <Tabs.Screen
        key="history"
        name="history"
        options={{ title: 'History', tabBarAccessibilityLabel: 'History', tabBarIcon: tabIcon(IconOverview) }}
      />,
    );
  }

  tabs.push(
    <Tabs.Screen
      key="account"
      name="account"
      options={{ title: 'Account', tabBarAccessibilityLabel: 'Account', tabBarIcon: tabIcon(IconShield) }}
    />,
  );

  if (owner) {
    tabs.push(
      <Tabs.Screen key="history" name="history" options={hiddenTab} />,
      <Tabs.Screen key="reports" name="reports" options={hiddenTab} />,
    );
  } else {
    tabs.push(<Tabs.Screen key="sites" name="sites" options={hiddenTab} />);
  }

  tabs.push(
    <Tabs.Screen key="onboarding" name="onboarding" options={{ ...hiddenTab, tabBarStyle: { display: 'none' } }} />,
  );

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#101D35',
        tabBarInactiveTintColor: INACTIVE,
        tabBarShowLabel: false,
        sceneStyle: { backgroundColor: '#F5F7FB' },
        tabBarStyle: {
          position: 'absolute',
          left: 16,
          right: 16,
          bottom: 0,
          height: 64 + insets.bottom,
          paddingTop: 8,
          paddingBottom: 8 + insets.bottom,
          borderTopLeftRadius: 26,
          borderTopRightRadius: 26,
          backgroundColor: '#FFFFFF',
          borderTopWidth: 0,
          shadowColor: '#101D35',
          shadowOpacity: 0.14,
          shadowRadius: 24,
          shadowOffset: { width: 0, height: -6 },
          elevation: 12,
        },
        tabBarItemStyle: { borderRadius: 20 },
      }}
    >
      {tabs}
    </Tabs>
  );
}
