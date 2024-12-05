
import { DataSource } from 'typeorm';
import { Room } from '../../src/entities/Room';
import { User } from '../../src/entities/User';
import { Crossword } from '../../src/entities/Crossword';

export const create = async (connection: DataSource) => {
  const roomRepository = connection.getRepository(Room);
  const userRepository = connection.getRepository(User);
  const crosswordRepository = connection.getRepository(Crossword);

  const user1 = await userRepository.findOne({ where: { username: 'testuser' } });
  const user2 = await userRepository.findOne({ where: { username: 'testadmin' } });
  const crossword = await crosswordRepository.findOne({ where: { id: 1 } });

  const room = roomRepository.create({
    player_1: user1,
    player_2: user2,
    crossword,
    found_letters: [],
    difficulty: 'easy',
  });

  await roomRepository.save(room);
  console.log('Test room created.');
};
