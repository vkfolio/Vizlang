import * as vscode from 'vscode';
import type { GraphEditorProvider } from '../providers/GraphEditorProvider';

/**
 * Command: Load a LangGraph from a Python file.
 */
export function registerLoadGraphCommand(
  graphEditor: GraphEditorProvider
): vscode.Disposable {
  return vscode.commands.registerCommand('vizlang.loadGraph', async () => {
    // Let user pick a Python file
    const fileUri = await vscode.window.showOpenDialog({
      canSelectFiles: true,
      canSelectFolders: false,
      canSelectMany: false,
      filters: { 'Python Files': ['py'] },
      title: 'Select a Python file containing a LangGraph',
    });

    if (!fileUri || fileUri.length === 0) {
      return;
    }

    const filePath = fileUri[0].fsPath;

    // Open the graph editor
    await graphEditor.openGraph(filePath);
  });
}
