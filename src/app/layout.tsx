import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: "David's Galactic Casino of Doom",
  description: 'No Refunds. No Mercy. No Gravity.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
