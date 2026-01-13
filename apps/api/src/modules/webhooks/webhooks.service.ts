import { prisma } from '../../lib/prisma';
import { WebhookEventLog, WebhookEventStatus } from '@prisma/client';

export interface WebhookStats {
  paystack: {
    totalEvents: number;
    successfulEvents: number;
    failedEvents: number;
    successRate: number;
    failureRate: number;
    lastEventTime: string | null;
  };
  custom: {
    totalEvents: number;
    successfulEvents: number;
    failedEvents: number;
    successRate: number;
    failureRate: number;
    lastEventTime: string | null;
  };
  overall: {
    totalEvents: number;
    successfulEvents: number;
    failedEvents: number;
    successRate: number;
    failureRate: number;
    lastEventTime: string | null;
  };
  recentEvents: Array<{
    id: number;
    eventType: string;
    status: WebhookEventStatus;
    timestamp: string;
    source: string;
  }>;
}

export interface WebhookEventResponse {
  id: number;
  eventType: string;
  status: WebhookEventStatus;
  statusCode: number | null;
  duration: number | null;
  payload: any;
  errorMessage: string | null;
  createdAt: string;
  associationId: number;
  endpoint: string | null;
  retryCount: number;
  isTest: boolean;
}

export interface WebhookEventsResponse {
  events: WebhookEventResponse[];
  total: number;
  page: number;
  limit: number;
}

export interface WebhookTestRequest {
  eventType: string;
  payload: any;
  headers?: Record<string, string>;
  simulateDelay?: number;
  simulateError?: boolean;
  errorStatusCode?: number;
}

export interface WebhookTestResponse {
  success: boolean;
  responseCode: number;
  responseBody: any;
  responseTime: number;
  error?: string;
}

// Get webhook statistics
export async function getWebhookStats(associationId?: number): Promise<WebhookStats> {
  const whereClause = associationId ? { associationId } : {};
  
  const [
    paystackTotal,
    paystackSuccess,
    paystackFailed,
    customTotal,
    customSuccess,
    customFailed
  ] = await Promise.all([
    prisma.webhookEventLog.count({
      where: { ...whereClause, source: 'paystack', isTest: false }
    }),
    prisma.webhookEventLog.count({
      where: { ...whereClause, source: 'paystack', status: 'SUCCESS', isTest: false }
    }),
    prisma.webhookEventLog.count({
      where: { ...whereClause, source: 'paystack', status: 'FAILED', isTest: false }
    }),
    prisma.webhookEventLog.count({
      where: { ...whereClause, source: 'custom', isTest: false }
    }),
    prisma.webhookEventLog.count({
      where: { ...whereClause, source: 'custom', status: 'SUCCESS', isTest: false }
    }),
    prisma.webhookEventLog.count({
      where: { ...whereClause, source: 'custom', status: 'FAILED', isTest: false }
    }),
  ]);

  const paystackLastEvent = await prisma.webhookEventLog.findFirst({
    where: { ...whereClause, source: 'paystack', isTest: false },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true }
  });

  const customLastEvent = await prisma.webhookEventLog.findFirst({
    where: { ...whereClause, source: 'custom', isTest: false },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true }
  });

  const overallTotal = paystackTotal + customTotal;
  const overallSuccess = paystackSuccess + customSuccess;
  const overallFailed = paystackFailed + customFailed;
  const overallSuccessRate = overallTotal > 0 ? (overallSuccess / overallTotal) * 100 : 0;
  const overallFailureRate = overallTotal > 0 ? (overallFailed / overallTotal) * 100 : 0;

  const lastOverallEvent = [paystackLastEvent, customLastEvent]
    .filter((e): e is { createdAt: Date } => e !== null)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

  const recentEvents = await prisma.webhookEventLog.findMany({
    where: { ...whereClause, isTest: false },
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: {
      id: true,
      eventType: true,
      status: true,
      createdAt: true,
      source: true
    }
  });

  return {
    paystack: {
      totalEvents: paystackTotal,
      successfulEvents: paystackSuccess,
      failedEvents: paystackFailed,
      successRate: paystackTotal > 0 ? (paystackSuccess / paystackTotal) * 100 : 0,
      failureRate: paystackTotal > 0 ? (paystackFailed / paystackTotal) * 100 : 0,
      lastEventTime: paystackLastEvent?.createdAt?.toISOString() || null
    },
    custom: {
      totalEvents: customTotal,
      successfulEvents: customSuccess,
      failedEvents: customFailed,
      successRate: customTotal > 0 ? (customSuccess / customTotal) * 100 : 0,
      failureRate: customTotal > 0 ? (customFailed / customTotal) * 100 : 0,
      lastEventTime: customLastEvent?.createdAt?.toISOString() || null
    },
    overall: {
      totalEvents: overallTotal,
      successfulEvents: overallSuccess,
      failedEvents: overallFailed,
      successRate: overallSuccessRate,
      failureRate: overallFailureRate,
      lastEventTime: lastOverallEvent?.createdAt?.toISOString() || null
    },
    recentEvents: recentEvents.map(e => ({
      id: e.id,
      eventType: e.eventType,
      status: e.status,
      timestamp: e.createdAt.toISOString(),
      source: e.source
    }))
  };
}

// Get webhook events with pagination and filters
export async function getWebhookEvents(params: {
  associationId?: number;
  page?: number;
  limit?: number;
  eventType?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
}): Promise<WebhookEventsResponse> {
  const {
    associationId,
    page = 1,
    limit = 20,
    eventType,
    status,
    startDate,
    endDate,
    search
  } = params;

  const where: any = {};
  
  if (associationId) {
    where.associationId = associationId;
  }

  if (eventType) {
    where.eventType = eventType;
  }

  if (status) {
    where.status = status;
  }

  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) {
      where.createdAt.gte = new Date(startDate);
    }
    if (endDate) {
      where.createdAt.lte = new Date(endDate);
    }
  }

  if (search) {
    where.OR = [
      { eventType: { contains: search, mode: 'insensitive' } },
      { errorMessage: { contains: search, mode: 'insensitive' } }
    ];
  }

  const [events, total] = await Promise.all([
    prisma.webhookEventLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.webhookEventLog.count({ where })
  ]);

  return {
    events: events.map(e => ({
      id: e.id,
      eventType: e.eventType,
      status: e.status,
      statusCode: e.statusCode,
      duration: e.duration,
      payload: e.payload,
      errorMessage: e.errorMessage,
      createdAt: e.createdAt.toISOString(),
      associationId: e.associationId,
      endpoint: e.endpoint,
      retryCount: e.retryCount,
      isTest: e.isTest
    })),
    total,
    page,
    limit
  };
}

// Get single webhook event
export async function getWebhookEvent(id: number, associationId?: number): Promise<WebhookEventResponse | null> {
  const whereClause = associationId ? { id, associationId } : { id };
  
  const event = await prisma.webhookEventLog.findFirst({
    where: whereClause
  });

  if (!event) return null;

  return {
    id: event.id,
    eventType: event.eventType,
    status: event.status,
    statusCode: event.statusCode,
    duration: event.duration,
    payload: event.payload,
    errorMessage: event.errorMessage,
    createdAt: event.createdAt.toISOString(),
    associationId: event.associationId,
    endpoint: event.endpoint,
    retryCount: event.retryCount,
    isTest: event.isTest
  };
}

// Retry failed webhook event
export async function retryWebhookEvent(id: number, associationId?: number): Promise<void> {
  const whereClause = associationId ? { id, associationId } : { id };
  
  const event = await prisma.webhookEventLog.findFirst({
    where: whereClause
  });

  if (!event) {
    throw new Error('Webhook event not found');
  }

  // Update event status to RETRYING and increment retry count
  await prisma.webhookEventLog.update({
    where: { id },
    data: {
      status: 'RETRYING',
      retryCount: event.retryCount + 1,
      updatedAt: new Date()
    }
  });
}

// Retry all failed webhook events
export async function retryFailedWebhooks(associationId?: number): Promise<void> {
  const whereClause: any = { 
    status: 'FAILED' as const, 
    isTest: false 
  };
  
  if (associationId) {
    whereClause.associationId = associationId;
  }
    
  await prisma.webhookEventLog.updateMany({
    where: whereClause,
    data: {
      status: 'RETRYING',
      retryCount: { increment: 1 },
      updatedAt: new Date()
    }
  });
}

// Clear webhook logs
export async function clearWebhookLogs(params: {
  associationId?: number;
  olderThan?: string;
  status?: string;
}): Promise<{ count: number }> {
  const { associationId, olderThan, status } = params;

  const where: any = {};
  
  if (associationId) {
    where.associationId = associationId;
  }

  if (status) {
    where.status = status;
  }

  if (olderThan) {
    where.createdAt = {
      lt: new Date(olderThan)
    };
  }

  const result = await prisma.webhookEventLog.deleteMany({ where });
  
  return { count: result.count };
}

// Test webhook
export async function testWebhook(params: {
  associationId?: number;
  testRequest: WebhookTestRequest;
}): Promise<WebhookTestResponse> {
  const { associationId, testRequest } = params;
  const startTime = Date.now();

  // Simulate delay if specified
  if (testRequest.simulateDelay) {
    await new Promise(resolve => setTimeout(resolve, testRequest.simulateDelay));
  }

  // Simulate error if specified
  if (testRequest.simulateError) {
    const errorResponse: WebhookTestResponse = {
      success: false,
      responseCode: testRequest.errorStatusCode || 500,
      responseBody: null,
      responseTime: Date.now() - startTime,
      error: 'Simulated error for testing purposes'
    };

    // Log the test event (only if associationId is provided)
    if (associationId) {
      await prisma.webhookEventLog.create({
        data: {
          associationId,
          eventType: testRequest.eventType,
          status: 'FAILED',
        statusCode: testRequest.errorStatusCode || 500,
        duration: Date.now() - startTime,
        payload: testRequest.payload,
        errorMessage: 'Simulated error for testing purposes',
        source: 'custom',
        endpoint: null,
        isTest: true
      }
    });
    }

    return errorResponse;
  }

  // Simulate successful webhook
  const successResponse: WebhookTestResponse = {
    success: true,
    responseCode: 200,
    responseBody: {
      message: 'Webhook test successful',
      receivedAt: new Date().toISOString(),
      payload: testRequest.payload
    },
    responseTime: Date.now() - startTime
  };

  // Log the test event (only if associationId is provided)
  if (associationId) {
    await prisma.webhookEventLog.create({
      data: {
        associationId,
        eventType: testRequest.eventType,
        status: 'SUCCESS',
        statusCode: 200,
        duration: Date.now() - startTime,
      payload: testRequest.payload,
      responseBody: successResponse.responseBody,
      source: 'custom',
      endpoint: null,
      isTest: true
    }
  });
  }

  return successResponse;
}

// Get webhook event types
export async function getWebhookEventTypes(): Promise<string[]> {
  return [
    'payment.success',
    'payment.failed',
    'subscription.created',
    'subscription.renewed',
    'subscription.cancelled',
    'subscription.not_renew',
    'subscription.expiring_cards',
    'invoice.created',
    'invoice.paid',
    'invoice.failed',
    'customer.created',
    'customer.updated',
    'member.joined',
    'member.left',
    'meeting.scheduled',
    'meeting.completed',
    'charge.success',
    'charge.failed',
    'transfer.success',
    'transfer.failed',
    'refund.success',
    'refund.failed'
  ];
}
