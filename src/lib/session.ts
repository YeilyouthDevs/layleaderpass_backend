import { ControlledError } from "@/controlledError";
import { setCookie } from "@/lib/cookie";
import { createJwtToken, verifyJwtToken } from "@/lib/jwt";
import redis from "@/lib/redis";
import { User } from "@/models/user";
import bcrypt from 'bcrypt';
import { FastifyReply, FastifyRequest } from "fastify";
import { JwtPayload, TokenExpiredError } from "jsonwebtoken";
import { v4 } from "uuid";
import { TalentService } from "../services/talentService";
import { ServiceOptions } from "@/lib/service";
import { sequelize } from "@/configs/sequelizeConfig";
import { formatDatetime } from "@/lib/date";
import { ACCESS_TIMEOUT, AUTOLOGIN_TIMEOUT, LOGOUT_PROTECT_TIMEOUT, MAX_SESSION_COUNT, REFRESH_TIMEOUT } from "@/configs/envConfig";

export interface AccessTokenClaim extends JwtPayload {
    email: string;
}

export interface RefreshTokenClaim extends JwtPayload {
    email: string;
    uuid: string;
}

export class Session {
    // 세션 키 생성
    private static createSessionKey(email: string, uuid?: string) {
        return `session:${email}:${uuid ? uuid : '*'}`;
    }

    // 로그아웃 보호 키 생성
    private static createLogoutProtectKey(uuid: string) {
        return `protected:${uuid}`;
    }

    // 토큰 검증
    private static checkToken(token: string) {
        try {
            const decoded = verifyJwtToken(token);
            const { email, uuid } = decoded;
            if (!email || !uuid) throw new Error('JWTPayload에 email, uuid 없음');
            return { email, uuid };
        } catch (error) {
            throw new ControlledError({
                message: '유효한 토큰이 아닙니다.',
                alertOptions: { type: 'fail', duration: 3000 }
            });
        }
    }

    // 사용자 정보 가져오기
    private static async getUser(email: string, options?: ServiceOptions) {
        const user = await User.findByPk(email, {
            attributes: ['email', 'name', 'password', 'role', 'talent', 'deletedAt', 'deleteConfirmAt', 'isDeleted'],
            paranoid: false,
            raw: true
        });

        if (!user) return null;
        return user;
    }

    // 로그인 처리
    static async signIn(email: string, password: string, autoLogin = false) {
        const user = await Session.getUser(email);

        if (user && await bcrypt.compare(password, user.password!)) {
            if (user.deletedAt && user.deleteConfirmAt) {
                throw new ControlledError({
                    message: `메일로 탈퇴 처리에 대한 안내를 ${formatDatetime(user.deletedAt, { includeWeekDay: false })}(KST) 에 보내드렸습니다.`,
                    alertOptions: { title: '탈퇴 처리된 계정입니다', type: 'warn' }
                })
            }

            const { tokens, refreshTimeout } = await Session.createSession(email, autoLogin);

            user.password = undefined;
            return { user, tokens, refreshTimeout };
        }

        throw new ControlledError({
            message: '아이디 또는 비밀번호가 올바르지 않습니다.',
            alertOptions: { type: 'warn', duration: 3000 }
        });
    }

    // 자동 로그인 처리
    static async autoLogin(refreshToken: string) {
        const { email, uuid } = Session.checkToken(refreshToken);
        const sessionKey = Session.createSessionKey(email, uuid);
        const isAutoLogin = await redis.inst.get(sessionKey);

        if (isAutoLogin === null) {
            throw new ControlledError({
                message: '로그인 세션이 만료되었습니다. 다시 로그인 해주세요.',
                alertOptions: { type: 'warn', duration: 3000 }
            });
        }

        await redis.inst.del(sessionKey);
        const newUUID = v4();
        const { tokens, refreshTimeout } = await Session.refreshSession(email, newUUID, (isAutoLogin === 'auto'));
        const user = await Session.getUser(email);
        
        //보호받는 세션인 경우 같이 변경        
        await Session.refreshLogoutProtected(uuid, newUUID)

        return { user, tokens, refreshTimeout };
    }

    // 로그아웃 처리
    static async signOut(refreshToken: string) {
        const { email, uuid } = Session.checkToken(refreshToken);
        const sessionKey = Session.createSessionKey(email, uuid);
        await redis.inst.del(sessionKey);

        const protectKey = Session.createLogoutProtectKey(uuid);
        await redis.inst.del(protectKey);
        await Session.deleteLogoutProtected(uuid)
    }

    // 새로운 세션 생성
    private static async createSession(email: string, autoLogin = false) {
        const sessionUUID = v4();
        await Session.setLogoutProtected(sessionUUID);
        return await Session.refreshSession(email, sessionUUID, autoLogin);
    }

    // 세션 새로고침
    private static async refreshSession(email: string, uuid: string, autoLogin = false) {
        const sessionKey = Session.createSessionKey(email, uuid);
        const refreshValue = autoLogin ? 'auto' : '';
        const refreshTimeout = autoLogin ? AUTOLOGIN_TIMEOUT : REFRESH_TIMEOUT;

        await redis.inst.set(sessionKey, refreshValue);
        await redis.inst.expire(sessionKey, refreshTimeout);
        await redis.tool.maintainKeyCount(Session.createSessionKey(email), MAX_SESSION_COUNT);

        const accessToken = createJwtToken({ email }, ACCESS_TIMEOUT);
        const refreshToken = createJwtToken({ email, uuid }, refreshTimeout);

        return { tokens: { accessToken, refreshToken }, refreshTimeout };
    }

    // Refresh Token 처리
    private static async handleRefreshToken(refreshClaim: RefreshTokenClaim, rep: FastifyReply) {
        const { email, uuid } = refreshClaim;
        const sessionKey = Session.createSessionKey(email, uuid);
        const isAutoLogin = await redis.inst.get(sessionKey);

        if (isAutoLogin === null) {
            throw new ControlledError({
                message: '로그인 세션이 만료되었습니다. 다시 로그인 해주세요.',
                alertOptions: { type: 'warn', duration: 3000 }
            });
        }

        await redis.inst.del(sessionKey);
        const newUUID = v4();

        const { tokens, refreshTimeout } = await Session.refreshSession(email, newUUID, !!isAutoLogin);
        Session.registerTokens(rep, tokens.accessToken, tokens.refreshToken, refreshTimeout);

        //보호받는 세션인 경우 같이 변경        
        await Session.refreshLogoutProtected(uuid, newUUID)
    }

    // 세션 검증
    static async checkSession(req: FastifyRequest, rep: FastifyReply) {
        const accessToken = req.headers['access-token'] as string;
        let accessClaim: AccessTokenClaim | null = null;
        let email: string | undefined = undefined;

        try {
            if (!accessToken) throw new Error('Access Token 없음');
            accessClaim = verifyJwtToken(accessToken) as AccessTokenClaim;
            email = accessClaim.email;
        } catch (error) {
            if (!(error instanceof TokenExpiredError)) {
                return Session.sendNeedLoginReply(rep);
            }
        }

        if (!accessClaim) {
            const refreshToken = req.cookies['refreshToken'];

            try {
                if (!refreshToken) throw new Error('Refresh Token 없음');
                const refreshClaim = verifyJwtToken(refreshToken) as RefreshTokenClaim;

                email = refreshClaim.email;
                await Session.handleRefreshToken(refreshClaim, rep);
            } catch (error) {
                Session.deleteTokens(rep);

                if (error instanceof TokenExpiredError) {
                    return Session.sendNeedLoginReply(rep, '장시간 활동이 없어서 로그아웃 되었습니다. 다시 로그인 해주세요.');
                } else {
                    return Session.sendNeedLoginReply(rep);
                }
            }
        }

        req.headers['email'] = email;
    }

    // 로그인 필요 응답
    static sendNeedLoginReply(rep: FastifyReply, message: string | undefined = undefined) {
        Session.deleteTokens(rep);
        return rep.status(403).header('x-need-login', true).send({ message });
    }

    // 토큰 등록
    static registerTokens(rep: FastifyReply, accessToken: string, refreshToken: string, refreshTimeout: number) {
        rep.header('access-token', accessToken);
        setCookie(rep, 'refreshToken', refreshToken, { timeout: refreshTimeout });
    }

    // 토큰 삭제
    static deleteTokens(rep: FastifyReply) {
        setCookie(rep, "refreshToken", "", { timeout: 0 });
    }

    // 로그아웃 보호 등록
    private static async setLogoutProtected(uuid: string, expire?: number) {
        const key = Session.createLogoutProtectKey(uuid);
        await redis.inst.set(key, '');
        await redis.inst.expire(key, expire ? expire : LOGOUT_PROTECT_TIMEOUT);
    }

    private static async refreshLogoutProtected(oldUUID: string, newUUID: string) {
        //보호받는 세션인 경우 같이 변경        
        const protectKey = Session.createLogoutProtectKey(oldUUID);
        const isProtected = await redis.inst.get(protectKey);
        const remainExpire = await redis.inst.ttl(protectKey);

        if (isProtected !== null) {
            await redis.inst.del(protectKey)
            await Session.setLogoutProtected(newUUID, remainExpire)
        }
    }

    private static async deleteLogoutProtected(uuid: string) {
        const protectKey = Session.createLogoutProtectKey(uuid);
        await redis.inst.del(protectKey);
    }

    static async deleteAllOtherSessions(email: string, refreshToken: string) {
        // 검증은 prehandler 에서 수행
        const warnError = new ControlledError({
            message: '올바르지 않은 요청입니다. 실시간으로 보안 로그가 모니터링 되며, 부정한 행위인 경우 민/형사상 책임을 질 수 있습니다.',
            alertOptions: { type: 'fail' }
        })

        if (!refreshToken) throw warnError;
        const { email: refreshEmail, uuid } = Session.checkToken(refreshToken);

        if (email !== refreshEmail) throw warnError;
        const iterateKey = Session.createSessionKey(email);

        let totalCount = 0;
        let deletedCount = 0;

        await redis.tool.scanAsync(iterateKey, async (key) => {

            const iterateUUID = key.split(':')[2]

            if (iterateUUID !== uuid){ //요청한 세션을 제외
                totalCount++;

                // 보호받는 세션인지 확인
                const protectKey = Session.createLogoutProtectKey(iterateUUID)
                const value = await redis.inst.get(protectKey);

                if (value === null) {
                    //보호받는 세션이 아니라면 삭제
                    await redis.inst.del(key);
                    deletedCount++;
                }
            }
        })

        return { totalCount, deletedCount, protectedCount: totalCount - deletedCount };
    }
}
