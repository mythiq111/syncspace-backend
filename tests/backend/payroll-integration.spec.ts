// tests/backend/payroll-integration.spec.ts

import { PayrollService } from '../../src/modules/payroll/payroll.service';

describe('Payroll & Payslip Signed URL Generation', () => {
  let payrollService: PayrollService;

  beforeEach(() => {
    payrollService = new PayrollService();
  });

  it('should generate monthly batch payroll and 15-minute signed URLs', async () => {
    const payslips = await payrollService.generateMonthlyBatchPayroll('tenant-123', '2026-09', [
      {
        id: 'user-123',
        baseSalary: 4400,
        allowances: 600,
        deductions: 200,
        unpaidLeaveDays: 2,
      },
    ]);

    expect(payslips.length).toBe(1);
    expect(payslips[0].finalPay).toBe(4400); // 4400 + 600 - (2*200) - 200

    const signedUrl = await payrollService.getSignedPayslipUrl(
      payslips[0].id,
      'user-123',
      'tenant-123'
    );

    expect(signedUrl).toContain('expires=');
    expect(signedUrl).toContain('token=mock-jwt-signature-15m');
  });
});
