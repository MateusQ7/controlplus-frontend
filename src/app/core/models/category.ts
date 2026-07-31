import { TransactionType } from "./transaction-type";

export interface Category {
    id: number;
    name: string;
    type: TransactionType;
}

export interface CategoryRequest {
    name: string;
    type: TransactionType;
}