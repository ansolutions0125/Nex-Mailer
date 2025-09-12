import "./globals.css";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import Script from "next/script";
import StoresInitializer from "@/store/StoresInitializer";
import ToastContainer from "@/toast/ToastContainer";

export const metadata = {
  title: "Master Mailer",
  description: "Perfect Mailer Management System",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <Script
          async
          src="https://www.googletagmanager.com/gtag/js?id=G-FCHL3EQX3S"
        ></Script>
        <Script id="google-analytics" strategy="afterInteractive">
          {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments)}
          gtag('js', new Date());

          gtag('config', 'G-FCHL3EQX3S');
          `}
        </Script>
      </head>

      <body>
        <Analytics />
        <SpeedInsights />

        <ToastContainer />
        <StoresInitializer>{children}</StoresInitializer>
      </body>
    </html>
  );
}
