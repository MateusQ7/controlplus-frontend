import { Category } from "./category";
import { BudgetStatus } from "./transaction-type";

export interface Budget {
  id: number;
  referenceMonth: string;
  limitAmount: number;
  spentAmount: number;
  remainingAmount: number;
  usagePercentage: number;
  status: BudgetStatus;
  category: Category;
}

export interface BudgetRequest {
  categoryId: number;
  referenceMonth: string;
  limitAmount: number;
}
