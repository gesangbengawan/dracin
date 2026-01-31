import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dracin | Stream Asian Dramas",
  description: "Watch your favorite Asian dramas - Futuristic streaming platform",
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
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased grid-bg">
        <div className="min-h-screen">{children}</div>
      </body>
    </html>
  );
}
