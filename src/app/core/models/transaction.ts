import { Category } from "./category";
import { TransactionType } from "./transaction-type";

export interface Transaction {
  id: number;
  description: string;
  amount: number;
  date: string;
  type: TransactionType;
  category: Category;
}

export interface TransactionRequest {
  description: string;
  amount: number;
  date: string;
  type: TransactionType;
  categoryId: number;
}

export interface Summary {
  startDate: string;
  endDate: string;
  totalIncome: number;
  totalExpense: number;
  balance: number;
}

export interface CategorySummary {
  categoryId: number;
  categoryName: string;
  total: number;
  percentage: number;
}