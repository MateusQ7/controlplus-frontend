export type Role = 'USER' | 'ADMIN';

/** Espelha UserResponseDTO do backend. */
export interface User {
    id: number;
    name: string;
    email: string;
    role: Role;
    createdAt: string;
}
