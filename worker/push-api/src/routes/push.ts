import { Router } from 'express';
import { z } from 'zod';
import { AuthRequest, requireBotAuth } from '../middleware/auth';
import { createError } from '../middleware/errorHandler';
import { PushDispatchService } from '../services/pushDispatch';

const router = Router();

const dispatchSchema = z.object({
  userId: z.string().uuid(),
  event: z.object({
    title: z.string(),
    body: z.string(),
    icon: z.string().optional(),
    badge: z.string().optional(),
    data: z.object({
      eventId: z.string(),
      groupId: z.string().optional(),
      type: z.string(),
      timestamp: z.number(),
    }),
  }),
});

const testNotificationSchema = z.object({
  title: z.string(),
  body: z.string(),
});

const pushService = new PushDispatchService();

// POST /api/push/dispatch - Dispatch push notification (bot only)
router.post('/dispatch', requireBotAuth, async (req: AuthRequest, res, next) => {
  try {
    const { userId, event } = dispatchSchema.parse(req.body);

    const result = await pushService.dispatchToUser(userId, event);

    res.json({
      success: true,
      dispatched: result.successful,
      failed: result.failed,
      total: result.total,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError('Invalid dispatch data', 400));
    }
    next(error);
  }
});

// POST /api/push/test - Send test notification (development)
router.post('/test', async (req: AuthRequest, res, next) => {
  if (process.env.NODE_ENV === 'production') {
    return next(createError('Test endpoint not available in production', 404));
  }

  try {
    const { title, body } = testNotificationSchema.parse(req.body);

    // For testing, we'll send to all subscriptions
    const testEvent = {
      title,
      body,
      icon: '/web-app-manifest-192x192.png',
      badge: '/web-app-manifest-192x192.png',
      data: {
        eventId: 'test-' + Date.now(),
        type: 'test',
        timestamp: Math.floor(Date.now() / 1000),
      },
    };

    const result = await pushService.dispatchToAll(testEvent);

    res.json({
      success: true,
      message: 'Test notifications sent',
      dispatched: result.successful,
      failed: result.failed,
      total: result.total,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError('Invalid test data', 400));
    }
    next(error);
  }
});

export { router as pushRouter };
EOF 2>&1
