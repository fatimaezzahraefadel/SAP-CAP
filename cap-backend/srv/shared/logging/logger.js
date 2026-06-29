'use strict';

const cds = require('@sap/cds');

/**
 * Structured logger for business events
 * Wraps cds.log to provide consistent metadata structure.
 */
class Logger {
  constructor(moduleName) {
    this.logger = cds.log(moduleName);
  }

  /**
   * Log an informational business event.
   * @param {string} message - Description of the event
   * @param {object} metadata - Additional context (e.g., entityId, userId, action)
   */
  info(message, metadata = {}) {
    this.logger.info({ message, ...metadata });
  }

  /**
   * Log a business or technical error.
   * @param {string} message - Description of the error
   * @param {Error|object} error - The error object or metadata
   * @param {object} metadata - Additional context
   */
  error(message, error, metadata = {}) {
    if (error instanceof Error) {
      this.logger.error({ message, error: error.message, stack: error.stack, ...metadata });
    } else {
      this.logger.error({ message, error, ...metadata });
    }
  }

  /**
   * Log a warning (e.g., unexpected but handled condition).
   * @param {string} message - Warning description
   * @param {object} metadata - Additional context
   */
  warn(message, metadata = {}) {
    this.logger.warn({ message, ...metadata });
  }
}

module.exports = {
  getLogger: (moduleName) => new Logger(moduleName)
};
