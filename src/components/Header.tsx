import React from 'react';

const Header: React.FC = () => {
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
        <a href="#/" style={{
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
          <a href="#/" style={{ color: '#3c4043', textDecoration: 'none' }}>Home</a>
          <a href="#/about" style={{ color: '#3c4043', textDecoration: 'none' }}>About</a>
        </nav>
      </div>
    </header>
  );
};

export default Header;
