export interface Transaction {
  id: string;
  title: string;
  date: string; // Display date
  time: string;
  amount: number;
  icon: string;
  type: 'income' | 'expense';
  category: 'service' | 'tip' | 'supply' | 'other';
  rawDate: string; // Original ISO date
  gross_amount?: number;
  commission_amount?: number;
}

export interface KPI {
  label: string;
  value: string;
  trend: number;
  icon: string;
  iconColorClass: string;
  iconBgClass: string;
  chartData: { value: number }[];
}

export enum Tab {
  Home = 'Inicio',
  Income = 'Movimientos',
  Reports = 'Reportes',
  Advisor = 'Asesor IA',
  Profile = 'Perfil',
}

export interface Profile {
  id: string;
  first_name?: string;
  last_name?: string;
  avatar_url?: string;
  subscription_status?: 'free' | 'pro';
  commission_rate?: number;
  expense_model?: 'commission' | 'rent';
  rent_amount?: number;
  rent_period?: 'weekly' | 'monthly';
}