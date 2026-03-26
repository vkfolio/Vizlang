import * as vscode from 'vscode';
import { BridgeManager } from './bridge/BridgeManager';
import { GraphEditorProvider } from './providers/GraphEditorProvider';
import { registerLoadGraphCommand } from './commands/loadGraph';

let bridge: BridgeManager;
let graphEditor: GraphEditorProvider;

export function activate(context: vscode.ExtensionContext) {
  // Initialize bridge manager
  bridge = new BridgeManager(context.extensionUri);
  context.subscriptions.push(bridge);

  // Initialize graph editor provider
  graphEditor = new GraphEditorProvider(bridge, context.extensionUri);
  context.subscriptions.push(graphEditor);

  // Register commands
  context.subscriptions.push(registerLoadGraphCommand(graphEditor));

  // Status bar item
  const statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    100
  );
  statusBarItem.text = '$(circuit-board) VizLang';
  statusBarItem.command = 'vizlang.loadGraph';
  statusBarItem.tooltip = 'Load a LangGraph';
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  // Update status bar on bridge status changes
  bridge.onStatusChange((status) => {
    switch (status) {
      case 'starting':
        statusBarItem.text = '$(loading~spin) VizLang: Starting...';
        break;
      case 'ready':
        statusBarItem.text = '$(check) VizLang: Connected';
        break;
      case 'error':
        statusBarItem.text = '$(error) VizLang: Error';
        break;
      case 'stopped':
        statusBarItem.text = '$(circuit-board) VizLang';
        break;
    }
  });

  console.log('VizLang extension activated');
}

export function deactivate() {
  bridge?.dispose();
}
