//envConfig.ts
import { configDotenv } from "dotenv";
configDotenv();

export function loadEnvField(varibleName: string): string {
    const variable = process.env[varibleName];
    if (variable === null || variable === undefined || (typeof variable === 'string' && variable.trim() === '')) {
        throw new Error(`환경변수 ${varibleName} 유효하지 않음`);
    }
    return variable!
}

//환경변수 캐싱
export const runtime = loadEnvField('RUNTIME');
console.log('RUNTIME 환경', runtime)

export const isProduct = runtime === 'PRODUCT';
export const isPreview = runtime === 'PREVIEW';
export const isDevelop = runtime === 'DEVELOP';
export const isTest = runtime === 'TEST';
export const projectRoot = loadEnvField('PROJECT_ROOT');
export const TEMPLATE_ROOT = loadEnvField('TEMPLATE_ROOT');

export const MAX_LOG_COUNT = parseInt(loadEnvField('MAX_LOG_COUNT'));

export const PORT = parseInt(loadEnvField('PORT_' + runtime));
export const DB_HOST = loadEnvField('DB_HOST');
export const DB_USER = loadEnvField('DB_USER');
export const DB_PW = loadEnvField('DB_PW');
export const DB_NAME = loadEnvField('DB_NAME_' + runtime);

export const APP_NAME = loadEnvField('APP_NAME');

export const MAIL_SERVICE = loadEnvField('MAIL_SERVICE');
export const MAIL_ID = loadEnvField('MAIL_ID');
export const MAIL_PW = loadEnvField('MAIL_PW');

export const JWT_SECRET_KEY = loadEnvField('JWT_SECRET_KEY');
export const COOKIE_SECRET_KEY = loadEnvField('COOKIE_SECRET_KEY');
export const TURNSTILE_SECRET_KEY = loadEnvField('TURNSTILE_SECRET_KEY');

export const REDIS_HOST = loadEnvField('REDIS_HOST');
export const REDIS_PW = loadEnvField('REDIS_PW')
export const REDIS_PORT = loadEnvField('REDIS_PORT');
export const REDIS_DB = loadEnvField('REDIS_DB_' + runtime);

export const TEMP_FILE_PATH = loadEnvField('TEMP_FILE_PATH');
export const FILE_BASE_DEFAULT = loadEnvField('FILE_BASE_DEFAULT');
export const TEST_TEMP_FILE_PATH = loadEnvField('TEST_TEMP_FILE_PATH');
export const TEST_FILE_BASE_DEFAULT = loadEnvField('TEST_FILE_BASE_DEFAULT');

export const DEV_ID = loadEnvField('DEV_ID');
export const DEV_PW = loadEnvField('DEV_PW');



