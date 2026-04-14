import './globals.css';
import AuthProvider from '@/components/AuthProvider';
import { Toaster } from '@/components/ui/sonner';

export const metadata = {
  title: 'CreatorFlow AI',
  description: 'Automate your YouTube content pipeline with AI',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@100..900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body style={{ fontFamily: "'Inter', sans-serif" }}>
        <AuthProvider>
          {children}
        </AuthProvider>
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
