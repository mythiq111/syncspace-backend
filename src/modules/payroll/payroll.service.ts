// backend/src/modules/payroll/payroll.service.ts

import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { calculateMonthlyPayroll, PayrollCalculationOutput } from '../../../shared/utils/payroll';
import { Payslip } from '../../../shared/types';
import { DatabasePayslipRow } from '../../../shared/schemas/db';
import { SupabaseService, unwrap } from '../../common/supabase/supabase.service';
import { toPayslip } from '../../common/supabase/mappers';

@Injectable()
export class PayrollService {
  constructor(private readonly supabase: SupabaseService) {}

  async calculateUserPayroll(
    _userId: string,
    _tenantId: string,
    baseSalary: number,
    allowances: number,
    deductions: number,
    unpaidLeaveDays: number
  ): Promise<PayrollCalculationOutput> {
    return calculateMonthlyPayroll({ baseSalary, allowances, deductions, unpaidLeaveDays });
  }

  /** Calculates and saves one payslip per employee for `month` (YYYY-MM). Re-running a month updates it. */
  async generateMonthlyBatchPayroll(
    tenantId: string,
    month: string,
    employees: Array<{ id: string; baseSalary: number; allowances: number; deductions: number; unpaidLeaveDays: number }>
  ): Promise<Payslip[]> {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new BadRequestException('month must be YYYY-MM');

    const rows = employees.map((emp) => {
      const calc = calculateMonthlyPayroll({
        baseSalary: emp.baseSalary,
        allowances: emp.allowances,
        deductions: emp.deductions,
        unpaidLeaveDays: emp.unpaidLeaveDays,
      });
      return {
        user_id: emp.id,
        tenant_id: tenantId,
        month,
        pdf_url: `${tenantId}/${emp.id}/${month}.pdf`, // path inside the private `payslips` bucket
        base: calc.baseSalary,
        allowances: calc.allowances,
        deductions: calc.deductions,
        unpaid_leave_deduction: calc.unpaidLeaveDeduction,
        final_pay: calc.finalPay,
      };
    });
    if (rows.length === 0) return [];

    const saved = unwrap(
      await this.supabase.client.from('payslips').upsert(rows, { onConflict: 'user_id,month' }).select('*')
    ) as DatabasePayslipRow[];
    return saved.map(toPayslip);
  }

  /** Builds payslips for every employee from their saved salary and approved unpaid leave in `month`. */
  async runMonthlyPayroll(tenantId: string, month: string): Promise<Payslip[]> {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new BadRequestException('month must be YYYY-MM');
    const [year, mon] = month.split("-").map(Number);
    const monthStart = new Date(Date.UTC(year, mon - 1, 1));
    const monthEnd = new Date(Date.UTC(year, mon, 0));

    const users = unwrap(
      await this.supabase.client.from("users").select("id, base_salary, allowances, deductions").eq("tenant_id", tenantId)
    ) as Array<{ id: string; base_salary: number; allowances: number; deductions: number }>;

    const leaves = unwrap(
      await this.supabase.client
        .from("leave_requests")
        .select("user_id, start_date, end_date")
        .eq("tenant_id", tenantId)
        .eq("type", "UNPAID")
        .eq("status", "HR_APPROVED")
        .lte("start_date", monthEnd.toISOString().slice(0, 10))
        .gte("end_date", monthStart.toISOString().slice(0, 10))
    ) as Array<{ user_id: string; start_date: string; end_date: string }>;

    const unpaidDays = new Map<string, number>();
    for (const l of leaves) {
      const from = new Date(Math.max(new Date(l.start_date + "T00:00:00Z").getTime(), monthStart.getTime()));
      const to = new Date(Math.min(new Date(l.end_date + "T00:00:00Z").getTime(), monthEnd.getTime()));
      let days = 0;
      for (let d = new Date(from); d <= to; d.setUTCDate(d.getUTCDate() + 1)) {
        const dow = d.getUTCDay();
        if (dow !== 0 && dow !== 6) days++; // weekdays only
      }
      unpaidDays.set(l.user_id, (unpaidDays.get(l.user_id) ?? 0) + days);
    }

    return this.generateMonthlyBatchPayroll(
      tenantId,
      month,
      users.map((u) => ({
        id: u.id,
        baseSalary: Number(u.base_salary),
        allowances: Number(u.allowances),
        deductions: Number(u.deductions),
        unpaidLeaveDays: unpaidDays.get(u.id) ?? 0,
      }))
    );
  }

  /** userId === 'all' returns every payslip in the tenant. */
  async getPayslipsForUser(userId: string, tenantId: string): Promise<Payslip[]> {
    let query = this.supabase.client.from('payslips').select('*').eq('tenant_id', tenantId);
    if (userId !== 'all') query = query.eq('user_id', userId);
    const rows = unwrap(await query.order('month', { ascending: false })) as DatabasePayslipRow[];
    return rows.map(toPayslip);
  }

  async getSignedPayslipUrl(payslipId: string, userId: string, tenantId: string): Promise<string> {
    const { data, error } = await this.supabase.client
      .from('payslips')
      .select('user_id, pdf_url')
      .eq('id', payslipId)
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (error) throw new BadRequestException(error.message);
    if (!data) throw new NotFoundException('Payslip record not found');
    if (data.user_id !== userId) throw new ForbiddenException('You can only download your own payslips');

    const signed = await this.supabase.client.storage.from('payslips').createSignedUrl(data.pdf_url, 900);
    if (signed.error || !signed.data) throw new NotFoundException('Payslip PDF has not been generated yet');
    return signed.data.signedUrl;
  }
}
