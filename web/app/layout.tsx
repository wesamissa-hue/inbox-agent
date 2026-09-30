import './globals.css'
import type { ReactNode } from 'react'
import type { Metadata } from 'next'
import { ThemeProvider } from '../components/ThemeProvider'
import { LanguageProvider } from '../components/LanguageProvider'

export const metadata: Metadata = {
  metadataBase: new URL('https://inbox-agent-rho.vercel.app'),
  title: 'IDEEPS GPT',
  description: 'A premium AI-powered customer inbox for businesses.',
  icons: {
    icon: '/icon.png',
    apple: '/apple-icon.png',
  },
  openGraph: {
    title: 'IDEEPS GPT',
    description: 'A premium AI-powered customer inbox for businesses.',
    images: ['/opengraph-image.png'],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    images: ['/opengraph-image.png'],
  },
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body><LanguageProvider><ThemeProvider>{children}</ThemeProvider></LanguageProvider></body>
    </html>
  )
}
