import './globals.css'
import type { Metadata } from 'next'

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
      <body className="bg-slate-950 text-slate-100">
        {children}
      </body>
    </html>
  )
}
