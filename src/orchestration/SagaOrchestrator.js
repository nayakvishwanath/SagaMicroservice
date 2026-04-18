'use strict';

const { log } = require('../utils/logger');

/**
 * SagaOrchestrator — generic, reusable orchestrator for any saga.
 *
 * PATTERN: Orchestration
 *   A central coordinator owns the saga state machine. It sends explicit
 *   commands to each participant service and receives replies. When a step
 *   fails, the orchestrator triggers compensating transactions in reverse
 *   order for every step that already completed.
 *
 * USAGE:
 *   const orchestrator = new SagaOrchestrator('Order Saga');
 *
 *   orchestrator
 *     .addStep('Reserve Inventory',
 *       async (ctx) => { ctx.reservation = await inventoryService.reserve(ctx); },
 *       async (ctx) => { await inventoryService.release(ctx.reservation.id); }
 *     )
 *     .addStep('Charge Payment', ...);
 *
 *   const result = await orchestrator.execute({ orderId: '...', ... });
 */
class SagaOrchestrator {
  /**
   * @param {string} sagaName  Human-readable name used in log output
   */
  constructor(sagaName) {
    this.sagaName = sagaName;
    /** Ordered list of steps */
    this.steps = [];
    /** Steps that completed successfully (used for compensation) */
    this.completedSteps = [];
    /** IDLE | RUNNING | COMPENSATING | COMPLETED | FAILED */
    this.state = 'IDLE';
  }

  /**
   * Register a saga step.
   *
   * @param {string}   name        Descriptive label shown in logs
   * @param {Function} execute     async (ctx) => void — runs the forward action;
   *                               mutates ctx to record results (e.g. ctx.charge = ...)
   * @param {Function} compensate  async (ctx) => void — undoes the forward action;
   *                               reads the results stored by execute (e.g. ctx.charge.chargeId)
   * @returns {SagaOrchestrator}   this, for chaining
   */
  addStep(name, execute, compensate) {
    this.steps.push({ name, execute, compensate });
    return this;
  }

  /**
   * Run the saga.  Mutates `ctx` in-place as each step records its results.
   *
   * @param  {object}  ctx   Shared context object — passed by reference to every step
   * @returns {Promise<{ success: boolean, error?: string }>}
   */
  async execute(ctx) {
    this.state = 'RUNNING';
    this.completedSteps = [];

    log('Orchestrator', `Starting saga: "${this.sagaName}"`, 'saga');
    log('Orchestrator', `Steps: ${this.steps.map((s) => s.name).join(' → ')}`, 'info');

    for (const step of this.steps) {
      try {
        log('Orchestrator', `▶ Executing: ${step.name}`, 'saga');
        await step.execute(ctx);
        this.completedSteps.push(step);
      } catch (err) {
        log('Orchestrator', `✖ Step "${step.name}" failed: ${err.message}`, 'error');
        await this._compensate(ctx);
        return { success: false, error: err.message, failedStep: step.name };
      }
    }

    this.state = 'COMPLETED';
    log('Orchestrator', `✔ Saga "${this.sagaName}" completed successfully`, 'success');
    return { success: true };
  }

  /**
   * Run compensating transactions in reverse order for all completed steps.
   * @private
   */
  async _compensate(ctx) {
    this.state = 'COMPENSATING';
    const stepsToUndo = [...this.completedSteps].reverse();
    log(
      'Orchestrator',
      `↩ Starting compensation — ${stepsToUndo.length} step(s) to undo: ${stepsToUndo.map((s) => s.name).join(' → ')}`,
      'compensate'
    );

    for (const step of stepsToUndo) {
      try {
        log('Orchestrator', `  ↩ Compensating: ${step.name}`, 'compensate');
        await step.compensate(ctx);
      } catch (compErr) {
        // A compensation failure is a critical bug — in production this would
        // page on-call and write to a dead-letter / outbox table for manual review.
        log(
          'Orchestrator',
          `  ✖ Compensation for "${step.name}" also failed: ${compErr.message} — requires manual intervention`,
          'error'
        );
      }
    }

    this.state = 'FAILED';
    log('Orchestrator', `✖ Saga "${this.sagaName}" rolled back`, 'error');
  }
}

module.exports = SagaOrchestrator;
