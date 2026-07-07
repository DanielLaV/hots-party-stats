"""Shared-secret gate for write endpoints -- not real user auth, just enough
to stop a stranger who finds the URL from griefing the board (or, later,
spamming the replay-upload endpoint). The token ships in the dashboard's
embedded JSON (see build_dashboard.py), so anyone with devtools can read it;
this is a deterrent, not a security boundary."""
import os
from functools import wraps

from flask import jsonify, request

API_TOKEN = os.environ.get("FEARLESS_API_TOKEN", "")


def require_token(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        if not API_TOKEN:
            return jsonify(error="Server misconfigured: FEARLESS_API_TOKEN not set"), 500
        if request.headers.get("X-Api-Token") != API_TOKEN:
            return jsonify(error="Unauthorized"), 401
        return fn(*args, **kwargs)
    return wrapper
