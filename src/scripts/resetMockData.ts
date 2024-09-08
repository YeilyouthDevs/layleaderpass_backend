import { DB_HOST, DB_PW, DB_USER, loadEnvField, TEST_FILE_BASE_DEFAULT, TEST_TEMP_FILE_PATH } from '../configs/envConfig';
import { Sequelize } from "sequelize";
import { loadModels } from '../models/__loadModel';
import fs from 'fs-extra';

// 환경 변수 로딩
const DB_NAME_DEVELOP = loadEnvField('DB_NAME_DEVELOP');
const DB_NAME_TEST = loadEnvField('DB_NAME_TEST');

// sequelize 인스턴스 생성 (초기화 시 동적으로 변경)
export let sequelize: Sequelize;

// 데이터베이스 연결 함수
export async function connectDatabase(dbName: string) {
    try {
        sequelize = new Sequelize(dbName, DB_USER, DB_PW, { 
            host: DB_HOST,
            dialect: "mysql",
            logging: false
        });

        console.log(`데이터베이스 연결됨(${dbName})`);
    } catch (error) {
        console.error(`데이터베이스 연결중 오류발생(${dbName})`, error);
        throw error;
    }
}

// 데이터베이스 연결 해제 함수
export async function disconnectDatabase() {
    try {
        await sequelize.close();
        console.log("데이터베이스 연결 해제됨");
    } catch (error) {
        console.error("데이터베이스 연결 해제 중 오류 발생", error);
    }
}

// DB 초기화 함수
export async function forceResetDatabase(dbName: string) {
    try {
        await connectDatabase(dbName);

        await sequelize.query(`DROP DATABASE IF EXISTS ${dbName};`);
        await sequelize.query(`CREATE DATABASE IF NOT EXISTS ${dbName};`);
        await sequelize.query(`USE ${dbName};`);

        loadModels(sequelize);
        await sequelize.sync({ force: true });
        
        console.log(`${dbName} 데이터베이스 초기화 완료`);
    } catch (error) {
        console.error(`데이터베이스 초기화 중 오류 발생(${dbName})`, error);
        throw error;
    }
}

async function main() {
    // npm run 에서 --env 전달받기
    const env = process.env.npm_config_env?.toUpperCase() || 'DEVELOP';

    let dbName = '';
    
    if (env === 'TEST') {
        dbName = DB_NAME_TEST;
    } else {
        dbName = DB_NAME_DEVELOP;
    }

    // 자료제출 초기화
    console.log('자료제출 초기화 중...');
    fs.emptyDirSync(TEST_FILE_BASE_DEFAULT);
    fs.emptyDirSync(TEST_TEMP_FILE_PATH);

    // 특정 DB 초기화
    console.log(`${env} 환경 DB 초기화 중...`);
    await forceResetDatabase(dbName);

    await disconnectDatabase(); // DB 해제
    process.exit(0);
}

// 실행
main().catch((error) => {
    console.error("DB 초기화 중 오류 발생:", error);
    process.exit(1);
});
