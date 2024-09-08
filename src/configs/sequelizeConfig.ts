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
            max: 100,
            min: 20,
            evict: 10000,
            idle: 5000,
            acquire: 40000,
            validate: (client: any) => {
                // 커넥션 객체가 존재하고 상태가 "disconnected"가 아닌 경우 유효한 커넥션으로 간주
                if (
                    typeof client !== "object" ||
                    client === null ||
                    client.state === "disconnected"
                ) {
                    return false;
                }

                return true; // 커넥션이 유효하면 true 반환
            },
        },
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
