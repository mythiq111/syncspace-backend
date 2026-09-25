// backend/src/app.module.ts

import { Module } from '@nestjs/common';
import { AttendanceController } from './modules/attendance/attendance.controller';
import { AttendanceService } from './modules/attendance/attendance.service';
import { LeaveController } from './modules/leave/leave.controller';
import { LeaveService } from './modules/leave/leave.service';
import { PayrollController } from './modules/payroll/payroll.controller';
import { PayrollService } from './modules/payroll/payroll.service';
import { OrganizationsController } from './modules/organizations/organizations.controller';
import { OrganizationsService } from './modules/organizations/organizations.service';
import { EmployeesController } from './modules/employees/employees.controller';
import { EmployeesService } from './modules/employees/employees.service';
import { NotificationsService } from './modules/notifications/notifications.service';
import { DataIngestionController } from './modules/data-ingestion/data-ingestion.controller';
import { DataIngestionService } from './modules/data-ingestion/data-ingestion.service';
import { ShiftClosureWorker } from './modules/jobs/shift-closure.worker';
import { PdfPayslipWorker } from './modules/jobs/pdf-payslip.worker';

@Module({
  imports: [],
  controllers: [
    AttendanceController,
    LeaveController,
    PayrollController,
    OrganizationsController,
    EmployeesController,
    DataIngestionController,
  ],
  providers: [
    AttendanceService,
    LeaveService,
    PayrollService,
    OrganizationsService,
    EmployeesService,
    NotificationsService,
    DataIngestionService,
    ShiftClosureWorker,
    PdfPayslipWorker,
  ],
})
export class AppModule {}
