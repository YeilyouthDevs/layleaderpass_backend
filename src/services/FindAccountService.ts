import { redisInst } from "@/configs/redisConfig";
import { ControlledError } from "@/controlledError";
import { renderTemplate } from "@/lib/ejs";
import { maskEmail } from "@/lib/encrypt";
import { createJwtToken, decodeJwtToken, verifyJwtToken } from "@/lib/jwt";
import { sendMail } from "@/lib/mail";
import { Service, ServiceOptions } from "@/lib/service";
import { ensureNotEmpty } from "@/lib/validation";
import { User } from "@/models/user";
import bcrypt from 'bcrypt';
import { FastifyRequest } from "fastify";
import jwt, { JwtPayload } from 'jsonwebtoken';
import { Transaction } from "sequelize";

export class FindAccountService {

    static async findEmail(req: FastifyRequest, options?: ServiceOptions) {
        return await Service.handler(options, async (transaction) => {
            const { name, birthday, phone } = req.body as any;
            ensureNotEmpty([name, birthday])

            const user = await User.findOne({
                attributes: ['email', 'phone'],
                where: {
                    name, birthday,
                },
                transaction
            })

            if (!user || (user?.phone && user.phone !== phone)) throw new ControlledError({
                message: '이름, 생년월일, 전화번호를 다시 확인해주세요.',
                alertOptions: {
                    title: '일치하는 정보가 없음',
                    type: 'warn',
                    duration: 3000
                }
            })

            return Service.result({
                status: true, message: "Done", payload: { email: maskEmail(user.email) }
            })
        });
    }

    static async sendPasswordResetMail(req: FastifyRequest, options?: ServiceOptions) {
        return await Service.handler(options, async (transaction) => {

            const origin = req.headers.origin;
            const { email } = req.body as any;
            ensureNotEmpty([email, origin]);

            const user = await User.findByPk(email, {
                attributes: ['email'],
                transaction
            })

            let token: string | null = null;
            const timeout = parseInt(process.env.REGISTER_EMAIL_TIMEOUT!);

            if (user) {
                //토큰 발급
                token = createJwtToken({ email }, timeout);

                //redis 에 토큰 등록
                const redisKey = `findPw:${email}`
                await redisInst.set(redisKey, token);
                await redisInst.expire(redisKey, timeout);

                const linkUrl = origin + '/findAccount/passwordForm' + `?token=${token}`;

                const title = "비밀번호 재설정 메일입니다";
                const mailBody = await renderTemplate("linkedMail", {
                    title,
                    content: "안녕하세요. 중직자PASS 비밀번호 재설정 메일입니다. <br>아래 버튼을 눌러 비밀번호를 재설정 해주세요.",
                    buttonName: "비밀번호 재설정",
                    link: linkUrl,
                });

                await sendMail(email, title, mailBody);
            }

            return Service.result({
                status: true, message: '비밀번호 재설정 메일이 전송되었습니다.', payload: {
                    expireAt: token ? decodeJwtToken(token!)!.exp : timeout,
                }
            })

        });
    }

    static async checkPasswordResetToken(req: FastifyRequest, options?: ServiceOptions) {
        return await Service.handler(options, async (transaction) => {

            const { token } = req.body as any;

            const invalidError = new ControlledError({
                message: "올바르지 않은 접근입니다.",
                alertOptions: {
                    type: 'fail'
                }
            });

            if (!token) throw invalidError;

            let decoded: JwtPayload | null = null;

            try {
                decoded = verifyJwtToken(token);
            } catch (error) {
                if (error instanceof jwt.TokenExpiredError) {
                    throw new ControlledError({
                        message: "비밀번호 재설정 메일이 만료되었습니다. 다시 시도해주세요.",
                        alertOptions: {
                            type: 'fail'
                        }
                    });
                } else if (error instanceof jwt.JsonWebTokenError) {
                    throw invalidError
                }
            }

            const email = (decoded as any).email;
            
            //redis에서 토큰 유효한지 확인
            const redisKey = `findPw:${email}`
            const storedToken = await redisInst.get(redisKey);

            if (!storedToken || storedToken !== token) throw new ControlledError({
                message: '토큰이 유효하지 않습니다. 메일을 다시 전송해보세요.',
                alertOptions: {
                    type: 'fail'
                }
            })
            
            //남은시간 가져오기
            const expireAt = await redisInst.ttl(redisKey);

            return Service.result({
                status: true, message: "Done", payload: { email, expireAt }
            })

        });
    }

    static async submitPasswordResetForm(req: FastifyRequest, options?: ServiceOptions) {
        return await Service.handler(options, async (transaction) => {

            const { email, password } = req.body as any;
            ensureNotEmpty([email, password]);

            const user = await User.findByPk(email, {
                lock: Transaction.LOCK.UPDATE,
                transaction
            })

            user!.password = await bcrypt.hash(password, await bcrypt.genSalt());
            await user!.save({ transaction });

            const redisKey = `findPw:${email}`
            await redisInst.del(redisKey);

            return Service.result({
                status: true, id: user!.email, message: '비밀번호가 변경되었습니다.'
            })
        });
    }

}
