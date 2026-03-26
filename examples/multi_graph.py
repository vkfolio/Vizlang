"""
File with multiple LangGraph graphs for testing multi-graph detection.
No API keys needed.
"""

from typing import TypedDict, Annotated, Literal
from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages


# ═══════════════════════════════════════
# Graph 1: Simple Echo Bot
# ═══════════════════════════════════════

class EchoState(TypedDict):
    messages: Annotated[list, add_messages]


def echo(state: EchoState) -> dict:
    last = state["messages"][-1] if state["messages"] else None
    content = last.content if hasattr(last, "content") else str(last)
    return {"messages": [{"role": "assistant", "content": f"Echo: {content}"}]}


echo_builder = StateGraph(EchoState)
echo_builder.add_node("echo", echo)
echo_builder.add_edge(START, "echo")
echo_builder.add_edge("echo", END)

echo_graph = echo_builder.compile()


# ═══════════════════════════════════════
# Graph 2: Calculator Pipeline
# ═══════════════════════════════════════

class CalcState(TypedDict):
    input_number: int
    doubled: int
    squared: int
    result: str


def doubler(state: CalcState) -> dict:
    return {"doubled": state["input_number"] * 2}


def squarer(state: CalcState) -> dict:
    return {"squared": state["doubled"] ** 2}


def formatter(state: CalcState) -> dict:
    return {
        "result": f"Input: {state['input_number']} → Doubled: {state['doubled']} → Squared: {state['squared']}"
    }


calc_builder = StateGraph(CalcState)
calc_builder.add_node("doubler", doubler)
calc_builder.add_node("squarer", squarer)
calc_builder.add_node("formatter", formatter)
calc_builder.add_edge(START, "doubler")
calc_builder.add_edge("doubler", "squarer")
calc_builder.add_edge("squarer", "formatter")
calc_builder.add_edge("formatter", END)

calc_graph = calc_builder.compile()


# ═══════════════════════════════════════
# Graph 3: Branching Workflow
# ═══════════════════════════════════════

class WorkflowState(TypedDict):
    task: str
    priority: str
    result: str


def intake(state: WorkflowState) -> dict:
    task = state.get("task", "").lower()
    if "urgent" in task or "asap" in task:
        priority = "high"
    elif "when you can" in task or "low" in task:
        priority = "low"
    else:
        priority = "medium"
    return {"priority": priority}


def route_priority(state: WorkflowState) -> Literal["fast_track", "normal_track", "backlog"]:
    p = state.get("priority", "medium")
    if p == "high":
        return "fast_track"
    elif p == "low":
        return "backlog"
    return "normal_track"


def fast_track(state: WorkflowState) -> dict:
    return {"result": f"FAST TRACKED: {state['task']}"}


def normal_track(state: WorkflowState) -> dict:
    return {"result": f"Processing normally: {state['task']}"}


def backlog(state: WorkflowState) -> dict:
    return {"result": f"Added to backlog: {state['task']}"}


wf_builder = StateGraph(WorkflowState)
wf_builder.add_node("intake", intake)
wf_builder.add_node("fast_track", fast_track)
wf_builder.add_node("normal_track", normal_track)
wf_builder.add_node("backlog", backlog)
wf_builder.add_edge(START, "intake")
wf_builder.add_conditional_edges("intake", route_priority)
wf_builder.add_edge("fast_track", END)
wf_builder.add_edge("normal_track", END)
wf_builder.add_edge("backlog", END)

workflow_graph = wf_builder.compile()
