import { SerializeOptions } from "@fastify/cookie";
import { FastifyReply, FastifyRequest } from "fastify";

interface SetCookieOptions {
    timeout?: number;
    signed?: boolean;
}

export function setCookie(reply: FastifyReply, cookieName: string, value: string, options: SetCookieOptions = {}) {

    const { timeout = undefined, signed = false } = options;

    return reply.setCookie(cookieName, value, {
        path: '/',
        httpOnly: true,
        secure: true, //TODO https설정 후 true로 변경하기
        sameSite: 'strict',
        signed,
        maxAge: timeout
    } as SerializeOptions)
}

export function getUnsignedCookie(request: FastifyRequest, cookieName: string){
    const targetCookie = request.cookies[cookieName];
    if (!targetCookie) return null;
    return request.unsignCookie(targetCookie);
}