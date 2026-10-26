# Security Policy & Zero-Trust Architecture

## 1. Zero-Trust API Key Architecture
`Lecture-Summariser` adheres to a strict Zero-Trust client-privacy model:
- **Client-Side Key Vault:** Any Google Gemini API Key provided by the user in the UI is stored solely in the client browser's local memory / `localStorage`.
- **Transient HTTPS Transport:** When calling `/api/process-lecture` or `/api/feynman-grade`, the API key is passed via an encrypted `x-gemini-key` header for transient per-request processing.
- **Zero Server Persistence:** Keys are never stored in databases, logs, telemetry events, or server-side cache.
- **Pre-Loaded Demos:** Judges and users can evaluate all platform features without inputting any API key via our pre-loaded university datasets.

## 2. Input Validation & Multimodal Safeguards
- **File Integrity:** Ingestion buffers limit audio/video uploads to supported MIME types (`audio/mpeg`, `audio/mp4`, `audio/wav`, `text/plain`, `application/pdf`).
- **Sanitized Markdown & Diagram Generation:** AI output passed to `mermaid` and markdown parsers undergo regex sanitization to strip unescaped script tags, nested entity wrappers, and invalid node delimiters, eliminating Cross-Site Scripting (XSS) vectors.
- **Self-Healing LLM Parsing:** Responses from Gemini 1.5/2.0 are passed through `withSelfHealingJSON()` with a 3x retry mechanism, handling truncated tokens, trailing comma issues, or markdown code fence pollution without application crashes.

## 3. HTTP Security Headers
The Next.js edge and production server enforce the following defense-in-depth headers:
```http
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: microphone=(self)
```

## 4. Reporting a Vulnerability
If you discover a security vulnerability in this project:
1. Please do **NOT** open a public issue.
2. Email security concerns privately to the repository maintainer.
3. Include detailed steps to reproduce, affected endpoints, and potential impact.
4. We aim to triage and respond within 24 hours.
