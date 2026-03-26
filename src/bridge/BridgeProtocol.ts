import { EventEmitter } from 'events';
import type { BridgeRequest, BridgeResponse, BridgeMethod } from './types';

/**
 * Handles JSON Lines protocol parsing and request/response matching
 * for communication with the Python bridge subprocess.
 */
export class BridgeProtocol extends EventEmitter {
  private buffer = '';
  private requestCounter = 0;
  private pendingRequests = new Map<
    string,
    {
      resolve: (data: unknown) => void;
      reject: (error: Error) => void;
    }
  >();

  /**
   * Feed raw stdout data from the Python process.
   * Parses JSON Lines and dispatches to appropriate handlers.
   */
  onData(chunk: string): void {
    this.buffer += chunk;
    const lines = this.buffer.split('\n');
    // Keep the last incomplete line in the buffer
    this.buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      try {
        const msg: BridgeResponse = JSON.parse(trimmed);
        this.handleMessage(msg);
      } catch {
        // Not valid JSON — might be Python print output, ignore
        this.emit('log', trimmed);
      }
    }
  }

  private handleMessage(msg: BridgeResponse): void {
    switch (msg.type) {
      case 'response': {
        const pending = this.pendingRequests.get(msg.id);
        if (pending) {
          this.pendingRequests.delete(msg.id);
          pending.resolve(msg.data);
        }
        break;
      }

      case 'error': {
        const pending = this.pendingRequests.get(msg.id);
        if (pending) {
          this.pendingRequests.delete(msg.id);
          const errData = msg.data as { message: string; traceback?: string };
          const error = new Error(errData.message);
          (error as any).traceback = errData.traceback;
          pending.reject(error);
        }
        this.emit('error', msg);
        break;
      }

      case 'stream':
        this.emit('stream', msg);
        break;

      case 'interrupt':
        this.emit('interrupt', msg);
        break;

      case 'step_pause':
        this.emit('step_pause', msg);
        break;

      case 'done': {
        this.emit('done', msg);
        // Also resolve the pending request
        const pending = this.pendingRequests.get(msg.id);
        if (pending) {
          this.pendingRequests.delete(msg.id);
          pending.resolve(msg.data);
        }
        break;
      }
    }
  }

  /**
   * Create a request object and return the JSON line + a promise for the response.
   */
  createRequest(
    method: BridgeMethod,
    params: Record<string, unknown> = {}
  ): { request: BridgeRequest; promise: Promise<unknown> } {
    const id = `req_${++this.requestCounter}`;
    const request: BridgeRequest = { id, method, params };

    const promise = new Promise<unknown>((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
    });

    return { request, promise };
  }

  /**
   * Serialize a request to a JSON line (with trailing newline).
   */
  serialize(request: BridgeRequest): string {
    return JSON.stringify(request) + '\n';
  }

  /**
   * Cancel all pending requests (e.g., on bridge shutdown).
   */
  cancelAll(): void {
    for (const [id, pending] of this.pendingRequests) {
      pending.reject(new Error('Bridge connection closed'));
    }
    this.pendingRequests.clear();
  }

  dispose(): void {
    this.cancelAll();
    this.removeAllListeners();
  }
}
