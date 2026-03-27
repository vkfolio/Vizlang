<p align="center">
  <img src="media/logo.svg" width="80" height="80" alt="VizLang" />
</p>

<h1 align="center">VizLang</h1>

<p align="center">
  <strong>Visual debugger for LangGraph agents in VS Code</strong>
</p>

<p align="center">
  See your agent's graph. Watch it think. Step through every node.
</p>

<p align="center">
  <a href="#install">
    <img src="https://img.shields.io/badge/VS%20Code-Install-007ACC?style=flat-square&logo=visual-studio-code" alt="Install" />
  </a>
  <img src="https://img.shields.io/badge/python-3.10+-3776AB?style=flat-square&logo=python&logoColor=white" alt="Python 3.10+" />
  <img src="https://img.shields.io/badge/license-MIT-green?style=flat-square" alt="License" />
</p>

<br />

<!-- screenshot: hero-graph-view -->
<p align="center">
  <img src="docs/screenshots/hero.png" width="800" alt="VizLang showing a LangGraph agent with nodes lighting up during execution" />
</p>

<br />

---

<br />

## Why VizLang?

Building LangGraph agents is powerful. Debugging them shouldn't require `print()` statements and prayer.

VizLang gives you a visual, interactive debugger right inside VS Code. No cloud service. No API keys. No context switching. Just open your Python file and see your agent's architecture, execution flow, and state changes in real time.

<br />

## Features

### Visual Graph Canvas

See your agent's architecture at a glance. Nodes, edges, conditional branches, and loops rendered on an infinite canvas with drag, zoom, and auto-layout.

<!-- screenshot: graph-canvas -->

<br />

### Real-time Execution

Watch nodes light up green as they complete. Animated edges show data flowing through your graph. See exactly where your agent is at any moment.

<!-- screenshot: execution-animation -->

<br />

### Step-by-step Debugging

Pause after each node. Inspect the full state. Click "Next" to advance one step, or "Continue All" to let it run. Like a line-by-line debugger, but for agent graphs.

<!-- screenshot: step-debugging -->

<br />

### Chat Interface

Talk to your agent directly. Send messages, see streaming responses, view tool calls. Supports multimodal input with images and files.

<!-- screenshot: chat-interface -->

<br />

### State Inspector

Hover any node to see the complete state snapshot at that point in execution. Scroll through large state objects without losing your place.

<!-- screenshot: state-inspector -->

<br />

### Human-in-the-Loop

When your agent hits an interrupt, VizLang shows the decision inline. Approve, reject, or provide input without leaving VS Code.

<!-- screenshot: hitl-interrupt -->

<br />

### Schema-aware Input

VizLang reads your graph's state schema and pre-fills the input form. No more guessing what JSON shape your graph expects.

<!-- screenshot: json-input -->

<br />

### Thread Management

Create threads, switch between conversations, clear history. Each thread maintains its own state and checkpoint history.

<!-- screenshot: threads -->

<br />

## Quick Start

### 1. Install

Search for **VizLang** in the VS Code Extensions marketplace, or:

```
code --install-extension vizlang.vizlang
```

<a name="install"></a>

### 2. Open a Python file

Open any Python file that contains a compiled LangGraph `StateGraph`:

```python
from langgraph.graph import START, END, StateGraph
from typing import TypedDict, Annotated
import operator

class State(TypedDict):
    messages: Annotated[list[str], operator.add]
    count: int

def step_one(state: State):
    return {"messages": ["Step 1 done"], "count": state["count"] + 1}

def step_two(state: State):
    return {"messages": ["Step 2 done"]}

builder = StateGraph(State)
builder.add_node("step_one", step_one)
builder.add_node("step_two", step_two)
builder.add_edge(START, "step_one")
builder.add_edge("step_one", "step_two")
builder.add_edge("step_two", END)

graph = builder.compile()
```

### 3. Launch VizLang

Click the **VizLang** button in the editor title bar. Or right-click the file and select **"Open in VizLang"**.

Your graph appears instantly. Click **Run** or **Step** to execute.

<br />

## What works

- [x] Graph visualization (nodes, edges, conditional branches, loops)
- [x] Auto-layout with dagre
- [x] Node dragging and canvas zoom/pan
- [x] Run execution with streaming
- [x] Step-by-step debugging (pause after each node)
- [x] Chat interface with streaming responses
- [x] State inspection on node hover
- [x] Human-in-the-loop interrupt handling
- [x] Thread create / switch / clear
- [x] Schema-aware JSON input
- [x] Multimodal input (images, audio, files)
- [x] Edge waypoints (double-click to add, drag to reroute)
- [x] Export graph as PNG
- [x] Multiple graph support (select from dropdown)
- [x] Drag-and-drop Python files
- [x] Dark and light theme support
- [x] Background dots toggle
- [x] Minimap

<br />

## Requirements

| Requirement | Version |
|---|---|
| VS Code | 1.85+ |
| Python | 3.10+ |
| langgraph | 0.2+ |
| langchain-core | 0.3+ |

Install Python dependencies:

```
pip install langgraph langchain-core
```

<br />

## Keyboard Shortcuts

| Action | Shortcut |
|---|---|
| Load Graph | `Ctrl+Shift+P` → "VizLang: Load Graph" |
| Run | Click **Run** in toolbar |
| Step | Click **Step** in toolbar |
| Submit input | `Ctrl+Enter` |
| Cancel input | `Escape` |
| Send chat message | `Enter` |
| New line in chat | `Shift+Enter` |

<br />

## How it works

VizLang spawns a Python subprocess that loads your LangGraph file, extracts the compiled graph, and communicates via JSON-RPC over stdin/stdout. The graph structure is rendered using React Flow in a VS Code webview. Execution uses LangGraph's `stream()` API with `values` and `updates` modes for real-time node status and state inspection.

No data leaves your machine. No cloud. No accounts.

<br />

## Contributing

Found a bug? Have an idea? [Open an issue](https://github.com/anthropics/vizlang/issues).

<br />

## License

MIT
