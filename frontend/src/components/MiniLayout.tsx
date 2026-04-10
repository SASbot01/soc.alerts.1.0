import React from 'react';
import { NavLink } from 'react-router-dom';

interface Tab {
  to: string;
  label: string;
  end?: boolean;
  badge?: number;
}

interface MiniLayoutProps {
  title: string;
  tabs: Tab[];
  children: React.ReactNode;
}

const MiniLayout: React.FC<MiniLayoutProps> = ({ title, tabs, children }) => {
  return (
    <div className="mini-layout">
      <header className="mini-layout__header">
        <h2 className="mini-layout__title">{title}</h2>
        <nav className="mini-layout__tabs">
          {tabs.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              className={({ isActive }) =>
                `mini-layout__tab ${isActive ? 'mini-layout__tab--active' : ''}`
              }
            >
              {tab.label}
              {tab.badge != null && tab.badge > 0 && (
                <span className="mini-layout__badge">{tab.badge}</span>
              )}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="mini-layout__content">{children}</main>
    </div>
  );
};

export default MiniLayout;
