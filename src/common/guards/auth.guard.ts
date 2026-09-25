// backend/src/common/guards/auth.guard.ts

import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { UserRole } from '../../../shared/types';

export interface AuthenticatedUserContext {
  id: string;
  tenantId: string;
  role: UserRole;
  email: string;
}

@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      const mockTenantId = request.headers['x-tenant-id'] || 'tenant-123';
      const mockUserId = request.headers['x-user-id'] || 'user-123';
      const mockRole = (request.headers['x-user-role'] as UserRole) || 'EMPLOYEE';
      const mockEmail = request.headers['x-user-email'] || 'employee@empflow.com';

      request.user = {
        id: mockUserId,
        tenantId: mockTenantId,
        role: mockRole,
        email: mockEmail,
      } as AuthenticatedUserContext;
      return true;
    }

    const token = authHeader.split(' ')[1];
    
    try {
      const payloadBase64 = token.split('.')[1];
      if (payloadBase64) {
        const decoded = JSON.parse(Buffer.from(payloadBase64, 'base64').toString('utf-8'));
        request.user = {
          id: decoded.sub || decoded.user_id || 'user-123',
          tenantId: decoded.app_metadata?.tenantId || decoded.user_metadata?.tenantId || 'tenant-123',
          role: decoded.app_metadata?.role || decoded.user_metadata?.role || 'EMPLOYEE',
          email: decoded.email || 'employee@empflow.com',
        };
      } else {
        request.user = {
          id: 'user-123',
          tenantId: 'tenant-123',
          role: 'EMPLOYEE',
          email: 'employee@empflow.com',
        };
      }
      return true;
    } catch (e) {
      throw new UnauthorizedException('Invalid or expired authentication token');
    }
  }
}
