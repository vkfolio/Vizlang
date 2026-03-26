"""
Wraps graph.stream() for execution with streaming event output.
Handles HITL interrupts and step-by-step execution.
"""

import time
import threading
from typing import Any, Callable

from langgraph.graph.state import CompiledStateGraph
from langgraph.types import Command
from utils import serialize_value


class RunExecutor:
    def __init__(
        self,
        graph: CompiledStateGraph,
        send_stream: Callable,
        send_interrupt: Callable,
        send_done: Callable,
    ):
        self.graph = graph
        self.send_stream = send_stream
        self.send_interrupt = send_interrupt
        self.send_done = send_done
        self._cancelled = threading.Event()
        self._current_thread_id: str | None = None

    def execute(
        self,
        req_id: str,
        thread_id: str,
        input_data: Any,
        stream_modes: list[str],
        step_mode: bool = False,
    ) -> None:
        """Execute a graph run with streaming."""
        self._cancelled.clear()
        self._current_thread_id = thread_id

        config = {"configurable": {"thread_id": thread_id}}

        # Step mode: interrupt after every node
        if step_mode:
            config["interrupt_after"] = "*"

        try:
            stream = self.graph.stream(
                input_data,
                config,
                stream_mode=stream_modes if len(stream_modes) > 1 else stream_modes[0],
            )

            for event in stream:
                if self._cancelled.is_set():
                    break

                # Handle multi-mode streaming (returns tuples)
                if len(stream_modes) > 1 and isinstance(event, tuple):
                    mode, data = event
                else:
                    mode = stream_modes[0] if len(stream_modes) == 1 else "updates"
                    data = event

                # Detect node name from updates mode
                node_id = None
                if mode == "updates" and isinstance(data, dict):
                    keys = list(data.keys())
                    if keys:
                        node_id = keys[0]

                serialized = serialize_value(data)
                self.send_stream(req_id, mode, serialized)

            # Check if interrupted (state has pending tasks)
            state = self.graph.get_state(config)
            if state.next:
                # Graph is paused (step mode or interrupt)
                tasks = getattr(state, "tasks", [])
                for task in tasks:
                    interrupts = getattr(task, "interrupts", [])
                    for interrupt in interrupts:
                        self.send_interrupt(req_id, {
                            "value": serialize_value(getattr(interrupt, "value", None)),
                            "node_id": task.name if hasattr(task, "name") else str(state.next[0]),
                            "resumable": getattr(interrupt, "resumable", True),
                            "when": getattr(interrupt, "when", "during"),
                        })

                if not any(getattr(t, "interrupts", []) for t in tasks):
                    # Step mode pause (no explicit interrupt, just paused between nodes)
                    self.send_interrupt(req_id, {
                        "value": f"Paused before: {', '.join(state.next)}",
                        "node_id": state.next[0] if state.next else "",
                        "resumable": True,
                        "when": "after",
                    })
            else:
                self.send_done(req_id)

        except Exception as e:
            import traceback
            self.send_stream(req_id, "error", {
                "message": str(e),
                "traceback": traceback.format_exc(),
            })
            self.send_done(req_id)

    def resume(
        self,
        req_id: str,
        thread_id: str,
        resume_value: Any,
        stream_modes: list[str],
    ) -> None:
        """Resume from a HITL interrupt."""
        self._cancelled.clear()
        self._current_thread_id = thread_id

        config = {"configurable": {"thread_id": thread_id}}

        try:
            if resume_value is not None:
                input_data = Command(resume=resume_value)
            else:
                input_data = None

            stream = self.graph.stream(
                input_data,
                config,
                stream_mode=stream_modes if len(stream_modes) > 1 else stream_modes[0],
            )

            for event in stream:
                if self._cancelled.is_set():
                    break

                if len(stream_modes) > 1 and isinstance(event, tuple):
                    mode, data = event
                else:
                    mode = stream_modes[0] if len(stream_modes) == 1 else "updates"
                    data = event

                serialized = serialize_value(data)
                self.send_stream(req_id, mode, serialized)

            # Check for further interrupts
            state = self.graph.get_state(config)
            if state.next:
                tasks = getattr(state, "tasks", [])
                for task in tasks:
                    interrupts = getattr(task, "interrupts", [])
                    for interrupt in interrupts:
                        self.send_interrupt(req_id, {
                            "value": serialize_value(getattr(interrupt, "value", None)),
                            "node_id": task.name if hasattr(task, "name") else str(state.next[0]),
                            "resumable": getattr(interrupt, "resumable", True),
                            "when": getattr(interrupt, "when", "during"),
                        })
                if not any(getattr(t, "interrupts", []) for t in tasks):
                    self.send_interrupt(req_id, {
                        "value": f"Paused before: {', '.join(state.next)}",
                        "node_id": state.next[0] if state.next else "",
                        "resumable": True,
                        "when": "after",
                    })
            else:
                self.send_done(req_id)

        except Exception as e:
            import traceback
            self.send_stream(req_id, "error", {
                "message": str(e),
                "traceback": traceback.format_exc(),
            })
            self.send_done(req_id)

    def cancel(self) -> None:
        """Cancel the current execution."""
        self._cancelled.set()
