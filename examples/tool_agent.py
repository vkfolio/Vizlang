"""
Tool-calling agent example for VizLang.
Demonstrates an agent that uses tools (web search, calculator)
and shows tool call/result messages in the chat panel.
"""

from lutils import init_env
init_env()

from typing import TypedDict, Annotated
from langchain.chat_models import init_chat_model
from langchain_core.messages import AnyMessage
from langchain_core.tools import tool
from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode


# --- Tools ---

@tool
def calculator(expression: str) -> str:
    """Evaluate a math expression. Use this for any arithmetic calculations."""
    try:
        result = eval(expression, {"__builtins__": {}}, {})
        return f"{expression} = {result}"
    except Exception as e:
        return f"Error evaluating '{expression}': {e}"


@tool
def get_weather(city: str) -> str:
    """Get the current weather for a city."""
    # Mock weather data
    weather_data = {
        "new york": "72°F, Partly Cloudy",
        "london": "58°F, Rainy",
        "tokyo": "68°F, Clear",
        "paris": "64°F, Overcast",
        "sydney": "77°F, Sunny",
    }
    result = weather_data.get(city.lower(), f"65°F, Clear (no data for {city})")
    return f"Weather in {city}: {result}"


@tool
def search_knowledge(query: str) -> str:
    """Search a knowledge base for information."""
    # Mock search results
    results = {
        "python": "Python is a high-level programming language created by Guido van Rossum in 1991.",
        "langgraph": "LangGraph is a framework for building stateful, multi-actor applications with LLMs.",
        "langchain": "LangChain is a framework for developing applications powered by language models.",
    }
    for key, value in results.items():
        if key in query.lower():
            return value
    return f"No results found for: {query}"


# --- State ---

class AgentState(TypedDict):
    messages: Annotated[list[AnyMessage], add_messages]


# --- Nodes ---

tools = [calculator, get_weather, search_knowledge]
llm = init_chat_model("gpt-5-nano", model_provider="openai").bind_tools(tools)


def agent(state: AgentState) -> dict:
    """Call the LLM which may decide to use tools."""
    response = llm.invoke(state["messages"])
    return {"messages": [response]}


def should_continue(state: AgentState) -> str:
    """Route to tools if the last message has tool calls, else end."""
    last_message = state["messages"][-1]
    if hasattr(last_message, "tool_calls") and last_message.tool_calls:
        return "tools"
    return END


# --- Graph ---

tool_node = ToolNode(tools)

builder = StateGraph(AgentState)
builder.add_node("agent", agent)
builder.add_node("tools", tool_node)

builder.add_edge(START, "agent")
builder.add_conditional_edges("agent", should_continue, {"tools": "tools", END: END})
builder.add_edge("tools", "agent")

graph = builder.compile()
