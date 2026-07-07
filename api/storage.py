"""Small generic JSON-file store, reusable by any future endpoint (e.g. a
replay-upload manifest) that just needs a persisted blob on disk without a
real database.

Locking is a single in-process threading.Lock, which is only safe because
the container runs a single gunicorn worker (see Dockerfile's CMD) -- a
second worker process wouldn't share this lock. If a future endpoint needs
concurrent writers across multiple processes, switch to a file lock
(fcntl.flock) instead."""
import json
import os
import tempfile
import threading

_lock = threading.Lock()


def read_json(path, default):
    if not os.path.exists(path):
        return default
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def write_json_atomic(path, data):
    with _lock:
        directory = os.path.dirname(path)
        os.makedirs(directory, exist_ok=True)
        fd, tmp_path = tempfile.mkstemp(dir=directory)
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as f:
                json.dump(data, f)
            os.replace(tmp_path, path)
        except BaseException:
            os.unlink(tmp_path)
            raise
