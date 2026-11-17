import type { ReactNode } from 'react';
import { AppShell } from '@/components/app-shell';
import { FlashProvider } from '@/components/ui';

export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  return (
    <FlashProvider>
      <AppShell>{children}</AppShell>
    </FlashProvider>
  );
}
