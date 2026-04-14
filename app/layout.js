import './globals.css';
import AuthProvider from '@/components/AuthProvider';
import { Toaster } from 'sonner';

export const metadata = {
  title: 'CreatorFlow AI',
  description: 'Premium AI-powered YouTube content studio. Automate ideation, scriptwriting, video generation, and publishing.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-slate-950 text-white antialiased font-sans">
        <AuthProvider>
          {children}
          <Toaster theme="dark" position="top-right" richColors />
        </AuthProvider>
      </body>
    </html>
  );
}
