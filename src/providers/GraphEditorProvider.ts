import * as vscode from 'vscode';
import { HostMessageBus } from '../webview/MessageBus';
import type { BridgeManager } from '../bridge/BridgeManager';
import { GraphService } from '../services/GraphService';
import type { WebviewMessage, HostMessage } from '../../shared/protocol';

/**
 * Manages the main webview panel for graph visualization and chat.
 */
export class GraphEditorProvider {
  private panel: vscode.WebviewPanel | undefined;
  private messageBus: HostMessageBus | undefined;
  private graphService: GraphService;
  private currentFile: string | undefined;
  private currentGraphVar: string | undefined;
  /** Active run disposables — cleaned up before each new run */
  private runDisposables: vscode.Disposable[] = [];
  /** Whether the graph has been fully loaded and bridge is ready for runs */
  private graphLoaded = false;

  constructor(
    private bridge: BridgeManager,
    private extensionUri: vscode.Uri
  ) {
    this.graphService = new GraphService(bridge);
  }

  async openGraph(filePath: string, graphVar?: string): Promise<void> {
    this.currentFile = filePath;
    this.currentGraphVar = graphVar;

    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.One);
    } else {
      this.panel = vscode.window.createWebviewPanel(
        'vizlang.graphEditor',
        'VizLang',
        vscode.ViewColumn.One,
        {
          enableScripts: true,
          retainContextWhenHidden: true,
          localResourceRoots: [
            vscode.Uri.joinPath(this.extensionUri, 'dist'),
          ],
        }
      );

      this.panel.webview.html = this.getHtml(this.panel.webview);
      this.messageBus = new HostMessageBus(this.panel);

      // Handle messages from webview
      this.messageBus.onMessage((msg) => this.handleWebviewMessage(msg));

      // Handle panel disposal
      this.panel.onDidDispose(() => {
        this.panel = undefined;
        this.messageBus = undefined;
        this.graphLoaded = false;
      });

      // Wait for webview to be ready before loading graph.
      // WEBVIEW_READY is sent via setTimeout(0) in the webview, ensuring
      // the host listener is registered first.
      await new Promise<void>((resolve) => {
        const readyDisposable = this.messageBus!.onMessage((msg) => {
          if (msg.type === 'WEBVIEW_READY') {
            readyDisposable.dispose();
            resolve();
          }
        });
        // Fallback timeout — should not be needed but prevents deadlock
        setTimeout(() => {
          readyDisposable.dispose();
          resolve();
        }, 5000);
      });
    }

    // Load the graph
    await this.loadGraph(filePath, graphVar);
  }

  private async loadGraph(
    filePath: string,
    graphVar?: string
  ): Promise<void> {
    if (!this.messageBus) return;

    try {
      // Cancel any in-progress execution and clean up listeners
      this.graphLoaded = false;
      this.disposeRunListeners();
      if (this.bridge.isRunning) {
        try {
          await this.bridge.request('cancel', {});
        } catch {
          // Ignore — bridge might not have a running execution
        }
      }

      // Notify webview to clear all state (run status, chat, traces)
      this.messageBus.send({ type: 'RUN_COMPLETE', finalState: null });

      // Start bridge if not running
      if (!this.bridge.isRunning) {
        await this.bridge.start();
      }

      this.messageBus.send({
        type: 'BRIDGE_STATUS',
        status: 'starting',
      });

      // Load the graph file
      console.log(`[VizLang] Loading graph from: ${filePath}`);
      const result = await this.graphService.loadGraph(filePath, graphVar);
      console.log(`[VizLang] Loaded graphs: ${result.graphs.join(', ')}`);

      // Send available graphs list
      if (result.graphs.length > 1) {
        this.messageBus.send({
          type: 'GRAPHS_LIST',
          graphs: result.graphs.map((name) => ({ name })),
        });
      }

      // Get and send graph structure
      const graphData = await this.graphService.getGraphStructure(graphVar);
      console.log(`[VizLang] Graph structure: ${graphData.nodes.length} nodes, ${graphData.edges.length} edges`);
      this.messageBus.send({
        type: 'GRAPH_DATA',
        nodes: graphData.nodes,
        edges: graphData.edges,
        inputSchema: graphData.inputSchema,
        sampleInput: graphData.sampleInput,
      });

      // Verify bridge is responsive before declaring ready
      await this.bridge.request('ping', {});

      this.messageBus.send({
        type: 'BRIDGE_STATUS',
        status: 'ready',
      });

      this.graphLoaded = true;
      console.log('[VizLang] Graph fully loaded and ready for execution');
    } catch (err: any) {
      this.graphLoaded = false;
      console.error(`[VizLang] Error loading graph: ${err.message}`);
      this.messageBus.send({
        type: 'BRIDGE_STATUS',
        status: 'error',
        error: err.message,
      });
      vscode.window.showErrorMessage(`VizLang: ${err.message}`);
    }
  }

  private async handleWebviewMessage(msg: WebviewMessage): Promise<void> {
    switch (msg.type) {
      case 'LOAD_GRAPH':
        await this.loadGraph(msg.filePath, msg.graphVar);
        break;

      case 'REQUEST_GRAPHS':
        try {
          const graphs = await this.graphService.listGraphs(msg.filePath);
          this.messageBus?.send({ type: 'GRAPHS_LIST', graphs });
        } catch (err: any) {
          vscode.window.showErrorMessage(`VizLang: ${err.message}`);
        }
        break;

      case 'START_RUN':
        await this.handleStartRun(msg);
        break;

      case 'SEND_MESSAGE':
        await this.handleSendMessage(msg);
        break;

      case 'RESOLVE_INTERRUPT':
        await this.handleResolveInterrupt(msg);
        break;

      case 'RESUME_RUN':
        await this.handleResumeRun(msg.threadId, msg.stepMode ?? false);
        break;

      case 'CANCEL_RUN':
        await this.bridge.request('cancel', {});
        this.messageBus?.send({ type: 'RUN_COMPLETE', finalState: null });
        break;

      case 'CREATE_THREAD': {
        try {
          const result = (await this.bridge.request('create_thread', {})) as {
            thread_id: string;
          };
          // Send the new thread directly to webview
          this.messageBus?.send({
            type: 'THREADS_LIST',
            threads: [{ threadId: result.thread_id, status: 'idle' as const }],
          });
          // Also refresh full list
          await this.refreshThreads();
        } catch {
          // Bridge not ready — create a local thread ID
          const threadId = 'thread_' + Math.random().toString(36).slice(2, 10);
          this.messageBus?.send({
            type: 'THREADS_LIST',
            threads: [{ threadId, status: 'idle' as const }],
          });
        }
        break;
      }

      case 'SWITCH_THREAD':
        await this.handleSwitchThread(msg.threadId);
        break;

      case 'DELETE_THREAD':
        try {
          await this.bridge.request('delete_thread', {
            thread_id: msg.threadId,
          });
          // Refresh threads list after deletion
          await this.refreshThreads();
        } catch (err: any) {
          vscode.window.showErrorMessage(`VizLang: Failed to delete thread — ${err.message}`);
        }
        break;

      case 'RELOAD_GRAPH':
        if (this.currentFile) {
          await this.loadGraph(this.currentFile, this.currentGraphVar);
        }
        break;

      case 'CLOSE_FILE':
        this.currentFile = undefined;
        this.currentGraphVar = undefined;
        this.messageBus?.send({
          type: 'GRAPH_DATA',
          nodes: [],
          edges: [],
        });
        break;

      case 'OPEN_FILE_PICKER': {
        const fileUri = await vscode.window.showOpenDialog({
          canSelectFiles: true,
          canSelectFolders: false,
          canSelectMany: false,
          filters: { 'Python Files': ['py'] },
          title: 'Select a Python file containing a LangGraph',
        });
        if (fileUri && fileUri.length > 0) {
          this.currentFile = fileUri[0].fsPath;
          await this.loadGraph(fileUri[0].fsPath);
        }
        break;
      }

      case 'GET_STATE':
        await this.handleGetState(msg.threadId);
        break;

      case 'GET_HISTORY':
        await this.handleGetHistory(msg.threadId);
        break;

      case 'TIME_TRAVEL':
        await this.handleTimeTavel(msg.threadId, msg.checkpointId);
        break;
    }
  }

  /** Dispose any active run listeners before registering new ones. */
  private disposeRunListeners(): void {
    for (const d of this.runDisposables) {
      d.dispose();
    }
    this.runDisposables = [];
  }

  /** Register stream/interrupt/stepPause/done listeners for a run. */
  private setupRunListeners(): void {
    // Always clean up previous listeners first
    this.disposeRunListeners();
    console.log('[VizLang] Setting up run listeners');

    const streamDisposable = this.bridge.onStream((response) => {
      console.log(`[VizLang] >>> Stream event — mode: ${response.mode}, id: ${response.id}`);
      this.messageBus?.send({
        type: 'STREAM_EVENT',
        mode: response.mode as any,
        data: response.data,
      });
    });

    const interruptDisposable = this.bridge.onInterrupt((response) => {
      const data = response.data as any;
      this.messageBus?.send({
        type: 'INTERRUPT_RECEIVED',
        interrupt: {
          id: response.id,
          value: data.value,
          nodeId: data.node_id,
          resumable: data.resumable,
        },
        nodeId: data.node_id,
      });
    });

    const stepPauseDisposable = this.bridge.onStepPause((response) => {
      const data = response.data as any;
      this.messageBus?.send({
        type: 'STEP_PAUSED',
        nodeId: data.completed_node || '',
        nextNodes: data.next_nodes || [],
      });
    });

    const doneDisposable = this.bridge.onDone(() => {
      console.log('[VizLang] >>> Done event received');
      this.messageBus?.send({
        type: 'RUN_COMPLETE',
        finalState: null,
      });
      // Clean up after completion
      this.disposeRunListeners();
    });

    this.runDisposables = [
      streamDisposable,
      interruptDisposable,
      stepPauseDisposable,
      doneDisposable,
    ];
  }

  private async handleStartRun(msg: {
    threadId: string;
    input: unknown;
    stepMode: boolean;
  }): Promise<void> {
    console.log(`[VizLang] handleStartRun called — bridge running: ${this.bridge.isRunning}, graphLoaded: ${this.graphLoaded}, file: ${this.currentFile}, stepMode: ${msg.stepMode}`);

    if (!this.bridge.isRunning || !this.graphLoaded) {
      console.log('[VizLang] Bridge not ready, sending error');
      this.messageBus?.send({
        type: 'RUN_ERROR',
        error: this.graphLoaded
          ? 'Bridge not running. Load a graph first.'
          : 'Graph is still loading. Please wait a moment and try again.',
      });
      return;
    }

    if (!this.currentFile) {
      console.log('[VizLang] No current file, sending error');
      this.messageBus?.send({
        type: 'RUN_ERROR',
        error: 'No graph loaded.',
      });
      return;
    }

    this.setupRunListeners();

    try {
      console.log(`[VizLang] Sending run request — threadId: ${msg.threadId}, stepMode: ${msg.stepMode}`);
      const result = this.bridge.sendRequest('run', {
        thread_id: msg.threadId,
        input: msg.input,
        stream_mode: ['values', 'updates'],
        step_mode: msg.stepMode,
      });
      console.log(`[VizLang] Run request sent — id: ${result.id}`);
    } catch (err: any) {
      console.error(`[VizLang] Run request FAILED: ${err.message}`);
      this.messageBus?.send({
        type: 'RUN_ERROR',
        error: err.message || 'Failed to start execution',
      });
      this.disposeRunListeners();
    }
  }

  private async handleSendMessage(msg: {
    threadId: string;
    content: string;
    attachments?: Array<{ type: string; name: string; mimeType: string; data: string }>;
    extraInput?: Record<string, unknown>;
  }): Promise<void> {
    // Build multimodal content array if attachments present
    let messageContent: unknown;
    if (msg.attachments && msg.attachments.length > 0) {
      const contentParts: unknown[] = [];
      if (msg.content) {
        contentParts.push({ type: 'text', text: msg.content });
      }
      for (const att of msg.attachments) {
        if (att.type === 'image') {
          contentParts.push({
            type: 'image',
            base64: att.data,
            mime_type: att.mimeType,
          });
        } else if (att.type === 'audio') {
          contentParts.push({
            type: 'audio',
            base64: att.data,
            mime_type: att.mimeType,
          });
        } else {
          contentParts.push({
            type: 'text',
            text: `[File: ${att.name}]\n${Buffer.from(att.data, 'base64').toString('utf-8')}`,
          });
        }
      }
      messageContent = contentParts;
    } else {
      messageContent = msg.content;
    }

    // Build input: messages + any extra fields from schema
    const input: Record<string, unknown> = {
      messages: [{ type: 'human', content: messageContent }],
    };

    // Merge extra input fields (e.g., amount, category, etc.)
    if (msg.extraInput) {
      Object.assign(input, msg.extraInput);
    }

    await this.handleStartRun({
      threadId: msg.threadId,
      input,
      stepMode: false,
    });
  }

  private async handleResumeRun(threadId: string, stepMode: boolean): Promise<void> {
    if (!this.bridge.isRunning) return;

    this.setupRunListeners();
    this.messageBus?.send({ type: 'INTERRUPT_RESUMED' });

    this.bridge.sendRequest('resume', {
      thread_id: threadId,
      value: null,
      stream_mode: ['values', 'updates'],
      step_mode: stepMode,
    });
  }

  private async handleResolveInterrupt(msg: {
    response: unknown;
    stepMode?: boolean;
    threadId?: string;
  }): Promise<void> {
    if (!this.currentFile) return;

    const stepMode = msg.stepMode ?? false;
    const threadId = msg.threadId || 'default';

    this.setupRunListeners();
    this.messageBus?.send({ type: 'INTERRUPT_RESUMED' });

    this.bridge.sendRequest('resume', {
      thread_id: threadId,
      value: msg.response,
      stream_mode: ['values', 'updates'],
      step_mode: stepMode,
    });
  }

  private async handleSwitchThread(threadId: string): Promise<void> {
    try {
      const state = (await this.bridge.request('get_state', {
        thread_id: threadId,
      })) as any;
      const history = (await this.bridge.request('get_history', {
        thread_id: threadId,
        limit: 20,
      })) as any[];

      this.messageBus?.send({
        type: 'THREAD_STATE',
        values: state.values,
        next: state.next,
        history: history || [],
      });
    } catch (err: any) {
      vscode.window.showErrorMessage(`VizLang: ${err.message}`);
    }
  }

  private async handleGetState(threadId: string): Promise<void> {
    try {
      const state = (await this.bridge.request('get_state', {
        thread_id: threadId,
      })) as any;

      this.messageBus?.send({
        type: 'THREAD_STATE',
        values: state.values,
        next: state.next,
        history: [],
      });
    } catch (err: any) {
      vscode.window.showErrorMessage(`VizLang: ${err.message}`);
    }
  }

  private async handleGetHistory(threadId: string): Promise<void> {
    try {
      const history = (await this.bridge.request('get_history', {
        thread_id: threadId,
        limit: 20,
      })) as any[];

      this.messageBus?.send({
        type: 'THREAD_STATE',
        values: {},
        next: [],
        history: history || [],
      });
    } catch (err: any) {
      vscode.window.showErrorMessage(`VizLang: ${err.message}`);
    }
  }

  private async handleTimeTavel(
    threadId: string,
    checkpointId: string
  ): Promise<void> {
    try {
      await this.bridge.request('update_state', {
        thread_id: threadId,
        checkpoint_id: checkpointId,
        values: {},
      });
      await this.handleSwitchThread(threadId);
    } catch (err: any) {
      vscode.window.showErrorMessage(`VizLang: ${err.message}`);
    }
  }

  private async refreshThreads(): Promise<void> {
    try {
      const result = (await this.bridge.request('list_threads', {})) as {
        threads: any[];
      };
      this.messageBus?.send({
        type: 'THREADS_LIST',
        threads: result.threads,
      });
    } catch {
      // Silently ignore thread listing errors
    }
  }

  private getHtml(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview', 'assets', 'index.js')
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview', 'assets', 'index.css')
    );

    const nonce = getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; img-src ${webview.cspSource} data:; font-src ${webview.cspSource};">
  <link href="${styleUri}" rel="stylesheet">
  <title>VizLang</title>
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }

  dispose(): void {
    this.panel?.dispose();
  }
}

function getNonce(): string {
  let text = '';
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return text;
}
