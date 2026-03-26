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
      });

      this.messageBus.send({
        type: 'BRIDGE_STATUS',
        status: 'ready',
      });
    } catch (err: any) {
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

  private async handleStartRun(msg: {
    threadId: string;
    input: unknown;
    stepMode: boolean;
  }): Promise<void> {
    if (!this.bridge.isRunning) {
      this.messageBus?.send({
        type: 'RUN_ERROR',
        error: 'Bridge not running. Load a graph first (Ctrl+Shift+P → "VizLang: Load Graph").',
      });
      return;
    }

    if (!this.currentFile) {
      this.messageBus?.send({
        type: 'RUN_ERROR',
        error: 'No graph loaded. Use Ctrl+Shift+P → "VizLang: Load Graph" first.',
      });
      return;
    }

    const streamModes = ['values', 'updates'];

    // Set up stream event forwarding
    const streamDisposable = this.bridge.onStream((response) => {
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
      this.messageBus?.send({
        type: 'RUN_COMPLETE',
        finalState: null,
      });
      streamDisposable.dispose();
      interruptDisposable.dispose();
      stepPauseDisposable.dispose();
      doneDisposable.dispose();
    });

    try {
      this.bridge.sendRequest('run', {
        thread_id: msg.threadId,
        input: msg.input,
        stream_mode: streamModes,
        step_mode: msg.stepMode,
      });
    } catch (err: any) {
      this.messageBus?.send({
        type: 'RUN_ERROR',
        error: err.message || 'Failed to start execution',
      });
      streamDisposable.dispose();
      interruptDisposable.dispose();
      stepPauseDisposable.dispose();
      doneDisposable.dispose();
    }
  }

  private async handleSendMessage(msg: {
    threadId: string;
    content: string;
  }): Promise<void> {
    await this.handleStartRun({
      threadId: msg.threadId,
      input: { messages: [{ role: 'human', content: msg.content }] },
      stepMode: false,
    });
  }

  private async handleResumeRun(threadId: string, stepMode: boolean): Promise<void> {
    if (!this.bridge.isRunning) return;

    const streamDisposable = this.bridge.onStream((response) => {
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
      this.messageBus?.send({ type: 'RUN_COMPLETE', finalState: null });
      streamDisposable.dispose();
      interruptDisposable.dispose();
      stepPauseDisposable.dispose();
      doneDisposable.dispose();
    });

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
  }): Promise<void> {
    if (!this.currentFile) return;

    const streamDisposable = this.bridge.onStream((response) => {
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

    const doneDisposable = this.bridge.onDone(() => {
      this.messageBus?.send({ type: 'RUN_COMPLETE', finalState: null });
      streamDisposable.dispose();
      interruptDisposable.dispose();
      doneDisposable.dispose();
    });

    this.messageBus?.send({ type: 'INTERRUPT_RESUMED' });

    this.bridge.sendRequest('resume', {
      thread_id: '', // Will use current thread
      value: msg.response,
      stream_mode: ['values', 'updates'],
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
