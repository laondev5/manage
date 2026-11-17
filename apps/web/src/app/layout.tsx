import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AuthProvider } from '@/lib/auth';

export const metadata: Metadata = {
  title: 'Manage',
  description: 'Worksite attendance and remote oversight.',
  applicationName: 'Manage',
  openGraph: {
    title: 'Manage — worksite attendance, verified',
    description: 'Know who is on site, and what happened when they left.',
    siteName: 'Manage',
    type: 'website',
  },
  twitter: { card: 'summary_large_image' },
};

export const viewport: Viewport = {
  themeColor: '#101D35',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
