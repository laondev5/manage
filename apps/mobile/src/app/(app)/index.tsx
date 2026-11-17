import { Text, View } from 'react-native';
import { useAuth } from '@/lib/auth';
import { StaffToday } from '@/components/staff-today';
import { OwnerOverview } from '@/components/owner-overview';
import { Card, EmptyState, Header, Loading, Screen } from '@/components/ui';
import { IconShield } from '@/components/icons';

export default function HomeScreen() {
  const { me, loading, isOwner, isStaff } = useAuth();

  if (loading) {
    return (
      <Screen>
        <Header title="Manage" />
        <Loading label="Opening your workspace" />
      </Screen>
    );
  }

  if (isOwner) return <OwnerOverview />;
  if (isStaff) return <StaffToday />;

  const membership = me?.memberships.find((entry) => entry.status === 'ACTIVE');
  return (
    <Screen>
      <Header title="Manage" subtitle={membership?.organizationName} />
      <View className="px-5 pt-4">
        <Card>
          <EmptyState
            icon={<IconShield size={20} />}
            title="Use the web console"
            body="This mobile app is for site owners and staff attendance. Platform administration, audit and health live in the Manage web console."
            action={<Text className="text-[12px] text-faint">Sign in to the console with the same account.</Text>}
          />
        </Card>
      </View>
    </Screen>
  );
}
