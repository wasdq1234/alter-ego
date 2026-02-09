import os
from typing import AsyncIterator

from langchain_core.messages import SystemMessage
from langchain_openai import ChatOpenAI
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.graph import StateGraph, MessagesState, START, END

memory = InMemorySaver()


def _build_llm() -> ChatOpenAI:
    return ChatOpenAI(
        model=os.environ.get("OPENAI_MODEL", "gpt-4o-mini"),
        temperature=0.7,
        streaming=True,
    )


def chat_node(state: MessagesState) -> dict:
    """LLM을 호출하여 응답 생성."""
    llm = _build_llm()
    response = llm.invoke(state["messages"])
    return {"messages": [response]}


# 그래프 구성
graph = StateGraph(MessagesState)
graph.add_node("chat", chat_node)
graph.add_edge(START, "chat")
graph.add_edge("chat", END)

chat_graph = graph.compile(checkpointer=memory)


async def stream_chat(
    system_prompt: str,
    user_message: str,
    thread_id: str,
) -> AsyncIterator[str]:
    """페르소나 system_prompt + 유저 메시지로 스트리밍 응답 생성."""
    config = {"configurable": {"thread_id": thread_id}}

    # 첫 메시지일 때만 system prompt 주입
    state = await chat_graph.aget_state(config)
    messages = []
    if not state.values.get("messages"):
        messages.append(SystemMessage(content=system_prompt))
    messages.append({"role": "user", "content": user_message})

    async for event in chat_graph.astream_events(
        {"messages": messages},
        config=config,
        version="v2",
    ):
        if event["event"] == "on_chat_model_stream":
            chunk = event["data"]["chunk"]
            if chunk.content:
                yield chunk.content
