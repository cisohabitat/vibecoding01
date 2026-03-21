# CLAUDE.md

This file provides guidance for AI assistants (Claude and others) working on this repository.

## Project Overview

**vibecoding01** is a vibe coding experiment — a project bootstrapped with AI assistance. It is currently in its initial setup phase with no specific technology stack committed yet.

- **Repository:** cisohabitat/vibecoding01
- **Default branch:** `main`
- **Status:** Early stage / greenfield

## Repository Structure

```
vibecoding01/
├── README.md      # Project overview
└── CLAUDE.md      # This file — AI assistant guidance
```

As the project grows, this file should be updated to reflect the actual structure.

## Git Workflow

### Branch Naming

- Feature branches for Claude: `claude/<description>-<session-id>`
- Always develop on the designated branch, never directly on `main` or `master`

### Commit Signing

Commits require GPG/SSH signing. The git config uses:
- GPG format: `ssh`
- Signing key: `/home/claude/.ssh/commit_signing_key.pub`
- Signing is enforced (`commit.gpgsign = true`)

Do not use `--no-gpg-sign` or `--no-verify` to bypass signing.

### Push Instructions

Always push with upstream tracking:
```bash
git push -u origin <branch-name>
```

If the push fails due to network errors, retry with exponential backoff (2s, 4s, 8s, 16s). Do not push to branches other than the one designated for your session.

### Pull Requests

After pushing, open a PR from your branch into `main`. Keep PR descriptions concise and include a summary of changes and a test plan.

## Development Conventions

Since this project is in its early stage, conventions will evolve. When the stack is chosen, update this file with:

- Language and framework version requirements
- Linting and formatting rules
- How to install dependencies
- How to run the development server
- How to run tests

### General Principles (apply until overridden)

- Keep changes minimal and focused — avoid over-engineering
- Prefer editing existing files over creating new ones
- Do not add unnecessary comments, docstrings, or type annotations to unchanged code
- Do not add backwards-compatibility shims for code that can simply be changed
- Validate at system boundaries (user input, external APIs), not internally

## Testing

No test framework is configured yet. When one is added:
1. Document the test runner command here
2. Always run tests before committing
3. Do not mark tasks complete if tests are failing

## Environment Variables

No environment variables are required at this time. When `.env` or similar configuration is introduced, document required keys here (never commit secrets).

## CI/CD

No CI/CD pipelines are configured yet. When GitHub Actions or another system is added, describe the workflow triggers and required checks here.

## Updating This File

This file should be updated whenever:
- A new technology or framework is adopted
- New development scripts or commands are added
- Conventions change or are formally established
- CI/CD or testing infrastructure is introduced

Keep this file accurate and concise — it is the primary reference for AI assistants onboarding to this codebase.
