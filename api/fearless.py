"""Persists the Fearless draft-tracker board so everyone viewing the
dashboard sees the same live picks, instead of each browser keeping its own
localStorage copy (see dashboard_src/js/fearless_view.js)."""
import os

from flask import Blueprint, jsonify, request

from auth import require_token
from storage import read_json, write_json_atomic

fearless_bp = Blueprint("fearless", __name__)

DATA_DIR = os.environ.get("API_DATA_DIR", "/data")
STATE_PATH = os.path.join(DATA_DIR, "fearless_state.json")
SLOTS = 5


def _empty_game():
    return {"our": [None] * SLOTS, "enemy": [None] * SLOTS}


def _default_state():
    return [_empty_game()]


def _valid_game(g):
    return (
        isinstance(g, dict)
        and isinstance(g.get("our"), list) and len(g["our"]) == SLOTS
        and isinstance(g.get("enemy"), list) and len(g["enemy"]) == SLOTS
    )


@fearless_bp.route("/api/fearless", methods=["GET"])
def get_fearless_state():
    return jsonify(read_json(STATE_PATH, _default_state()))


@fearless_bp.route("/api/fearless", methods=["PUT"])
@require_token
def set_fearless_state():
    state = request.get_json(silent=True)
    if not isinstance(state, list) or not state or not all(_valid_game(g) for g in state):
        return jsonify(error="Expected a non-empty list of {our: [5 heroes], enemy: [5 heroes]} games"), 400
    write_json_atomic(STATE_PATH, state)
    return jsonify(state)


@fearless_bp.route("/api/fearless/reset", methods=["POST"])
@require_token
def reset_fearless_state():
    state = _default_state()
    write_json_atomic(STATE_PATH, state)
    return jsonify(state)
