import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { ThemeProvider } from 'next-themes';
import { Toaster } from '@/components/ui/sonner';
import './globals.css';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'SynapseLearn — AI-Powered Adaptive Tutoring',
  description: 'Learn anything with an AI tutor that adapts to your learning style. Upload slides, get intelligent questions, and master every concept with evidence-based teaching.',
  keywords: ['AI tutoring', 'adaptive learning', 'quiz generation', 'slide analysis', 'mastery tracking'],
  openGraph: {
    title: 'SynapseLearn — AI-Powered Adaptive Tutoring',
    description: 'Learn anything with an AI tutor that adapts to your learning style.',
    type: 'website',
  },
  twitter: { card: 'summary_large_image', title: 'SynapseLearn', description: 'AI-Powered Adaptive Tutoring' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#059669" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'WebApplication',
          name: 'SynapseLearn',
          description: 'AI-Powered Adaptive Tutoring Platform',
          applicationCategory: 'EducationalApplication',
        })}} />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}