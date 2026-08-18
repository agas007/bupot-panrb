<!-- graphify MCP tools -->
## MCP Tools: Graphify

**IMPORTANT: This project has a knowledge graph. ALWAYS use the
Graphify tools BEFORE using Grep/Glob/Read to explore the codebase.**
The graph is faster, cheaper (fewer tokens), and gives you structural
context (callers, dependents, test coverage) that file scanning cannot.

### When to use graph tools FIRST

- **Exploring code**: `graphify query` instead of Grep
- **Understanding impact**: `graphify path` instead of manually tracing imports
- **Code review**: `graphify explain` plus query/path results instead of reading entire files
- **Finding relationships**: `graphify query` with callers_of/callees_of/imports_of/tests_for
- **Architecture questions**: `graphify query` and `graphify explain`

Fall back to Grep/Glob/Read **only** when the graph doesn't cover what you need.

### Key Tools

| Tool | Use when |
| ------ | ---------- |
| `graphify query` | Tracing callers, callees, imports, tests, dependencies |
| `graphify path` | Finding shortest relationships between concepts |
| `graphify explain` | Understanding a focused node or concept |

### Workflow

1. The graph auto-updates on file changes (via hooks).
2. Use `graphify query` for broad context.
3. Use `graphify path` to trace impact.
4. Use `graphify explain` for focused concepts.
