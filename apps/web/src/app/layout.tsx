import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ArcGent Dashboard',
  description: 'Autonomous signal-to-payment agents on Arc + Circle',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,700;9..40,900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
