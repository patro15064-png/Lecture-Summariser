# Contributing to Lecture-Summariser

Thank you for contributing to `Lecture-Summariser`! Follow these guidelines to maintain high engineering standards.

## Development Workflow
1. Fork and clone the repository.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy `.env.example` to `.env.local` and configure your API keys (optional).
4. Run the local development server:
   ```bash
   npm run dev
   ```

## Branching Conventions
- `feat/feature-name`: New features or enhancements
- `fix/bug-fix-name`: Bug fixes
- `sec/security-patch`: Security improvements
- `docs/doc-updates`: Documentation changes

## Commit Conventions
We strictly adhere to [Conventional Commits](https://www.conventionalcommits.org/):
- `feat:` A new feature
- `fix:` A bug fix
- `sec:` Security remediation or policy update
- `ci:` CI/CD pipeline or GitHub Actions changes
- `docs:` Documentation only changes
- `refactor:` Code change that neither fixes a bug nor adds a feature
- `test:` Adding or updating tests

## Pull Request Checklist
- [ ] TypeScript strict mode passes: `npx tsc --noEmit`
- [ ] Linting checks pass: `npm run lint`
- [ ] Production build succeeds: `npm run build`
- [ ] No hardcoded secrets or API keys in code or commits
