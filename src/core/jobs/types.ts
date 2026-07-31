export type JobType =
  | 'notification-fanout'
  | 'email-delivery'
  | 'cleanup'
  | 'trust-score-recalculate'
  | 'maintenance';

export interface NotificationFanoutPayload {
  notificationId: string;
  userIds: string[];
}

export interface EmailDeliveryPayload {
  to: string;
  subject: string;
  body: string;
  metadata?: Record<string, any>;
}

export interface CleanupPayload {
  olderThanDays: number;
}

export interface TrustScoreRecalculatePayload {
  userId: string;
}

export interface MaintenancePayload {
  task: 'session-cleanup' | 'soft-delete-purge';
}

export interface JobPayloadMap {
  'notification-fanout': NotificationFanoutPayload;
  'email-delivery': EmailDeliveryPayload;
  'cleanup': CleanupPayload;
  'trust-score-recalculate': TrustScoreRecalculatePayload;
  'maintenance': MaintenancePayload;
}
