import 'module-alias/register';
import { addAliases } from 'module-alias';
import { join } from 'path';

addAliases({
  '@': join(__dirname, 'src'),
});

import { configDotenv } from 'dotenv';
import { disconnectDatabase, forceResetDatabase } from './src/configs/sequelizeConfig';
import { ensureNotEmpty } from './src/lib/validation';

const dbName = process.env[`DB_NAME_${process.env.RUNTIME}`] as string;
ensureNotEmpty([dbName]);

export default async () => {
  configDotenv();

  await forceResetDatabase(dbName);
  await disconnectDatabase();
};
