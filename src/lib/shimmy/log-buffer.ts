import type { LogEntry } from "./types";

export class LogBuffer {
  private entries: LogEntry[] = [];
  private nextId = 1;

  constructor(private readonly maxEntries = 500) {}

  push(stream: LogEntry["stream"], message: string) {
    const entry: LogEntry = {
      id: this.nextId,
      time: new Date().toISOString(),
      stream,
      message,
    };
    this.nextId += 1;
    this.entries.push(entry);
    if (this.entries.length > this.maxEntries) {
      this.entries.splice(0, this.entries.length - this.maxEntries);
    }
    return entry;
  }

  list() {
    return [...this.entries];
  }

  clear() {
    this.entries = [];
  }
}
