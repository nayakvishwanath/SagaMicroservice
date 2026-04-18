'use strict';

// ANSI color codes — supported on Windows 10+ and all Unix terminals
const C = {
  reset:   '\x1b[0m',
  bold:    '\x1b[1m',
  green:   '\x1b[32m',
  red:     '\x1b[31m',
  yellow:  '\x1b[33m',
  blue:    '\x1b[34m',
  cyan:    '\x1b[36m',
  magenta: '\x1b[35m',
  gray:    '\x1b[90m',
};

const TYPE_COLOR = {
  success:    C.green,
  error:      C.red,
  compensate: C.yellow,
  saga:       C.blue,
  event:      C.cyan,
  info:       C.gray,
};

/**
 * Log a service action with a colored type indicator.
 * @param {string} service  - Service name shown in brackets
 * @param {string} message  - What happened
 * @param {string} type     - success | error | compensate | saga | event | info
 */
function log(service, message, type = 'info') {
  const color = TYPE_COLOR[type] || C.gray;
  const label = `[${service}]`.padEnd(24);
  console.log(`  ${color}${label}${C.reset} ${message}`);
}

/** Print a bold section header with a double-line border. */
function header(title) {
  const bar = '═'.repeat(64);
  console.log(`\n${C.bold}${C.blue}${bar}${C.reset}`);
  console.log(`${C.bold}${C.blue}  ${title}${C.reset}`);
  console.log(`${C.bold}${C.blue}${bar}${C.reset}\n`);
}

/** Print a final PASS / FAIL result line. */
function result(success, message) {
  const badge = success
    ? `${C.bold}${C.green}[PASS]${C.reset}`
    : `${C.bold}${C.red}[FAIL]${C.reset}`;
  console.log(`\n  Result: ${badge} ${message}\n`);
}

/** Thin separator between sub-sections. */
function divider() {
  console.log(`  ${C.gray}${'─'.repeat(56)}${C.reset}`);
}

module.exports = { log, header, result, divider };
