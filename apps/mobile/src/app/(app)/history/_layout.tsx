import { Stack } from 'expo-router';

export default function HistoryLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#F5F7FB' } }} />;
}
