---
name: explore-codebase
description: Navigate and understand codebase structure using Graphify
---

## Explore Codebase

Use Graphify to explore and understand the codebase.

### Steps

1. Run `graphify query "<question>"` for broad context.
2. Use `graphify path "<A>" "<B>"` to trace relationships.
3. Use `graphify explain "<concept>"` for focused concepts.
4. Read `graphify-out/GRAPH_REPORT.md` for a broader architecture view when needed.

### Tips

- Start broad (stats, architecture) then narrow down to specific areas.
- Prefer the graph before Grep/Glob/Read.
- Refresh the graph with `graphify update .` after code changes.
