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
        send_step_pause: Callable,
        send_done: Callable,
    ):
        self.graph = graph
        self.send_stream = send_stream
        self.send_interrupt = send_interrupt
        self.send_step_pause = send_step_pause
        self.send_done = send_done
        self._cancelled = threading.Event()
        self._current_thread_id: str | None = None

    def _get_all_node_names(self) -> list[str]:
        """Get all node names from the graph for step mode."""
        try:
            drawable = self.graph.get_graph()
            return [
                n for n in drawable.nodes
                if n not in ("__start__", "__end__")
            ]
        except Exception:
            return []

    def _run_stream(
        self,
        req_id: str,
        input_data: Any,
        config: dict,
        stream_modes: list[str],
        step_mode: bool = False,
    ) -> None:
        """Common streaming logic for execute and resume."""
        try:
            # Build stream kwargs
            stream_kwargs: dict[str, Any] = {
                "stream_mode": stream_modes if len(stream_modes) > 1 else stream_modes[0],
            }

            # interrupt_after is a stream() kwarg, NOT a config key
            if step_mode:
                node_names = self._get_all_node_names()
                if node_names:
                    stream_kwargs["interrupt_after"] = node_names

            stream = self.graph.stream(
                input_data,
                config,
                **stream_kwargs,
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

                serialized = serialize_value(data)
                self.send_stream(req_id, mode, serialized)

            # Check if interrupted (state has pending tasks)
            self._check_for_interrupts(req_id, config)

        except Exception as e:
            import traceback
            self.send_stream(req_id, "error", {
                "message": str(e),
                "traceback": traceback.format_exc(),
            })
            self.send_done(req_id)

    def _check_for_interrupts(self, req_id: str, config: dict) -> None:
        """Check if graph is paused and send appropriate events."""
        state = self.graph.get_state(config)
        if state.next:
            tasks = getattr(state, "tasks", [])

            # Check for explicit HITL interrupts
            has_interrupts = False
            for task in tasks:
                interrupts = getattr(task, "interrupts", [])
                for interrupt in interrupts:
                    has_interrupts = True
                    self.send_interrupt(req_id, {
                        "value": serialize_value(getattr(interrupt, "value", None)),
                        "node_id": task.name if hasattr(task, "name") else str(state.next[0]),
                        "resumable": getattr(interrupt, "resumable", True),
                        "when": getattr(interrupt, "when", "during"),
                    })

            if not has_interrupts:
                # Step mode pause — graph stopped between nodes
                next_nodes = list(state.next)
                # Get current state values for inspection
                state_values = serialize_value(state.values) if state.values else {}
                self.send_step_pause(req_id, {
                    "completed_node": next_nodes[0] if next_nodes else "",
                    "next_nodes": next_nodes,
                    "state": state_values,
                })
        else:
            self.send_done(req_id)

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
        self._run_stream(req_id, input_data, config, stream_modes, step_mode)

    def resume(
        self,
        req_id: str,
        thread_id: str,
        resume_value: Any,
        stream_modes: list[str],
        step_mode: bool = False,
    ) -> None:
        """Resume from a HITL interrupt or step pause."""
        self._cancelled.clear()
        self._current_thread_id = thread_id

        config = {"configurable": {"thread_id": thread_id}}

        if resume_value is not None:
            input_data = Command(resume=resume_value)
        else:
            input_data = None

        self._run_stream(req_id, input_data, config, stream_modes, step_mode)

    def cancel(self) -> None:
        """Cancel the current execution."""
        self._cancelled.set()
