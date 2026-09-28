#!/usr/bin/env python3
# Usage: python3 scripts/check-thai.py [files...]  (default: all of src/). Exit 1 if suspicious Thai is found.
# Flags suspicious Thai: repeated combining marks, two tone marks in a row, or a combining mark with no base consonant.
import re, sys, glob
COMB = "ัิีึืฺุู็่้๊๋์ํ๎"
TONE = "่้๊๋"
pats = [re.compile("([%s])\\1" % COMB), re.compile("[%s][%s]" % (TONE, TONE)), re.compile("(^|[^ก-ฮ%s])[%s]" % (COMB, COMB))]
bad = 0
import os
files = []
for arg in sys.argv[1:] or ["src"]:
    files += glob.glob(os.path.join(arg, "**/*.*"), recursive=True) if os.path.isdir(arg) else [arg]
for f in files:
    for n, line in enumerate(open(f, encoding="utf-8"), 1):
        if any(p.search(line) for p in pats):
            bad += 1; print(f"{f}:{n}: {line.strip()[:120]}")
print("suspicious lines:", bad)
sys.exit(1 if bad else 0)
