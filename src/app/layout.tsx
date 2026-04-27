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
import MobileBlocker from "@/components/mobile-blocker";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Thyleads - Internal Dashboard",
  description: "Thyleads employee internal dashboard",
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
        <MobileBlocker />
        <GoogleOAuthWrapper>
        <AuthProvider>
          <PresenceProvider>
            <PodProvider>
              <NotificationProvider>
                <DataProvider>
                  <ChatProvider>
                    <SidebarProvider>
                      <AppShell>{children}</AppShell>
                    </SidebarProvider>
                  </ChatProvider>
                </DataProvider>
              </NotificationProvider>
            </PodProvider>
          </PresenceProvider>
        </AuthProvider>
        </GoogleOAuthWrapper>
      </body>
    </html>
  );
}
