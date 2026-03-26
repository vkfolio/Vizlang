"""
Serialization helpers for converting LangGraph objects to JSON-safe values.
"""

import json
from typing import Any
from datetime import datetime
from enum import Enum


def serialize(obj: Any) -> Any:
    """JSON default serializer for non-standard types."""
    if isinstance(obj, datetime):
        return obj.isoformat()
    if isinstance(obj, Enum):
        return obj.value
    if isinstance(obj, bytes):
        return obj.decode("utf-8", errors="replace")
    if isinstance(obj, set):
        return list(obj)
    if hasattr(obj, "__dict__"):
        return {k: v for k, v in obj.__dict__.items() if not k.startswith("_")}
    if hasattr(obj, "model_dump"):
        return obj.model_dump()
    if hasattr(obj, "dict"):
        return obj.dict()
    return str(obj)


def serialize_value(value: Any) -> Any:
    """
    Recursively serialize a value to be JSON-safe.
    Handles LangChain message objects, Pydantic models, etc.
    """
    if value is None or isinstance(value, (bool, int, float, str)):
        return value

    if isinstance(value, dict):
        return {str(k): serialize_value(v) for k, v in value.items()}

    if isinstance(value, (list, tuple)):
        return [serialize_value(item) for item in value]

    if isinstance(value, set):
        return [serialize_value(item) for item in value]

    if isinstance(value, datetime):
        return value.isoformat()

    if isinstance(value, Enum):
        return value.value

    if isinstance(value, bytes):
        return value.decode("utf-8", errors="replace")

    # LangChain message objects
    if hasattr(value, "type") and hasattr(value, "content"):
        result: dict[str, Any] = {
            "type": getattr(value, "type", "unknown"),
            "content": serialize_value(getattr(value, "content", "")),
        }
        if hasattr(value, "tool_calls"):
            result["tool_calls"] = serialize_value(value.tool_calls)
        if hasattr(value, "name"):
            result["name"] = value.name
        if hasattr(value, "id"):
            result["id"] = value.id
        if hasattr(value, "additional_kwargs"):
            result["additional_kwargs"] = serialize_value(value.additional_kwargs)
        return result

    # Pydantic models
    if hasattr(value, "model_dump"):
        return serialize_value(value.model_dump())
    if hasattr(value, "dict"):
        return serialize_value(value.dict())

    # Dataclasses
    if hasattr(value, "__dataclass_fields__"):
        return serialize_value({k: getattr(value, k) for k in value.__dataclass_fields__})

    # Named tuples
    if hasattr(value, "_asdict"):
        return serialize_value(value._asdict())

    # Fallback
    try:
        json.dumps(value)
        return value
    except (TypeError, ValueError):
        return str(value)
