import fs from 'fs-extra'
import path from "path";
import { projectRoot } from '@/configs/envConfig';
import { Sequelize } from 'sequelize';

export function pastDateRandomDelta(date: Date, { day = 7, hour = 6, minutes = 60, seconds = 60 } = {}) {
  const newDate = new Date(date); // 원본 Date 객체를 복사하여 새 Date 객체 생성
  const randomDays = Math.floor(Math.random() * (day + 1));
  const randomHours = Math.floor(Math.random() * (hour + 1));
  const randomMinutes = Math.floor(Math.random() * (minutes + 1));
  const randomSeconds = Math.floor(Math.random() * (seconds + 1));

  newDate.setDate(newDate.getDate() - randomDays);
  newDate.setHours(newDate.getHours() - randomHours);
  newDate.setMinutes(newDate.getMinutes() - randomMinutes);
  newDate.setSeconds(newDate.getSeconds() - randomSeconds);

  return newDate;
}


export async function runSqlFile(sequelize: Sequelize, filePath: string) {
  // SQL 파일의 내용을 읽어옵니다.
  const sqlQuery = fs.readFileSync(path.join(projectRoot, filePath), 'utf8');

  // 세미콜론(;)으로 SQL 명령어를 구분하여 목록으로 나눕니다.
  const sqlStatements = sqlQuery.split(';').map(stmt => stmt.trim()).filter(stmt => stmt.length);

  // 각 SQL 명령어를 순차적으로 실행합니다.
  for (const statement of sqlStatements) {
    if (statement.length > 0) await sequelize.query(statement, { raw: true });
  }
}