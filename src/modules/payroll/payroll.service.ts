// backend/src/modules/payroll/payroll.service.ts

import { Injectable, NotFoundException } from '@nestjs/common';
import { calculateMonthlyPayroll, PayrollCalculationOutput } from '../../../shared/utils/payroll';
import { Payslip } from '../../../shared/types';

const mockPayslipStore: Payslip[] = [];

@Injectable()
export class PayrollService {
  async calculateUserPayroll(
    userId: string,
    tenantId: string,
    baseSalary: number,
    allowances: number,
    deductions: number,
    unpaidLeaveDays: number
  ): Promise<PayrollCalculationOutput> {
    return calculateMonthlyPayroll({
      baseSalary,
      allowances,
      deductions,
      unpaidLeaveDays,
    });
  }

  async generateMonthlyBatchPayroll(
    tenantId: string,
    month: string,
    employees: Array<{
      id: string;
      baseSalary: number;
      allowances: number;
      deductions: number;
      unpaidLeaveDays: number;
    }>
  ): Promise<Payslip[]> {
    const generatedPayslips: Payslip[] = [];

    for (const emp of employees) {
      const calc = calculateMonthlyPayroll({
        baseSalary: emp.baseSalary,
        allowances: emp.allowances,
        deductions: emp.deductions,
        unpaidLeaveDays: emp.unpaidLeaveDays,
      });

      const payslip: Payslip = {
        id: `pay-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        userId: emp.id,
        tenantId,
        month,
        pdfUrl: `payslips/${tenantId}/${emp.id}/${month}.pdf`,
        base: calc.baseSalary,
        allowances: calc.allowances,
        deductions: calc.deductions,
        unpaidLeaveDeduction: calc.unpaidLeaveDeduction,
        finalPay: calc.finalPay,
        createdAt: new Date().toISOString(),
      };

      generatedPayslips.push(payslip);
      mockPayslipStore.push(payslip);
    }

    return generatedPayslips;
  }

  async getPayslipsForUser(userId: string, tenantId: string): Promise<Payslip[]> {
    return mockPayslipStore.filter((p) => p.tenantId === tenantId && (p.userId === userId || userId === 'all'));
  }

  async getSignedPayslipUrl(payslipId: string, userId: string, tenantId: string): Promise<string> {
    const payslip = mockPayslipStore.find((p) => p.id === payslipId && p.tenantId === tenantId);
    if (!payslip) {
      throw new NotFoundException('Payslip record not found');
    }

    const expiresAt = Math.floor(Date.now() / 1000) + 900;
    return `https://supabase.internal/storage/v1/object/sign/payslips/${payslip.pdfUrl}?token=mock-jwt-signature-15m&expires=${expiresAt}`;
  }
}
