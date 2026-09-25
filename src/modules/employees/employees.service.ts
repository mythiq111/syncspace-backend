// backend/src/modules/employees/employees.service.ts

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { User, UserRole } from '../../../shared/types';
import { DatabaseUserRow } from '../../../shared/schemas/db';
import { SupabaseService, unwrap } from '../../common/supabase/supabase.service';
import { toUser } from '../../common/supabase/mappers';

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

  /** Creates the login (Supabase sends the invite email) and the employee profile row. */
  async inviteEmployee(
    tenantId: string,
    email: string,
    name: string,
    role: UserRole,
    managerId?: string,
    baseSalary = 0,
    allowances = 0,
    deductions = 0,
    password?: string
  ): Promise<User> {
    if (!email || !name) throw new BadRequestException('email and name are required');
    if (role === 'SUPER_ADMIN') throw new BadRequestException('Cannot invite a SUPER_ADMIN');

    // With a password the admin hands over credentials directly; without one Supabase emails an invite.
    const { data: invited, error: inviteError } = password
      ? await this.supabase.client.auth.admin.createUser({ email, password, email_confirm: true })
      : await this.supabase.client.auth.admin.inviteUserByEmail(email);
    if (inviteError || !invited.user) {
      throw new BadRequestException(inviteError?.message ?? 'Could not create user');
    }

    const { data, error } = await this.supabase.client
      .from('users')
      .insert({
        id: invited.user.id,
        tenant_id: tenantId,
        role,
        email,
        name,
        manager_id: managerId ?? null,
        base_salary: baseSalary,
        allowances,
        deductions,
      })
      .select('*')
      .single();

    if (error) {
      await this.supabase.client.auth.admin.deleteUser(invited.user.id); // roll back the orphan login
      throw new BadRequestException(error.message);
    }
    return toUser(data as DatabaseUserRow);
  }

  async updateEmployee(
    id: string,
    tenantId: string,
    updates: Partial<Pick<User, "name" | "role" | "managerId" | "baseSalary" | "allowances" | "deductions" | "annualLeaveBalance">>
  ): Promise<User> {
    if (updates.role === "SUPER_ADMIN") throw new BadRequestException("Cannot assign SUPER_ADMIN");
    const patch: Record<string, unknown> = {};
    if (updates.name !== undefined) patch.name = updates.name;
    if (updates.role !== undefined) patch.role = updates.role;
    if (updates.managerId !== undefined) patch.manager_id = updates.managerId || null;
    if (updates.baseSalary !== undefined) patch.base_salary = updates.baseSalary;
    if (updates.allowances !== undefined) patch.allowances = updates.allowances;
    if (updates.deductions !== undefined) patch.deductions = updates.deductions;
    if (updates.annualLeaveBalance !== undefined) patch.annual_leave_balance = updates.annualLeaveBalance;
    if (Object.keys(patch).length === 0) return this.getEmployeeById(id, tenantId);

    const { data, error } = await this.supabase.client
      .from("users").update(patch).eq("id", id).eq("tenant_id", tenantId).select("*").maybeSingle();
    if (error) throw new BadRequestException(error.message);
    if (!data) throw new NotFoundException("Employee " + id + " not found");
    return toUser(data as DatabaseUserRow);
  }
}
