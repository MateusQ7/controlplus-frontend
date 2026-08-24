export type Role = 'USER' | 'ADMIN';

/** Espelha UserResponseDTO do backend. */
export interface User {
    id: number;
    name: string;
    email: string;
    role: Role;
    createdAt: string;
    active: boolean;
}

/** Espelha UserRequestDTO: senha obrigatória na criação. */
export interface UserRequest {
    name: string;
    email: string;
    password: string;
    role: Role;
}

/** Espelha UserUpdateRequestDTO: senha nula mantém a atual. */
export interface UserUpdateRequest {
    name: string;
    email: string;
    password: string | null;
    role: Role;
}
