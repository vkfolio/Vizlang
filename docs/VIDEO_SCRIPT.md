# VizLang — Product Demo Video Script

**Duration:** 2:30
**Style:** Screen recording with minimal narration overlay. No face cam. Clean, focused, fast-paced.
**Music:** Lo-fi ambient / soft electronic (e.g., Epidemic Sound "Tech Product" category)
**Resolution:** 1920x1080, 60fps
**Tool:** OBS or built-in screen recorder

---

## Pre-recording Setup

1. VS Code with **dark theme** (One Dark Pro or default dark)
2. **Hide all sidebars** except the editor — clean workspace
3. Font size bumped to **16px** so text is readable in video
4. Have these files ready:
   - `examples/simple_agent.py` (linear: START → greeter → analyzer → responder → END)
   - `examples/tool_agent.py` (agent with tools + conditional routing)
   - `examples/hitl_agent.py` (human-in-the-loop interrupt)
5. **Close all other tabs** — only VizLang should be visible
6. Terminal hidden

---

## Script

### SCENE 1 — Hook (0:00 - 0:08)

**[Screen: VS Code with a Python file open]**

**Text overlay (center, large, fade in):**
> "What if you could *see* your LangGraph agent think?"

*Hold 3 seconds, fade out.*

---

### SCENE 2 — Open VizLang (0:08 - 0:20)

**[Action: Right-click `simple_agent.py` → "Open in VizLang"]**

The graph appears: START → greeter → analyzer → responder → END, perfectly laid out.

**Text overlay (bottom):**
> "Open any Python file with a LangGraph. One click."

*Pause 2 seconds to let viewer absorb the graph.*

**[Action: Zoom in on nodes, pan around the canvas, zoom back out]**

---

### SCENE 3 — Run Execution (0:20 - 0:45)

**[Action: Click "Run" button → type `{"messages": ["hello"]}` in JSON input → press Ctrl+Enter]**

Nodes light up green one by one: START → greeter (animating) → greeter (green check) → analyzer → responder → END.

**Text overlay:**
> "Watch execution flow through every node in real time."

**[Action: Hover over "greeter" node]**

State tooltip appears showing the full state after that node ran.

**Text overlay:**
> "Hover any node to inspect its state."

*Hold 2 seconds on the tooltip.*

---

### SCENE 4 — Step Debugging (0:45 - 1:15)

**[Action: Click "Reload" icon to reset → Click "Step" → enter input → press Ctrl+Enter]**

Graph starts executing. After START completes, it pauses. Toolbar shows **"Next"** and **"Continue All"** buttons. Status shows "stepped".

**Text overlay:**
> "Step through your agent node by node. Like a debugger."

**[Action: Click "Next" three times, pausing briefly each time]**

Each click advances one node. The viewer sees: greeter lights up → paused → click Next → analyzer lights up → paused → click Next → responder → paused.

**[Action: Click "Continue All"]**

Remaining nodes run to completion. END turns green.

**Text overlay:**
> "Continue All to let it finish."

---

### SCENE 5 — Switch to Chat (1:15 - 1:40)

**[Action: Click the "Chat" tab]**

Chat interface appears with the conversation from the run.

**[Action: Type "What's the weather in Tokyo?" → press Enter]**

Message appears on the right (user bubble). Thinking indicator shows. AI response streams in on the left.

**Text overlay:**
> "Chat with your agent. See streaming responses."

**[Action: Switch back to "Graph" tab]**

Graph shows the execution that just happened — nodes are green.

**Text overlay:**
> "Switch between Graph and Chat anytime."

---

### SCENE 6 — Tool Agent with Conditional Routing (1:40 - 2:00)

**[Action: Click the "Open file" icon → select `tool_agent.py`]**

A more complex graph loads: START → agent → (conditional) → tools / END, with a loop from tools back to agent.

**Text overlay:**
> "Works with any graph. Conditionals, loops, tool calls."

**[Action: Click "Run" → enter `{"messages": [{"type": "human", "content": "search for Python tutorials"}]}` → Ctrl+Enter]**

Watch execution: agent → tools (loops) → agent → END. Conditional edges animate with purple dashes.

---

### SCENE 7 — Human-in-the-Loop (2:00 - 2:15)

**[Action: Open `hitl_agent.py` → Run]**

Graph executes until it hits an interrupt. An overlay appears asking for human approval.

**[Action: Type approval response → click "Submit"]**

Execution continues and completes.

**Text overlay:**
> "Human-in-the-loop. Approve decisions inline."

---

### SCENE 8 — Closing (2:15 - 2:30)

**[Screen: Pull back to show the full VizLang interface — graph on the left, chat conversation visible]**

**Text overlay (center, large, fade in):**
> **VizLang**
> Visual debugger for LangGraph agents.
>
> Free. Open source. In your editor.

**Text overlay (smaller, below):**
> Install from VS Code Marketplace

*Hold 3 seconds. Fade to black.*

---

## Recording Tips

1. **Mouse movement** — Move slowly and deliberately. Avoid jittery movements.
2. **Pauses** — Hold 1-2 seconds after each action so viewers can follow.
3. **No clicks off-screen** — Keep all actions within the VS Code window.
4. **Text overlays** — Add in post (CapCut, DaVinci Resolve, or even iMovie). Use a clean sans-serif font (Inter, SF Pro). White text with slight drop shadow.
5. **Transitions** — Simple cross-dissolve between scenes. No flashy transitions.
6. **Speed** — Record at normal speed, then speed up boring parts (like waiting for LLM responses) to 2-4x in post.
7. **Crop** — If your screen has distracting elements, crop to just the VS Code window.

## Post-production Checklist

- [ ] Add background music (low volume, ambient)
- [ ] Add text overlays at timestamps above
- [ ] Speed up LLM response wait times (2-4x)
- [ ] Add VizLang logo at the end
- [ ] Export at 1080p 60fps
- [ ] Upload to YouTube, embed in landing page
- [ ] Create 15-second clip for Twitter/X
