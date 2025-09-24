export interface Room {
  id: string;
  room_id: string;
  aliases: string; // Pipe separated
  floor: string; // numeric as string, 0 for ground
  tags: string;
  map_image: string;
  category: string;
  description: string;
  building: string;
  type: string;
  person?: string; // Optional; names pipe-separated, may be empty
}
