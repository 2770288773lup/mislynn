import { AdminPage } from './pages/AdminPage.jsx';
import { OverlayPage } from './pages/OverlayPage.jsx';
import { ViewerPage } from './pages/ViewerPage.jsx';

export default function App() {
  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  if (path === '/admin') return <AdminPage />;
  if (path === '/overlay') return <OverlayPage />;
  return <ViewerPage />;
}
