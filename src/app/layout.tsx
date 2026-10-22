import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Papertrail — Document intelligence",
  description: "Traceable PDF analysis with page-linked evidence and explicit uncertainty.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}