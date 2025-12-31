import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'OnSite Flow - Gerenciador de Horas',
  description: 'Gerencie suas horas de trabalho de forma simples e eficiente',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-gray-50">{children}</body>
    </html>
  );
}
