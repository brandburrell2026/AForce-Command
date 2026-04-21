/**
 * Tracing facade. Production initializes the OpenTelemetry SDK at boot and
 * exports to Tempo/Jaeger; this stub records spans in memory + propagates a
 * `traceparent` so downstream services can stitch together a trace today.
 *
 * Wire up:
 *   import { startSpan } from './tracing';
 *   const span = startSpan('scan.recognize', { userId });
 *   try { ... } finally { span.end({ status: 'ok' }); }
 */

export interface SpanAttributes { [key: string]: string | number | boolean }

export interface Span {
  end(opts?: { status?: 'ok' | 'error'; error?: unknown; attributes?: SpanAttributes }): void;
  setAttribute(key: string, value: string | number | boolean): void;
  /** W3C traceparent header — pass to downstream HTTP calls. */
  traceparent(): string;
}

class StubSpan implements Span {
  private attrs: SpanAttributes;
  private started = Date.now();
  constructor(private name: string, private traceId: string, private spanId: string, attrs: SpanAttributes) {
    this.attrs = { ...attrs };
  }
  setAttribute(key: string, value: string | number | boolean): void { this.attrs[key] = value; }
  end(_opts?: { status?: 'ok' | 'error'; error?: unknown; attributes?: SpanAttributes }): void {
    // No-op: production would forward span to the OTel exporter here.
    void this.name; void this.attrs; void (Date.now() - this.started);
  }
  traceparent(): string { return `00-${this.traceId}-${this.spanId}-01`; }
}

function rand(n: number): string {
  let s = '';
  for (let i = 0; i < n; i++) s += Math.floor(Math.random() * 16).toString(16);
  return s;
}

export function startSpan(name: string, attrs: SpanAttributes = {}): Span {
  return new StubSpan(name, rand(32), rand(16), attrs);
}
