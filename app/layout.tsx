import type { Metadata } from 'next';
import '@/src/css/main.css';

export const metadata: Metadata = {
  title: 'SatLotto',
  description: 'La lotería de Bitcoin en Lightning Network',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
