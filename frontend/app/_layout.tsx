import { Stack } from 'expo-router';
import { InventoryProvider } from './contexts/InventoryContext';

export default function RootLayout() {
  return (
    <InventoryProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
      </Stack>
    </InventoryProvider>
  );
}