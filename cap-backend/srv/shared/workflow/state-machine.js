'use strict';

/**
 * Validates state transitions based on a defined state machine configuration.
 */
class StateMachine {
  /**
   * @param {Object} transitions - A map of valid transitions (e.g., { CURRENT_STATE: new Set(['NEXT_STATE']) })
   */
  constructor(transitions) {
    this.transitions = transitions;
  }

  /**
   * Check if a transition is valid.
   * @param {string} currentState
   * @param {string} nextState
   * @returns {boolean}
   */
  canTransition(currentState, nextState) {
    const allowed = this.transitions[currentState] || new Set();
    return allowed.has(nextState);
  }

  /**
   * Assert that a transition is valid, throwing an error if it isn't.
   * @param {string} currentState
   * @param {string} nextState
   * @param {string} entityName - Used for error message context
   * @throws {Error} if the transition is invalid
   */
  assertTransition(currentState, nextState, entityName = 'Entity') {
    if (!this.canTransition(currentState, nextState)) {
      const error = new Error(`Invalid ${entityName} status transition: ${currentState} -> ${nextState}`);
      error.code = 409;
      throw error;
    }
  }
}

module.exports = StateMachine;
