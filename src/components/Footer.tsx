import React from 'react';

const Footer: React.FC = () => {
  return (
    <footer style={{ borderTop: '1px solid #eee', marginTop: 24, background: '#fafafa' }}>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '16px 20px', textAlign: 'center', color: '#5f6368' }}>
        <a href="#/about" style={{ color: '#1a73e8', textDecoration: 'none' }}>About the developer</a>
      </div>
    </footer>
  );
};

export default Footer;
