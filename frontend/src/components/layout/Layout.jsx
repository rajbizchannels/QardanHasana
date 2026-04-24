import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-dark-50">
      <Sidebar collapsed={collapsed} />
      <Header
        onToggleSidebar={() => setCollapsed(!collapsed)}
        sidebarCollapsed={collapsed}
      />
      <main
        className="transition-all duration-300 pt-16"
        style={{ paddingLeft: collapsed ? '4rem' : '16rem' }}
      >
        <div className="p-6 max-w-screen-2xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
