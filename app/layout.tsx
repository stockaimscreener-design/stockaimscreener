import './globals.css'
import { Inter } from 'next/font/google'
import Navigation from '@/components/Navigation'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'StockAimScreener - Advanced Stock Screening Tool',
  description: 'Professional stock screening tool for NASDAQ and NYSE markets with real-time data and advanced filters.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="min-h-screen bg-gray-50">
          <Navigation />
          <main className="pb-20">
            {children}
          </main>
        </div>
      </body>
    </html>
  )
}

