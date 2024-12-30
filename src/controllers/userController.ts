// userController.ts

import { app } from "@/configs/fastifyConfig";
import { ControlledError } from "@/controlledError";
import { UserRole } from "@/enums/userRole";
import { ensureNotEmpty } from "@/lib/validation";
import { checkRole } from "@/middlewares/checkRole";
import { checkSession } from "@/middlewares/checkSession";
import { createValidator } from "@/middlewares/createValidator";
import { UserService } from "@/services/userService";
import Joi from "joi";
import {
    emailSchema
} from "llp-validator";

export function enroll() {

    app.get(
        "/api/user/list",
        {
            preHandler: [checkSession(), checkRole({ min: UserRole.ADMIN })],
        },
        async (req, rep) => {
            try {
                const pageData = await UserService.getList(req);
                rep.send(pageData);
            } catch (error) {
                ControlledError.catch(rep, error, {
                    message: "사용자 목록을 가져오는 중 오류 발생",
                });
            }
        }
    );

    /**
     * 사용자가 존재하는지(이메일이 사용중인지) 확인함
     */
    app.get(
        "/api/user/isExists",
        {
            preValidation: createValidator(
                Joi.object({
                    email: emailSchema,
                })
            ),
        },
        async (req, rep) => {
            try {
                const { email } = req.query as any;

                const result = await UserService.isExists(email);
                rep.send(result);
            } catch (error) {
                ControlledError.catch(rep, error, {
                    message: "사용자가 존재하는지 확인하는 도중 오류가 발생했습니다.",
                });
            }
        }
    );

    /**
     * 사용자 자신의 정보를 가져옴
     */
    app.get(
        "/api/user/selfInfo",
        {
            preHandler: [checkSession()],
        },
        async (req, rep) => {
            try {
                const { email, forEdit } = req.query as any;
                ensureNotEmpty([email]);

                const result = await UserService.getSelfInfo(email, forEdit ? true : false);
                rep.send(result.payload?.user);
            } catch (error) {
                ControlledError.catch(rep, error, {
                    message: "사용자가 존재하는지 확인하는 도중 오류가 발생했습니다.",
                });
            }
        }
    );

    /**
     * 사용자 이름과 연락처 보기
     */
    app.get("/api/user/contact", {
        preHandler: [checkSession(), checkRole({ min: UserRole.USER })]
    }, async (req, rep) => {
        try {
            const { id } = req.query as any;
            ensureNotEmpty([id]);

            const data = await UserService.getContact(id);
            rep.send(data)
        } catch (error) {
            ControlledError.catch(rep, error, {
                message: "사용자 연락처를 불러오는 중 오류가 발생했습니다.",
            });
        }
    });

    app.post('/api/user/leaveOut', {
        preHandler: [checkSession(), checkRole({ min: UserRole.GUEST, allowRestored: true })]
    }, async (req, rep) => {
        try {
            const { email } = req.headers as any;

            const result = await UserService.delete(email);
            rep.send(result)

        } catch (error) {
            ControlledError.catch(rep, error, {
                message: "회원 탈퇴 중 오류가 발생했습니다.",
            });
        }
    })

    app.post('/api/user/edit', {
        preHandler: [checkSession(), checkRole({ min: UserRole.GUEST, allowRestored: true })]
    }, async (req, rep) => {
        try {
            const { updated, isDeleted } = req.body as any;
            const { email } = req.headers as any;

            const result = await UserService.edit(email, updated, (isDeleted ? true : false));
            rep.send(result)

        } catch (error) {
            ControlledError.catch(rep, error, {
                message: "사용자 정보 수정 중 오류가 발생했습니다.",
            });
        }
    })

    app.get(
        "/api/user/selector",
        {
            preHandler: [checkSession(), checkRole({ min: UserRole.USER })],
        },
        async (req, rep) => {
            try {
                const data = await UserService.searchUserSelector(req);
                rep.send(data);
            } catch (error) {
                ControlledError.catch(rep, error, {
                    message: "사용자 목록을 불러오는 중 오류가 발생했습니다.",
                });
            }
        }
    );

    app.get(
        "/api/user/getAcceptNo",
        {
            preHandler: [checkSession(), checkRole({ min: UserRole.USER })],
        },
        async (req, rep) => {
            try {
                const data = await UserService.getAcceptNo(req);
                rep.send(data);
            } catch (error) {
                ControlledError.catch(rep, error, {
                    message: "사용자의 가입승인번호를 불러오는 중 오류가 발생했습니다.",
                });
            }
        }
    );

}
