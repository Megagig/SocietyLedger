import { Router, Request, Response } from 'express';
import { prisma } from '../../lib/prisma';
import { 
  getWebhookStats, 
  getWebhookEvents, 
  getWebhookEvent, 
  retryWebhookEvent, 
  retryFailedWebhooks, 
  clearWebhookLogs, 
  testWebhook,
  getWebhookEventTypes
} from './webhooks.service';

const router = Router();

// GET /api/webhooks/stats - Get webhook statistics
router.get('/stats', async (req: Request, res: Response) => {
  try {
    // Super Admin can view platform-wide webhook stats
    const stats = await getWebhookStats();
    res.json(stats);
  } catch (error) {
    console.error('Error fetching webhook stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch webhook statistics',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/webhooks/events - Get webhook events with pagination and filters
router.get('/events', async (req: Request, res: Response) => {
  try {
    const {
      page = '1',
      limit = '20',
      eventType,
      status,
      startDate,
      endDate,
      search,
      associationId // Optional filter for specific association
    } = req.query;

    const params: any = {};
    
    if (page) params.page = parseInt(page as string);
    if (limit) params.limit = parseInt(limit as string);
    if (eventType) params.eventType = eventType as string;
    if (status) params.status = status as string;
    if (startDate) params.startDate = startDate as string;
    if (endDate) params.endDate = endDate as string;
    if (search) params.search = search as string;
    if (associationId) params.associationId = associationId as string;

    const result = await getWebhookEvents(params);
    res.json(result);
  } catch (error) {
    console.error('Error fetching webhook events:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch webhook events',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/webhooks/events/:id - Get single webhook event
router.get('/events/:id', async (req: Request, res: Response) => {
  try {
    const eventId = parseInt(req.params.id);
    
    if (isNaN(eventId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid event ID'
      });
    }

    const event = await getWebhookEvent(eventId);
    
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Webhook event not found'
      });
    }

    res.json(event);
  } catch (error) {
    console.error('Error fetching webhook event:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch webhook event',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /api/webhooks/events/:id/retry - Retry specific webhook event
router.post('/events/:id/retry', async (req: Request, res: Response) => {
  try {
    const eventId = parseInt(req.params.id);
    
    if (isNaN(eventId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid event ID'
      });
    }

    await retryWebhookEvent(eventId);
    
    res.json({
      success: true,
      message: 'Webhook event queued for retry'
    });
  } catch (error) {
    console.error('Error retrying webhook event:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retry webhook event',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /api/webhooks/events/retry-failed - Retry all failed webhook events
router.post('/events/retry-failed', async (req: Request, res: Response) => {
  try {
    const { associationId } = req.query; // Optional filter for specific association
    
    await retryFailedWebhooks(associationId as string);
    
    res.json({
      success: true,
      message: 'Failed webhook events queued for retry'
    });
  } catch (error) {
    console.error('Error retrying failed webhooks:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retry failed webhook events',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// DELETE /api/webhooks/logs/clear - Clear webhook logs
router.delete('/logs/clear', async (req: Request, res: Response) => {
  try {
    const { olderThan, status, associationId } = req.query;
    
    const params: any = {};
    
    if (olderThan) params.olderThan = olderThan as string;
    if (status) params.status = status as string;
    if (associationId) params.associationId = associationId as string;

    const result = await clearWebhookLogs(params);
    
    res.json({
      success: true,
      message: `${result.count} webhook event logs cleared`,
      count: result.count
    });
  } catch (error) {
    console.error('Error clearing webhook logs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to clear webhook logs',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /api/webhooks/test - Test webhook
router.post('/test', async (req: Request, res: Response) => {
  try {
    const testRequest = req.body;
    const { associationId } = req.query; // Optional association context for testing
    
    const result = await testWebhook({
      associationId: associationId as string,
      testRequest
    });
    
    res.json(result);
  } catch (error) {
    console.error('Error testing webhook:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to test webhook',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/webhooks/event-types - Get available event types
router.get('/event-types', async (req: Request, res: Response) => {
  try {
    const eventTypes = await getWebhookEventTypes();
    res.json(eventTypes);
  } catch (error) {
    console.error('Error fetching event types:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch event types',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
