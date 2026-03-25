import type { Metadata, Viewport } from "next";
import "./globals.css";
import Providers from "./providers";

export const metadata: Metadata = {
  title: "Taller MAQJEEZ",
  description: "Sistema de gestión para taller de Moto-Implementos y Motovehículos",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#f97316",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className="min-h-screen bg-gray-950 dark:bg-gray-950 light:bg-gray-50">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
