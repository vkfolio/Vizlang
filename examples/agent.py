from lutils import init_env

init_env()


from langgraph.graph import START, END, StateGraph
from typing import TypedDict, Annotated
from langchain.chat_models import init_chat_model
import operator
from langchain.messages import HumanMessage, AnyMessage

llm = init_chat_model("gpt-5-nano", model_provider="openai")


class State(TypedDict):
    messages: Annotated[list[AnyMessage], operator.add]


def chatLLM(state: State):
    resp = llm.invoke(state["messages"])
    return {"messages": [resp]}


builder = StateGraph(State)
builder.add_node("chatllm", chatLLM)

builder.add_edge(START, "chatllm")
builder.add_edge("chatllm", END)

graph = builder.compile()
