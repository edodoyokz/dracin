import { Inter } from 'next/font/google';
import './globals.css';
import type { Metadata } from 'next';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'dracinhub - Drama Streaming Platform',
  description: 'Multi-provider short drama streaming aggregator',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="id">
      <body className={`${inter.className} bg-neutral-950 text-slate-100 antialiased`}>
        {children}
      </body>
    </html>
  )
}
