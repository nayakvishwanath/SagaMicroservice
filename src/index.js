'use strict';

/**
 * SAGA Pattern Demo — Node.js
 *
 * Runs four scenarios across both SAGA variants:
 *
 *  Orchestration (central coordinator drives the saga):
 *    1. Happy Path       — all steps succeed
 *    2. Payment Failure  — payment is declined; inventory is released, order cancelled
 *
 *  Choreography (services react to events, no central coordinator):
 *    3. Happy Path       — all steps succeed
 *    4. Shipping Failure — shipment fails; payment refunded, inventory released, order cancelled
 *
 * Run:  node src/index.js
 */

const { log, header, result, divider } = require('./utils/logger');

const OrderService     = require('./services/OrderService');
const InventoryService = require('./services/InventoryService');
const PaymentService   = require('./services/PaymentService');
const ShippingService  = require('./services/ShippingService');

const { buildOrderSaga }      = require('./orchestration/OrderSaga');
const OrderSagaChoreography   = require('./choreography/OrderSaga');

// ─── Shared Service Instances ─────────────────────────────────────────────────
// In a real system these would be separate processes communicating over the network.
// Here they share memory so we can run everything in one Node.js process.

const orderService     = new OrderService();
const inventoryService = new InventoryService();
const paymentService   = new PaymentService();
const shippingService  = new ShippingService();

const services = { orderService, inventoryService, paymentService, shippingService };

// ─── Sample Order Payloads ────────────────────────────────────────────────────

const sampleOrder = {
  customerId:  'CUST-001',
  items:       [{ productId: 'WIDGET-001', quantity: 2 }],
  totalAmount: 49.99,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function resetAllServices() {
  orderService.reset();
  inventoryService.reset();
  paymentService.reset();
  shippingService.reset();
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ─── Orchestration Scenarios ──────────────────────────────────────────────────

async function runOrchestration_HappyPath() {
  header('ORCHESTRATION — Scenario 1: Happy Path');
  log('Demo', 'All four saga steps will succeed. Order gets CONFIRMED.', 'info');
  divider();

  resetAllServices();
  const saga = buildOrderSaga(services);
  const ctx  = { ...sampleOrder };

  const outcome = await saga.execute(ctx);
  result(outcome.success, outcome.success
    ? `Order ${ctx.order?.orderId} confirmed, shipment ${ctx.shipment?.shipmentId} scheduled`
    : `Saga failed at step: ${outcome.failedStep}`
  );
}

async function runOrchestration_PaymentFailure() {
  header('ORCHESTRATION — Scenario 2: Payment Failure');
  log('Demo', 'PaymentService is set to decline the card.', 'info');
  log('Demo', 'Expected compensations: Release Inventory → Cancel Order', 'info');
  divider();

  resetAllServices();
  paymentService.failureMode = 'charge'; // inject failure

  const saga = buildOrderSaga(services);
  const ctx  = { ...sampleOrder };

  const outcome = await saga.execute(ctx);
  result(!outcome.success,
    `Saga correctly rolled back after payment failure (failed step: "${outcome.failedStep}")`
  );
}

// ─── Choreography Scenarios ───────────────────────────────────────────────────

async function runChoreography_HappyPath() {
  header('CHOREOGRAPHY — Scenario 3: Happy Path');
  log('Demo', 'All services react to events — no central coordinator.', 'info');
  log('Demo', 'Watch the Event Bus publish events between services.', 'info');
  divider();

  resetAllServices();
  const saga = new OrderSagaChoreography(services);
  const outcome = await saga.startSaga({ ...sampleOrder });

  result(outcome.success, outcome.success
    ? `Saga completed — order ${outcome.orderId} fully confirmed`
    : `Saga failed at step: ${outcome.failedStep}`
  );
}

async function runChoreography_ShippingFailure() {
  header('CHOREOGRAPHY — Scenario 4: Shipping Failure');
  log('Demo', 'ShippingService reports no carrier available.', 'info');
  log('Demo', 'Expected compensations: Refund Payment → Release Inventory → Cancel Order', 'info');
  divider();

  resetAllServices();
  shippingService.failureMode = 'schedule'; // inject failure

  const saga = new OrderSagaChoreography(services);
  const outcome = await saga.startSaga({ ...sampleOrder });

  result(!outcome.success,
    `Saga correctly rolled back after shipping failure (failed step: "${outcome.failedStep}")`
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n\x1b[1m\x1b[35m  SAGA Design Pattern — Node.js Demo\x1b[0m');
  console.log('  \x1b[90mE-Commerce Order Flow with Compensating Transactions\x1b[0m\n');

  await runOrchestration_HappyPath();
  await sleep(300);

  await runOrchestration_PaymentFailure();
  await sleep(300);

  await runChoreography_HappyPath();
  await sleep(300);

  await runChoreography_ShippingFailure();

  console.log('\x1b[1m\x1b[35m  All scenarios complete.\x1b[0m\n');
}

main().catch((err) => {
  console.error('\nUnexpected error:', err);
  process.exit(1);
});
