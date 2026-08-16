# Git Methodology

This document defines how the team uses git for Wits Quest, per COMS3011A's Sprint 1 requirements. Based on [Lecture 2: Collaborative Software Development](https://sdp.ms.wits.ac.za) (Brendan Griffiths, 30 July 2026).

## Branching strategy

We use a simplified **GitHub-flow**-style model with one addition: a `dev` staging branch, so `main` always stays stable and demoable.

- **`main`** — always stable. Only updated at the end of each Sprint milestone, tagged accordingly (see Versioning below). Never commit directly to `main`.
- **`dev`** — the active integration branch. All feature branches merge into `dev` via reviewed Pull Request. This is our day-to-day working branch.
- **`feat/<short-description>`** (or `fix/`, `chore/`, etc.) — one branch per user story or task, branched off `dev`.

Reference: [GitHub-flow](https://docs.github.com/en/get-started/using-github/github-flow) (same workflow, works identically on Gitea).

## Branch naming

Format: `type/short-description`, lowercase, hyphen-separated.

Types:
- `feat/` — new feature or user story
- `fix/` — bug fix
- `chore/` — tooling, config, non-feature work
- `docs/` — documentation only
- `test/` — adding or fixing tests

Examples: `feat/visitor-map-access`, `fix/location-radius-check`, `docs/api-reference`.

## When to branch

One branch per user story (see the Issues tab / Sprint 1 board). Keeps Pull Requests small and reviewable. Don't bundle multiple unrelated stories into one branch.

## Commits

We follow **[Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/)**:

```
<type>: <short description>

[optional longer body]

Assisted-by: <tool>[<model>]   (only if AI was used for this commit)
```

Types: `feat`, `fix`, `docs`, `chore`, `test`, `refactor`.

**Commit atomically** — each commit should represent one coherent unit of work that leaves the repo in a working state. Avoid bulk "end of day" dumps; avoid vague messages like `fix stuff` or `wip`.

## Pull Requests / merge requirements

Every PR merges `feat/... → dev` (or, at milestone points, `dev → main`).

Before merging, a PR must:
1. Have at least **one teammate's review and approval**
2. **Pass CI** (lint + automated tests)
3. Actually do what its description claims — reviewer should verify, not rubber-stamp
4. Be linked to its corresponding issue (e.g. `Closes #4`)

Once approved and merged, move the card on the Sprint 1 board from **In Review → Done**.

## Board workflow

Our Gitea Project board (`Wits Quest - Sprint 1`) has these columns:

- **Backlog** — not yet started
- **In Progress** — actively being worked on
- **In Review** — PR opened, awaiting review
- **Done** — merged into `dev`

Move your own card when your status changes — don't wait for someone else to do it.

## Versioning

We tag `main` at the end of each Sprint milestone using a simplified semantic scheme:

| Milestone | Tag |
|---|---|
| Sprint 1 | `v0.1.0` |
| Sprint 2 | `v0.2.0` |
| Sprint 3 | `v0.3.0` |
| Final Submission | `v1.0.0` |

Reference: [Semantic Versioning](https://semver.org).

The most important rule, per the lecture: **be consistent**. Don't mix schemes mid-project.
