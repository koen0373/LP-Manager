import './globals.css';

export const metadata = {
  title: 'LiquiLab',
  description: 'Powered by RangeBand™',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

