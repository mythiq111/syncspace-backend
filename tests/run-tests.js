// tests/run-tests.js

// 1. Haversine Formula from shared/utils/haversine
function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
  const EARTH_RADIUS_METERS = 6371000;
  const toRadians = (deg) => (deg * Math.PI) / 180;

  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_METERS * c;
}

function isWithinGeofence(deviceLat, deviceLng, officeLat, officeLng, radiusMeters) {
  const distanceMeters = calculateHaversineDistance(deviceLat, deviceLng, officeLat, officeLng);
  return {
    isInside: distanceMeters <= radiusMeters,
    distanceMeters: Math.round(distanceMeters * 100) / 100,
  };
}

// 2. Payroll Math Engine from shared/utils/payroll
function calculateMonthlyPayroll(input) {
  const { baseSalary, allowances, deductions, unpaidLeaveDays, totalWorkingDaysInMonth = 22 } = input;
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

// Verification Test Execution
function runVerificationSuite() {
  console.log('========================================');
  console.log('RUNNING SEPARATED FOLDER ARCHITECTURE SUITE');
  console.log('========================================');

  let passed = 0;
  let failed = 0;

  function assert(condition, name) {
    if (condition) {
      console.log(`✅ [PASS] ${name}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${name}`);
      failed++;
    }
  }

  // Test 1: Haversine
  const dist = calculateHaversineDistance(17.6868, 83.2185, 17.6868, 83.2185);
  assert(dist === 0, 'Haversine distance for identical points is 0');

  const inside = isWithinGeofence(17.6869, 83.2186, 17.6868, 83.2185, 200);
  assert(inside.isInside === true, 'Coordinates within 200m radius approved');

  const outside = isWithinGeofence(17.7500, 83.3000, 17.6868, 83.2185, 200);
  assert(outside.isInside === false, 'Coordinates outside 200m radius rejected');

  // Test 2: Payroll Math Engine
  const pay = calculateMonthlyPayroll({
    baseSalary: 4400,
    allowances: 600,
    deductions: 200,
    unpaidLeaveDays: 2,
    totalWorkingDaysInMonth: 22,
  });
  assert(pay.dailyRate === 200, 'Daily rate calculation (4400/22 = 200)');
  assert(pay.unpaidLeaveDeduction === 400, 'Unpaid leave deduction calculation (2 * 200 = 400)');
  assert(pay.finalPay === 4400, 'Net salary math calculation (4400 + 600 - 400 - 200 = 4400)');

  console.log('\n========================================');
  console.log(`FINAL RESULT: ${passed} PASSED | ${failed} FAILED`);
  console.log('========================================\n');

  if (failed > 0) process.exit(1);
}

runVerificationSuite();
