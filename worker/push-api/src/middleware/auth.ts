import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
  userId?: string;
  isBot?: boolean;
}

export const authMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return res.status(401).json({ error: 'Authorization header required' });
  }

  const token = authHeader.split(' ')[1]; // Bearer <token>
  
  if (!token) {
    return res.status(401).json({ error: 'Token required' });
  }

  try {
    // Check if it's a bot token first
    if (token === process.env.BOT_TOKEN) {
      req.isBot = true;
      return next();
    }

    // Otherwise verify JWT
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret') as any;
    req.userId = decoded.userId || decoded.sub;
    
    if (!req.userId) {
      return res.status(401).json({ error: 'Invalid token payload' });
    }

    next();
  } catch (error) {
    console.error('Auth error:', error);
    return res.status(401).json({ error: 'Invalid token' });
  }
};

export const requireAuth = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.userId && !req.isBot) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
};

export const requireBotAuth = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.isBot) {
    return res.status(403).json({ error: 'Bot authentication required' });
  }
  next();
};
EOF 2>&1
