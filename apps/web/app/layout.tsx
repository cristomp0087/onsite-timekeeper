import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'OnSite Club',
  description: 'Área do Cliente OnSite',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  )
}
