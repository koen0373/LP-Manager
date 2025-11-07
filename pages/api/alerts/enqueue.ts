/**
 * Alerts Enqueue API
 * POST /api/alerts/enqueue
 * Guard: alerts entitlement required; in-memory rate-limit + hysteresis
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { getRoleForUser, getEntitlements } from '@/lib/entitlements';

type EnqueueRequest = {
  positionId: string;
  state: 'near' | 'out';
  price: number;
  timestamp: number;
};

// In-memory rate-limit tracking (per positionId)
const rateLimitMap = new Map<string, number>();
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

// Hysteresis tracking (prevent flip-flop alerts)
const hysteresisMap = new Map<string, { state: string; timestamp: number }>();
const HYSTERESIS_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ queued: boolean; message?: string } | { error: string }>
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Check entitlements
    const role = getRoleForUser(req);
    const alertsEnabled = req.query.alertsEnabled === 'true' || req.cookies['ll_alerts'] === 'true';
    const entitlements = getEntitlements(role, undefined, alertsEnabled);
    
    if (!entitlements.alerts) {
      return res.status(403).json({ 
        error: 'Alerts entitlement required. Please upgrade to Premium with Alerts add-on.' 
      });
    }
    
    // Parse request body
    const body = req.body as EnqueueRequest;
    
    if (!body.positionId || !body.state || typeof body.price !== 'number') {
      return res.status(400).json({ error: 'Invalid request body' });
    }
    
    const { positionId, state, price, timestamp } = body;
    
    // Check rate limit
    const lastAlert = rateLimitMap.get(positionId);
    if (lastAlert && Date.now() - lastAlert < RATE_LIMIT_WINDOW_MS) {
      return res.status(202).json({ 
        queued: false, 
        message: 'Rate limit: alert already sent within the last hour' 
      });
    }
    
    // Check hysteresis (prevent flip-flop)
    const lastState = hysteresisMap.get(positionId);
    if (lastState && lastState.state === state && Date.now() - lastState.timestamp < HYSTERESIS_WINDOW_MS) {
      return res.status(202).json({ 
        queued: false, 
        message: 'Hysteresis: same state alert sent recently' 
      });
    }
    
    // Enqueue alert (stub - would push to queue/send email in production)
    console.log('[alerts/enqueue] Alert queued:', { positionId, state, price, timestamp });
    
    // Update rate-limit and hysteresis tracking
    rateLimitMap.set(positionId, Date.now());
    hysteresisMap.set(positionId, { state, timestamp: Date.now() });
    
    return res.status(202).json({ 
      queued: true, 
      message: 'Alert queued for processing' 
    });
  } catch (error) {
    console.error('[alerts/enqueue] Error:', error);
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Internal server error' 
    });
  }
}




