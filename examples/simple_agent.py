"""
Simple LangGraph agent for testing VizLang.
This example doesn't require any API keys - it uses mock responses.
"""

from typing import TypedDict, Annotated
from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages


class AgentState(TypedDict):
    messages: Annotated[list, add_messages]
    next_action: str


def greeter(state: AgentState) -> dict:
    """First node: greets the user."""
    last_msg = state["messages"][-1] if state["messages"] else None
    content = last_msg.content if hasattr(last_msg, "content") else str(last_msg)
    return {
        "messages": [{"role": "assistant", "content": f"Hello! You said: {content}"}],
        "next_action": "analyze",
    }


def analyzer(state: AgentState) -> dict:
    """Second node: analyzes the message."""
    last_msg = state["messages"][-1] if state["messages"] else None
    content = last_msg.content if hasattr(last_msg, "content") else str(last_msg)
    word_count = len(content.split())
    return {
        "messages": [
            {
                "role": "assistant",
                "content": f"Analysis: Your message has {word_count} words.",
            }
        ],
        "next_action": "respond",
    }


def responder(state: AgentState) -> dict:
    """Third node: generates final response."""
    return {
        "messages": [
            {
                "role": "assistant",
                "content": "Thanks for chatting! That's my analysis complete.",
            }
        ],
        "next_action": "done",
    }


# Build the graph
builder = StateGraph(AgentState)
builder.add_node("greeter", greeter)
builder.add_node("analyzer", analyzer)
builder.add_node("responder", responder)

builder.add_edge(START, "greeter")
builder.add_edge("greeter", "analyzer")
builder.add_edge("analyzer", "responder")
builder.add_edge("responder", END)

graph = builder.compile()
