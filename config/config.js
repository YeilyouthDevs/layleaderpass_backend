import { configDotenv } from "dotenv";
configDotenv();

const DB_USER = process.env['DB_USER'];
const DB_PW = process.env['DB_PW'];
const DB_NAME_PRODUCT = process.env['DB_NAME_PRODUCT'];
const DB_NAME_DEVELOP = process.env['DB_NAME_DEVELOP'];
const DB_NAME_TEST = process.env['DB_NAME_TEST'];
const DB_HOST = process.env['DB_HOST'];

if (!DB_USER || !DB_PW || !DB_NAME_PRODUCT || !DB_NAME_DEVELOP || !DB_NAME_TEST || !DB_HOST) {
  throw new Error('환경변수 없음');
}

module.exports = {
  development: {
    username: DB_USER,
    password: DB_PW,
    database: DB_NAME_DEVELOP,
    host: DB_HOST,
    dialect: "mysql"
  },
  test: {
    username: DB_USER,
    password: DB_PW,
    database: DB_NAME_TEST,
    host: DB_HOST,
    dialect: "mysql"
  },
  production: {
    username: DB_USER,
    password: DB_PW,
    database: DB_NAME_PRODUCT,
    host: DB_HOST,
    dialect: "mysql"
  }
}
