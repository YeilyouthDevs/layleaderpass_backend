import crypto from 'crypto';

export function sha256(text: string) {
    return crypto.createHash('sha256').update(text).digest('hex')
}

export function maskEmail(email: string): string {
    // 이메일 주소를 로컬 파트와 도메인 파트로 분리
    const [localPart, domainPart] = email.split('@');
    
    // 로컬 파트 마스킹
    const maskedLocalPart = maskPart(localPart);
    
    // 도메인 파트를 '.' 기준으로 나누기
    const domainParts = domainPart.split('.');
    
    // 도메인 파트 각각을 마스킹
    const maskedDomainParts = domainParts.map((part, index) => {
        // 최종 도메인 파트는 길이가 3자 이상일 때만 마스킹
        if (index === domainParts.length - 1 && part.length >= 3) {
            return maskPart(part);
        }
        // 다른 도메인 파트는 길이가 2자 이상일 때만 마스킹
        return part.length > 1 ? maskPart(part) : part;
    });
    
    // 마스킹된 로컬 파트와 도메인 파트를 합쳐서 반환
    return `${maskedLocalPart}@${maskedDomainParts.join('.')}`;
}

function maskPart(part: string): string {
    if (part.length <= 1) {
        return part; // 길이가 1 이하이면 마스킹하지 않음
    }
    
    // 첫 번째 문자는 남기고, 나머지는 '*'로 마스킹
    return part[0] + '*'.repeat(part.length - 2) + part[part.length - 1];
}
