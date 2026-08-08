import {reportError} from './errorReporting';

/**
 * Thin delegate to `reportError` (EDITOR_COMPONENT_PLAN.md, Phase 1 item 3).
 * Kept under its original name so the ~40 existing call sites do not need to
 * churn; new code should call `reportError` directly.
 */
const sendErrorToSentry = (error: unknown): void => {
  reportError(error);
};

export {sendErrorToSentry};
