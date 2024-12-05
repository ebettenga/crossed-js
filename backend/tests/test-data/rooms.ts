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
  const crossword = await crosswordRepository.findOne({ where: { title: 'Test Crossword' } });

  if (!user1 || !user2 || !crossword) {
    console.error('Test data for rooms init script not found.');
    return;
  }

  const existingRoom = await roomRepository.findOne({ where: { difficulty: 'easy' } });

  if (existingRoom) {
    console.log('Room with easy difficulty already exists.');
    return;
  }
  const room = roomRepository.create({
    player_1: user1,
    player_2: user2,
    crossword,
    found_letters: ["*", "*", "*", "*", "*", "*", "*", "*", "*", "*", "*"],
    difficulty: 'easy',
    player_1_score: 0,
    player_2_score: 0,
  });

  await roomRepository.save(room);
  console.log('Test room created.');
};
