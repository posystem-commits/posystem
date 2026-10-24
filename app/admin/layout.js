import "./admin.css";

// The login page and the dashboard pages want different chrome (a split sign-in screen vs. a sidebar + content
// shell), so the shell lives in components/AdminShell.jsx and is used directly by each dashboard page.
export default function AdminLayout({ children }) {
  return children;
}
