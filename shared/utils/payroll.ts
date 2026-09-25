// shared/utils/payroll.ts

export interface PayrollCalculationInput {
  baseSalary: number;
  allowances: number;
  deductions: number;
  unpaidLeaveDays: number;
  totalWorkingDaysInMonth?: number;
}

export interface PayrollCalculationOutput {
  baseSalary: number;
  allowances: number;
  deductions: number;
  unpaidLeaveDays: number;
  dailyRate: number;
  unpaidLeaveDeduction: number;
  grossPay: number;
  finalPay: number;
}

export function calculateMonthlyPayroll(
  input: PayrollCalculationInput
): PayrollCalculationOutput {
  const {
    baseSalary,
    allowances,
    deductions,
    unpaidLeaveDays,
    totalWorkingDaysInMonth = 22,
  } = input;

  const validBase = Math.max(0, baseSalary || 0);
  const validAllowances = Math.max(0, allowances || 0);
  const validDeductions = Math.max(0, deductions || 0);
  const validUnpaidDays = Math.max(0, unpaidLeaveDays || 0);

  const dailyRate = validBase / Math.max(1, totalWorkingDaysInMonth);
  const unpaidLeaveDeduction = validUnpaidDays * dailyRate;

  const grossPay = validBase + validAllowances;
  const finalPay = Math.max(0, grossPay - unpaidLeaveDeduction - validDeductions);

  return {
    baseSalary: validBase,
    allowances: validAllowances,
    deductions: validDeductions,
    unpaidLeaveDays: validUnpaidDays,
    dailyRate: Math.round(dailyRate * 100) / 100,
    unpaidLeaveDeduction: Math.round(unpaidLeaveDeduction * 100) / 100,
    grossPay: Math.round(grossPay * 100) / 100,
    finalPay: Math.round(finalPay * 100) / 100,
  };
}
