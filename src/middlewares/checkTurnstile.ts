import { TURNSTILE_SECRET_KEY } from "@/configs/envConfig";
import { ControlledError } from "@/controlledError";
import { FastifyReply, FastifyRequest } from "fastify";

export async function checkTurnstile(req: FastifyRequest, rep: FastifyReply) {
    const token = (req.body as any)['turnstileToken'];
    const ip = req.headers['CF-Connecting-IP'];

    let formData = new FormData();
    formData.append('secret', TURNSTILE_SECRET_KEY);
    formData.append('response', token);
    formData.append('remoteip', ip);

    const result = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        body: formData,
        method: 'POST',
    });

    const outcome = await result.json() as any;

    if (!outcome.success) {
        const error = new ControlledError({
            message: '캡챠가 올바르지 않습니다. 새로고침 후 다시 시도해보세요.',
            alertOptions: { type: 'fail' }
        });
        
        return ControlledError.catch(rep, error, error);
    }
}