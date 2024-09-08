import { app } from "@/configs/fastifyConfig";
import { ControlledError } from "@/controlledError";
import { UserRole } from "@/enums/userRole";
import { checkRole } from "@/middlewares/checkRole";
import { checkSession } from "@/middlewares/checkSession";
import { checkTurnstile } from "@/middlewares/checkTurnstile";
import { createValidator as createPreValidation } from "@/middlewares/createValidator";
import { Session } from "@/lib/session";
import Joi from "joi";
import { emailSchema, passwordSchema } from "llp-validator";

export function enroll() {
    /**
     * 로그인
     */
    app.post(
        "/api/session/signin",
        {
            preValidation: createPreValidation(
                Joi.object({
                    email: emailSchema,
                    password: passwordSchema,
                }),
                { allowUnknown: true }
            ),
            preHandler: [checkTurnstile],
        },
        async (req, rep) => {
            const { email, password, autologin } = req.body as any;

            try {
                const { user, tokens, refreshTimeout } =
                    await Session.signIn(
                        email,
                        password,
                        autologin ? true : false
                    );
                Session.registerTokens(
                    rep,
                    tokens.accessToken,
                    tokens.refreshToken,
                    refreshTimeout
                );

                rep.send(user);
            } catch (error) {
                ControlledError.catch(rep, error, {
                    message: "로그인 처리 중 오류가 발생했습니다.",
                });
            }
        }
    );

    /**
     * 로그아웃
     */
    app.delete("/api/session/signout", async (req, rep) => {
        try {
            const refreshToken = req.cookies["refreshToken"];

            if (refreshToken) {
                await Session.signOut(refreshToken);
            }

            Session.deleteTokens(rep);
            rep.send();
        } catch (error) {
            ControlledError.catch(rep, error, {
                message: "로그아웃 중 오류가 발생했습니다.",
            });
        }
    });

    /**
     * 사이트 재방문시 쿠키에 저장된 refresh token으로 자동로그인 시도
     */
    app.post("/api/session/autologin", async (req, rep) => {
        try {
            const storedRefreshToken = req.cookies["refreshToken"];

            if (storedRefreshToken) {
                const { user, tokens, refreshTimeout } =
                    await Session.autoLogin(storedRefreshToken);
                if (!user)
                    throw new ControlledError({
                        message: "계정이 존재하지 않습니다.",
                        alertOptions: { type: "fail", duration: 3000 },
                    });

                Session.registerTokens(
                    rep,
                    tokens.accessToken,
                    tokens.refreshToken,
                    refreshTimeout
                );
                rep.send(user);
            } else {
                rep.send();
            }
        } catch (error) {
            Session.deleteTokens(rep);
            rep.send({ result: false, message: "자동로그인 실패" });
        }
    });

    app.post(
        "/api/session/deleteAllOtherSession",
        {
            preHandler: [
                checkSession(),
                checkRole({ min: UserRole.GUEST, allowRestored: true }),
            ],
        },
        async (req, rep) => {
            try {
                const { email } = req.headers as any;

                const refreshToken = req.cookies["refreshToken"];
                const counts = await Session.deleteAllOtherSessions(
                    email,
                    refreshToken!
                );

                rep.send(counts);
            } catch (error) {
                ControlledError.catch(rep, error, {
                    message:
                        "다른기기에서 모두 로그아웃 요청 중 오류가 발생했습니다.",
                });
            }
        }
    );
}
