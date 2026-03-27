import * as vscode from 'vscode';
import { BridgeManager } from './bridge/BridgeManager';
import { GraphEditorProvider } from './providers/GraphEditorProvider';

let bridge: BridgeManager;
let graphEditor: GraphEditorProvider;

export function activate(context: vscode.ExtensionContext) {
  // Initialize bridge manager
  bridge = new BridgeManager(context.extensionUri);
  context.subscriptions.push(bridge);

  // Initialize graph editor provider
  graphEditor = new GraphEditorProvider(bridge, context.extensionUri);
  context.subscriptions.push(graphEditor);

  // Command: Load Graph (file picker)
  context.subscriptions.push(
    vscode.commands.registerCommand('vizlang.loadGraph', async () => {
      const fileUri = await vscode.window.showOpenDialog({
        canSelectFiles: true,
        canSelectFolders: false,
        canSelectMany: false,
        filters: { 'Python Files': ['py'] },
        title: 'Select a Python file containing a LangGraph',
      });

      if (!fileUri || fileUri.length === 0) return;
      await graphEditor.openGraph(fileUri[0].fsPath);
    })
  );

  // Command: Open current Python file in VizLang (editor/title button)
  context.subscriptions.push(
    vscode.commands.registerCommand('vizlang.openCurrentFile', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('VizLang: No active editor.');
        return;
      }

      const filePath = editor.document.uri.fsPath;
      if (!filePath.endsWith('.py')) {
        vscode.window.showWarningMessage(
          'VizLang: Only Python files are supported.'
        );
        return;
      }

      await graphEditor.openGraph(filePath);
    })
  );

  // Command: Open a file by URI (for drag-and-drop / URI handler)
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'vizlang.openFile',
      async (uri?: vscode.Uri) => {
        if (!uri) return;
        const filePath = uri.fsPath;
        if (!filePath.endsWith('.py')) {
          vscode.window.showWarningMessage(
            'VizLang: Only Python (.py) files are supported.'
          );
          return;
        }
        await graphEditor.openGraph(filePath);
      }
    )
  );

  console.log('VizLang extension activated');
}

export function deactivate() {
  bridge?.dispose();
}
