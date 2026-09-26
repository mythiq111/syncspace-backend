// backend/src/modules/notifications/notifications.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service';
import { SettingsService } from '../../common/settings/settings.service';

export interface PushNotificationPayload {
  toExpoPushToken: string;
  title: string;
  body: string;
  data?: Record<string, any>;
}

const SLACK_WEBHOOK_RE = /^https:\/\/hooks\.slack\.com\/services\/[A-Za-z0-9/_-]+$/;

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly settings: SettingsService
  ) {}

  // ---- Slack (per-company incoming webhook, stored in tenant_secrets) ----

  static isValidSlackWebhook(url: string): boolean {
    return SLACK_WEBHOOK_RE.test(url);
  }

  async getSlackWebhook(tenantId: string): Promise<string | null> {
    const { data } = await this.supabase.client.from('tenant_secrets').select('slack_webhook_url').eq('tenant_id', tenantId).maybeSingle();
    return data?.slack_webhook_url ?? null;
  }

  /** Posts to the company's Slack channel. Throws on failure. */
  async sendSlack(webhookUrl: string, text: string): Promise<void> {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`Slack responded ${res.status}: ${(await res.text()).slice(0, 120)}`);
  }

  /** Fire-and-forget: tells Slack about a leave request or decision if the company enabled it. Never throws. */
  async notifyLeaveEvent(tenantId: string, text: string): Promise<void> {
    try {
      const s = await this.settings.get(tenantId);
      if (!s.integrations.slackNotifyLeave) return;
      const url = await this.getSlackWebhook(tenantId);
      if (url) await this.sendSlack(url, text);
    } catch (e) {
      this.logger.warn(`Slack notification failed: ${(e as Error).message}`);
    }
  }

  // ---- Push (Expo) placeholders: real delivery needs device tokens, which are not stored yet ----

  async sendPushNotification(payload: PushNotificationPayload): Promise<{ success: boolean; id: string }> {
    this.logger.log(`[Notification] ${payload.title}: ${payload.body}`);
    return { success: true, id: `push-${Date.now()}` };
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
