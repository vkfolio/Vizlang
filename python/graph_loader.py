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
        """Switch checkpointer type. 'none' disables persistence entirely."""
        if checkpointer_type == "none":
            self.checkpointer = None
        elif checkpointer_type == "memory":
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
            if self.checkpointer is not None:
                self.current_graphs[name] = raw.compile(checkpointer=self.checkpointer)
            else:
                self.current_graphs[name] = raw.compile()

    def load(self, file_path: str, graph_var: str | None = None) -> dict[str, CompiledStateGraph]:
        """
        Load a Python file and find all StateGraph instances.
        If graph_var is specified, only load that variable.
        Returns {variable_name: compiled_graph}.
        """
        file_path = os.path.abspath(file_path)
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"File not found: {file_path}")

        # Fresh checkpointer for each graph load — clears old thread state
        # but preserve "none" mode if set
        if self.checkpointer is not None:
            self.checkpointer = MemorySaver()

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
                # Check if user already compiled with their own checkpointer
                user_checkpointer = getattr(obj, "checkpointer", None)
                if user_checkpointer is not None:
                    # User provided their own checkpointer — use their compiled graph as-is
                    graphs[name] = obj
                    if hasattr(obj, 'builder'):
                        raw[name] = obj.builder
                    print(f"[graph_loader] Using user's checkpointer for '{name}': {type(user_checkpointer).__name__}", file=sys.stderr)
                elif hasattr(obj, 'builder'):
                    # No user checkpointer — recompile with ours
                    try:
                        if self.checkpointer is not None:
                            graphs[name] = obj.builder.compile(checkpointer=self.checkpointer)
                        else:
                            graphs[name] = obj.builder.compile()
                        raw[name] = obj.builder
                    except Exception:
                        graphs[name] = obj
                else:
                    graphs[name] = obj

            elif isinstance(obj, StateGraph):
                raw[name] = obj
                if self.checkpointer is not None:
                    graphs[name] = obj.compile(checkpointer=self.checkpointer)
                else:
                    graphs[name] = obj.compile()

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

        # Extract state schema and generate sample input
        input_schema = {}
        sample_input = {}
        output_schema = {}
        try:
            input_schema, sample_input = self._extract_schema(graph)
            output_schema = self._extract_output_schema(graph)
        except Exception as e:
            print(f"[graph_loader] Could not extract schema: {e}", file=sys.stderr)

        return {
            "nodes": nodes,
            "edges": edges,
            "inputSchema": input_schema,
            "sampleInput": sample_input,
            "outputSchema": output_schema,
        }

    @staticmethod
    def _extract_schema(graph: CompiledStateGraph) -> tuple[dict[str, str], dict[str, Any]]:
        """Extract input schema from graph builder.
        Prefers InputSchema (if defined via input_schema=) over the main State.
        Returns (input_schema, sample_input).
        """
        import typing

        schemas = getattr(graph.builder, 'schemas', {})
        if not schemas:
            return {}, {}

        schema_list = list(schemas.keys())
        state_cls = schema_list[0]
        state_fields = set(getattr(state_cls, '__annotations__', {}).keys())

        # Determine the actual input schema:
        # - If 3 schemas: [State, InputSchema, OutputSchema] — use InputSchema
        # - If 2 schemas: could be [State, InputSchema] or [State, PrivateState]
        #   Check if 2nd schema's fields are a subset of State (= InputSchema)
        #   or have different fields (= PrivateState from node type hints)
        # - If 1 schema: just State
        if len(schema_list) >= 3:
            input_cls = schema_list[1]  # Explicit InputSchema
        elif len(schema_list) == 2:
            candidate = schema_list[1]
            candidate_fields = set(getattr(candidate, '__annotations__', {}).keys())
            if candidate_fields.issubset(state_fields):
                # Fields are a subset of State — this is an InputSchema
                input_cls = candidate
            else:
                # Fields are NOT a subset — this is a PrivateState, use State
                input_cls = state_cls
        else:
            input_cls = state_cls

        annotations = getattr(input_cls, '__annotations__', {})
        if not annotations:
            return {}, {}

        input_schema: dict[str, str] = {}
        sample_input: dict[str, Any] = {}

        for field_name, type_hint in annotations.items():
            type_hint = GraphLoader._unwrap_annotated(type_hint)
            type_str = GraphLoader._type_to_str(type_hint)
            input_schema[field_name] = type_str
            sample_input[field_name] = GraphLoader._default_for_type(type_hint)

        return input_schema, sample_input

    @staticmethod
    def _extract_output_schema(graph: CompiledStateGraph) -> dict[str, str]:
        """Extract output schema if defined (3rd entry in builder.schemas)."""
        schemas = getattr(graph.builder, 'schemas', {})
        schema_list = list(schemas.keys())

        if len(schema_list) < 3:
            return {}  # No explicit output schema

        output_cls = schema_list[2]
        annotations = getattr(output_cls, '__annotations__', {})
        output_schema: dict[str, str] = {}
        for field_name, type_hint in annotations.items():
            type_hint = GraphLoader._unwrap_annotated(type_hint)
            output_schema[field_name] = GraphLoader._type_to_str(type_hint)

        return output_schema

    @staticmethod
    def _unwrap_annotated(t: Any) -> Any:
        """Unwrap Annotated[X, ...] to X."""
        if hasattr(t, '__metadata__'):
            args = getattr(t, '__args__', ())
            return args[0] if args else t
        return t

    @staticmethod
    def _type_to_str(t: Any) -> str:
        """Convert a type hint to a readable string."""
        import typing
        t = GraphLoader._unwrap_annotated(t)
        origin = getattr(t, '__origin__', None)
        args = getattr(t, '__args__', ())

        if origin is list or (origin is not None and getattr(origin, '__name__', '') == 'List'):
            inner = GraphLoader._type_to_str(args[0]) if args else 'any'
            return f"list[{inner}]"
        elif origin is dict:
            k = GraphLoader._type_to_str(args[0]) if len(args) > 0 else 'str'
            v = GraphLoader._type_to_str(args[1]) if len(args) > 1 else 'any'
            return f"dict[{k},{v}]"
        elif t is str:
            return "string"
        elif t is int:
            return "integer"
        elif t is float:
            return "number"
        elif t is bool:
            return "boolean"
        elif hasattr(t, '__name__'):
            return t.__name__
        return str(t)

    @staticmethod
    def _default_for_type(t: Any) -> Any:
        """Generate a default sample value for a type."""
        t = GraphLoader._unwrap_annotated(t)
        origin = getattr(t, '__origin__', None)

        if origin is list or (origin is not None and getattr(origin, '__name__', '') == 'List'):
            return []
        elif origin is dict:
            return {}
        elif t is str:
            return ""
        elif t is int:
            return 0
        elif t is float:
            return 0.0
        elif t is bool:
            return False
        return None
