"""
Dynamically loads user's Python files and extracts compiled LangGraph graphs.
"""

import importlib.util
import inspect
import os
import sys
from typing import Any

from langgraph.graph.state import CompiledStateGraph
from langgraph.checkpoint.memory import MemorySaver


class GraphLoader:
    def __init__(self):
        self.current_graphs: dict[str, CompiledStateGraph] = {}
        self.raw_graphs: dict[str, Any] = {}  # Uncompiled StateGraph objects
        self.checkpointer = MemorySaver()
        self._loaded_file: str | None = None

    def set_checkpointer(self, checkpointer_type: str) -> None:
        """Switch checkpointer type."""
        if checkpointer_type == "memory":
            self.checkpointer = MemorySaver()
        elif checkpointer_type == "sqlite":
            try:
                from langgraph.checkpoint.sqlite import SqliteSaver
                self.checkpointer = SqliteSaver.from_conn_string("vizlang_checkpoints.sqlite")
            except ImportError:
                print("[graph_loader] langgraph-checkpoint-sqlite not installed, using MemorySaver", file=sys.stderr)
                self.checkpointer = MemorySaver()

        # Recompile graphs with new checkpointer
        for name, raw in self.raw_graphs.items():
            self.current_graphs[name] = raw.compile(checkpointer=self.checkpointer)

    def load(self, file_path: str, graph_var: str | None = None) -> dict[str, CompiledStateGraph]:
        """
        Load a Python file and find all StateGraph instances.
        If graph_var is specified, only load that variable.
        Returns {variable_name: compiled_graph}.
        """
        file_path = os.path.abspath(file_path)
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"File not found: {file_path}")

        # Add the file's directory to sys.path so imports work
        file_dir = os.path.dirname(file_path)
        if file_dir not in sys.path:
            sys.path.insert(0, file_dir)

        # Load the module
        module_name = os.path.splitext(os.path.basename(file_path))[0]
        spec = importlib.util.spec_from_file_location(module_name, file_path)
        if spec is None or spec.loader is None:
            raise ImportError(f"Cannot load module from {file_path}")

        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)

        # Find all StateGraph / CompiledStateGraph instances
        from langgraph.graph.state import StateGraph

        graphs: dict[str, CompiledStateGraph] = {}
        raw: dict[str, Any] = {}

        for name, obj in inspect.getmembers(module):
            if name.startswith("_"):
                continue

            if graph_var and name != graph_var:
                continue

            if isinstance(obj, CompiledStateGraph):
                # Already compiled — recompile with our checkpointer
                # We need the raw graph for recompilation, but if user
                # already compiled it, we use it as-is for structure
                # and wrap it
                graphs[name] = obj
                # Try to recompile with checkpointer if possible
                if hasattr(obj, 'builder'):
                    try:
                        graphs[name] = obj.builder.compile(checkpointer=self.checkpointer)
                        raw[name] = obj.builder
                    except Exception:
                        pass  # Use the original compiled graph

            elif isinstance(obj, StateGraph):
                raw[name] = obj
                graphs[name] = obj.compile(checkpointer=self.checkpointer)

        self.current_graphs = graphs
        self.raw_graphs = raw
        self._loaded_file = file_path

        return graphs

    def scan(self, file_path: str) -> list[dict]:
        """Scan a file for graph definitions without fully loading them."""
        graphs = self.load(file_path)
        result = []
        for name, graph in graphs.items():
            info: dict[str, Any] = {"name": name}
            # Try to get state schema
            try:
                schemas = graph.get_graph()
                info["node_count"] = len(schemas.nodes)
                info["edge_count"] = len(schemas.edges)
            except Exception:
                pass
            result.append(info)
        return result

    def get_graph_structure(self, graph_var: str | None = None) -> dict:
        """Get the graph topology as JSON-serializable dict."""
        if not self.current_graphs:
            raise RuntimeError("No graphs loaded")

        if graph_var:
            if graph_var not in self.current_graphs:
                raise KeyError(f"Graph '{graph_var}' not found. Available: {list(self.current_graphs.keys())}")
            graph = self.current_graphs[graph_var]
        else:
            graph = next(iter(self.current_graphs.values()))

        drawable = graph.get_graph()

        nodes = []
        for node_id, node_data in drawable.nodes.items():
            node_type = "process"
            if node_id == "__start__":
                node_type = "entry"
            elif node_id == "__end__":
                node_type = "end"

            nodes.append({
                "id": node_id,
                "name": getattr(node_data, "name", node_id),
                "type": node_type,
                "metadata": getattr(node_data, "metadata", {}),
            })

        edges = []
        for edge in drawable.edges:
            is_conditional = getattr(edge, "conditional", False)
            edge_data = getattr(edge, "data", None)

            # Detect conditional nodes: if a node has multiple outgoing
            # conditional edges, mark it as conditional type
            edges.append({
                "source": edge.source,
                "target": edge.target,
                "conditional": is_conditional,
                "data": str(edge_data) if edge_data else None,
            })

        # Post-process: detect conditional nodes (nodes with multiple conditional outgoing edges)
        conditional_sources = set()
        for edge in edges:
            if edge["conditional"]:
                conditional_sources.add(edge["source"])

        for node in nodes:
            if node["id"] in conditional_sources and node["type"] == "process":
                node["type"] = "conditional"

        return {"nodes": nodes, "edges": edges}
