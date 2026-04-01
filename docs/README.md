# Design Documents

This folder contains the original design documents, specs, and build prompts used to develop Jobseek — entirely with AI-assisted development using [Claude Code](https://claude.ai/code).

They are kept here for transparency and as a reference for anyone learning AI-led development workflows.

## Documents

| # | Document | What It Covers |
|---|----------|----------------|
| 01 | [Build Plan](./01-build-plan.md) | The multi-phase Claude Code build plan — how the entire app was scaffolded, feature by feature |
| 02 | [Extension Build Prompt](./02-extension-build-prompt.md) | The prompt and spec used to build the Chrome extension for LinkedIn signal detection |
| 03 | [Apollo Integration Spec](./03-apollo-integration-spec.md) | People discovery API integration design (Apollo.io free tier) |
| 04 | [Signal Intelligence Spec](./04-signal-intelligence-spec.md) | The feature spec for network signal detection — problem statement, taxonomy, scoring |
| 05 | [Product Context](./05-product-context.md) | Strategic product context — ICP, positioning, core thesis |
| 06 | [Design System](./06-design-system.md) | Design tokens, color palette, typography, component patterns |
| 07 | [PRD v1](./07-prd-v1.docx) | Original product requirements document |
| 08 | [PRD Visual](./08-prd-visual.jsx) | Visual mockup of the product concept |

## How These Were Used

Each document served as input to Claude Code during development. The workflow was:

1. **Write the spec** — Define what to build, why, and the constraints
2. **Feed to Claude Code** — Use the spec as context for implementation
3. **Iterate in conversation** — Refine the output through back-and-forth
4. **Review and ship** — Verify the code, test, and commit

This is the same workflow described in the main [README](../README.md#how-it-was-built) and [ARCHITECTURE.md](../ARCHITECTURE.md).
