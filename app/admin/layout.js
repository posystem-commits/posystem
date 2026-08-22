// Deliberately thin — the login page and the dashboard pages want different chrome (a centered
// card vs. a nav + content shell), so the shared nav lives in components/AdminNav.jsx and is
// included directly by each dashboard page instead of here.
export default function AdminLayout({ children }) {
  return children;
}
