import { JWT_SECRET_KEY } from '@/configs/envConfig';
import jwt, { JwtPayload } from 'jsonwebtoken';

export function createJwtToken(payload: any, expireSecond: number){
    const token = jwt.sign(payload, JWT_SECRET_KEY,  {
        expiresIn: `${expireSecond}s`
    })

    return token;
}

export function verifyJwtToken(token: string){
    return jwt.verify(token, JWT_SECRET_KEY) as jwt.JwtPayload    
}

export function getJwtRemainExp(token: string){
    const decoded = jwt.decode(token) as JwtPayload;

    if (decoded && decoded.exp) {
        const currentTime = Math.floor(Date.now() / 1000); // 현재 시간을 초 단위로
        const remainingTime = decoded.exp - currentTime; // 만료 시간 - 현재 시간 = 남은 시간

        return remainingTime;
    }

    return 0;
}

export function decodeJwtToken(token: string){
    if (token) return jwt.decode(token) as JwtPayload;
}
