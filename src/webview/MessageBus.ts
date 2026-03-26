import type * as vscode from 'vscode';
import type { HostMessage, WebviewMessage } from '../../shared/protocol';

/**
 * Host-side typed message bus for communicating with the webview.
 */
export class HostMessageBus {
  constructor(private panel: vscode.WebviewPanel) {}

  send(message: HostMessage): void {
    this.panel.webview.postMessage(message);
  }

  onMessage(handler: (message: WebviewMessage) => void): vscode.Disposable {
    return this.panel.webview.onDidReceiveMessage(handler);
  }
}
