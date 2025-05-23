/**
 * Cloudflare Worker API for Push Notifications
 * Handles subscription management and notification dispatch
 */

import { Env } from './worker-enhanced';

interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

interface UserSubscription {
  npub: string;
  subscription: PushSubscription;
  groups: string[]; // Array of group IDs (34550:pubkey:identifier)
  preferences: {
    mentions: boolean;
    groupActivity: boolean;
    reactions: boolean;
    moderation: boolean;
    frequency: 'immediate' | 'hourly' | 'daily';
  };
  createdAt: number;
  lastNotified: number;
}

export class WorkerAPI {
  constructor(private env: Env) {}

  async handleRequest(request: Request): Promise<Response> {
    const url = new URL(request.url);
    
    // CORS headers for browser requests
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    // Handle preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      let response: Response;

      switch (url.pathname) {
        case '/api/subscribe':
          response = await this.handleSubscribe(request);
          break;
        case '/api/unsubscribe':
          response = await this.handleUnsubscribe(request);
          break;
        case '/api/subscriptions':
          response = await this.handleGetSubscriptions(request);
          break;
        case '/api/preferences':
          response = await this.handleUpdatePreferences(request);
          break;
        case '/api/notify':
          response = await this.handleNotify(request);
          break;
        case '/api/test-notification':
          response = await this.handleTestNotification(request);
          break;
        case '/api/subscription/check':
          response = await this.handleCheckSubscription(request);
          break;
        default:
          response = new Response('Not Found', { status: 404 });
      }

      // Add CORS headers to response
      Object.entries(corsHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });

      return response;
    } catch (error) {
      console.error('API error:', error);
      return new Response('Internal Server Error', { 
        status: 500,
        headers: corsHeaders
      });
    }
  }

  /**
   * Handle push subscription registration
   */
  private async handleSubscribe(request: Request): Promise<Response> {
    const body = await request.json() as {
      npub: string;
      subscription: PushSubscription;
      preferences?: any;
    };

    // Store user subscription
    const userSub: UserSubscription = {
      npub: body.npub,
      subscription: body.subscription,
      groups: body.preferences?.subscriptions?.groups || [],
      preferences: {
        mentions: body.preferences?.settings?.mentions ?? true,
        groupActivity: body.preferences?.settings?.groupActivity ?? true,
        reactions: body.preferences?.settings?.reactions ?? false,
        moderation: body.preferences?.settings?.moderation ?? true,
        frequency: body.preferences?.settings?.frequency || 'immediate',
      },
      createdAt: Date.now(),
      lastNotified: 0,
    };

    await this.env.KV.put(`sub:${body.npub}`, JSON.stringify(userSub));

    // Update group memberships
    for (const groupId of userSub.groups) {
      await this.addUserToGroup(body.npub, groupId);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  /**
   * Handle push subscription removal
   */
  private async handleUnsubscribe(request: Request): Promise<Response> {
    const body = await request.json() as { npub: string };
    
    // Get existing subscription to clean up groups
    const existing = await this.env.KV.get(`sub:${body.npub}`, 'json') as UserSubscription;
    if (existing) {
      // Remove from all groups
      for (const groupId of existing.groups) {
        await this.removeUserFromGroup(body.npub, groupId);
      }
    }

    // Delete subscription
    await this.env.KV.delete(`sub:${body.npub}`);

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  /**
   * Get all subscriptions (for bot)
   */
  private async handleGetSubscriptions(request: Request): Promise<Response> {
    // Verify bot token
    const auth = request.headers.get('Authorization');
    if (auth !== `Bearer ${this.env.BOT_TOKEN}`) {
      return new Response('Unauthorized', { status: 401 });
    }

    const subscriptions = await this.env.KV.list({ prefix: 'sub:' });
    const users: Record<string, string[]> = {};

    for (const key of subscriptions.keys) {
      const sub = await this.env.KV.get(key.name, 'json') as UserSubscription;
      if (sub) {
        users[sub.npub] = sub.groups;
      }
    }

    return new Response(JSON.stringify({ users }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  /**
   * Update user preferences
   */
  private async handleUpdatePreferences(request: Request): Promise<Response> {
    const body = await request.json() as {
      npub: string;
      preferences: any;
    };

    const existing = await this.env.KV.get(`sub:${body.npub}`, 'json') as UserSubscription;
    if (!existing) {
      return new Response('Subscription not found', { status: 404 });
    }

    // Update groups if changed
    const oldGroups = existing.groups;
    const newGroups = body.preferences?.subscriptions?.groups || [];

    // Remove from old groups
    for (const groupId of oldGroups) {
      if (!newGroups.includes(groupId)) {
        await this.removeUserFromGroup(body.npub, groupId);
      }
    }

    // Add to new groups
    for (const groupId of newGroups) {
      if (!oldGroups.includes(groupId)) {
        await this.addUserToGroup(body.npub, groupId);
      }
    }

    // Update subscription
    existing.groups = newGroups;
    existing.preferences = {
      mentions: body.preferences?.settings?.mentions ?? existing.preferences.mentions,
      groupActivity: body.preferences?.settings?.groupActivity ?? existing.preferences.groupActivity,
      reactions: body.preferences?.settings?.reactions ?? existing.preferences.reactions,
      moderation: body.preferences?.settings?.moderation ?? existing.preferences.moderation,
      frequency: body.preferences?.settings?.frequency || existing.preferences.frequency,
    };

    await this.env.KV.put(`sub:${body.npub}`, JSON.stringify(existing));

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  /**
   * Send notification to user (called by bot)
   */
  private async handleNotify(request: Request): Promise<Response> {
    // Verify bot token
    const auth = request.headers.get('Authorization');
    if (auth !== `Bearer ${this.env.BOT_TOKEN}`) {
      return new Response('Unauthorized', { status: 401 });
    }

    const body = await request.json() as {
      npub: string;
      notification: any;
    };

    const sub = await this.env.KV.get(`sub:${body.npub}`, 'json') as UserSubscription;
    if (!sub) {
      return new Response('User not subscribed', { status: 404 });
    }

    // Check user preferences
    if (!this.shouldSendNotification(sub, body.notification)) {
      return new Response('Notification filtered by preferences', { status: 204 });
    }

    // Format notification
    const payload = {
      title: this.getNotificationTitle(body.notification),
      body: body.notification.content,
      icon: '/icon-192x192.png',
      badge: '/icon-96x96.png',
      data: {
        url: this.getNotificationUrl(body.notification),
        ...body.notification
      },
      timestamp: Date.now()
    };

    // Send push notification
    await this.sendPushNotification(sub.subscription, payload);

    // Update last notified time
    sub.lastNotified = Date.now();
    await this.env.KV.put(`sub:${body.npub}`, JSON.stringify(sub));

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  /**
   * Send test notification
   */
  private async handleTestNotification(request: Request): Promise<Response> {
    const body = await request.json() as {
      npub: string;
      message?: string;
    };

    const sub = await this.env.KV.get(`sub:${body.npub}`, 'json') as UserSubscription;
    if (!sub) {
      return new Response('Subscription not found', { status: 404 });
    }

    const payload = {
      title: '🎵 Chorus Test Notification',
      body: body.message || 'This is a test notification from Chorus!',
      icon: '/icon-192x192.png',
      badge: '/icon-96x96.png',
      data: { url: '/settings/notifications' },
      timestamp: Date.now()
    };

    await this.sendPushNotification(sub.subscription, payload);

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  /**
   * Check if subscription is valid
   */
  private async handleCheckSubscription(request: Request): Promise<Response> {
    const body = await request.json() as {
      npub: string;
      endpoint: string;
    };

    const sub = await this.env.KV.get(`sub:${body.npub}`, 'json') as UserSubscription;
    if (!sub || sub.subscription.endpoint !== body.endpoint) {
      return new Response('Invalid subscription', { status: 404 });
    }

    return new Response(JSON.stringify({ valid: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  /**
   * Add user to group subscribers
   */
  private async addUserToGroup(npub: string, groupId: string): Promise<void> {
    const key = `group:${groupId}`;
    const members = await this.env.KV.get(key, 'json') as string[] || [];
    if (!members.includes(npub)) {
      members.push(npub);
      await this.env.KV.put(key, JSON.stringify(members));
    }
  }

  /**
   * Remove user from group subscribers
   */
  private async removeUserFromGroup(npub: string, groupId: string): Promise<void> {
    const key = `group:${groupId}`;
    const members = await this.env.KV.get(key, 'json') as string[] || [];
    const filtered = members.filter(n => n !== npub);
    if (filtered.length > 0) {
      await this.env.KV.put(key, JSON.stringify(filtered));
    } else {
      await this.env.KV.delete(key);
    }
  }

  /**
   * Check if notification should be sent based on preferences
   */
  private shouldSendNotification(sub: UserSubscription, notification: any): boolean {
    switch (notification.type) {
      case 'mention':
        return sub.preferences.mentions;
      case 'new_post':
      case 'group_activity':
        return sub.preferences.groupActivity;
      case 'reaction':
        return sub.preferences.reactions;
      case 'post_approved':
      case 'post_removed':
        return sub.preferences.moderation;
      default:
        return true;
    }
  }

  /**
   * Get notification title
   */
  private getNotificationTitle(notification: any): string {
    switch (notification.type) {
      case 'mention':
        return '💬 You were mentioned';
      case 'new_post':
        return '📝 New post in group';
      case 'reaction':
        return '👍 New reaction';
      case 'post_approved':
        return '✅ Post approved';
      case 'post_removed':
        return '❌ Post removed';
      default:
        return '🔔 Chorus notification';
    }
  }

  /**
   * Get notification URL
   */
  private getNotificationUrl(notification: any): string {
    if (notification.groupId && notification.eventId) {
      return `/group/${notification.groupId}?post=${notification.eventId}`;
    } else if (notification.groupId) {
      return `/group/${notification.groupId}`;
    }
    return '/settings/notifications';
  }

  /**
   * Send push notification using Web Push protocol
   */
  private async sendPushNotification(subscription: PushSubscription, payload: any): Promise<void> {
    // For Cloudflare Workers, we need to use the web-push protocol manually
    // or use a service like FCM/APNS
    
    // First, let's try a simple approach that works with most browsers
    const message = {
      to: subscription.endpoint,
      notification: payload,
      data: payload.data
    };
    
    // If endpoint is FCM (Chrome/Edge)
    if (subscription.endpoint.includes('fcm.googleapis.com')) {
      const response = await fetch(subscription.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `key=${this.env.FCM_SERVER_KEY}`, // Optional: for better delivery
          'TTL': '86400'
        },
        body: JSON.stringify(message)
      });
      
      if (!response.ok) {
        console.error(`FCM error: ${response.status} ${await response.text()}`);
      }
      return;
    }
    
    // For other endpoints, we'd need proper Web Push encryption
    // This is simplified - in production, use a proper web-push library
    console.log(`Push notification queued for ${subscription.endpoint}`);
  }
}