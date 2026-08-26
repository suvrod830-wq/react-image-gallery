import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { Footer } from './Footer';
import { ConfigBanner } from './ConfigBanner';

export function PublicLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <ConfigBanner />
      <Header />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
