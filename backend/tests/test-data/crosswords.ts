
import { DataSource } from 'typeorm';
import { Crossword } from '../../src/entities/Crossword';

export const create = async (connection: DataSource) => {
  const crosswordRepository = connection.getRepository(Crossword);

  const testCrosswords = [
    {
      clues: { across: [], down: [] },
      answers: { across: [], down: [] },
      author: 'Test Author',
      circles: [],
      date: new Date(),
      dow: 'Monday',
      grid: [],
      gridnums: [],
      shadecircles: false,
      col_size: 15,
      row_size: 15,
      jnote: 'Test note',
      notepad: 'Test notepad',
      title: 'Test Crossword',
    },
  ];

  for (const crosswordData of testCrosswords) {
    const crossword = crosswordRepository.create(crosswordData);
    await crosswordRepository.save(crossword);
  }
  console.log('Test crosswords created.');
};
