import { Inter } from 'next/font/google';
import './globals.css';

// 1. Optimize the Font (Fixes the warning)
const inter = Inter({ subsets: ['latin'] });

// 2. SEO Metadata
export const metadata = {
  title: 'BrainBuffer | Visual Memory Training',
  description: 'Boost your cognitive speed with BrainBuffer. Memorize floating numbers, challenge your short-term recall, and compete for the high score in this fast-paced brain training game.',
  keywords: ['memory game', 'brain training', 'cognitive test', 'visual memory', 'puzzle game', 'mind game'],
  authors: [{ name: 'Muhammad Yasir' }], // ✅ Updated Name
  applicationName: 'BrainBuffer',
  openGraph: {
    title: 'BrainBuffer - Can you beat the high score?',
    description: 'Test your short-term memory speed. Memorize the bubbles before they vanish!',
    type: 'website',
  },
};

// 3. Mobile Settings (Critical for preventing zoom on phones)
export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#ffffff',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      {/* 4. Apply Font & Styles */}
      <body className={`${inter.className} bg-white text-slate-800 antialiased`}>
        {children}
      </body>
    </html>
  );
}