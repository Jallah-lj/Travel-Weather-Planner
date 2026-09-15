from typing import Any

def success(data: Any, meta: dict[str, Any] | None = None) -> dict[str, Any]:
    return {"success": True, "data": data, "meta": meta or {}}

def error(code: str, message: str) -> dict[str, Any]:
    return {"success": False, "error": {"code": code, "message": message}}
