// tests/core/payroll.spec.ts

import { calculateMonthlyPayroll } from '../../shared/utils/payroll';

describe('Automated Payroll Math Engine', () => {
  it('should accurately calculate standard salary with 0 unpaid leaves', () => {
    const result = calculateMonthlyPayroll({
      baseSalary: 5000,
      allowances: 1000,
      deductions: 500,
      unpaidLeaveDays: 0,
      totalWorkingDaysInMonth: 20,
    });

    expect(result.dailyRate).toBe(250);
    expect(result.unpaidLeaveDeduction).toBe(0);
    expect(result.grossPay).toBe(6000);
    expect(result.finalPay).toBe(5500); // 5000 + 1000 - 0 - 500
  });

  it('should deduct unpaid leaves calculated at daily rate', () => {
    const result = calculateMonthlyPayroll({
      baseSalary: 4400,
      allowances: 600,
      deductions: 200,
      unpaidLeaveDays: 2,
      totalWorkingDaysInMonth: 22,
    });

    // Daily rate = 4400 / 22 = 200
    // Unpaid leave deduction = 2 * 200 = 400
    // Final Pay = 4400 + 600 - 400 - 200 = 4400
    expect(result.dailyRate).toBe(200);
    expect(result.unpaidLeaveDeduction).toBe(400);
    expect(result.finalPay).toBe(4400);
  });

  it('should handle zero base salary without error', () => {
    const result = calculateMonthlyPayroll({
      baseSalary: 0,
      allowances: 300,
      deductions: 50,
      unpaidLeaveDays: 3,
    });

    expect(result.dailyRate).toBe(0);
    expect(result.finalPay).toBe(250);
  });
});
