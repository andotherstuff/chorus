import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/connection';
import { pushSubscriptions } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { AuthRequest, requireAuth } from '../middleware/auth';
import { createError } from '../middleware/errorHandler';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

const subscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string(),
    auth: z.string(),
  }),
});

// POST /api/subscriptions - Create or update push subscription
router.post('/', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const { endpoint, keys } = subscriptionSchema.parse(req.body);
    const userId = req.userId!;

    // Check if subscription already exists for this user and endpoint
    const existing = await db
      .select()
      .from(pushSubscriptions)
      .where(
        and(
          eq(pushSubscriptions.userId, userId),
          eq(pushSubscriptions.endpoint, endpoint)
        )
      )
      .limit(1);

    let subscription;

    if (existing.length > 0) {
      // Update existing subscription
      subscription = await db
        .update(pushSubscriptions)
        .set({
          p256dh: keys.p256dh,
          auth: keys.auth,
          lastSeen: new Date(),
        })
        .where(eq(pushSubscriptions.id, existing[0].id))
        .returning();
    } else {
      // Create new subscription
      subscription = await db
        .insert(pushSubscriptions)
        .values({
          id: uuidv4(),
          userId,
          endpoint,
          p256dh: keys.p256dh,
          auth: keys.auth,
        })
        .returning();
    }

    res.status(201).json({
      success: true,
      subscription: subscription[0],
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError('Invalid subscription data', 400));
    }
    next(error);
  }
});

// GET /api/subscriptions - Get user's subscriptions
router.get('/', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.userId!;

    const subscriptions = await db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.userId, userId));

    res.json({
      success: true,
      subscriptions: subscriptions.map(sub => ({
        id: sub.id,
        endpoint: sub.endpoint,
        createdAt: sub.createdAt,
        lastSeen: sub.lastSeen,
      })),
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/subscriptions/:id - Remove subscription
router.delete('/:id', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const subscriptionId = req.params.id;
    const userId = req.userId!;

    const result = await db
      .delete(pushSubscriptions)
      .where(
        and(
          eq(pushSubscriptions.id, subscriptionId),
          eq(pushSubscriptions.userId, userId)
        )
      )
      .returning();

    if (result.length === 0) {
      return next(createError('Subscription not found', 404));
    }

    res.json({
      success: true,
      message: 'Subscription removed',
    });
  } catch (error) {
    next(error);
  }
});

export { router as subscriptionRouter };
EOF 2>&1
