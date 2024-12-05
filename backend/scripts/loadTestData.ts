import { DataSource } from "typeorm"
import { User } from "../src/entities/User"



import {config} from '../src/config/config';
const AppDataSource = new DataSource(config.db);


const connection = await AppDataSource.initialize();

async function syncDatabase() {

    await connection.synchronize();

    const userRepository = connection.getRepository(User);

    const testUsers = [
        { username: 'testuser', githubId: 'john123', role: 'USER' },
        { username: 'testadmin', githubId: 'jane456', role: 'ADMIN' },
    ];

    for (const userData of testUsers) {
        const user = userRepository.create(userData);
        await userRepository.save(user);
    }

    console.log('Database synchronized and test users created.');
    await connection.close();
}

syncDatabase().catch(error => console.log(error));
