// backend/src/modules/data-ingestion/data-ingestion.service.ts

import { Injectable, BadRequestException } from '@nestjs/common';
import { EmployeesService } from '../employees/employees.service';
import { UserRole } from '../../../shared/types';

@Injectable()
export class DataIngestionService {
  constructor(private readonly employeesService: EmployeesService) {}

  async parseAndImportCsv(tenantId: string, csvContent: string): Promise<{ importedCount: number; errors: string[] }> {
    if (!csvContent || csvContent.trim().length === 0) {
      throw new BadRequestException('CSV file content is empty');
    }

    const lines = csvContent.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length <= 1) {
      return { importedCount: 0, errors: ['CSV contains header only or no data rows'] };
    }

    const rows = lines.slice(1);
    let count = 0;
    const errors: string[] = [];

    for (let i = 0; i < rows.length; i++) {
      const parts = rows[i].split(',').map((p) => p.trim());
      if (parts.length < 2) {
        errors.push(`Row ${i + 2}: Insufficient columns`);
        continue;
      }

      const [email, name, roleStr, baseSalaryStr] = parts;
      const role: UserRole = (roleStr as UserRole) || 'EMPLOYEE';
      const baseSalary = parseFloat(baseSalaryStr) || 0;

      try {
        await this.employeesService.inviteEmployee(tenantId, { email, name, role, baseSalary });
        count++;
      } catch (err: any) {
        errors.push(`Row ${i + 2}: ${err.message}`);
      }
    }

    return { importedCount: count, errors };
  }
}
