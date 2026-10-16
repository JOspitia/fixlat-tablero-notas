---
name: hu-implementation-flow
description: "Trigger: implementar HU, aplicar historia de usuario, work-unit commits, validación pre-commit, adversarial review. Coordina flujo de HU en dos ramas separadas (backend primero, frontend después) con validación obligatoria antes de commit y revisión adversarial al final de cada rama."
license: Apache-2.0
metadata:
  author: "jospitia"
  version: "1.0"
---

## Activation Contract

Load this skill on any HU implementation request in fixlat-tablero-notas: "implementar HU", "aplicar HU", "vamos con HU", "arrancar con HU", "implementar historia de usuario". Governs the end-to-end flow, not individual edits.

## Hard Rules

1. TWO branches per HU, in this strict order: `feature/hu-XX-backend` first (created from `main`), then `feature/hu-XX-frontend` (created from `main` AFTER the backend branch is merged). Backend FIRST because the frontend depends on the backend exposing the new API contract (e.g. shape/font_family/text_align fields).
2. MULTIPLE commits, one per logical work-unit (migration; model + resource + formrequest; frontend clip-path; editor controls). NOT one commit per file type.
3. VALIDATE BEFORE COMMIT. Writer runs lint/tests/sanity and reports `command: result` + diff stats + narrative summary. NO commit until the user explicitly approves.
4. APPROVAL GATE. User says "ok commitea" (or equivalent). Until then, NO `git add`, NO `git commit`.
5. COMMIT STYLE. Conventional Commits with the `<summary>` in neutral professional Spanish. NO voseo, NO slang, NO `Co-Authored-By`, NO AI attribution. Follow `git-artifacts-locale`.
6. ADVERSARIAL REVIEW RUNS SEPARATELY PER BRANCH. Adversarial review runs separately for backend branch (after all backend WUs committed, before merge) and for frontend branch (after all frontend WUs committed, before merge). Each branch has its own fix loop. Once every work-unit on a branch is committed, run `brainiac` over the full branch diff. Loop fix-and-resubmit until PASS, then merge to `main` before opening the next branch.
7. CODE MODE LIMITATION. The orchestrator has NO direct `bash`/`shell`/`read`/`write`. Delegate ALL implementation, validation, and git ops to the `general` sub-agent, which DOES have these tools. The orchestrator coordinates, reviews, and presents diffs to the user.

## Decision Gates

| User signal | Action |
|---|---|
| Approves commit ("ok commitea") | Delegate `git add` + `git commit` to `general`. |
| "faltó X" / "revisar" | Fix, re-validate, re-present. NO commit. |
| Changes scope mid-flow | STOP, re-plan work-units, present new plan, wait for OK. |
| `brainiac` FAIL | Enter fix loop. NO new features mid-fix. |
| `brainiac` PASS | Report branch ready for PR. |
| Branching split confirmado | Plan: backend WUs on feature/hu-XX-backend first → merge → frontend WUs on feature/hu-XX-frontend. |

## Execution Steps

1. Read the approved US file (e.g. `documents/HU-05-*.md`). Confirm scope with the orchestrator.
2. Delegate to `general`:
   a. `git fetch origin main`
   b. `git checkout -b feature/hu-XX-backend main`
   c. Implement backend work-units, get approvals, commit each.
   d. Once all backend work-units are committed and merged to main, create the frontend branch:
      `git checkout main && git pull && git checkout -b feature/hu-XX-frontend`
   e. Implement frontend work-units, get approvals, commit each.
3. Decompose the US into work-units. Present the plan and wait for OK.
4. For each work-unit delegate implementation to `general`. Sub-agent reports `command: result`, diff stats, narrative summary.
5. Orchestrator presents the summary. Wait for "ok commitea" or "faltó X".
6. On approval, delegate commit to `general` with a Conventional Commit, Spanish summary.
7. Once every work-unit is committed, delegate `brainiac` review of `git diff origin/main...HEAD`.
8. FAIL → fix loop. PASS → report ready for PR.

## Output Contract

After each work-unit: work-unit name, files changed, `command: result` validation, diff stats, narrative summary, explicit commit-approval request.

After the full block on PASS: branch name, list of commits, total diff stats, `brainiac` verdict, PR readiness.

## References

- `~/.config/opencode/skills/git-artifacts-locale/SKILL.md`
- `~/.config/opencode/skills/work-unit-commits/SKILL.md`
