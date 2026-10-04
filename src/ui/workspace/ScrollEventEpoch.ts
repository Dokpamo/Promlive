/** Ignore Fabric events produced before a programmatic coordinate correction. */
export class ScrollEventEpoch {
  private clockOffset = Infinity;
  private lastDelivery = 0;
  private correctedAt = 0;
  correct(now: number) {this.correctedAt = now;}
  accepts(timestamp: number | undefined, now: number) {
    if (timestamp === undefined || !Number.isFinite(timestamp) || timestamp <= 0) return true;
    // Native uptime and JS clocks have different origins. Recalibrate after
    // inactivity as macOS sleep can advance those clocks differently.
    if (now - this.lastDelivery > 1000) this.clockOffset = Infinity;
    this.lastDelivery = now;
    this.clockOffset = Math.min(this.clockOffset, now - timestamp);
    return timestamp + this.clockOffset >= this.correctedAt - 1;
  }
}
