/**
 * How many characters to send per check request. Starts at the API's
 * TEXT_MAX_LENGTH as configured; when a deployment's limit is lower, a
 * multi-sentence batch comes back with `limit_reached` and the budget halves
 * until batches fit. Shared by the extension and the editor.
 */
export class CheckBudget {
  static readonly MINIMUM = 100;

  constructor(public value: number) {}

  /** Returns false when the batch cannot be made smaller. */
  shrink(): boolean {
    if (this.value <= CheckBudget.MINIMUM) return false;
    this.value = Math.max(CheckBudget.MINIMUM, Math.floor(this.value / 2));
    return true;
  }
}
