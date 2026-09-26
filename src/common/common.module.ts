// backend/src/common/common.module.ts

import { Global, Module } from '@nestjs/common';
import { SettingsService } from './settings/settings.service';
import { AuditService } from './audit/audit.service';

@Global()
@Module({
  providers: [SettingsService, AuditService],
  exports: [SettingsService, AuditService],
})
export class CommonModule {}
