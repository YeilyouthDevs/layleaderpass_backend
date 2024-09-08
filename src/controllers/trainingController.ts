import { app } from "@/configs/fastifyConfig";
import { ControlledError } from "@/controlledError";
import { UserRole } from "@/enums/userRole";
import { ensureNotEmpty } from "@/lib/validation";
import { checkRole } from "@/middlewares/checkRole";
import { checkSession } from "@/middlewares/checkSession";
import { Training } from "@/models/training";
import { TrainingType } from "@/models/trainingType";
import { TrainingService } from "@/services/trainingService";
import { TrainingTypeService } from "@/services/trainingTypeService";

export function enroll() {
    app.get(
        "/api/training/list/:tab",
        {
            preHandler: [checkSession(), checkRole({ min: UserRole.USER })],
        },
        async (req, rep) => {
            try {
                const pageData = await TrainingService.getList(req);
                rep.send(pageData);
            } catch (error) {
                ControlledError.catch(rep, error, {
                    message: "훈련 목록을 불러오는 중 오류가 발생했습니다.",
                });
            }
        }
    );

    app.get(
        "/api/training/spec",
        {
            preHandler: [checkSession(), checkRole({ min: UserRole.GUEST })],
        },
        async (req, rep) => {
            try {
                const { id } = req.query as any;

                const trainingSchema = await Training.findByPk(id, {
                    attributes: [
                        "id",
                        "trainingTypeId",
                        "title",
                        "content",
                        "startAt",
                        "endAt",
                        "submitStartAt",
                        "submitEndAt",
                        "createdAt",
                        "createdBy",
                        "updatedAt",
                        "updatedBy",
                        "fileSetId",
                    ],
                    include: [
                        {
                            model: TrainingType,
                            foreignKey: "trainingTypeId",
                            as: "trainingType",
                            attributes: [
                                "name",
                                "desc",
                                "minTalent",
                                "maxTalent",
                            ],
                        },
                    ],
                });

                rep.send(trainingSchema);
            } catch (error) {
                ControlledError.catch(rep, error, {
                    message: "훈련 데이터를 불러오는 중 오류가 발생했습니다.",
                });
            }
        }
    );

    app.get("/api/training/searchTrainingType", {}, async (req, rep) => {
        const { search } = req.query as any;

        const data = await TrainingTypeService.serachAllByName(search, {
            attributes: ["id", "name"],
        });

        rep.send(data);
    });

    app.post(
        "/api/training/create",
        {
            preHandler: [checkSession(), checkRole({ min: UserRole.ADMIN })],
        },
        async (req, rep) => {
            try {
                const result = await TrainingService.create(req);
                rep.send(result);
            } catch (error) {
                ControlledError.catch(rep, error, {
                    message: "훈련을 추가하는 도중 오류가 발생했습니다.",
                });
            }
        }
    );

    app.post(
        "/api/training/delete",
        {
            preHandler: [checkSession(), checkRole({ min: UserRole.ADMIN })],
        },
        async (req, rep) => {
            try {
                const { targets } = req.body as any;
                const { email: updater } = req.headers;

                ensureNotEmpty([targets, updater]);

                let results = [];

                for (const target of targets) {
                    results.push(
                        await TrainingService.delete(target, { updatedBy: updater as string })
                    );
                }

                rep.send(results);
            } catch (error) {
                ControlledError.catch(rep, error, {
                    message: "훈련을 삭제하는 도중 오류가 발생했습니다.",
                });
            }
        }
    );

    app.post(
        "/api/training/edit",
        {
            preHandler: [checkSession(), checkRole({ min: UserRole.ADMIN })],
        },
        async (req, rep) => {
            try {
                const result = await TrainingService.edit(req);
                rep.send(result);
            } catch (error) {
                ControlledError.catch(rep, error, {
                    message: "훈련을 수정하는 도중 오류가 발생했습니다.",
                });
            }
        }
    );
}
