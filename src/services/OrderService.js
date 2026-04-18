'use strict';

const { log } = require('../utils/logger');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let counter = 1;

/**
 * OrderService — manages the lifecycle of customer orders.
 *
 * In a real system this would talk to a database. Here we use an in-memory
 * Map so the demo runs without any external dependencies.
 */
class OrderService {
  constructor() {
    /** @type {Map<string, object>} orderId → order */
    this.orders = new Map();
    /**
     * Inject a failure mode to simulate unhappy paths.
     * Values: null | 'create' | 'confirm'
     */
    this.failureMode = null;
  }

  /** Reset state between demo scenarios. */
  reset() {
    this.orders.clear();
    this.failureMode = null;
    counter = 1;
  }

  // ─── Forward Transaction ──────────────────────────────────────────────────

  /**
   * Create a new order in PENDING status.
   * This is the first step of the saga — nothing is confirmed yet.
   */
  async createOrder({ customerId, items, totalAmount }) {
    await sleep(80);

    if (this.failureMode === 'create') {
      log('Order Service', 'FAILED: order creation rejected by risk engine', 'error');
      throw new Error('Order rejected: failed risk check');
    }

    const orderId = `ORD-${String(counter++).padStart(3, '0')}`;
    const order = {
      orderId,
      customerId,
      items,
      totalAmount,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
    };

    this.orders.set(orderId, order);
    log('Order Service', `Created order ${orderId} ($${totalAmount}) → status: PENDING`, 'success');
    return order;
  }

  /**
   * Flip order status to CONFIRMED once all saga steps succeed.
   */
  async confirmOrder(orderId) {
    await sleep(60);

    const order = this.orders.get(orderId);
    if (!order) throw new Error(`Order ${orderId} not found`);

    order.status = 'CONFIRMED';
    log('Order Service', `Order ${orderId} confirmed → status: CONFIRMED`, 'success');
    return { orderId, status: 'CONFIRMED' };
  }

  // ─── Compensating Transaction ─────────────────────────────────────────────

  /**
   * Cancel the order — the compensating transaction for createOrder.
   * Must be idempotent: cancelling an already-cancelled order is a no-op.
   */
  async cancelOrder(orderId) {
    await sleep(80);

    const order = this.orders.get(orderId);
    if (!order) return; // idempotent: already gone

    if (order.status === 'CANCELLED') {
      log('Order Service', `[COMPENSATE] Order ${orderId} already cancelled — skipped (idempotent)`, 'compensate');
      return;
    }

    order.status = 'CANCELLED';
    log('Order Service', `[COMPENSATE] Cancelled order ${orderId} → status: CANCELLED`, 'compensate');
    return { orderId, status: 'CANCELLED' };
  }
}

module.exports = OrderService;
