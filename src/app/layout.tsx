import type { Metadata } from 'next';
import '@/src/css/main.css';

export const metadata: Metadata = {
  title: 'SatLotto',
  description: 'Proba tu suerte... cada 21 bloques',
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
