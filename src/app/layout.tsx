import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Asistencia FECQR',
  description: 'Control de asistencia inteligente mediante códigos QR',
  themeColor: '#F2F2F7',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className={`${inter.className} antialiased bg-[#F2F2F7] text-[#1C1C1E] min-h-screen selection:bg-[#007AFF]/20 selection:text-[#007AFF]`}>
        {children}
      </body>
    </html>
  );
}
