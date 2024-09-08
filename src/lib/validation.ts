export function ensureNotEmpty(args: any[], message?: string) {
    for (const arg of args) {
        if (!isNotEmpty(arg)) throw new Error(message ?? '요청인자가 유효하지 않습니다.');
    }

    return args;
}

export function isNotEmpty(value: any) {
    if (value === null || value === undefined || (typeof value === 'string' && value.trim() === '')) {
        return false;
    }

    return true;
}
