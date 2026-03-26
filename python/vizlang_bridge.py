"""
VizLang Bridge — JSON Lines server over stdin/stdout.
Wraps the langgraph library to provide graph introspection,
execution, state management, and HITL support.
"""

import sys
import json
import threading
import traceback
import uuid
from typing import Any

from graph_loader import GraphLoader
from run_executor import RunExecutor
from state_manager import StateManager
from utils import serialize

# Globals
graph_loader = GraphLoader()
run_executor: RunExecutor | None = None
state_manager: StateManager | None = None
_stdout_lock = threading.Lock()


def send(msg: dict) -> None:
    """Write a JSON line to stdout (thread-safe)."""
    line = json.dumps(msg, default=serialize) + "\n"
    with _stdout_lock:
        sys.stdout.write(line)
        sys.stdout.flush()


def send_response(req_id: str, data: Any) -> None:
    send({"id": req_id, "type": "response", "data": data})


def send_error(req_id: str, message: str, tb: str | None = None) -> None:
    send({"id": req_id, "type": "error", "data": {"message": message, "traceback": tb}})


def send_stream(req_id: str, mode: str, data: Any) -> None:
    send({"id": req_id, "type": "stream", "mode": mode, "data": data})


def send_interrupt(req_id: str, data: dict) -> None:
    send({"id": req_id, "type": "interrupt", "data": data})


def send_step_pause(req_id: str, data: dict) -> None:
    send({"id": req_id, "type": "step_pause", "data": data})


def send_done(req_id: str) -> None:
    send({"id": req_id, "type": "done", "data": None})


def handle_request(req: dict) -> None:
    """Dispatch a request to the appropriate handler."""
    global run_executor, state_manager

    req_id = req.get("id", "unknown")
    method = req.get("method", "")
    params = req.get("params", {})

    try:
        if method == "ping":
            send_response(req_id, {"pong": True})

        elif method == "load_graph":
            file_path = params["file"]
            graph_var = params.get("graph_var")
            graphs = graph_loader.load(file_path, graph_var)
            # Initialize executor and state manager with first graph
            if graphs:
                first_name = list(graphs.keys())[0]
                compiled = graphs[first_name]
                run_executor = RunExecutor(compiled, send_stream, send_interrupt, send_step_pause, send_done)
                state_manager = StateManager(compiled)
            send_response(req_id, {
                "success": True,
                "graphs": list(graphs.keys()),
            })

        elif method == "list_graphs":
            file_path = params["file"]
            graphs = graph_loader.scan(file_path)
            send_response(req_id, {"graphs": graphs})

        elif method == "get_graph":
            graph_var = params.get("graph_var")
            graph_data = graph_loader.get_graph_structure(graph_var)
            send_response(req_id, graph_data)

        elif method == "run":
            if not run_executor:
                send_error(req_id, "No graph loaded")
                return
            thread_id = params.get("thread_id", str(uuid.uuid4()))
            input_data = params.get("input", {})
            stream_modes = params.get("stream_mode", ["values", "updates"])
            step_mode = params.get("step_mode", False)
            # Run in a separate thread to not block stdin reading
            t = threading.Thread(
                target=run_executor.execute,
                args=(req_id, thread_id, input_data, stream_modes, step_mode),
            )
            t.daemon = True
            t.start()

        elif method == "resume":
            if not run_executor:
                send_error(req_id, "No graph loaded")
                return
            thread_id = params["thread_id"]
            value = params.get("value")
            stream_modes = params.get("stream_mode", ["values", "updates"])
            step_mode = params.get("step_mode", False)
            t = threading.Thread(
                target=run_executor.resume,
                args=(req_id, thread_id, value, stream_modes, step_mode),
            )
            t.daemon = True
            t.start()

        elif method == "cancel":
            if run_executor:
                run_executor.cancel()
            send_response(req_id, {"cancelled": True})

        elif method == "get_state":
            if not state_manager:
                send_error(req_id, "No graph loaded")
                return
            thread_id = params["thread_id"]
            state = state_manager.get_state(thread_id)
            send_response(req_id, state)

        elif method == "get_history":
            if not state_manager:
                send_error(req_id, "No graph loaded")
                return
            thread_id = params["thread_id"]
            limit = params.get("limit", 20)
            history = state_manager.get_history(thread_id, limit)
            send_response(req_id, history)

        elif method == "update_state":
            if not state_manager:
                send_error(req_id, "No graph loaded")
                return
            thread_id = params["thread_id"]
            values = params["values"]
            as_node = params.get("as_node")
            result = state_manager.update_state(thread_id, values, as_node)
            send_response(req_id, result)

        elif method == "create_thread":
            thread_id = str(uuid.uuid4())
            send_response(req_id, {"thread_id": thread_id})

        elif method == "list_threads":
            if not state_manager:
                send_response(req_id, {"threads": []})
                return
            threads = state_manager.list_threads()
            send_response(req_id, {"threads": threads})

        elif method == "delete_thread":
            # MemorySaver doesn't support deletion directly
            send_response(req_id, {"deleted": True})

        elif method == "set_checkpointer":
            checkpointer_type = params.get("type", "memory")
            graph_loader.set_checkpointer(checkpointer_type)
            # Recompile current graph with new checkpointer
            if graph_loader.current_graphs:
                first_name = list(graph_loader.current_graphs.keys())[0]
                compiled = graph_loader.current_graphs[first_name]
                run_executor = RunExecutor(compiled, send_stream, send_interrupt, send_step_pause, send_done)
                state_manager = StateManager(compiled)
            send_response(req_id, {"success": True})

        else:
            send_error(req_id, f"Unknown method: {method}")

    except Exception as e:
        send_error(req_id, str(e), traceback.format_exc())


def main() -> None:
    """Main loop: read JSON Lines from stdin, dispatch to handlers."""
    print("[vizlang_bridge] Starting...", file=sys.stderr)

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            req = json.loads(line)
            handle_request(req)
        except json.JSONDecodeError:
            print(f"[vizlang_bridge] Invalid JSON: {line}", file=sys.stderr)
        except Exception as e:
            print(f"[vizlang_bridge] Unexpected error: {e}", file=sys.stderr)
            traceback.print_exc(file=sys.stderr)


if __name__ == "__main__":
    main()
