export enum UserRole {
    GUEST = 'GUEST',
    USER = 'USER',
    ADMIN = 'ADMIN'
}

const UserRoleMaps: { [key in UserRole]: number } = {
    [UserRole.GUEST]: 0,
    [UserRole.USER]: 1,
    [UserRole.ADMIN]: 2
};

export function mapRoleLevel(role?: UserRole): number {
    return UserRoleMaps[role as keyof object] || 0;
}