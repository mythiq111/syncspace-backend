// backend/src/common/settings/settings.service.ts
// Per-company configuration stored in tenants.settings (JSON), merged over safe defaults.

import { BadRequestException, Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

export interface TenantSettings {
  general: { domain: string; supportEmail: string; currency: string };
  leave: { annualLeaveDays: number; minNoticeDays: number; maxConsecutiveDays: number };
  geofence: { enforce: boolean };
  payroll: { workingDaysPerMonth: number; payDay: number };
  integrations: { slackNotifyLeave: boolean };
  security: { allowedEmailDomains: string; minPasswordLength: number };
}
export type SettingsSection = keyof TenantSettings;

export const DEFAULT_SETTINGS: TenantSettings = {
  general: { domain: '', supportEmail: '', currency: 'INR' },
  leave: { annualLeaveDays: 20, minNoticeDays: 0, maxConsecutiveDays: 30 },
  geofence: { enforce: true },
  payroll: { workingDaysPerMonth: 22, payDay: 1 },
  integrations: { slackNotifyLeave: true },
  security: { allowedEmailDomains: '', minPasswordLength: 6 },
};

const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'CAD', 'AUD', 'SGD', 'AED'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Rule = (v: unknown) => string | null; // returns an error message, or null when valid
const int = (min: number, max: number, label: string): Rule => (v) =>
  Number.isInteger(v) && (v as number) >= min && (v as number) <= max ? null : `${label} must be a whole number from ${min} to ${max}`;
const str = (max: number, label: string): Rule => (v) =>
  typeof v === 'string' && v.length <= max ? null : `${label} is too long`;
const bool = (label: string): Rule => (v) => (typeof v === 'boolean' ? null : `${label} must be on or off`);

const RULES: { [S in SettingsSection]: Record<keyof TenantSettings[S], Rule> } = {
  general: {
    domain: (v) => (typeof v === 'string' && (v === '' || /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(v)) ? null : 'Domain must look like example.com'),
    supportEmail: (v) => (typeof v === 'string' && (v === '' || EMAIL_RE.test(v)) ? null : 'HR support email is not valid'),
    currency: (v) => (CURRENCIES.includes(v as string) ? null : 'Unsupported currency'),
  },
  leave: {
    annualLeaveDays: int(0, 365, 'Annual leave days'),
    minNoticeDays: int(0, 90, 'Minimum notice'),
    maxConsecutiveDays: int(1, 365, 'Maximum consecutive days'),
  },
  geofence: { enforce: bool('Geofence enforcement') },
  payroll: {
    workingDaysPerMonth: int(1, 31, 'Working days per month'),
    payDay: int(1, 28, 'Pay day'),
  },
  integrations: { slackNotifyLeave: bool('Slack leave notifications') },
  security: {
    allowedEmailDomains: (v) =>
      typeof v === 'string' && v.split(',').every((d) => d.trim() === '' || /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(d.trim()))
        ? null
        : 'Allowed domains must be comma-separated, like acme.com, acme.in',
    minPasswordLength: int(6, 64, 'Minimum password length'),
  },
};

@Injectable()
export class SettingsService {
  constructor(private readonly supabase: SupabaseService) {}

  async get(tenantId: string): Promise<TenantSettings> {
    const { data } = await this.supabase.client.from('tenants').select('settings').eq('id', tenantId).maybeSingle();
    return this.merge((data?.settings ?? {}) as Partial<TenantSettings>);
  }

  async update<S extends SettingsSection>(tenantId: string, section: S, values: Partial<TenantSettings[S]>): Promise<TenantSettings> {
    const rules = RULES[section] as Record<string, Rule> | undefined;
    if (!rules) throw new BadRequestException('Unknown settings section');
    const clean: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(values ?? {})) {
      if (!rules[key]) throw new BadRequestException(`Unknown setting "${key}"`);
      const message = rules[key](value);
      if (message) throw new BadRequestException(message);
      clean[key] = typeof value === 'string' ? value.trim() : value;
    }

    const current = await this.get(tenantId);
    const next = { ...current, [section]: { ...current[section], ...clean } };
    const { error } = await this.supabase.client.from('tenants').update({ settings: next }).eq('id', tenantId);
    if (error) throw new BadRequestException(error.message);
    return next;
  }

  private merge(stored: Partial<TenantSettings>): TenantSettings {
    const out = {} as Record<string, unknown>;
    for (const section of Object.keys(DEFAULT_SETTINGS) as SettingsSection[]) {
      out[section] = { ...DEFAULT_SETTINGS[section], ...((stored as Record<string, object>)[section] ?? {}) };
    }
    return out as unknown as TenantSettings;
  }
}
