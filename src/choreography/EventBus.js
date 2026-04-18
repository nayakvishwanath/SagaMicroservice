'use strict';

const { log } = require('../utils/logger');

/**
 * AsyncEventBus — a simple in-process async event bus.
 *
 * In production this would be replaced by Apache Kafka, RabbitMQ, AWS SNS/SQS,
 * or any durable message broker.  This in-memory version keeps the demo
 * runnable with zero dependencies while preserving the exact same programming
 * model: services publish events and other services react to them.
 *
 * KEY DESIGN DECISIONS:
 *   - Handlers are called sequentially and awaited, so the demo output is easy
 *     to follow.  A real broker would deliver messages concurrently.
 *   - There is no retry / dead-letter logic here.  In production you must
 *     handle at-least-once delivery and idempotent consumers.
 */
class EventBus {
  constructor() {
    /** @type {Map<string, Function[]>} event name → list of async handlers */
    this.handlers = new Map();
  }

  /**
   * Subscribe to an event.
   * @param {string}   event    Domain event name (e.g. 'order.created')
   * @param {Function} handler  async (payload) => void
   */
  on(event, handler) {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, []);
    }
    this.handlers.get(event).push(handler);
  }

  /**
   * Publish an event — all registered handlers are awaited in registration order.
   * @param {string} event    Domain event name
   * @param {object} payload  Event data (saga context accumulated so far)
   */
  async emit(event, payload) {
    log('Event Bus', `Published: ${event}`, 'event');
    const handlers = this.handlers.get(event) || [];
    for (const handler of handlers) {
      await handler(payload);
    }
  }
}

module.exports = EventBus;
