import React from 'react';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
}

const SearchBar: React.FC<SearchBarProps> = ({ value, onChange, onSubmit }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') onSubmit();
  };

  return (
    <div style={{ margin: '20px 0', display: 'flex', justifyContent: 'center', gap: 8 }}>
      <input
        type="text"
        placeholder="Search rooms by ID, alias, people, building, floor, or category..."
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        style={{
          padding: '10px 14px',
          width: '100%',
          maxWidth: '600px',
          fontSize: '16px',
          borderRadius: '8px',
          border: '1px solid #ccc',
          outline: 'none'
        }}
        aria-label="Search rooms"
      />
      <button
        type="button"
        onClick={onSubmit}
        style={{
          padding: '10px 16px',
          borderRadius: 8,
          border: '1px solid #1a73e8',
          background: '#1a73e8',
          color: 'white',
          fontWeight: 600,
          cursor: 'pointer'
        }}
        aria-label="Execute search"
      >
        Search
      </button>
    </div>
  );
};

export default SearchBar;
