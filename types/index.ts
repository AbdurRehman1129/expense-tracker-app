export interface Category {
  id: number;
  name: string;
  icon: string;
  is_default: number;
}

export interface Expense {
  id: number;
  amount: number;
  category_id: number;
  date: string;
  note: string | null;
  payment_method: string | null;
  source: 'manual' | 'donation';
  linked_donation_id: number | null;
  created_at: string;
}

export interface Income {
  id: number;
  amount: number;
  source: string | null;
  date: string;
  note: string | null;
  created_at: string;
}

export type DonationType = 'zakat' | 'sadqa' ;

export interface Donation {
  id: number;
  type: DonationType;
  recipient: string | null;
  amount: number;
  date: string;
  note: string | null;
  linked_income_id: number | null;
  linked_expense_id: number | null;
  created_at: string;
}

export interface Budget {
  id: number;
  category_id: number;
  monthly_limit: number;
}

export interface DonationDue {
  id: number;
  type: DonationType;
  amount: number;
  date: string;
  note: string | null;
  linked_income_id: number | null;
  created_at: string;
}