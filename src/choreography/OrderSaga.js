'use strict';

const EventBus = require('./EventBus');
const { log } = require('../utils/logger');

/**
 * OrderSagaChoreography — wires the e-commerce saga using the Choreography pattern.
 *
 * PATTERN: Choreography
 *   There is NO central orchestrator.  Each microservice:
 *     1. Subscribes to a domain event it cares about
 *     2. Executes its local transaction
 *     3. Publishes a new event (success or failure) for the next service to react to
 *
 *   Compensation events are published explicitly when a step fails, triggering
 *   each upstream service to undo its work.
 *
 * EVENT FLOW (happy path):
 *   order.create.requested
 *     → OrderService → order.created
 *       → InventoryService → inventory.reserved
 *         → PaymentService → payment.charged
 *           → ShippingService → shipment.scheduled
 *             → OrderService (confirm) → saga.completed
 *
 * EVENT FLOW (payment failure):
 *   ...inventory.reserved
 *     → PaymentService FAILS → publishes:
 *         inventory.release.requested   (compensate step 2)
 *         order.cancel.requested        (compensate step 1)
 *         saga.failed
 */
class OrderSagaChoreography {
  /**
   * @param {{ orderService, inventoryService, paymentService, shippingService }} services
   */
  constructor(services) {
    this.services = services;
    this.bus = new EventBus();
    this._registerHandlers();
  }

  // ─── Handler Registration ─────────────────────────────────────────────────

  _registerHandlers() {
    const { bus, services } = this;

    // ── Step 1: Create Order ──────────────────────────────────────────────
    bus.on('order.create.requested', async (ctx) => {
      try {
        ctx.order = await services.orderService.createOrder(ctx);
        await bus.emit('order.created', ctx);
      } catch (err) {
        await bus.emit('saga.failed', { ...ctx, reason: err.message, failedStep: 'Create Order' });
      }
    });

    // ── Step 2: Reserve Inventory ─────────────────────────────────────────
    bus.on('order.created', async (ctx) => {
      try {
        ctx.reservation = await services.inventoryService.reserveInventory(ctx);
        await bus.emit('inventory.reserved', ctx);
      } catch (err) {
        log('Choreography', `Inventory reservation failed — compensating Step 1`, 'compensate');
        await bus.emit('order.cancel.requested', ctx);
        await bus.emit('saga.failed', { ...ctx, reason: err.message, failedStep: 'Reserve Inventory' });
      }
    });

    // ── Step 3: Charge Payment ────────────────────────────────────────────
    bus.on('inventory.reserved', async (ctx) => {
      try {
        ctx.charge = await services.paymentService.chargePayment(ctx);
        await bus.emit('payment.charged', ctx);
      } catch (err) {
        log('Choreography', `Payment failed — compensating Steps 2 → 1`, 'compensate');
        await bus.emit('inventory.release.requested', ctx);
        await bus.emit('order.cancel.requested', ctx);
        await bus.emit('saga.failed', { ...ctx, reason: err.message, failedStep: 'Charge Payment' });
      }
    });

    // ── Step 4: Schedule Shipment ─────────────────────────────────────────
    bus.on('payment.charged', async (ctx) => {
      try {
        ctx.shipment = await services.shippingService.scheduleShipment(ctx);
        await bus.emit('shipment.scheduled', ctx);
      } catch (err) {
        log('Choreography', `Shipping failed — compensating Steps 3 → 2 → 1`, 'compensate');
        await bus.emit('payment.refund.requested', ctx);
        await bus.emit('inventory.release.requested', ctx);
        await bus.emit('order.cancel.requested', ctx);
        await bus.emit('saga.failed', { ...ctx, reason: err.message, failedStep: 'Schedule Shipment' });
      }
    });

    // ── Saga Completion ───────────────────────────────────────────────────
    bus.on('shipment.scheduled', async (ctx) => {
      await services.orderService.confirmOrder(ctx.order.orderId);
      await bus.emit('saga.completed', ctx);
    });

    // ── Compensation Event Handlers ───────────────────────────────────────
    // These are the "compensating transactions" — each service listens for
    // its own compensation event and undoes its forward transaction.

    bus.on('order.cancel.requested', async (ctx) => {
      await services.orderService.cancelOrder(ctx.order.orderId);
    });

    bus.on('inventory.release.requested', async (ctx) => {
      await services.inventoryService.releaseInventory(ctx.reservation.reservationId);
    });

    bus.on('payment.refund.requested', async (ctx) => {
      await services.paymentService.refundPayment(ctx.charge.chargeId);
    });
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  /**
   * Start the order saga.
   *
   * Since our EventBus awaits every handler sequentially, the entire event
   * chain resolves before this function returns — making it trivial to collect
   * the final result.
   *
   * @param {{ customerId, items, totalAmount }} orderRequest
   * @returns {Promise<{ success: boolean, reason?: string, failedStep?: string }>}
   */
  async startSaga(orderRequest) {
    let sagaResult = null;

    // One-shot listeners — capture the final outcome
    this.bus.on('saga.completed', (ctx) => {
      sagaResult = { success: true, orderId: ctx.order?.orderId };
    });
    this.bus.on('saga.failed', (ctx) => {
      sagaResult = { success: false, reason: ctx.reason, failedStep: ctx.failedStep };
    });

    const ctx = { ...orderRequest };
    await this.bus.emit('order.create.requested', ctx);

    return sagaResult || { success: false, reason: 'Unknown — saga did not emit a completion event' };
  }
}

module.exports = OrderSagaChoreography;
