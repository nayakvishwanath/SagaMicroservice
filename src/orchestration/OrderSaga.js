'use strict';

const SagaOrchestrator = require('./SagaOrchestrator');

/**
 * buildOrderSaga — wires the four e-commerce steps into a SagaOrchestrator.
 *
 * Each step definition contains:
 *   execute(ctx)    — runs the forward action and stores results in ctx
 *   compensate(ctx) — reads the stored results from ctx and undoes the action
 *
 * The orchestrator calls compensate in reverse order when any step fails,
 * so services always get cleaned up in the correct sequence.
 *
 * @param {{ orderService, inventoryService, paymentService, shippingService }} services
 * @returns {SagaOrchestrator}
 */
function buildOrderSaga(services) {
  const { orderService, inventoryService, paymentService, shippingService } = services;

  return new SagaOrchestrator('E-Commerce Order')

    // ── Step 1: Create the order record (PENDING) ──────────────────────────
    .addStep(
      'Create Order',
      async (ctx) => {
        ctx.order = await orderService.createOrder(ctx);
      },
      async (ctx) => {
        await orderService.cancelOrder(ctx.order.orderId);
      }
    )

    // ── Step 2: Reserve product inventory ─────────────────────────────────
    .addStep(
      'Reserve Inventory',
      async (ctx) => {
        ctx.reservation = await inventoryService.reserveInventory(ctx);
      },
      async (ctx) => {
        await inventoryService.releaseInventory(ctx.reservation.reservationId);
      }
    )

    // ── Step 3: Capture payment from the customer ──────────────────────────
    .addStep(
      'Charge Payment',
      async (ctx) => {
        ctx.charge = await paymentService.chargePayment(ctx);
      },
      async (ctx) => {
        await paymentService.refundPayment(ctx.charge.chargeId);
      }
    )

    // ── Step 4: Schedule the physical shipment ─────────────────────────────
    .addStep(
      'Schedule Shipment',
      async (ctx) => {
        ctx.shipment = await shippingService.scheduleShipment(ctx);
        // Mark the order CONFIRMED only after all steps succeed
        await orderService.confirmOrder(ctx.order.orderId);
      },
      async (ctx) => {
        // Shipment was scheduled but something went wrong during confirmation —
        // cancel the shipment so the warehouse doesn't dispatch the package.
        await shippingService.cancelShipment(ctx.shipment.shipmentId);
      }
    );
}

module.exports = { buildOrderSaga };
