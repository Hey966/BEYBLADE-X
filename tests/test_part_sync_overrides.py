"""Offline checks for Hasbro package-backed catalog correction guard."""
from __future__ import annotations
import copy
import json
from pathlib import Path
import importlib.util

ROOT = Path(__file__).resolve().parents[1]
module = importlib.util.spec_from_file_location(
    "sync_part_abilities", ROOT / "tools" / "sync_part_abilities.py"
)
sync = importlib.util.module_from_spec(module)
module.loader.exec_module(sync)
verified = json.loads((ROOT / "data" / "part-stat-overrides.json").read_text("utf8"))
published = json.loads((ROOT / "data" / "part-abilities.json").read_text("utf8"))

def input_data(use_corrected: bool = False):
    result = {"beys": {}, "summary": {}}
    for owner, rec in verified["records"].items():
        parts = {}
        for kind, corrected in rec["parts"].items():
            stats = corrected if use_corrected else rec["originalCatalog"][kind]
            parts[kind] = {"available": True, "stats": dict(stats)}
        result["beys"][owner] = {"parts": parts}
    return result

original = input_data()
assert sync.apply_verified_overrides(original) == 4
assert original["summary"]["verifiedPartCorrections"] == 4
assert original["verifiedOverridesSource"] == "data/part-stat-overrides.json"
for owner, rec in verified["records"].items():
    for kind, desired in rec["parts"].items():
        item = original["beys"][owner]["parts"][kind]
        assert all(item["stats"][name] == value for name, value in desired.items())
        assert item["verification"]["originalCatalog"] == rec["originalCatalog"][kind]
        assert item["verification"]["sourceImage"].startswith("https://")
        assert published["beys"][owner]["parts"][kind]["stats"] == {
            **published["beys"][owner]["parts"][kind]["stats"], **desired
        }
already_fixed = input_data(use_corrected=True)
assert sync.apply_verified_overrides(already_fixed) == 4
assert already_fixed["beys"] == original["beys"], "corrections must be idempotent"
broken = input_data()
broken["beys"]["OWN-G3084-05"]["parts"]["blade"]["stats"]["attack"] = 97
try:
    sync.apply_verified_overrides(broken)
except RuntimeError as error:
    assert "Unexpected catalog change" in str(error)
else:
    raise AssertionError("unreviewed upstream corrections must be rejected")
print("Hasbro package evidence, 4 source overrides, idempotence and fail-closed passed.")
