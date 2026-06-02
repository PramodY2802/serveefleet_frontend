import React from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import useAuth from '../hooks/useAuth.js';
import { useTheme } from '../shared/theme/ThemeProvider.jsx';
import Button from '../shared/components/ui/Button.jsx';

const AppLayout = () => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const navItems = [
    { label: 'Dashboard', to: '/dashboard', icon: 'bi-speedometer2' },
    { label: 'Reminders', to: '/reminders', icon: 'bi-bell' },
    { label: 'Customers', to: '/customers', icon: 'bi-people' },
    { label: 'Search', to: '/search', icon: 'bi-search' },
  ];

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const initials = (user?.name || user?.email || 'User')
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="app-shell">
      <aside className="app-sidebar" aria-label="Primary">
        <Link className="app-brand" to="/dashboard">
          <span className="app-brand__mark">AP</span>
          <span>AutoPulse</span>
        </Link>

        <nav>
          <p className="app-sidebar__label">Workspace</p>
          <div className="app-nav">
            {navItems.map((item) => (
              <NavLink key={item.to} to={item.to} className={({ isActive }) => `app-nav__link ${isActive ? 'is-active' : ''}`}>
                <i className={`bi ${item.icon}`} aria-hidden="true" />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </div>
        </nav>
      </aside>

      <div className="app-content">
        <header className="app-topbar">
          <div>
            <p className="app-topbar__title">Fleet operations</p>
            <p className="app-topbar__subtitle">Monitor customers, vehicles, and service history.</p>
          </div>
          <div className="app-topbar__actions">
            <Button variant="ghost" icon={theme === 'dark' ? 'bi-sun' : 'bi-moon-stars'} iconOnly aria-label="Toggle theme" onClick={toggleTheme} />
            <div className="user-chip">
              <span className="user-chip__avatar">{initials}</span>
              <div className="user-chip__meta">
                <p className="user-chip__name">{user?.name || 'User'}</p>
                <p className="user-chip__role">{user?.role || 'Operator'}</p>
              </div>
            </div>
            <Button variant="outline" size="sm" icon="bi-box-arrow-right" onClick={handleLogout}>
              Logout
            </Button>
          </div>
        </header>

        <nav className="mobile-nav" aria-label="Mobile primary">
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} className={({ isActive }) => `app-nav__link ${isActive ? 'is-active' : ''}`}>
              <i className={`bi ${item.icon}`} aria-hidden="true" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <main>
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AppLayout;
