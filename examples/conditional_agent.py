"""
LangGraph with conditional routing for testing VizLang.
No API keys needed - uses mock logic.
"""

from typing import TypedDict, Annotated, Literal
from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages


class State(TypedDict):
    messages: Annotated[list, add_messages]
    sentiment: str
    category: str


def classifier(state: State) -> dict:
    """Classifies the input message."""
    last_msg = state["messages"][-1] if state["messages"] else None
    content = (last_msg.content if hasattr(last_msg, "content") else str(last_msg)).lower()

    # Simple keyword-based classification
    if any(w in content for w in ["help", "issue", "problem", "bug", "error"]):
        category = "support"
    elif any(w in content for w in ["price", "buy", "cost", "plan", "upgrade"]):
        category = "sales"
    else:
        category = "general"

    # Simple sentiment
    if any(w in content for w in ["angry", "terrible", "worst", "hate", "awful"]):
        sentiment = "negative"
    elif any(w in content for w in ["love", "great", "awesome", "thanks", "amazing"]):
        sentiment = "positive"
    else:
        sentiment = "neutral"

    return {
        "messages": [{"role": "assistant", "content": f"Classified as: {category} ({sentiment})"}],
        "sentiment": sentiment,
        "category": category,
    }


def route_by_category(state: State) -> Literal["support_handler", "sales_handler", "general_handler"]:
    """Routes to the appropriate handler based on category."""
    category = state.get("category", "general")
    if category == "support":
        return "support_handler"
    elif category == "sales":
        return "sales_handler"
    else:
        return "general_handler"


def support_handler(state: State) -> dict:
    """Handles support inquiries."""
    is_negative = state.get("sentiment") == "negative"
    if is_negative:
        msg = "I'm sorry you're having trouble. Let me escalate this to our support team right away."
    else:
        msg = "I'd be happy to help! Let me look into that for you."
    return {"messages": [{"role": "assistant", "content": msg}]}


def sales_handler(state: State) -> dict:
    """Handles sales inquiries."""
    return {
        "messages": [
            {
                "role": "assistant",
                "content": "Great question about our pricing! We have three plans: Starter ($9/mo), Pro ($29/mo), and Enterprise (custom).",
            }
        ]
    }


def general_handler(state: State) -> dict:
    """Handles general inquiries."""
    return {
        "messages": [
            {
                "role": "assistant",
                "content": "Thanks for reaching out! How can I assist you today?",
            }
        ]
    }


def summarizer(state: State) -> dict:
    """Final node: summarizes the conversation."""
    msg_count = len(state.get("messages", []))
    return {
        "messages": [
            {
                "role": "assistant",
                "content": f"Conversation summary: {msg_count} messages exchanged. Category: {state.get('category', 'unknown')}. Sentiment: {state.get('sentiment', 'unknown')}.",
            }
        ]
    }


# Build the graph
builder = StateGraph(State)
builder.add_node("classifier", classifier)
builder.add_node("support_handler", support_handler)
builder.add_node("sales_handler", sales_handler)
builder.add_node("general_handler", general_handler)
builder.add_node("summarizer", summarizer)

builder.add_edge(START, "classifier")
builder.add_conditional_edges("classifier", route_by_category)
builder.add_edge("support_handler", "summarizer")
builder.add_edge("sales_handler", "summarizer")
builder.add_edge("general_handler", "summarizer")
builder.add_edge("summarizer", END)

graph = builder.compile()
