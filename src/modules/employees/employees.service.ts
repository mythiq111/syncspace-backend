// backend/src/modules/employees/employees.service.ts

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { EmployeePrivate, EmploymentType, Gender, User, UserRole } from '../../../shared/types';
import { DatabaseEmployeePrivateRow, DatabaseUserRow } from '../../../shared/schemas/db';
import { SupabaseService, unwrap } from '../../common/supabase/supabase.service';
import { toUser } from '../../common/supabase/mappers';

const ASSIGNABLE_ROLES: UserRole[] = ['EMPLOYEE', 'LINE_MANAGER', 'HR_MANAGER', 'TENANT_ADMIN'];
const EMPLOYMENT_TYPES: EmploymentType[] = ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN'];
const GENDERS: Gender[] = ['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Everything HR can set on an employee. Only name/email/role are needed to create one. */
export interface EmployeeInput extends EmployeePrivate {
  name?: string;
  email?: string;
  password?: string;
  role?: UserRole;
  managerId?: string | null;
  baseSalary?: number;
  allowances?: number;
  deductions?: number;
  annualLeaveBalance?: number;
  employeeCode?: string;
  phone?: string;
  department?: string;
  jobTitle?: string;
  employmentType?: EmploymentType;
  joiningDate?: string;
  workLocation?: string;
  isActive?: boolean;
}

const clean = (v?: string | null) => (v === undefined ? undefined : v === null || v.trim() === '' ? null : v.trim());

@Injectable()
export class EmployeesService {
  constructor(private readonly supabase: SupabaseService) {}

  async getEmployeesByTenant(tenantId: string): Promise<User[]> {
    const rows = unwrap(
      await this.supabase.client.from('users').select('*').eq('tenant_id', tenantId).order('name')
    ) as DatabaseUserRow[];
    return rows.map(toUser);
  }

  async getEmployeeById(id: string, tenantId: string): Promise<User> {
    const { data, error } = await this.supabase.client
      .from('users')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (error) throw new BadRequestException(error.message);
    if (!data) throw new NotFoundException(`Employee ${id} not found in tenant ${tenantId}`);
    return toUser(data as DatabaseUserRow);
  }

  /** Creates the login and the employee record (plus private details when given). */
  async inviteEmployee(tenantId: string, input: EmployeeInput): Promise<User> {
    const email = input.email?.trim().toLowerCase();
    const name = input.name?.trim();
    if (!name) throw new BadRequestException('Name is required');
    if (!email || !EMAIL_RE.test(email)) throw new BadRequestException('A valid email is required');
    const role = input.role ?? 'EMPLOYEE';
    this.validate(input, role);
    if (input.password !== undefined && input.password.length < 6) {
      throw new BadRequestException('Password must be at least 6 characters');
    }

    // With a password the admin hands over credentials directly; without one Supabase emails an invite.
    const { data: invited, error: inviteError } = input.password
      ? await this.supabase.client.auth.admin.createUser({ email, password: input.password, email_confirm: true })
      : await this.supabase.client.auth.admin.inviteUserByEmail(email);
    if (inviteError || !invited.user) {
      throw new BadRequestException(inviteError?.message ?? 'Could not create user');
    }
    const userId = invited.user.id;

    try {
      const code = clean(input.employeeCode) ?? (await this.nextEmployeeCode(tenantId));
      const { data, error } = await this.supabase.client
        .from('users')
        .insert({
          id: userId,
          tenant_id: tenantId,
          role,
          email,
          name,
          manager_id: clean(input.managerId) ?? null,
          base_salary: input.baseSalary ?? 0,
          allowances: input.allowances ?? 0,
          deductions: input.deductions ?? 0,
          ...(input.annualLeaveBalance !== undefined && { annual_leave_balance: input.annualLeaveBalance }),
          employee_code: code,
          phone: clean(input.phone) ?? null,
          department: clean(input.department) ?? null,
          job_title: clean(input.jobTitle) ?? null,
          employment_type: input.employmentType ?? 'FULL_TIME',
          joining_date: clean(input.joiningDate) ?? null,
          work_location: clean(input.workLocation) ?? null,
        })
        .select('*')
        .single();
      if (error) throw new BadRequestException(this.friendly(error.message));

      await this.savePrivate(userId, tenantId, input);
      return toUser(data as DatabaseUserRow);
    } catch (err) {
      await this.supabase.client.auth.admin.deleteUser(userId); // roll back the orphan login (cascades)
      throw err;
    }
  }

  async updateEmployee(id: string, tenantId: string, input: EmployeeInput, actorId?: string): Promise<User> {
    await this.getEmployeeById(id, tenantId);
    this.validate(input, input.role ?? 'EMPLOYEE');
    if (input.isActive === false && id === actorId) throw new BadRequestException('You cannot deactivate your own account');
    if (input.role && id === actorId) throw new BadRequestException('You cannot change your own role');
    if (input.managerId && input.managerId === id) throw new BadRequestException('An employee cannot be their own manager');

    const patch: Record<string, unknown> = {};
    const set = (col: string, v: unknown) => v !== undefined && (patch[col] = v);
    set('name', input.name?.trim());
    set('role', input.role);
    set('manager_id', input.managerId === undefined ? undefined : clean(input.managerId));
    set('base_salary', input.baseSalary);
    set('allowances', input.allowances);
    set('deductions', input.deductions);
    set('annual_leave_balance', input.annualLeaveBalance);
    set('employee_code', clean(input.employeeCode));
    set('phone', clean(input.phone));
    set('department', clean(input.department));
    set('job_title', clean(input.jobTitle));
    set('employment_type', input.employmentType);
    set('joining_date', clean(input.joiningDate));
    set('work_location', clean(input.workLocation));
    set('is_active', input.isActive);

    if (Object.keys(patch).length > 0) {
      const { error } = await this.supabase.client.from('users').update(patch).eq('id', id).eq('tenant_id', tenantId);
      if (error) throw new BadRequestException(this.friendly(error.message));
    }
    if (input.isActive !== undefined) {
      // Deactivated people can no longer sign in.
      await this.supabase.client.auth.admin.updateUserById(id, { ban_duration: input.isActive ? 'none' : '876000h' });
    }
    await this.savePrivate(id, tenantId, input);
    return this.getEmployeeById(id, tenantId);
  }

  /** Sensitive details (bank, tax ID, address...). Callers must already be HR/admin. */
  async getPrivateDetails(id: string, tenantId: string): Promise<EmployeePrivate> {
    const { data, error } = await this.supabase.client
      .from('employee_private')
      .select('*')
      .eq('user_id', id)
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (error) throw new BadRequestException(error.message);
    const r = data as DatabaseEmployeePrivateRow | null;
    return {
      dateOfBirth: r?.date_of_birth ?? undefined,
      gender: r?.gender ?? undefined,
      address: r?.address ?? undefined,
      emergencyContactName: r?.emergency_contact_name ?? undefined,
      emergencyContactPhone: r?.emergency_contact_phone ?? undefined,
      bankName: r?.bank_name ?? undefined,
      bankAccountNumber: r?.bank_account_number ?? undefined,
      bankIfsc: r?.bank_ifsc ?? undefined,
      taxId: r?.tax_id ?? undefined,
    };
  }

  // ---- helpers ----

  private validate(input: EmployeeInput, role: UserRole) {
    if (!ASSIGNABLE_ROLES.includes(role)) throw new BadRequestException('Invalid role');
    if (input.employmentType && !EMPLOYMENT_TYPES.includes(input.employmentType)) throw new BadRequestException('Invalid employment type');
    if (input.gender && !GENDERS.includes(input.gender)) throw new BadRequestException('Invalid gender');
    for (const [label, v] of [['Joining date', input.joiningDate], ['Date of birth', input.dateOfBirth]] as const) {
      if (v && (!DATE_RE.test(v) || Number.isNaN(Date.parse(v)))) throw new BadRequestException(`${label} must be a valid date`);
    }
    if (input.dateOfBirth && new Date(input.dateOfBirth) > new Date()) throw new BadRequestException('Date of birth cannot be in the future');
    for (const [label, v] of [['Base salary', input.baseSalary], ['Allowances', input.allowances], ['Deductions', input.deductions]] as const) {
      if (v !== undefined && (typeof v !== 'number' || !(v >= 0))) throw new BadRequestException(`${label} must be zero or more`);
    }
    if (input.phone && !/^[+\d][\d\s()-]{5,19}$/.test(input.phone.trim())) throw new BadRequestException('Phone number looks invalid');
  }

  private friendly(message: string): string {
    if (message.includes('users_tenant_email_key')) return 'An employee with this email already exists';
    if (message.includes('users_tenant_code_key')) return 'This employee ID is already in use';
    return message;
  }

  /** EMP-0001, EMP-0002 ... one higher than the largest number already used in this company. */
  private async nextEmployeeCode(tenantId: string): Promise<string> {
    const rows = unwrap(
      await this.supabase.client.from('users').select('employee_code').eq('tenant_id', tenantId)
    ) as Array<{ employee_code: string | null }>;
    const max = rows.reduce((m, r) => {
      const n = /^EMP-(\d+)$/i.exec(r.employee_code ?? '');
      return n ? Math.max(m, parseInt(n[1], 10)) : m;
    }, 0);
    return `EMP-${String(max + 1).padStart(4, '0')}`;
  }

  private async savePrivate(userId: string, tenantId: string, input: EmployeeInput) {
    const fields: Record<string, unknown> = {};
    const set = (col: string, v: unknown) => v !== undefined && (fields[col] = v);
    set('date_of_birth', clean(input.dateOfBirth));
    set('gender', clean(input.gender));
    set('address', clean(input.address));
    set('emergency_contact_name', clean(input.emergencyContactName));
    set('emergency_contact_phone', clean(input.emergencyContactPhone));
    set('bank_name', clean(input.bankName));
    set('bank_account_number', clean(input.bankAccountNumber));
    set('bank_ifsc', clean(input.bankIfsc)?.toUpperCase());
    set('tax_id', clean(input.taxId)?.toUpperCase());
    if (Object.keys(fields).length === 0) return;

    const { error } = await this.supabase.client
      .from('employee_private')
      .upsert({ user_id: userId, tenant_id: tenantId, ...fields }, { onConflict: 'user_id' });
    if (error) throw new BadRequestException(error.message);
  }
}
