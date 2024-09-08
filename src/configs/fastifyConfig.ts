// fastifyConfig.ts

import { generateCustomErrorMessage } from "../validationLocalize";
import * as loggerConfig from "./loggerConfig";

import fastifyCookie from "@fastify/cookie";
import fastifyMultipart from '@fastify/multipart';
import fastifyStatic from "@fastify/static";
import fastifyView from "@fastify/view";
import ejs from 'ejs';
import fastify from "fastify";
import path from 'path';
import { COOKIE_SECRET_KEY, PORT, projectRoot, TEMPLATE_ROOT } from "./envConfig";

export const app = fastify({
  trustProxy: true,
  ignoreTrailingSlash: true,
})

//ejs 사용
app.register(fastifyView, {
  engine: { ejs: ejs },
  includeViewExtension: true,
  root: path.join(projectRoot, TEMPLATE_ROOT),
})

// 정적파일
app.register(fastifyStatic, {
  root: path.join(projectRoot, 'frontend-build'),
  // prefix: '/',
  wildcard: false
});

/* 추가 static 디렉토리 */
app.register(fastifyStatic, {
  root: path.join(projectRoot, 'static'),
  prefix: '/static/',
  decorateReply: false
});

//쿠키
app.register(fastifyCookie, {
  secret: COOKIE_SECRET_KEY,
})

// 파일 Multipart
app.register(fastifyMultipart);

// 요청 로깅
app.addHook("onRequest", (request, reply, done) => {
  loggerConfig.logFastifyRequest(request, reply);
  done(); // 계속 진행
});

// 응답 로깅
app.addHook("onResponse", (request, reply, done) => {
  loggerConfig.logFastifyReply(request, reply);
  done();
});

//오류 핸들러
app.setErrorHandler((error, request, reply) => {
  if (error.validation) {
    // 검증 오류 핸들링
    const customMessage = generateCustomErrorMessage(error.validation);
    reply
      .status(400)
      .send({ errType: "ValidationError", message: customMessage });
  } else {
    reply.send(error);
  }
});

//SPA 라우터를 위해 모든경로에서 index.html 전송
app.setNotFoundHandler((req, rep) => {
  rep.sendFile('index.html')
});

export const startListen = async () => {
  try {
    const address = await app.listen({ port: PORT });
    console.log(`서버 실행중 ${address}`);
  } catch (error) {
    console.error("서버 시작 중 오류 발생", error);
    process.exit(1);
  }
};

export const stopListen = async () => {
  await app.close();
}
