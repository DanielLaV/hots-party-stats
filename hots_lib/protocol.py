"""Resolves the heroprotocol version for a replay build, falling back to the
nearest older bundled version for builds heroprotocol hasn't published yet
(https://github.com/Blizzard/heroprotocol) -- the wire format rarely changes
between adjacent patches, so this keeps parsing working without needing
heroprotocol updated immediately after every game patch."""

import os
import re
import shutil
import sys

from heroprotocol import versions as hp_versions

_VERSIONS_DIR = os.path.dirname(hp_versions.__file__)
_protocol_cache = {}


def get_protocol(base_build):
    if base_build in _protocol_cache:
        return _protocol_cache[base_build]

    try:
        protocol = hp_versions.build(base_build)
        _protocol_cache[base_build] = protocol
        return protocol
    except Exception:
        pass

    available = []
    for f in os.listdir(_VERSIONS_DIR):
        m = re.match(r"protocol(\d+)\.py$", f)
        if m:
            available.append(int(m.group(1)))
    available.sort()
    lower = [b for b in available if b < base_build]
    if not lower:
        raise RuntimeError(f"No protocol available for build {base_build}, and none older to fall back to")
    nearest = lower[-1]

    src = os.path.join(_VERSIONS_DIR, f"protocol{nearest}.py")
    dst = os.path.join(_VERSIONS_DIR, f"protocol{base_build}.py")
    shutil.copyfile(src, dst)
    print(f"[protocol] build {base_build} not bundled; using protocol{nearest}.py as a stand-in", file=sys.stderr)

    protocol = hp_versions.build(base_build)
    _protocol_cache[base_build] = protocol
    return protocol
