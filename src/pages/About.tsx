import React from 'react';

const About: React.FC = () => {
  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: 20, fontFamily: 'Arial, sans-serif' }}>
      <h1 style={{ margin: '0 0 12px 0', color: '#1a73e8' }}>About the Developer</h1>

      <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
        <p style={{ color: '#5f6368', lineHeight: 1.6 }}>
          Hi, I’m <strong>Ojas Netke</strong>. I developed this application to help students, staff, and visitors quickly locate rooms on campus. If you have any questions or suggestions or improvements, please don't hesitate to contact me.
        </p>
        <hr style={{ border: 'none', borderTop: '1px solid #eee', margin: '16px 0' }} />
        <h3 style={{ marginTop: 0, color: '#3c4043' }}>Contact</h3>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, lineHeight: 1.8 }}>
          <li><strong>Email:</strong> <a href="mailto:ojas.netke@edu.escp.eu" style={{ color: '#1a73e8' }}>ojas.netke@edu.escp.eu</a></li>
          <li><strong>LinkedIn:</strong> <a href="https://www.linkedin.com/in/ojas-netke-091164149/" target="_blank" rel="noreferrer" style={{ color: '#1a73e8' }}>linkedin.com/in/ojas-netke-091164149</a></li>
        </ul>
      </div>
    </div>
  );
};

export default About;
