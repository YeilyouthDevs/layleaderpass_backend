import { app } from "@/configs/fastifyConfig";
import { ControlledError } from "@/controlledError";
import { renderTemplate } from "@/lib/ejs";
import { createJwtToken, decodeJwtToken, verifyJwtToken } from "@/lib/jwt";
import { sendMail } from "@/lib/mail";
import { checkTurnstile } from "@/middlewares/checkTurnstile";
import { createValidator } from "@/middlewares/createValidator";
import { User } from "@/models/user";
import { UserService } from "@/services/userService";
import bcrypt from "bcrypt";
import Joi from "joi";
import jwt, { JwtPayload } from "jsonwebtoken";
import {
    birthdaySchema,
    emailSchema,
    nameSchema,
    passwordSchema,
    phoneSchema,
} from "llp-validator";

interface RegisterMailData {
    title: string;
    content: string;
    buttonName: string;
    link: string;
}

const REGISTER_EMAIL_TIMEOUT = 1200;

export function enroll() {
    /**
     * 회원가입 이메일을 보냄
     */
    app.post(
        "/api/register/sendEmail",
        {
            preValidation: createValidator(
                Joi.object({
                    email: emailSchema,
                }),
                { allowUnknown: true }
            ),
            preHandler: [checkTurnstile],
        },
        async (req, rep) => {
            try {
                const { email } = req.body as any;

                const origin = req.headers.origin; //메일 전송을 요청했던 도메인 (localhost면 localhost로, 도메인이면 해당 도메인)
                if (!origin)
                    throw new ControlledError({
                        message: "요청인자가 부족합니다.",
                    });

                const token = createJwtToken({ email }, REGISTER_EMAIL_TIMEOUT);

                const linkUrl =
                    origin + '/register/form' + `?token=${token}`;
                console.debug(`${email} 의 회원가입 링크: ${linkUrl} `);

                const title = "회원가입 메일입니다";
                const mailBody = await renderTemplate("linkedMail", {
                    title,
                    content:
                        "안녕하세요. 중직자PASS 회원가입 메일입니다. <br>아래 버튼을 눌러 회원가입을 진행해주세요.",
                    buttonName: "회원가입",
                    link: linkUrl,
                } as RegisterMailData);

                await sendMail(email, title, mailBody);

                rep.send({
                    message: "회원가입 메일이 전송되었습니다.",
                    expireAt: decodeJwtToken(token)!.exp,
                });
            } catch (error) {
                ControlledError.catch(rep, error, {
                    message: "회원가입 메일을 전송하는 중 오류가 발생했습니다.",
                });
            }
        }
    );

    /**
     * 회원가입 토큰이 유효한지 검사함
     */
    app.post("/api/register/checkMailToken", async (req, rep) => {
        try {
            const { token } = req.body as any;

            const invalidError = new ControlledError({
                message: "올바르지 않은 접근입니다.",
            });

            if (!token) throw invalidError;

            let decoded: JwtPayload | null = null;

            try {
                decoded = verifyJwtToken(token);
            } catch (error) {
                if (error instanceof jwt.TokenExpiredError) {
                    throw new ControlledError({
                        message: "회원가입 메일이 만료되었습니다. 다시 시도해주세요.",
                        alertOptions: { type: "fail" }
                    });
                } else if (error instanceof jwt.JsonWebTokenError) {
                    throw invalidError;
                }
            }

            //이미 가입된 이메일인지 확인
            if (decoded) {
                const user = await User.findByPk(decoded.email);
                if (user){
                    throw new ControlledError({
                        message: "이미 가입된 이메일입니다. 만약 본인이 가입하지 않았다면 운영팀으로 문의해주세요.",
                        alertOptions: { type: 'warn' }
                    });
                }
            }

            rep.send({ email: decoded!.email, expireAt: decoded!.exp });
        } catch (error) {
            ControlledError.catch(rep, error, {
                message: "회원가입 메일 토큰의 유효성을 검증하는 중 오류가 발생했습니다.",
            });
        }
    });

    /**
     * 사용자를 생성함, 회원가입 시 사용
     */
    app.post(
        "/api/register/submit",
        {
            preValidation: createValidator(
                Joi.object({
                    email: emailSchema,
                    password: passwordSchema,
                    name: nameSchema,
                    birthday: birthdaySchema,
                    phone: phoneSchema,
                }),
                { allowUnknown: true }
            ),
        },
        async (req, rep) => {
            try {
                const { email, password, name, birthday, phone } =
                    req.body as any;

                const newUser = {
                    email,
                    name,
                    birthday,
                    phone,
                    password: bcrypt.hashSync(password, bcrypt.genSaltSync()),
                };

                const result = await UserService.create(newUser);
                rep.send(result);
            } catch (error) {
                ControlledError.catch(rep, error, {
                    message: "새 사용자를 생성하는 중 오류가 발생했습니다.",
                });
            }
        }
    );

    /**
     * 회원가입 승인여부 또는 거절되어 삭제처리되었는지를 보냄
     */
    app.get("/api/register/checkAcceptState", async (req, rep) => {
        try {
            const { email } = req.query as any;

            if (!email) throw new Error("요청인자 부족");

            const user = await User.findByPk(email, {
                attributes: [
                    "name",
                    "role",
                    "deletedAt",
                    "deleteConfirmAt",
                ],
                paranoid: false,
            });

            if (!user) throw new Error("사용자 객체 없음");

            rep.send(user);
        } catch (error) {
            ControlledError.catch(rep, error, {
                message:
                    "회원가입 승인 상태를 가져오는 중 오류가 발생했습니다.",
            });
        }
    });
}
