import { sequelize } from "@/configs/sequelizeConfig";
import { UserRole, mapRoleLevel } from "@/enums/userRole";
import { User } from "@/models/user";
import { Session } from "@/lib/session";
import { FastifyReply, FastifyRequest } from "fastify";

export function checkRole(options: { min?: UserRole, allowRestored?: boolean }){
    const minLevel = mapRoleLevel(options.min ?? UserRole.GUEST);

    return async (req: FastifyRequest, rep: FastifyReply) => {

        const transaction = await sequelize.transaction();

        try {
            const email = req.headers['email'] as string;
            if (!email) throw new Error('헤더에 이메일이 없음')
    
            const user = await User.findByPk(email, {
                attributes: ['role', 'deletedAt', 'isDeleted'],
                paranoid: false,
                transaction
            });
    
            if (!user || user.deletedAt) throw new Error('사용자가 존재하지 않음');
            if (!options.allowRestored && user.isDeleted) throw new Error('복원된 사용자는 허용되지 않음')

            const userRoleLevel = mapRoleLevel(user.role);

            if (userRoleLevel < minLevel){
                return sendNotEnoughRoleReply(rep, '서비스 이용권한이 부족합니다.');
            }

            await transaction.commit();
        } catch (error) {
            console.error('권한 검사 오류', error);
            await transaction.rollback();
            return Session.sendNeedLoginReply(rep, '로그인 후 이용가능한 서비스입니다.');
        }
    }
}

function sendNotEnoughRoleReply(rep: FastifyReply, message: string | undefined = undefined){
    return rep.status(403).header('x-not-enough-role', true).send({ message });
}