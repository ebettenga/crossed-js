import { DataSource } from 'typeorm';
import { User } from '../../entities/User';

export const create = (connection: DataSource) => async (req, res) => {
  const userRepository = connection.getRepository(User);

  const testUsers = [
    { username: 'testuser', githubId: 'john123', role: 'USER' },
    { username: 'testadmin', githubId: 'jane456', role: 'ADMIN' },
  ];

  for (const userData of testUsers) {
    const user = userRepository.create(userData);
    await userRepository.upsert(user, []);
  }

  console.log('Test users created.');
};
