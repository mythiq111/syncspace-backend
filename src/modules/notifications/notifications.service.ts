// backend/src/modules/notifications/notifications.service.ts

import { Injectable, Logger } from '@nestjs/common';

export interface PushNotificationPayload {
  toExpoPushToken: string;
  title: string;
  body: string;
  data?: Record<string, any>;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  async sendPushNotification(payload: PushNotificationPayload): Promise<{ success: boolean; id: string }> {
    this.logger.log(`Dispatching Expo Push Notification to token: ${payload.toExpoPushToken}`);
    this.logger.log(`[Notification] Title: "${payload.title}" | Body: "${payload.body}"`);

    return {
      success: true,
      id: `push-${Date.now()}`,
    };
  }

  async notifyLeaveApprovalRequest(managerId: string, employeeName: string): Promise<void> {
    await this.sendPushNotification({
      toExpoPushToken: `ExponentPushToken[manager-${managerId}]`,
      title: 'New Leave Approval Request',
      body: `${employeeName} has submitted a new leave request awaiting your approval.`,
    });
  }

  async notifyMissedPunchAlert(userId: string): Promise<void> {
    await this.sendPushNotification({
      toExpoPushToken: `ExponentPushToken[user-${userId}]`,
      title: 'Missed Punch Alert',
      body: 'You missed a clock-out punch yesterday. Please submit a regularization request.',
    });
  }
}
