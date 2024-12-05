
import { Log } from '../../entities/Log';

export const create = (connection) => async () => {
  const logRepository = connection.getRepository(Log);

  const log1 = new Log();
  log1.log = { message: 'Test log 1' };
  log1.severity = 'info';

  const log2 = new Log();
  log2.log = { message: 'Test log 2' };
  log2.severity = 'error';

  console.log("Test Logs created successfully")
  await logRepository.save([log1, log2]);
};
