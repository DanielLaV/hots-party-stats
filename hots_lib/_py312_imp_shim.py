"""heroprotocol (github.com/Blizzard/heroprotocol) still does `import imp` to
dynamically load its protocol*.py files by path, and `imp` was removed in
Python 3.12. This installs a minimal find_module/load_module replacement
backed by importlib, so the project works on 3.12+ without requiring an
older interpreter installed alongside it. No-ops if `imp` is still available
(Python 3.9-3.11)."""

import importlib.util
import os
import sys
import types

PY_SOURCE = 1


def _find_module(name, path=None):
    for directory in path or [os.getcwd()]:
        candidate = os.path.join(directory, name + ".py")
        if os.path.isfile(candidate):
            return open(candidate), candidate, (".py", "r", PY_SOURCE)
    raise ImportError(f"No module named {name!r}")


def _load_module(name, file, pathname, description):
    try:
        spec = importlib.util.spec_from_file_location(name, pathname)
        module = importlib.util.module_from_spec(spec)
        sys.modules[name] = module
        spec.loader.exec_module(module)
        return module
    finally:
        if file:
            file.close()


def install():
    try:
        import imp  # noqa: F401
        return
    except ImportError:
        pass

    shim = types.ModuleType("imp")
    shim.PY_SOURCE = PY_SOURCE
    shim.find_module = _find_module
    shim.load_module = _load_module
    sys.modules["imp"] = shim
