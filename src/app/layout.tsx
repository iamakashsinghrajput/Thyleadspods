import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import { PodProvider } from "@/lib/pod-context";
import { DataProvider } from "@/lib/data-context";
import { NotificationProvider } from "@/lib/notification-context";
import { ChatProvider } from "@/lib/chat-context";
import { SidebarProvider } from "@/lib/sidebar-context";
import { PresenceProvider } from "@/lib/presence-context";
import AppShell from "@/components/app-shell";
import GoogleOAuthWrapper from "@/components/google-oauth-wrapper";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Thyleads - Employee Tracking",
  description: "Thyleads employee tracking dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="h-full flex overflow-hidden">
        <GoogleOAuthWrapper>
        <AuthProvider>
          <PresenceProvider>
            <PodProvider>
              <DataProvider>
                <NotificationProvider>
                  <ChatProvider>
                    <SidebarProvider>
                      <AppShell>{children}</AppShell>
                    </SidebarProvider>
                  </ChatProvider>
                </NotificationProvider>
              </DataProvider>
            </PodProvider>
          </PresenceProvider>
        </AuthProvider>
        </GoogleOAuthWrapper>
      </body>
    </html>
  );
}
