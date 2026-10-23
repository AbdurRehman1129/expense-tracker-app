import type { SelectOption } from '@/components/ui/SelectField';
import type { DonationType, RecurringFrequency } from '@/types';

export const PAYMENT_OPTIONS: SelectOption<string>[] = [
  { label: 'Cash', value: 'Cash' },
  { label: 'Card', value: 'Card' },
  { label: 'Bank Transfer', value: 'Bank' },
];

export const FREQUENCY_OPTIONS: SelectOption<RecurringFrequency>[] = [
  { label: 'Daily', value: 'daily' },
  { label: 'Weekly', value: 'weekly' },
  { label: 'Monthly', value: 'monthly' },
];

export const DONATION_TYPE_OPTIONS: { label: string; value: DonationType }[] = [
  { label: 'Zakat', value: 'zakat' },
  { label: 'Sadqa', value: 'sadqa' },
];
