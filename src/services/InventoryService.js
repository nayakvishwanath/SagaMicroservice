'use strict';

const { log } = require('../utils/logger');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let resCounter = 1;

/**
 * InventoryService — reserves and releases product stock.
 *
 * Stock levels are stored in memory. Reservations use a separate Map so that
 * stock is atomically reduced on reserve and restored on release.
 */
class InventoryService {
  constructor() {
    /** Product catalogue with current stock levels */
    this.catalog = new Map([
      ['WIDGET-001', { name: 'Widget Pro',    stock: 50 }],
      ['GADGET-002', { name: 'Gadget Plus',   stock: 20 }],
      ['GIZMO-003',  { name: 'Gizmo Ultra',   stock: 5  }],
    ]);

    /** @type {Map<string, { orderId: string, items: object[] }>} */
    this.reservations = new Map();

    /**
     * Inject a failure mode to simulate unhappy paths.
     * Values: null | 'reserve'
     */
    this.failureMode = null;
  }

  /** Reset state between demo scenarios. */
  reset() {
    // Restore original stock levels
    this.catalog.set('WIDGET-001', { name: 'Widget Pro',  stock: 50 });
    this.catalog.set('GADGET-002', { name: 'Gadget Plus', stock: 20 });
    this.catalog.set('GIZMO-003',  { name: 'Gizmo Ultra', stock: 5  });
    this.reservations.clear();
    this.failureMode = null;
    resCounter = 1;
  }

  // ─── Forward Transaction ──────────────────────────────────────────────────

  /**
   * Reserve stock for an order.
   * Reduces in-memory stock and records a reservation that can be undone.
   * @param {{ order: object, items: { productId: string, quantity: number }[] }} ctx
   */
  async reserveInventory({ order, items }) {
    await sleep(100);

    if (this.failureMode === 'reserve') {
      log('Inventory Service', 'FAILED: insufficient stock', 'error');
      throw new Error('Inventory reservation failed: out of stock');
    }

    // Validate stock availability before committing
    for (const { productId, quantity } of items) {
      const product = this.catalog.get(productId);
      if (!product) throw new Error(`Unknown product: ${productId}`);
      if (product.stock < quantity) {
        log('Inventory Service', `FAILED: only ${product.stock} units of ${productId} available`, 'error');
        throw new Error(`Insufficient stock for ${productId}`);
      }
    }

    // Commit the reservation
    for (const { productId, quantity } of items) {
      this.catalog.get(productId).stock -= quantity;
    }

    const reservationId = `RES-${String(resCounter++).padStart(3, '0')}`;
    this.reservations.set(reservationId, { orderId: order.orderId, items });

    const summary = items.map((i) => `${i.quantity}x ${i.productId}`).join(', ');
    log('Inventory Service', `Reserved ${summary} for ${order.orderId} → Reservation: ${reservationId}`, 'success');
    return { reservationId, status: 'RESERVED', items };
  }

  // ─── Compensating Transaction ─────────────────────────────────────────────

  /**
   * Release a reservation — the compensating transaction for reserveInventory.
   * Idempotent: releasing an already-released reservation is a no-op.
   */
  async releaseInventory(reservationId) {
    await sleep(100);

    const reservation = this.reservations.get(reservationId);
    if (!reservation) {
      log('Inventory Service', `[COMPENSATE] Reservation ${reservationId} not found — skipped (idempotent)`, 'compensate');
      return;
    }

    // Restore stock
    for (const { productId, quantity } of reservation.items) {
      const product = this.catalog.get(productId);
      if (product) product.stock += quantity;
    }

    this.reservations.delete(reservationId);
    log('Inventory Service', `[COMPENSATE] Released reservation ${reservationId} — stock restored`, 'compensate');
    return { reservationId, status: 'RELEASED' };
  }
}

module.exports = InventoryService;
