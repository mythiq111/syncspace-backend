// tests/run-tests.ts

import { calculateHaversineDistance, isWithinGeofence } from '../shared/utils/haversine';
import { calculateMonthlyPayroll } from '../shared/utils/payroll';
import { AttendanceService } from '../src/modules/attendance/attendance.service';
import { LeaveService } from '../src/modules/leave/leave.service';
import { PayrollService } from '../src/modules/payroll/payroll.service';

async function runAllVerificationTests() {
  console.log('--- STARTING EMPFLOW TEST SUITE VERIFICATION ---');
  let passedCount = 0;
  let failedCount = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passedCount++;
    } else {
      console.error(`❌ [FAIL] ${testName}`);
      failedCount++;
    }
  }

  // 1. Haversine Test
  const dist = calculateHaversineDistance(17.6868, 83.2185, 17.6868, 83.2185);
  assert(dist === 0, 'Haversine distance for identical coords is 0');

  const inGeofence = isWithinGeofence(17.6869, 83.2186, 17.6868, 83.2185, 200);
  assert(inGeofence.isInside === true, 'Coordinates within 200m radius approved');

  const outGeofence = isWithinGeofence(17.7500, 83.3000, 17.6868, 83.2185, 200);
  assert(outGeofence.isInside === false, 'Coordinates outside 200m radius rejected');

  // 2. Payroll Math Engine Test
  const payroll = calculateMonthlyPayroll({
    baseSalary: 4400,
    allowances: 600,
    deductions: 200,
    unpaidLeaveDays: 2,
    totalWorkingDaysInMonth: 22,
  });
  assert(payroll.dailyRate === 200, 'Daily rate = 4400 / 22 = 200');
  assert(payroll.unpaidLeaveDeduction === 400, 'Unpaid leave deduction = 2 * 200 = 400');
  assert(payroll.finalPay === 4400, 'Final Pay = 4400 + 600 - 400 - 200 = 4400');

  // 3. Attendance Service Test
  const attService = new AttendanceService();
  const clockInRecord = await attService.clockIn('user-123', 'tenant-123', 17.6869, 83.2186);
  assert(clockInRecord.status === 'PRESENT', 'Geofenced clock-in succeeds inside 200m');

  try {
    await attService.clockIn('user-123', 'tenant-123', 17.8000, 83.4000);
    assert(false, 'Outside clock-in should throw exception');
  } catch (err: any) {
    assert(err.message.includes('You must be within 200m of the office'), 'Outside clock-in throws ERR_OUT_OF_BOUNDS');
  }

  // 4. Leave 2-Step Approval Test
  const leaveService = new LeaveService();
  const req = await leaveService.createLeaveRequest('user-123', 'tenant-123', 'ANNUAL', '2026-10-01', '2026-10-05');
  assert(req.status === 'PENDING', 'Leave request starts in PENDING status');

  const mgrApp = await leaveService.approveByManager(req.id, 'mgr-1', 'tenant-123');
  assert(mgrApp.status === 'MANAGER_APPROVED', 'Line Manager approval updates state to MANAGER_APPROVED');

  const hrApp = await leaveService.approveByHR(req.id, 'hr-1', 'tenant-123');
  assert(hrApp.status === 'HR_APPROVED', 'HR approval updates state to HR_APPROVED');

  // 5. Payroll & Signed URL Test
  const payrollService = new PayrollService();
  const batch = await payrollService.generateMonthlyBatchPayroll('tenant-123', '2026-09', [
    { id: 'user-123', baseSalary: 5000, allowances: 500, deductions: 200, unpaidLeaveDays: 0 },
  ]);
  assert(batch.length === 1 && batch[0].finalPay === 5300, 'Batch payslip generated with correct net pay');

  const signedUrl = await payrollService.getSignedPayslipUrl(batch[0].id, 'user-123', 'tenant-123');
  assert(signedUrl.includes('expires=') && signedUrl.includes('token=mock-jwt-signature-15m'), '15-minute expiring signed URL generated');

  console.log(`\n========================================`);
  console.log(`TEST RESULTS: ${passedCount} PASSED | ${failedCount} FAILED`);
  console.log(`========================================\n`);

  if (failedCount > 0) {
    process.exit(1);
  }
}

runAllVerificationTests();
