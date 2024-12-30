// sequelizeConfig.ts
import { Sequelize } from "sequelize";
import { loadModels } from "../models/__loadModel";
import { disconnectToRedis } from "./redisConfig";
import { setIf } from "../lib/queryTools";
import { isProduct, isDevelop, isPreview, DB_HOST, DB_NAME, DB_PW, DB_USER } from "./envConfig";

export let sequelize = new Sequelize(DB_NAME, DB_USER, DB_PW, {
    host: DB_HOST,
    dialect: "mysql",
    logging: (isDevelop || isPreview) ? console.log : false,
    timezone: "+09:00",
    ...setIf(isProduct, {
        pool: {
        max: 80,           // 최대 연결 수
        min: 0,            // 최소 연결 수
        idle: 60000,       // 유휴 시간: 60초
        evict: 90000,      // 유휴 연결 검사 주기: 90초
        acquire: 40000,    // 연결 획득 타임아웃: 40초
            validate: (client: any) => {
                return client && client.connection && client.connection.stream && !client.connection.stream.destroyed;
            }
        },
        dialectOptions: {
            enableKeepAlive: true,
            keepAliveInitialDelay: 0
        },
        retry: {
            max: 3
        }
    }),

});

export async function connectDatabase() {
    try {
        loadModels(sequelize);
        console.log(`데이터베이스 연결됨(${DB_NAME})`);
    } catch (error) {
        console.log(`데이터베이스 연결중 오류발생(${DB_NAME})`, error);
    }
}

export async function disconnectDatabase() {
    await sequelize.close();
    await disconnectToRedis();
}
