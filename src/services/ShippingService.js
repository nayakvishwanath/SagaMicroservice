'use strict';

const { log } = require('../utils/logger');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let shipCounter = 1;

/**
 * ShippingService — schedules and cancels shipments.
 *
 * In a real system this would call a 3PL (FedEx, UPS) API or an internal
 * warehouse management system.
 */
class ShippingService {
  constructor() {
    /** @type {Map<string, { orderId: string, status: string }>} */
    this.shipments = new Map();

    /**
     * Inject a failure mode to simulate unhappy paths.
     * Values: null | 'schedule'
     */
    this.failureMode = null;
  }

  /** Reset state between demo scenarios. */
  reset() {
    this.shipments.clear();
    this.failureMode = null;
    shipCounter = 1;
  }

  // ─── Forward Transaction ──────────────────────────────────────────────────

  /**
   * Schedule a shipment for a confirmed order.
   * @param {{ order: object }} ctx
   */
  async scheduleShipment({ order }) {
    await sleep(90);

    if (this.failureMode === 'schedule') {
      log('Shipping Service', `FAILED: no carrier available for order ${order.orderId}`, 'error');
      throw new Error('Shipment failed: no carrier available in region');
    }

    const shipmentId = `SHP-${String(shipCounter++).padStart(3, '0')}`;
    const estimatedDelivery = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    const shipment = {
      shipmentId,
      orderId:           order.orderId,
      status:            'SCHEDULED',
      carrier:           'FastShip Express',
      estimatedDelivery,
    };

    this.shipments.set(shipmentId, shipment);
    log(
      'Shipping Service',
      `Scheduled shipment ${shipmentId} for ${order.orderId} (ETA: ${estimatedDelivery})`,
      'success'
    );
    return shipment;
  }

  // ─── Compensating Transaction ─────────────────────────────────────────────

  /**
   * Cancel a scheduled shipment — the compensating transaction for scheduleShipment.
   * Idempotent: cancelling an already-cancelled shipment is a no-op.
   */
  async cancelShipment(shipmentId) {
    await sleep(90);

    const shipment = this.shipments.get(shipmentId);
    if (!shipment) {
      log('Shipping Service', `[COMPENSATE] Shipment ${shipmentId} not found — skipped (idempotent)`, 'compensate');
      return;
    }

    if (shipment.status === 'CANCELLED') {
      log('Shipping Service', `[COMPENSATE] Shipment ${shipmentId} already cancelled — skipped (idempotent)`, 'compensate');
      return;
    }

    shipment.status = 'CANCELLED';
    log('Shipping Service', `[COMPENSATE] Cancelled shipment ${shipmentId}`, 'compensate');
    return { shipmentId, status: 'CANCELLED' };
  }
}

module.exports = ShippingService;
