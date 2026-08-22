import { FONT_IMPORT_URL, FONT_SANS, COLORS } from "@/lib/theme";

export const metadata = {
  title: "POS Admin",
  description: "Multi-tenant POS admin dashboard",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href={FONT_IMPORT_URL} />
      </head>
      <body style={{ margin: 0, fontFamily: FONT_SANS, background: COLORS.cream, color: COLORS.ink }}>
        {children}
      </body>
    </html>
  );
}
