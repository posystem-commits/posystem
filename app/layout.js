export const metadata = {
  title: "POS Admin",
  description: "Multi-tenant POS admin dashboard",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, sans-serif", background: "#F5F3EE", color: "#20242B" }}>
        {children}
      </body>
    </html>
  );
}
