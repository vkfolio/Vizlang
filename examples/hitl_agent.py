"""
LangGraph with Human-in-the-Loop (HITL) for testing VizLang.
Demonstrates interrupt() for approval and input patterns.
No API keys needed.
"""

from typing import TypedDict, Annotated
from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages
from langgraph.types import interrupt, Command


class State(TypedDict):
    messages: Annotated[list, add_messages]
    approved: bool
    user_feedback: str


def planner(state: State) -> dict:
    """Plans an action and asks for human approval."""
    last_msg = state["messages"][-1] if state["messages"] else None
    content = last_msg.content if hasattr(last_msg, "content") else str(last_msg)

    plan = f"I plan to process your request: '{content}'. This will involve 3 steps."

    # Ask for human approval
    approval = interrupt({
        "question": "Do you approve this plan?",
        "plan": plan,
        "options": ["approve", "reject", "modify"],
    })

    approved = approval in ["approve", True, "yes"]

    return {
        "messages": [{"role": "assistant", "content": f"Plan: {plan}\nApproval: {approval}"}],
        "approved": approved,
    }


def executor(state: State) -> dict:
    """Executes the approved plan."""
    if not state.get("approved", False):
        return {
            "messages": [{"role": "assistant", "content": "Plan was rejected. Stopping."}],
        }

    # Simulate work
    return {
        "messages": [
            {"role": "assistant", "content": "Executing step 1/3... Done."},
            {"role": "assistant", "content": "Executing step 2/3... Done."},
            {"role": "assistant", "content": "Executing step 3/3... Done."},
        ],
    }


def reviewer(state: State) -> dict:
    """Asks for human feedback on the result."""
    # Ask for feedback
    feedback = interrupt({
        "question": "How was the result? Please provide feedback.",
        "type": "text_input",
    })

    return {
        "messages": [{"role": "assistant", "content": f"Thank you for your feedback: '{feedback}'"}],
        "user_feedback": str(feedback),
    }


def finalizer(state: State) -> dict:
    """Wraps up the conversation."""
    feedback = state.get("user_feedback", "none")
    return {
        "messages": [
            {
                "role": "assistant",
                "content": f"All done! Your feedback has been recorded: {feedback}",
            }
        ],
    }


# Build the graph
builder = StateGraph(State)
builder.add_node("planner", planner)
builder.add_node("executor", executor)
builder.add_node("reviewer", reviewer)
builder.add_node("finalizer", finalizer)

builder.add_edge(START, "planner")
builder.add_edge("planner", "executor")
builder.add_edge("executor", "reviewer")
builder.add_edge("reviewer", "finalizer")
builder.add_edge("finalizer", END)

graph = builder.compile()
