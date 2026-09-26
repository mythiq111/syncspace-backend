// backend/scripts/seed-demo.ts
// Fills the admin's company with realistic SAMPLE data for demos: 13 employees across departments,
// two weeks of attendance, leave requests in every status, and two months of payslips.
//
//   npm run seed-demo            create / refresh the sample data (safe to re-run)
//   npm run seed-demo -- --remove   delete every sample employee and their data
//
// Sample people all use @mythiq-demo.com emails and share one password (DEMO_PASSWORD, default Demo@12345).
// Requires: 20260925_real_schema.sql and 20260926_employee_details.sql applied, and the admin created.

import 'dotenv/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { calculateMonthlyPayroll } from '../shared/utils/payroll';

const DOMAIN = 'mythiq-demo.com';
const PASSWORD = process.env.DEMO_PASSWORD || 'Demo@12345';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'mythiq111@gmail.com';

type Role = 'EMPLOYEE' | 'LINE_MANAGER' | 'HR_MANAGER';
interface Person {
  key: string;
  name: string;
  role: Role;
  dept: string;
  title: string;
  type: 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'INTERN';
  manager?: string; // key of another person; admin is the fallback
  base: number;
  allow: number;
  deduct: number;
  joined: string;
  gender: 'MALE' | 'FEMALE';
  dob: string;
  city: string;
}

const PEOPLE: Person[] = [
  { key: 'priya', name: 'Priya Sharma', role: 'HR_MANAGER', dept: 'Human Resources', title: 'HR Manager', type: 'FULL_TIME', base: 85000, allow: 12000, deduct: 6000, joined: '2022-03-14', gender: 'FEMALE', dob: '1990-06-21', city: 'Visakhapatnam' },
  { key: 'rahul', name: 'Rahul Verma', role: 'LINE_MANAGER', dept: 'Engineering', title: 'Engineering Manager', type: 'FULL_TIME', base: 140000, allow: 20000, deduct: 11000, joined: '2021-07-05', gender: 'MALE', dob: '1988-01-09', city: 'Visakhapatnam' },
  { key: 'ananya', name: 'Ananya Iyer', role: 'LINE_MANAGER', dept: 'Sales', title: 'Sales Manager', type: 'FULL_TIME', base: 110000, allow: 15000, deduct: 8500, joined: '2022-01-17', gender: 'FEMALE', dob: '1991-11-30', city: 'Visakhapatnam' },
  { key: 'karthik', name: 'Karthik Reddy', role: 'EMPLOYEE', dept: 'Engineering', title: 'Senior Software Engineer', type: 'FULL_TIME', manager: 'rahul', base: 105000, allow: 14000, deduct: 8000, joined: '2022-09-01', gender: 'MALE', dob: '1992-04-12', city: 'Visakhapatnam' },
  { key: 'sneha', name: 'Sneha Patel', role: 'EMPLOYEE', dept: 'Engineering', title: 'Software Engineer', type: 'FULL_TIME', manager: 'rahul', base: 72000, allow: 9000, deduct: 5200, joined: '2023-06-19', gender: 'FEMALE', dob: '1996-02-25', city: 'Visakhapatnam' },
  { key: 'arjun', name: 'Arjun Nair', role: 'EMPLOYEE', dept: 'Engineering', title: 'QA Engineer', type: 'FULL_TIME', manager: 'rahul', base: 60000, allow: 7000, deduct: 4300, joined: '2023-10-09', gender: 'MALE', dob: '1997-08-03', city: 'Visakhapatnam' },
  { key: 'meera', name: 'Meera Krishnan', role: 'EMPLOYEE', dept: 'Design', title: 'UI/UX Designer', type: 'FULL_TIME', manager: 'rahul', base: 68000, allow: 8000, deduct: 4800, joined: '2023-02-13', gender: 'FEMALE', dob: '1995-12-14', city: 'Visakhapatnam' },
  { key: 'vikram', name: 'Vikram Singh', role: 'EMPLOYEE', dept: 'Sales', title: 'Sales Executive', type: 'FULL_TIME', manager: 'ananya', base: 52000, allow: 8000, deduct: 3800, joined: '2023-04-24', gender: 'MALE', dob: '1994-05-17', city: 'Visakhapatnam' },
  { key: 'divya', name: 'Divya Menon', role: 'EMPLOYEE', dept: 'Sales', title: 'Sales Executive', type: 'FULL_TIME', manager: 'ananya', base: 50000, allow: 7500, deduct: 3600, joined: '2024-01-08', gender: 'FEMALE', dob: '1996-09-28', city: 'Visakhapatnam' },
  { key: 'rohan', name: 'Rohan Gupta', role: 'EMPLOYEE', dept: 'Finance', title: 'Accountant', type: 'FULL_TIME', manager: 'priya', base: 58000, allow: 6000, deduct: 4200, joined: '2022-11-21', gender: 'MALE', dob: '1993-03-06', city: 'Visakhapatnam' },
  { key: 'neha', name: 'Neha Joshi', role: 'EMPLOYEE', dept: 'Human Resources', title: 'HR Executive', type: 'PART_TIME', manager: 'priya', base: 30000, allow: 3000, deduct: 2000, joined: '2024-05-06', gender: 'FEMALE', dob: '1998-07-19', city: 'Visakhapatnam' },
  { key: 'aditya', name: 'Aditya Rao', role: 'EMPLOYEE', dept: 'Engineering', title: 'Software Engineering Intern', type: 'INTERN', manager: 'karthik', base: 20000, allow: 0, deduct: 0, joined: '2025-06-02', gender: 'MALE', dob: '2002-10-11', city: 'Visakhapatnam' },
  { key: 'lakshmi', name: 'Lakshmi Devi', role: 'EMPLOYEE', dept: 'Customer Support', title: 'Support Specialist', type: 'CONTRACT', manager: 'ananya', base: 38000, allow: 4000, deduct: 2600, joined: '2024-08-12', gender: 'FEMALE', dob: '1994-01-23', city: 'Visakhapatnam' },
];

const emailOf = (p: Person) => `${p.name.toLowerCase().replace(/[^a-z]+/g, '.')}@${DOMAIN}`;
const pick = <T,>(arr: T[], i: number) => arr[i % arr.length];
const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

/** Deterministic pseudo-random in [0,1) so re-runs give the same data. */
const rnd = (seed: number) => {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
};

/** Local (IST, UTC+5:30) wall-clock time on a given calendar day -> UTC ISO string. */
function istToIso(day: Date, hour: number, minute: number): string {
  const ms = Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), hour, minute) - (5 * 60 + 30) * 60000;
  return new Date(ms).toISOString();
}

async function findAuthUser(db: SupabaseClient, email: string) {
  for (let page = 1; page < 20; page++) {
    const { data } = await db.auth.admin.listUsers({ page, perPage: 200 });
    const hit = data?.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (hit) return hit;
    if (!data || data.users.length < 200) return null;
  }
  return null;
}

async function main() {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in backend/.env');
  const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const remove = process.argv.includes('--remove');

  // ---- remove mode ----
  if (remove) {
    let n = 0;
    for (const p of PEOPLE) {
      const u = await findAuthUser(db, emailOf(p));
      if (u) {
        await db.auth.admin.deleteUser(u.id); // cascades to users, attendance, leave, payslips, private details
        n++;
      }
    }
    console.log(`Removed ${n} sample employees and all their data.`);
    return;
  }

  // ---- checks ----
  const probe = await db.from('employee_private').select('user_id').limit(1);
  if (probe.error) throw new Error('Run supabase/migrations/20260926_employee_details.sql in the Supabase SQL Editor first.');

  const admin = await findAuthUser(db, ADMIN_EMAIL);
  if (!admin) throw new Error(`Admin ${ADMIN_EMAIL} not found. Run npm run create-admin first.`);
  const { data: adminRow } = await db.from('users').select('id, tenant_id').eq('id', admin.id).single();
  if (!adminRow) throw new Error('Admin has no company profile. Run npm run create-admin first.');
  const tenantId: string = adminRow.tenant_id;

  const { data: tenant } = await db.from('tenants').select('office_lat, office_lng, radius').eq('id', tenantId).single();
  await db.from('tenants').update({ timezone: 'Asia/Kolkata' }).eq('id', tenantId);

  // ---- admin profile ----
  await db
    .from('users')
    .update({
      employee_code: 'EMP-0001', department: 'Management', job_title: 'Managing Director', phone: '+91 98480 00001',
      employment_type: 'FULL_TIME', joining_date: '2020-01-06', work_location: 'Head Office',
    })
    .eq('id', admin.id);

  // ---- employees ----
  const ids = new Map<string, string>();
  let code = 2;
  for (const p of PEOPLE) {
    const email = emailOf(p);
    let u = await findAuthUser(db, email);
    if (!u) {
      const created = await db.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
      if (created.error || !created.data.user) throw new Error(`Could not create ${email}: ${created.error?.message}`);
      u = created.data.user;
    }
    ids.set(p.key, u.id);
  }
  const hrId = ids.get('priya')!;

  for (const [i, p] of PEOPLE.entries()) {
    const id = ids.get(p.key)!;
    const managerId = p.manager ? ids.get(p.manager)! : admin.id;
    const row = {
      id, tenant_id: tenantId, role: p.role, email: emailOf(p), name: p.name, manager_id: managerId,
      base_salary: p.base, allowances: p.allow, deductions: p.deduct,
      annual_leave_balance: 12 + Math.floor(rnd(i + 1) * 9),
      employee_code: `EMP-${String(code++).padStart(4, '0')}`,
      phone: `+91 9${String(8000000000 + i * 1234567 + 4210000).slice(0, 9)}`.replace(/(\+91 \d{5})(\d+)/, '$1 $2'),
      department: p.dept, job_title: p.title, employment_type: p.type, joining_date: p.joined,
      work_location: 'Head Office', is_active: true,
    };
    const { error } = await db.from('users').upsert(row, { onConflict: 'id' });
    if (error) throw new Error(`users upsert ${p.name}: ${error.message}`);

    const priv = await db.from('employee_private').upsert(
      {
        user_id: id, tenant_id: tenantId, date_of_birth: p.dob, gender: p.gender,
        address: `Flat ${101 + i}, Sample Residency, ${p.city}, Andhra Pradesh 530003`,
        emergency_contact_name: `${p.name.split(' ')[0]}'s family`, emergency_contact_phone: `+91 90000 ${String(10000 + i * 137).slice(0, 5)}`,
        bank_name: pick(['HDFC Bank', 'State Bank of India', 'ICICI Bank', 'Axis Bank'], i),
        bank_account_number: String(50100000000000 + i * 7919311),
        bank_ifsc: pick(['HDFC0001234', 'SBIN0004321', 'ICIC0002468', 'UTIB0001357'], i),
        tax_id: `${'ABCDE'.split('').map((_, k) => String.fromCharCode(65 + ((i * 3 + k * 5) % 26))).join('')}${String(1000 + i * 37).slice(0, 4)}${String.fromCharCode(65 + (i % 26))}`,
      },
      { onConflict: 'user_id' }
    );
    if (priv.error) throw new Error(`employee_private ${p.name}: ${priv.error.message}`);
  }

  // ---- reset sample activity (so re-running never duplicates) ----
  const allIds = Array.from(ids.values());
  await db.from('attendance').delete().in('user_id', allIds);
  await db.from('leave_requests').delete().in('user_id', allIds);
  await db.from('payslips').delete().in('user_id', allIds);

  // ---- attendance: last 14 weekdays + today ----
  const now = new Date();
  const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const att: Record<string, unknown>[] = [];
  const near = (seed: number) => ({
    lat: tenant!.office_lat + (rnd(seed) - 0.5) * 0.0012,
    lng: tenant!.office_lng + (rnd(seed + 1) - 0.5) * 0.0012,
  });

  let anomalies = 0;
  for (const [pi, p] of PEOPLE.entries()) {
    const id = ids.get(p.key)!;
    let days = 0;
    for (let back = 1; days < 14; back++) {
      const day = new Date(todayUtc.getTime() - back * 86400000);
      if (day.getUTCDay() === 0 || day.getUTCDay() === 6) continue;
      days++;
      const s = pi * 100 + back;
      if (rnd(s) < 0.06) continue; // occasionally absent
      const inMin = 8 * 60 + 40 + Math.floor(rnd(s + 2) * 65); // 08:40 - 09:45
      const outMin = 17 * 60 + 30 + Math.floor(rnd(s + 3) * 75); // 17:30 - 18:45
      const missed = back > 2 && rnd(s + 4) < 0.04 && anomalies < 3;
      if (missed) anomalies++;
      att.push({
        user_id: id, tenant_id: tenantId, ...near(s),
        punch_in: istToIso(day, Math.floor(inMin / 60), inMin % 60),
        punch_out: missed ? istToIso(day, 23, 59) : istToIso(day, Math.floor(outMin / 60), outMin % 60),
        status: missed ? 'ANOMALY_MISSED_PUNCH' : 'PRESENT',
      });
    }
    // Today: clocked in already if that time has passed (about 85% of people, most still working)
    const inMin = 8 * 60 + 45 + Math.floor(rnd(pi + 900) * 60);
    const punchIn = istToIso(todayUtc, Math.floor(inMin / 60), inMin % 60);
    if (new Date(punchIn) < now && rnd(pi + 950) < 0.85) {
      att.push({ user_id: id, tenant_id: tenantId, ...near(pi + 990), punch_in: punchIn, punch_out: null, status: 'PRESENT' });
    }
  }
  // Two corrected records so the "Regularized" status is visible
  att.filter((a) => a.status === 'PRESENT' && a.punch_out).slice(5, 7).forEach((a) => (a.status = 'REGULARIZED'));
  const attRes = await db.from('attendance').insert(att);
  if (attRes.error) throw new Error(`attendance: ${attRes.error.message}`);

  // ---- leave requests in every status ----
  const d = (offset: number) => ymd(new Date(todayUtc.getTime() + offset * 86400000));
  const managerOf = (p: Person) => (p.manager ? ids.get(p.manager)! : admin.id);
  const L = (key: string, type: string, a: number, b: number, status: string, reason: string) => {
    const p = PEOPLE.find((x) => x.key === key)!;
    return {
      user_id: ids.get(key)!, tenant_id: tenantId, type, start_date: d(a), end_date: d(b), status, reason,
      manager_approver_id: status === 'PENDING' || status === 'REJECTED' ? null : managerOf(p),
      hr_approver_id: status === 'HR_APPROVED' ? hrId : null,
    };
  };
  const leaves = [
    L('sneha', 'ANNUAL', 10, 14, 'PENDING', 'Family function in Hyderabad'),
    L('vikram', 'SICK', 1, 2, 'PENDING', 'Viral fever, doctor advised rest'),
    L('meera', 'ANNUAL', 21, 28, 'PENDING', 'Vacation with family'),
    L('karthik', 'ANNUAL', 6, 9, 'MANAGER_APPROVED', 'Sister’s wedding'),
    L('divya', 'SICK', 3, 3, 'MANAGER_APPROVED', 'Dental appointment'),
    L('arjun', 'ANNUAL', -12, -10, 'HR_APPROVED', 'Personal work'),
    L('rohan', 'SICK', -6, -5, 'HR_APPROVED', 'Food poisoning'),
    L('lakshmi', 'UNPAID', -20, -18, 'HR_APPROVED', 'Extended trip'),
    L('neha', 'ANNUAL', 15, 16, 'HR_APPROVED', 'Festival travel'),
    L('aditya', 'UNPAID', 4, 5, 'REJECTED', 'Exam preparation (project deadline)'),
    L('rahul', 'ANNUAL', 30, 35, 'PENDING', 'Annual vacation'),
  ];
  const leaveRes = await db.from('leave_requests').insert(leaves);
  if (leaveRes.error) throw new Error(`leave: ${leaveRes.error.message}`);

  // ---- payslips: previous two months ----
  const slips: Record<string, unknown>[] = [];
  for (const back of [1, 2]) {
    const m = new Date(Date.UTC(todayUtc.getUTCFullYear(), todayUtc.getUTCMonth() - back, 1));
    const month = `${m.getUTCFullYear()}-${pad(m.getUTCMonth() + 1)}`;
    for (const p of PEOPLE) {
      const unpaid = p.key === 'lakshmi' && back === 1 ? 2 : 0;
      const c = calculateMonthlyPayroll({ baseSalary: p.base, allowances: p.allow, deductions: p.deduct, unpaidLeaveDays: unpaid });
      slips.push({
        user_id: ids.get(p.key)!, tenant_id: tenantId, month, pdf_url: `${tenantId}/${ids.get(p.key)}/${month}.pdf`,
        base: c.baseSalary, allowances: c.allowances, deductions: c.deductions,
        unpaid_leave_deduction: c.unpaidLeaveDeduction, final_pay: c.finalPay,
      });
    }
  }
  const slipRes = await db.from('payslips').insert(slips);
  if (slipRes.error) throw new Error(`payslips: ${slipRes.error.message}`);

  console.log(`Done. ${PEOPLE.length} sample employees, ${att.length} attendance records, ${leaves.length} leave requests, ${slips.length} payslips.`);
  console.log(`Sample login password for everyone: ${PASSWORD}`);
  console.log(`Try: ${emailOf(PEOPLE[0])} (HR), ${emailOf(PEOPLE[1])} (manager), ${emailOf(PEOPLE[3])} (employee)`);
}

main().catch((e) => {
  console.error('FAILED:', e.message || e);
  process.exit(1);
});
