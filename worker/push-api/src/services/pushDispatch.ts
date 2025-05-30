import webpush from 'web-push';
import { db } from '../db/connection';
import { pushSubscriptions } from '../db/schema';
import { eq } from 'drizzle-orm';

export interface NotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  data: {
    eventId: string;
    groupId?: string;
    type: string;
    timestamp: number;
  };
}

export interface DispatchResult {
  successful: number;
  failed: number;
  total: number;
  failedSubscriptions: string[];
}

export class PushDispatchService {
  constructor() {
    // Set VAPID keys
    webpush.setVapidDetails(
      `mailto:${process.env.VAPID_EMAIL || 'admin@example.com'}`,
      process.env.VAPID_PUBLIC_KEY || '',
      process.env.VAPID_PRIVATE_KEY || ''
    );
  }

  async dispatchToUser(userId: string, payload: NotificationPayload): Promise<DispatchResult> {
    // Get all subscriptions for this user
    const userSubscriptions = await db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.userId, userId));

    if (userSubscriptions.length === 0) {
      return {
        successful: 0,
        failed: 0,
        total: 0,
        failedSubscriptions: [],
      };
    }

    return this.sendToSubscriptions(userSubscriptions, payload);
  }

  async dispatchToAll(payload: NotificationPayload): Promise<DispatchResult> {
    // Get all subscriptions (for testing)
    const allSubscriptions = await db
      .select()
      .from(pushSubscriptions);

    return this.sendToSubscriptions(allSubscriptions, payload);
  }

  private async sendToSubscriptions(
    subscriptions: typeof pushSubscriptions.$inferSelect[],
    payload: NotificationPayload
  ): Promise<DispatchResult> {
    const results = await Promise.allSettled(
      subscriptions.map(sub => this.sendNotification(sub, payload))
    );

    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    const failedSubscriptions: string[] = [];

    // Collect failed subscription IDs and clean up expired ones
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (result.status === 'rejected') {
        const subscription = subscriptions[i];
        failedSubscriptions.push(subscription.id);

        // If it's a 410 Gone response, remove the subscription
        if (result.reason?.statusCode === 410) {
          await this.removeExpiredSubscription(subscription.id);
          console.log(`Removed expired subscription: ${subscription.id}`);
        }
      }
    }

    return {
      successful,
      failed,
      total: subscriptions.length,
      failedSubscriptions,
    };
  }

  private async sendNotification(
    subscription: typeof pushSubscriptions.$inferSelect,
    payload: NotificationPayload
  ): Promise<void> {
    const pushSubscription = {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.p256dh,
        auth: subscription.auth,
      },
    };

    const options = {
      TTL: 3600, // 1 hour
      urgency: 'normal' as const,
      topic: payload.data.type,
    };

    try {
      await webpush.sendNotification(
        pushSubscription,
        JSON.stringify(payload),
        options
      );

      // Update last seen timestamp
      await db
        .update(pushSubscriptions)
        .set({ lastSeen: new Date() })
        .where(eq(pushSubscriptions.id, subscription.id));

    } catch (error: any) {
      console.error(`Failed to send notification to ${subscription.id}:`, error.message);
      
      // Re-throw to be handled by Promise.allSettled
      const err = new Error(error.message);
      (err as any).statusCode = error.statusCode;
      throw err;
    }
  }

  private async removeExpiredSubscription(subscriptionId: string): Promise<void> {
    try {
      await db
        .delete(pushSubscriptions)
        .where(eq(pushSubscriptions.id, subscriptionId));
    } catch (error) {
      console.error(`Failed to remove expired subscription ${subscriptionId}:`, error);
    }
  }

  // Method to clean up old/expired subscriptions (could be run periodically)
  async cleanupExpiredSubscriptions(): Promise<number> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const result = await db
      .delete(pushSubscriptions)
      .where(eq(pushSubscriptions.lastSeen, thirtyDaysAgo))
      .returning();

    console.log(`Cleaned up ${result.length} expired subscriptions`);
    return result.length;
  }
}
EOF 2>&1
