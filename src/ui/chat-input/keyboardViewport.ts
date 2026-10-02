/** Layout and IME events arrive independently. Publish their combined visible height. */
export class KeyboardViewport {
  private height = 0;
  private offset = 0;
  private listeners = new Set<(height: number) => void>();
  read = () => Math.max(0, this.height + this.offset);
  subscribe = (listener: (height: number) => void) => {this.listeners.add(listener); if (this.height > 0) listener(this.read()); return () => {this.listeners.delete(listener);};};
  layout(height: number) {if (height !== this.height) {this.height = height; this.emit();}}
  dock(offset: number) {if (offset !== this.offset) {this.offset = offset; this.emit();}}
  private emit() {if (this.height > 0) this.listeners.forEach(listener => listener(this.read()));}
}
