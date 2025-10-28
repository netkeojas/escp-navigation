import React from 'react';

interface HeaderProps {
  onHome?: () => void;
}

const Header: React.FC<HeaderProps> = ({ onHome }) => {
  const handleHomeClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    // Invoke reset if provided
    onHome?.();
    // Ensure hash reflects home route
    if (window.location.hash !== '#/') {
      window.location.hash = '#/'
    } else {
      // Force a light reload of the same hash to trigger UI expectations
      // without a full page reload.
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    }
  };
  return (
    <header style={{
      borderBottom: '1px solid #eee',
      background: '#ffffff',
      position: 'sticky',
      top: 0,
      zIndex: 100,
    }}>
      <div style={{
        maxWidth: 900,
        margin: '0 auto',
        padding: '12px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
      }}>
        <a href="#/" onClick={handleHomeClick} style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          color: '#1a73e8',
          fontWeight: 700,
          textDecoration: 'none',
          fontSize: 18,
        }}>
          ESCP Room Finder
        </a>
        <nav style={{ display: 'flex', gap: 12 }}>
          <a href="#/" onClick={handleHomeClick} style={{ color: '#3c4043', textDecoration: 'none' }}>Home</a>
          <a href="#/about" style={{ color: '#3c4043', textDecoration: 'none' }}>About</a>
        </nav>
      </div>
    </header>
  );
};

export default Header;
