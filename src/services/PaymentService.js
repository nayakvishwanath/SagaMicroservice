'use strict';

const { log } = require('../utils/logger');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let chargeCounter = 1;

/**
 * PaymentService — captures and refunds payments.
 *
 * Uses a random idempotency key per charge so that retrying the same charge
 * request does not result in double-billing.  In a real system this would call
 * Stripe, Braintree, or an internal ledger.
 */
class PaymentService {
  constructor() {
    /** @type {Map<string, { orderId: string, amount: number, status: string }>} */
    this.charges = new Map();

    /**
     * Inject a failure mode to simulate unhappy paths.
     * Values: null | 'charge'
     */
    this.failureMode = null;
  }

  /** Reset state between demo scenarios. */
  reset() {
    this.charges.clear();
    this.failureMode = null;
    chargeCounter = 1;
  }

  // ─── Forward Transaction ──────────────────────────────────────────────────

  /**
   * Capture a payment for an order.
   * In production this would call the payment gateway with an idempotency key.
   * @param {{ order: object }} ctx
   */
  async chargePayment({ order }) {
    await sleep(120);

    if (this.failureMode === 'charge') {
      log('Payment Service', `FAILED: card declined for order ${order.orderId}`, 'error');
      throw new Error('Payment failed: card declined');
    }

    const chargeId = `CHG-${String(chargeCounter++).padStart(3, '0')}`;
    const charge = {
      chargeId,
      orderId:   order.orderId,
      amount:    order.totalAmount,
      currency:  'USD',
      status:    'CAPTURED',
      capturedAt: new Date().toISOString(),
    };

    this.charges.set(chargeId, charge);
    log('Payment Service', `Captured $${order.totalAmount} for ${order.orderId} → Charge: ${chargeId}`, 'success');
    return charge;
  }

  // ─── Compensating Transaction ─────────────────────────────────────────────

  /**
   * Refund a previously captured payment — the compensating transaction for chargePayment.
   * Idempotent: refunding an already-refunded charge is a no-op.
   */
  async refundPayment(chargeId) {
    await sleep(120);

    const charge = this.charges.get(chargeId);
    if (!charge) {
      log('Payment Service', `[COMPENSATE] Charge ${chargeId} not found — skipped (idempotent)`, 'compensate');
      return;
    }

    if (charge.status === 'REFUNDED') {
      log('Payment Service', `[COMPENSATE] Charge ${chargeId} already refunded — skipped (idempotent)`, 'compensate');
      return;
    }

    charge.status = 'REFUNDED';
    log('Payment Service', `[COMPENSATE] Refunded $${charge.amount} for charge ${chargeId}`, 'compensate');
    return { chargeId, status: 'REFUNDED', amount: charge.amount };
  }
}

module.exports = PaymentService;
