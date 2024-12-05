import { DataSource } from 'typeorm';
import { User } from '../../src/entities/User';

export const create = async (connection: DataSource) => {
  const userRepository = connection.getRepository(User);

  const testUsers = [
    { username: 'testuser', githubId: 'john123', role: 'USER' },
    { username: 'testadmin', githubId: 'jane456', role: 'ADMIN' },
  ];

  for (const userData of testUsers) {
    const existingUser = await userRepository.findOneBy({
      username: userData.username,
    });
    if (!existingUser) {
      const user = userRepository.create(userData);
      await userRepository.save(user);
    }
    console.log('Test users created.');
  }
};
