import { Category } from "@/models/category";
import { Season } from "@/models/season";
import { TalentSum } from "@/models/talentSum";
import { Training } from "@/models/training";
import { TrainingType } from "@/models/trainingType";
import sequelize from "sequelize";

export class HomeService {
    static async loadDashboard(userEmail: string) {
        const currentSeason = await Season.findOne({
            where: { cursor: true },
            attributes: ["id", "name", "startDate", "endDate"],
        });

        if (!currentSeason) return null;

        // 모든 카테고리 쿼리
        const categories = await Category.findAll({
            attributes: ["id", "name"],
            raw: true,
        });

        // 카테고리 별 달란트 합계 구하기
        const talentSums = await TalentSum.findAll({
            attributes: [
                [
                    sequelize.fn("SUM", sequelize.col("TalentSum.sum")),
                    "totalAmount",
                ],
                [sequelize.col("training->trainingType.categoryId"), "categoryId"],
            ],
            include: [
                {
                    model: Training,
                    as: "training",
                    attributes: [],
                    where: {
                        seasonId: currentSeason.id,
                    },
                    include: [
                        {
                            model: TrainingType,
                            as: "trainingType",
                            attributes: [],
                        },
                    ],
                },
            ],
            where: {
                userEmail: userEmail,
            },
            group: ["training->trainingType.categoryId"],
            raw: true,
        });

        // 각 카테고리에 합계값 병합하기
        const result = categories.map((category) => {
            const assignment = talentSums.find((a: any) => a.categoryId === category.id) as any;
            return {
                categoryId: category.id,
                categoryName: category.name,
                totalAmount: assignment ? +assignment.totalAmount : 0,
            };
        });

        return {
            graphData: result,
            currentSeason
        }
    }
}
