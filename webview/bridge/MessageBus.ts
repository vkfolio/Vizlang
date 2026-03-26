import type { HostMessage, WebviewMessage } from '../../shared/protocol';

// Acquire VS Code API (can only be called once)
const vscode = acquireVsCodeApi();

type MessageHandler = (message: HostMessage) => void;

const handlers: MessageHandler[] = [];

// Listen for messages from extension host
window.addEventListener('message', (event) => {
  const message = event.data as HostMessage;
  for (const handler of handlers) {
    handler(message);
  }
});

/**
 * Send a message to the extension host.
 */
export function sendMessage(message: WebviewMessage): void {
  vscode.postMessage(message);
}

/**
 * Subscribe to messages from the extension host.
 * Returns an unsubscribe function.
 */
export function onMessage(handler: MessageHandler): () => void {
  handlers.push(handler);
  return () => {
    const idx = handlers.indexOf(handler);
    if (idx !== -1) handlers.splice(idx, 1);
  };
}

/**
 * Get/set webview persistent state.
 */
export function getState<T>(): T | undefined {
  return vscode.getState() as T | undefined;
}

export function setState<T>(state: T): void {
  vscode.setState(state);
}
