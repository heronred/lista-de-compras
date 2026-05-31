export interface UserProfile {
  userId: string;
  displayName: string;
  email: string;
  photoURL: string;
  familyId: string | null;
  createdAt: any;
  updatedAt: any;
}

export interface Family {
  familyId: string;
  name: string;
  createdBy: string;
  createdAt: any;
  updatedAt: any;
}

export interface ShoppingList {
  listId: string;
  title: string;
  familyId: string;
  createdBy: string;
  createdAt: any;
  updatedAt: any;
  itemsCount: number;
  checkedItemsCount: number;
  totalEstBudget: number;
  monthlyEstimate?: number;
  scannedFromNF: boolean;
}

export interface ShoppingItem {
  itemId: string;
  name: string;
  quantity: number;
  category: string;
  estimatedPrice: number;
  checked: boolean;
  checkedBy: string | null;
  checkedAt: any | null;
  addedBy: string;
  createdAt: any;
  updatedAt: any;
}

export interface ExpenseRecord {
  expenseId: string;
  listId: string;
  listTitle?: string;
  familyId: string;
  shopperId: string;
  shopperName: string;
  spentAt: any;
  totalSpent: number;
  itemsCount: number;
  createdAt: any;
}

export interface ActivityNotification {
  activityId: string;
  familyId: string;
  userId: string;
  userName: string;
  userPhoto: string;
  message: string;
  createdAt: any;
}

export interface AIHabitsReport {
  predictedMonthlySpent: number;
  categorySpendRecommendation: {
    category: string;
    suggestedLimit: number;
  }[];
  habitsComparison: string;
  savingsTips: string[];
}
