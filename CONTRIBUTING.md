# Contributing to VizLang

Thanks for your interest in contributing! VizLang is an open-source project and we welcome contributions of all kinds.

## Development Setup

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Python](https://python.org/) 3.10+
- [VS Code](https://code.visualstudio.com/) 1.85+

### Getting started

```bash
# Clone the repo
git clone https://github.com/anthropics/vizlang.git
cd vizlang

# Install dependencies
npm install

# Install Python dependencies
pip install langgraph langchain-core

# Build
npm run build

# Launch Extension Host (press F5 in VS Code)
```

### Project Structure

```
vizlang/
├── src/                    # VS Code extension (TypeScript)
│   ├── extension.ts        # Entry point
│   ├── providers/          # Webview providers
│   ├── bridge/             # Python bridge communication
│   ├── commands/           # VS Code commands
│   └── services/           # Graph service layer
├── webview/                # React webview (the UI)
│   ├── components/
│   │   ├── graph/          # Graph canvas, nodes, edges, toolbar
│   │   └── chat/           # Chat interface
│   ├── stores/             # Zustand state management
│   ├── hooks/              # React hooks
│   └── bridge/             # Webview ↔ extension messaging
├── python/                 # Python bridge (runs LangGraph)
│   ├── vizlang_bridge.py   # JSON-RPC server
│   ├── graph_loader.py     # Graph loading & schema extraction
│   ├── run_executor.py     # Execution & streaming
│   └── utils.py            # Serialization utilities
├── shared/                 # Shared types (protocol)
├── examples/               # Example LangGraph agents
└── docs/                   # Documentation & screenshots
```

### Architecture

```
VS Code Extension  ←→  Python Bridge  ←→  LangGraph
   (TypeScript)          (JSON-RPC)        (Python)
       ↕
  React Webview
   (React Flow)
```

- **Extension host** (`src/`) manages the webview lifecycle, spawns the Python subprocess, and routes messages.
- **Webview** (`webview/`) renders the graph canvas and chat interface using React Flow and Zustand.
- **Python bridge** (`python/`) loads the user's Python file, extracts compiled graphs, and runs `graph.stream()`.
- **Communication** is JSON-RPC over stdin/stdout between the extension and Python.

### Build Commands

```bash
npm run build          # Full build (TypeScript check + Vite + extension)
npm run dev            # Watch mode for development
npx vsce package       # Package as .vsix for local install
```

## Making Changes

### Before you start

1. Check [existing issues](../../issues) to avoid duplicating work
2. For large changes, open an issue first to discuss the approach
3. Fork the repo and create a branch from `main`

### Code style

- **TypeScript** — follow the existing patterns. No semicolons needed (project uses them, stay consistent).
- **Python** — standard Python conventions. Type hints encouraged.
- **React** — functional components with hooks. Zustand for state.
- **CSS** — Tailwind utility classes. Use CSS variables for theming (see `webview/styles/`).

### Theming

All colors must use CSS variables, never hardcoded hex values. This ensures dark/light theme support.

```css
/* Good */
color: var(--foreground);
background: var(--card);

/* Bad */
color: #ffffff;
background: #1a1a2e;
```

### Testing your changes

1. Press `F5` in VS Code to launch the Extension Development Host
2. Open one of the example files in `examples/`
3. Right-click → "Open in VizLang"
4. Verify your changes work in both dark and light themes

### Commit messages

Keep them short and descriptive:

```
fix: edge rendering in horizontal layout
feat: add PNG export with tight bounds
docs: update contributing guide
```

### Pull requests

1. Keep PRs focused — one feature or fix per PR
2. Include a brief description of what changed and why
3. Add screenshots for UI changes
4. Make sure `npm run build` passes

## What to Work On

### Good first issues

Look for issues labeled [`good first issue`](../../labels/good%20first%20issue). These are scoped, well-defined tasks ideal for getting familiar with the codebase.

### Feature ideas

Check the [Roadmap](README.md#roadmap) for planned features. If you want to tackle one, comment on the related issue (or create one) so we can coordinate.

### Areas that need help

- **Testing** — unit and integration tests
- **Documentation** — tutorials, guides, API docs
- **Examples** — sample LangGraph agents for different patterns
- **Accessibility** — keyboard navigation, screen reader support
- **Performance** — large graph rendering optimization

## Questions?

- Open a [discussion](../../discussions) for general questions
- Open an [issue](../../issues) for bugs or feature requests

Thanks for helping make LangGraph development better!
