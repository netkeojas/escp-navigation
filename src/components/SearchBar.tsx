import React from 'react';

interface SearchBarProps {
  onSearch: (query: string) => void;
}

const SearchBar: React.FC<SearchBarProps> = ({ onSearch }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onSearch(e.target.value);
  };

  return (
    <div style={{ margin: '20px 0', display: 'flex', justifyContent: 'center' }}>
      <input
        type="text"
        placeholder="Search rooms by ID, alias, people, building, floor, or category..."
        onChange={handleChange}
        style={{
          padding: '10px 14px',
          width: '100%',
          maxWidth: '600px',
          fontSize: '16px',
          borderRadius: '8px',
          border: '1px solid #ccc',
          outline: 'none'
        }}
      />
    </div>
  );
};

export default SearchBar;
