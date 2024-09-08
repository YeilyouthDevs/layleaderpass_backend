import nodemailer from "nodemailer";
import { sleep } from "./tools";
import { isProduct, APP_NAME, MAIL_ID, MAIL_SERVICE, MAIL_PW } from "@/configs/envConfig";

// 메일 전송기 설정
let transporter = nodemailer.createTransport({
  service: MAIL_SERVICE,
  auth: {
    user: MAIL_ID,
    pass: MAIL_PW,
  },
});

// 메일 사용 설정
let useMail = true;
export function setUseMail(value: boolean) {
  useMail = value;
}

interface Mail {
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string;
}

// 메일 큐
let emailQueue: Mail[] = [];

// 이메일 전송 함수
export async function sendMail(to: string, subject: string, body: string) {
  if (!useMail) return;

  if (!isProduct && to.startsWith('user')) { // 테스트 환경에서는 user로시작하는 가짜이메일에는 전송하지않음
    await new Promise(resolve => setTimeout(resolve, 1000)); // 모의 지연
    return true;
  }

  let mailOptions = {
    from: `${APP_NAME} <${MAIL_ID}>`,
    to: to,
    subject: `[${APP_NAME}] ${subject}`,
    text: "",
    html: ""
  };

  body = body.trim();
  if (body.startsWith("<!DOCTYPE html>")) {
    mailOptions.html = body;
  } else {
    mailOptions.text = body;
  }

  emailQueue.push(mailOptions); // 메일 큐에 추가
  flushQueue(); // 큐 처리 시작
}

let flushing = false;

// 큐를 처리하는 함수
async function flushQueue() {
  if (flushing) return;
  flushing = true;

  while (emailQueue.length > 0) {
    const mail = emailQueue.shift();
    if (!mail) continue;

    await sleep(500);

    transporter.sendMail(mail)
    .then((info) => {
      console.debug("이메일 전송됨:", info.response);
    })
    .catch((error) => {
      console.error("이메일 전송 실패:", error);
      emailQueue.push(mail); // 실패한 메일을 큐에 다시 추가
      flushQueue();
    })
    
  }

  flushing = false;
}
