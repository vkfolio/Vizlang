import * as vscode from 'vscode';
import { ChildProcess, spawn } from 'child_process';
import { BridgeProtocol } from './BridgeProtocol';
import type { BridgeMethod, BridgeResponse } from './types';

/**
 * Manages the Python bridge subprocess lifecycle.
 * Spawns the bridge using the user's Python interpreter,
 * communicates via JSON Lines over stdin/stdout.
 */
export class BridgeManager {
  private process: ChildProcess | null = null;
  private protocol: BridgeProtocol;
  private outputChannel: vscode.OutputChannel;
  private _onStatusChange = new vscode.EventEmitter<
    'starting' | 'ready' | 'error' | 'stopped'
  >();
  readonly onStatusChange = this._onStatusChange.event;

  private _onStream = new vscode.EventEmitter<BridgeResponse>();
  readonly onStream = this._onStream.event;

  private _onInterrupt = new vscode.EventEmitter<BridgeResponse>();
  readonly onInterrupt = this._onInterrupt.event;

  private _onDone = new vscode.EventEmitter<BridgeResponse>();
  readonly onDone = this._onDone.event;

  private _onStepPause = new vscode.EventEmitter<BridgeResponse>();
  readonly onStepPause = this._onStepPause.event;

  constructor(private extensionUri: vscode.Uri) {
    this.outputChannel = vscode.window.createOutputChannel('VizLang Bridge');
    this.protocol = new BridgeProtocol();

    // Forward protocol events to VS Code events
    this.protocol.on('stream', (msg: BridgeResponse) => {
      this.outputChannel.appendLine(`[event] stream — mode: ${msg.mode}`);
      this._onStream.fire(msg);
    });
    this.protocol.on('interrupt', (msg: BridgeResponse) => {
      this.outputChannel.appendLine(`[event] interrupt`);
      this._onInterrupt.fire(msg);
    });
    this.protocol.on('step_pause', (msg: BridgeResponse) => {
      this.outputChannel.appendLine(`[event] step_pause`);
      this._onStepPause.fire(msg);
    });
    this.protocol.on('done', (msg: BridgeResponse) => {
      this.outputChannel.appendLine(`[event] done — id: ${msg.id}`);
      this._onDone.fire(msg);
    });
    this.protocol.on('log', (line: string) =>
      this.outputChannel.appendLine(`[bridge] ${line}`)
    );
    this.protocol.on('error', (msg: BridgeResponse) => {
      const err = msg.data as { message: string; traceback?: string };
      this.outputChannel.appendLine(`[bridge error] ${err.message}`);
      if (err.traceback) {
        this.outputChannel.appendLine(err.traceback);
      }
    });
  }

  /**
   * Start the Python bridge subprocess.
   */
  async start(): Promise<void> {
    if (this.process) {
      return; // Already running
    }

    this._onStatusChange.fire('starting');

    const pythonPath = vscode.workspace
      .getConfiguration('vizlang')
      .get<string>('pythonPath', 'python');

    const bridgeScript = vscode.Uri.joinPath(
      this.extensionUri,
      'python',
      'vizlang_bridge.py'
    ).fsPath;

    const checkpointerType = vscode.workspace
      .getConfiguration('vizlang')
      .get<string>('checkpointerType', 'memory');

    this.outputChannel.appendLine(
      `Starting bridge: ${pythonPath} ${bridgeScript}`
    );
    this.outputChannel.appendLine(
      `Extension URI: ${this.extensionUri.fsPath}`
    );

    this.process = spawn(pythonPath, ['-u', bridgeScript], {
      env: {
        ...process.env,
        PYTHONUNBUFFERED: '1',
        VIZLANG_CHECKPOINTER: checkpointerType,
      },
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: vscode.Uri.joinPath(this.extensionUri, 'python').fsPath,
    });

    // Handle stdout (JSON Lines responses)
    this.process.stdout?.on('data', (data: Buffer) => {
      const text = data.toString();
      this.outputChannel.appendLine(`[stdout] Received ${text.length} bytes`);
      this.protocol.onData(text);
    });

    // Handle stderr (Python logs/errors)
    this.process.stderr?.on('data', (data: Buffer) => {
      this.outputChannel.appendLine(`[python] ${data.toString().trim()}`);
    });

    // Handle process exit
    this.process.on('exit', (code) => {
      this.outputChannel.appendLine(`Bridge exited with code ${code}`);
      this.process = null;
      this.protocol.cancelAll();
      this._onStatusChange.fire('stopped');
    });

    this.process.on('error', (err) => {
      this.outputChannel.appendLine(`Bridge spawn error: ${err.message}`);
      this.process = null;
      this._onStatusChange.fire('error');
    });

    // Wait for bridge to be ready (ping) with timeout
    try {
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Bridge startup timed out (10s)')), 10000)
      );
      await Promise.race([this.request('ping', {}), timeout]);
      this._onStatusChange.fire('ready');
      this.outputChannel.appendLine('Bridge ready');
    } catch (err: any) {
      this.outputChannel.appendLine(`Bridge startup failed: ${err.message}`);
      this._onStatusChange.fire('error');
      throw err;
    }
  }

  /**
   * Write a line to the bridge stdin.
   */
  private writeStdin(line: string): void {
    if (!this.process?.stdin) {
      throw new Error('Bridge not running');
    }
    this.outputChannel.appendLine(`[stdin] Writing ${line.length} bytes`);
    this.process.stdin.write(line);
  }

  /**
   * Send a request to the bridge and wait for the response.
   */
  async request(
    method: BridgeMethod,
    params: Record<string, unknown>
  ): Promise<unknown> {
    const { request, promise } = this.protocol.createRequest(method, params);
    const line = this.protocol.serialize(request);

    this.writeStdin(line);
    return promise;
  }

  /**
   * Send a request for streaming (results come via events).
   */
  sendRequest(
    method: BridgeMethod,
    params: Record<string, unknown>
  ): { id: string; promise: Promise<unknown> } {
    const { request, promise } = this.protocol.createRequest(method, params);
    const line = this.protocol.serialize(request);

    this.writeStdin(line);
    return { id: request.id, promise };
  }

  /**
   * Stop the bridge subprocess.
   */
  stop(): void {
    if (this.process) {
      this.process.kill();
      this.process = null;
      this.protocol.cancelAll();
      this._onStatusChange.fire('stopped');
    }
  }

  get isRunning(): boolean {
    return this.process !== null;
  }

  dispose(): void {
    this.stop();
    this.protocol.dispose();
    this._onStatusChange.dispose();
    this._onStream.dispose();
    this._onInterrupt.dispose();
    this._onStepPause.dispose();
    this._onDone.dispose();
    this.outputChannel.dispose();
  }
}
