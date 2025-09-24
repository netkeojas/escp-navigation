import React from 'react';
import type { Room } from '../types/room';
import RoomCard from './RoomCard';

interface ResultsListProps {
  results: Room[];
  exactIds?: string[];
  highlightQuery?: string;
}

const ResultsList: React.FC<ResultsListProps> = ({ results, exactIds, highlightQuery }) => {
  if (!results || results.length === 0) {
    return (
      <div style={{ textAlign: 'center', margin: '20px 0', color: '#666' }}>
        No rooms found. Try a different search term.
      </div>
    );
  }

  return (
    <div>
      {results.map((room) => (
        <RoomCard
          key={room.id}
          room={room}
          isExact={!!exactIds?.includes(room.id)}
          highlightQuery={highlightQuery}
        />
      ))}
    </div>
  );
};

export default ResultsList;
