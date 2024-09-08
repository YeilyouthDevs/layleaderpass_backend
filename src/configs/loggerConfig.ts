import { FastifyReply, FastifyRequest } from "fastify";
import fs from "fs-extra";
import cron from "node-cron";
import path from "path";
import UAParser from 'ua-parser-js';
import { isProduct, isTest, MAX_LOG_COUNT, projectRoot, runtime } from "./envConfig";


//원본 로그 메서드 백업
export const originalConsoleLog = console.log;
export const originalConsoleWarn = console.warn;
export const originalConsoleError = console.error;
export const originalConsoleDebug = console.debug;

// 최대 로그 파일 개수
const MAX_LOG_FILES = MAX_LOG_COUNT - 1; 

// 로그 폴더 경로
const LOG_DIR = path.join(projectRoot, "logs", runtime);

// 로그 폴더 생성
fs.ensureDirSync(LOG_DIR);

//로그 사용 모드
const writeDebug = !isProduct
const writeError = true;
const writeWarn = true;
const writeInfo = true;

// 새 로그 파일 생성
function createNewLogFile() {
  cleanUpOldLogFiles('.total.log'); // 로그 파일 수 유지

  const date = new Date();
  const formattedDate = date.toISOString().replaceAll(/:/g, "-");
  const logFileName = `${formattedDate}.total.log`;

  return fs.createWriteStream(path.join(LOG_DIR, logFileName), { flags: "a" });
}

// 새 오류 로그 파일 생성
function createNewErrorLogFile() {
  cleanUpOldLogFiles('.error.log');

  const date = new Date();
  const formattedDate = date.toISOString().replaceAll(/:/g, "-");
  const errorLogFileName = `${formattedDate}.error.log`;

  return fs.createWriteStream(path.join(LOG_DIR, errorLogFileName), { flags: "a" });
}

// 로그 폴더 내의 로그 파일 개수 검사 및 오래된 로그 파일 삭제
function cleanUpOldLogFiles(endsWith: string) {
  fs.readdir(LOG_DIR, (err, files) => {
    if (err) throw err;
    files = files.filter((file) => file.endsWith(endsWith));
    if (files.length > MAX_LOG_FILES) {
      // 파일 이름으로 정렬하여 가장 오래된 파일부터 삭제
      files.sort();
      const deleteCount = files.length - MAX_LOG_FILES;
      for (let i = 0; i < deleteCount; i++) {
        fs.unlink(path.join(LOG_DIR, files[i]), (err) => {
          // if (err) throw err;
        });
      }
    }
  });
}

// 로그 파일 생성
export let logStream = createNewLogFile();

// 오류 로그 파일 생성
export let errorLogStream = createNewErrorLogFile();

// 가변인자 문자열로 변환
function argsToString(args: Array<any>) {
  return args
    .map((arg) => {
      try {
        if(typeof arg === "object") return JSON.stringify(arg);
        else return arg;
      } catch (error) {
        return '[NOT CONVERTABLE]'
      }
    }).join(" ");
}

// 로그 필터링
function filter(uri: String) {
  if (uri.startsWith('/_app')) return false;
  if (uri.startsWith('/images')) return false;
  if (uri.startsWith('/favicon')) return false;

  return true;
}

//로그
console.log = (...args) => {
  const timestamp = `[${new Date().toISOString()}]`;
  originalConsoleLog(`\x1b[32m[INFO]\x1b[0m`, `\x1b[36m${timestamp}\x1b[0m`, ...args);
  if (writeInfo) logStream.write(`[INFO] ${timestamp} ${argsToString(args)}\n`);
};

//경고
console.warn = (...args) => {
  const timestamp = `[${new Date().toISOString()}]`;
  originalConsoleWarn(`\x1b[33m[WARN]\x1b[0m`, `\x1b[36m${timestamp}\x1b[0m`, ...args);
  if (writeWarn) logStream.write(`[WARN] ${timestamp} ${argsToString(args)}\n`);
};

//에러로그 쓰기
function writeErrorLog(timestamp: string, args: any[]){
  args.forEach(arg => {
    // Error 객체인 경우
    if(arg instanceof Error){
      // Error 메시지와 스택 트레이스를 명시적으로 문자열로 변환하여 기록
      const errorInfo = `[ERROR] ${timestamp} ${JSON.stringify(arg)}\n${arg.stack}\n`;
      logStream.write(errorInfo);
      errorLogStream.write(errorInfo);
    } else {
      // 그 외의 경우, 객체는 JSON.stringify로 변환, 그렇지 않으면 그대로 기록
      const info = (typeof arg === "object" && arg !== null) ? JSON.stringify(arg) : arg;
      const logEntry = `[ERROR] ${timestamp} ${info}\n`;
      logStream.write(logEntry);
      errorLogStream.write(logEntry);
    }
  });
}

//에러
console.error = (...args) => {
  const timestamp = `[${new Date().toISOString()}]`;
  originalConsoleError(`\x1b[31m[ERROR]\x1b[0m`, `\x1b[36m${timestamp}\x1b[0m`, ...args);
  if (writeError) writeErrorLog(timestamp, args);
};


//디버그
console.debug = (...args) => {
  const timestamp = `[${new Date().toISOString()}]`;
  originalConsoleDebug(`\x1b[34m[DEBUG]\x1b[0m`, `\x1b[36m${timestamp}\x1b[0m`, ...args);
  if (writeDebug)
    logStream.write(`[DEBUG] ${timestamp} ${argsToString(args)}\n`);
};

//요청
export function logFastifyRequest(
  request: FastifyRequest,
  reply: FastifyReply
) {
  if (filter(request.url)) {
    const timestamp = `[${new Date().toISOString()}]`;

    const head = `${request.method} ${request.url}`;
  
    const parser = new UAParser(request.headers["user-agent"]);
    const result = parser.getResult();
    
    const logObject = {
      id: request.id,
      ip: request.ip,
      brw: `${result.browser.name} ${result.browser.version}`,
      os: `${result.os.name} ${result.os.version}`
    };

    originalConsoleLog(`\x1b[35m[REQUEST]\x1b[0m`, `\x1b[36m${timestamp}\x1b[0m`, head, logObject);
    logStream.write(
      `[REQUEST] ${timestamp} ${head} ${JSON.stringify(logObject)}\n`
    );
  }
}

//응답
export function logFastifyReply(request: FastifyRequest, reply: FastifyReply) {
  if (filter(request.url)) {
    const timestamp = `[${new Date().toISOString()}]`;

    const head = `${request.method} ${request.url}`;

    const logObject = {
      id: request.id,
      status: reply.statusCode,
      el: Math.round(reply.elapsedTime * 1000) / 1000,
    };

    originalConsoleLog(`\x1b[35m[RESPONSE]\x1b[0m`, `\x1b[36m${timestamp}\x1b[0m`, head, logObject);
    logStream.write(
      `[RESPONSE] ${timestamp} ${head} ${JSON.stringify(logObject)}\n`
    );
  }
}

// 로그 파일 생성 크론
if (!isTest){
  cron.schedule(
    "0 0 * * *", // 매일 자정에 실행
    () => {
      logStream.end(); // 기존 로그 스트림을 닫음
      logStream = createNewLogFile(); // 새 로그 파일을 위한 스트림 생성

      errorLogStream.end(); // 오류 로그 스트림도 닫음
      errorLogStream = createNewErrorLogFile(); // 새 오류 로그 파일을 위한 스트림 생성
    },
    {
      scheduled: true,
      timezone: "Asia/Seoul",
    }
  );
}