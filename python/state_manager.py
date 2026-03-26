"""
State inspection, history, and time-travel operations.
"""

from typing import Any
from langgraph.graph.state import CompiledStateGraph
from utils import serialize_value


class StateManager:
    def __init__(self, graph: CompiledStateGraph):
        self.graph = graph

    def get_state(self, thread_id: str) -> dict:
        """Get current state snapshot for a thread."""
        config = {"configurable": {"thread_id": thread_id}}
        try:
            snapshot = self.graph.get_state(config)
            return {
                "values": serialize_value(snapshot.values),
                "next": list(snapshot.next) if snapshot.next else [],
                "config": serialize_value(snapshot.config),
                "metadata": serialize_value(getattr(snapshot, "metadata", {})),
                "created_at": str(getattr(snapshot, "created_at", "")),
                "tasks": serialize_value(getattr(snapshot, "tasks", [])),
            }
        except Exception:
            return {"values": {}, "next": [], "config": {}, "metadata": {}, "created_at": "", "tasks": []}

    def get_history(self, thread_id: str, limit: int = 20) -> list[dict]:
        """Get checkpoint history for a thread."""
        config = {"configurable": {"thread_id": thread_id}}
        history = []
        try:
            for snapshot in self.graph.get_state_history(config):
                checkpoint_id = ""
                if snapshot.config and "configurable" in snapshot.config:
                    checkpoint_id = snapshot.config["configurable"].get("checkpoint_id", "")

                history.append({
                    "id": checkpoint_id,
                    "values": serialize_value(snapshot.values),
                    "next": list(snapshot.next) if snapshot.next else [],
                    "metadata": serialize_value(getattr(snapshot, "metadata", {})),
                    "created_at": str(getattr(snapshot, "created_at", "")),
                    "parent_id": (
                        snapshot.parent_config["configurable"].get("checkpoint_id", "")
                        if snapshot.parent_config and "configurable" in snapshot.parent_config
                        else None
                    ),
                })
                if len(history) >= limit:
                    break
        except Exception:
            pass

        return history

    def update_state(self, thread_id: str, values: Any, as_node: str | None = None) -> dict:
        """Update state for time travel / forking."""
        config = {"configurable": {"thread_id": thread_id}}
        kwargs: dict[str, Any] = {"config": config, "values": values}
        if as_node:
            kwargs["as_node"] = as_node

        result = self.graph.update_state(**kwargs)
        return {"config": serialize_value(result)}

    def list_threads(self) -> list[dict]:
        """List all known thread IDs from the checkpointer."""
        threads = []
        # MemorySaver stores checkpoints keyed by thread_id
        checkpointer = getattr(self.graph, "checkpointer", None)
        if checkpointer is None:
            return threads

        # MemorySaver has a .storage dict
        storage = getattr(checkpointer, "storage", None)
        if storage and isinstance(storage, dict):
            for key in storage:
                if isinstance(key, tuple) and len(key) >= 1:
                    thread_id = key[0]
                    if thread_id not in [t["thread_id"] for t in threads]:
                        threads.append({
                            "thread_id": thread_id,
                            "status": "idle",
                        })

        return threads
