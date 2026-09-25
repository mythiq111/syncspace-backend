// backend/src/modules/data-ingestion/data-ingestion.controller.ts

import { Controller, Post, Body, Req, UseGuards } from '@nestjs/common';
import { DataIngestionService } from './data-ingestion.service';
import { AuthGuard, AuthenticatedUserContext } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ApiResponse } from '../../../shared/types';

@Controller('data-ingestion')
@UseGuards(AuthGuard, RolesGuard)
export class DataIngestionController {
  constructor(private readonly ingestionService: DataIngestionService) {}

  @Post('import-csv')
  @Roles('TENANT_ADMIN', 'HR_MANAGER', 'SUPER_ADMIN')
  async importCsv(
    @Req() req: { user: AuthenticatedUserContext },
    @Body() body: { csvData: string }
  ): Promise<ApiResponse<{ importedCount: number; errors: string[] }>> {
    const result = await this.ingestionService.parseAndImportCsv(req.user.tenantId, body.csvData);
    return { data: result };
  }
}
