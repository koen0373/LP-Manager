import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Enosys LP Manager",
  description: "Manage your Enosys V3 liquidity positions on Flare Network",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
