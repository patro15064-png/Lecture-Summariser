import { LectureArtifact } from '@/types/lecture';

/**
 * Generates an Obsidian-compatible Markdown study vault note with YAML frontmatter,
 * LaTeX mathematical formulas ($$...$$), Mermaid diagrams, [[Wikilinks]], and #card spaced-repetition tags.
 */
export function generateObsidianVaultMarkdown(artifact: LectureArtifact): string {
  const sanitizeSlug = (str: string) =>
    str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  const frontmatter = `---
title: "${artifact.title.replace(/"/g, '\\"')}"
course: "${artifact.course.replace(/"/g, '\\"')}"
lecturer: "${artifact.lecturer.replace(/"/g, '\\"')}"
date: "${artifact.date}"
duration: "${artifact.durationFormatted}"
source: "Lecture-Summariser Multimodal Engine"
tags:
  - university/lecture-notes
  - active-learning
  - feynman-technique
  - obsidian-spaced-repetition
created: "${new Date().toISOString()}"
---

# ${artifact.title}
**Course:** ${artifact.course} | **Lecturer:** ${artifact.lecturer} | **Date:** ${artifact.date} | **Duration:** ${artifact.durationFormatted}

---

## 📌 Executive Synthesis
${artifact.overview}

### Key Themes
${artifact.keyThemes.map((theme) => `- #theme/${sanitizeSlug(theme)}: **${theme}**`).join('\n')}

---

## 🗺️ Prerequisite Concept Graph
\`\`\`mermaid
${artifact.mermaidGraph}
\`\`\`

---

## 🧠 Core Conceptual Milestones

${artifact.concepts
  .map(
    (c) => `### [[${c.title}]]
*Timestamp:* \`${c.timestampFormatted}\` | *Importance:* \`${c.importance.toUpperCase()}\`

**Elevator Summary:**
${c.summary}

${
  c.formulaLatex
    ? `**Mathematical / Logical Formulation:**
$$
${c.formulaLatex}
$$`
    : ''
}

**Pedagogical Deep Dive:**
${c.explanation}

**Key Takeaways:**
${c.keyTakeaways.map((t) => `- [ ] ${t}`).join('\n')}

${
  c.prerequisites && c.prerequisites.length > 0
    ? `**Prerequisites:** ${c.prerequisites
        .map((pId) => {
          const found = artifact.concepts.find((item) => item.id === pId);
          return found ? `[[${found.title}]]` : `\`${pId}\``;
        })
        .join(', ')}`
    : '**Prerequisites:** *Foundational (None)*'
}
`
  )
  .join('\n---\n\n')}

---

## 🗂️ Active Recall Spaced Repetition Cards (#card)

${artifact.flashcards
  .map(
    (fc, idx) => `### Card ${idx + 1}: ${fc.front} #card
${fc.back}
${fc.hint ? `> [!tip] Pedagogical Hint\n> ${fc.hint}` : ''}
`
  )
  .join('\n')}

---

## 🎯 Diagnostic Misconception Quizzes

${artifact.diagnosticQuestions
  .map((dq) => {
    const correctOpt = dq.options.find((o) => o.isCorrect);
    const incorrectOpts = dq.options.filter((o) => !o.isCorrect);

    return `> [!question] Diagnostic Check: ${dq.question}
> **Verified Resolution:** ${correctOpt ? correctOpt.text : 'See explanation below.'}
>
${incorrectOpts
  .map(
    (opt) => `> > [!warning]- Trap: "${opt.text}"
> > **Why students fail this:** ${opt.misconceptionExplanation}`
  )
  .join('\n>\n')}
>
> *Step-by-step resolution:* ${dq.explanation}
`;
  })
  .join('\n')}

---

## 🎙️ Golden Audio Breakthrough Moments

${artifact.goldenSnippets
  .map(
    (s) => `### ⏱️ [${s.durationFormatted}] ${s.title}
> [!quote] Breakthrough Verbatim Transcript
> "${s.transcriptSnippet}"
> 
> **Why This Matters:** ${s.whyItMatters}
`
  )
  .join('\n')}

---
*Exported with ❤️ by Lecture-Summariser AI Engine — Zero-Persistence Client-Side Vault*
`;

  return frontmatter;
}

/**
 * Client-side file downloader for text/markdown blobs.
 */
export function downloadMarkdownFile(filename: string, content: string) {
  if (typeof window === 'undefined') return;

  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.md') ? filename : `${filename}.md`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Triggers modern printable PDF view formatted cleanly for academic study sheets.
 */
export function printLectureStudySheet(artifact: LectureArtifact) {
  if (typeof window === 'undefined') return;

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Please allow popups to open the printable PDF study sheet.');
    return;
  }

  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${artifact.title} - Academic Study Sheet</title>
  <style>
    @page {
      margin: 15mm 15mm 15mm 15mm;
      size: A4 portrait;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      background: #ffffff;
      line-height: 1.5;
      font-size: 11pt;
      padding: 20px;
    }
    .header {
      border-bottom: 2px solid #334155;
      padding-bottom: 12px;
      margin-bottom: 20px;
    }
    .badge {
      display: inline-block;
      padding: 3px 8px;
      font-size: 8pt;
      font-weight: 700;
      text-transform: uppercase;
      border-radius: 4px;
      background: #e2e8f0;
      color: #334155;
      margin-right: 6px;
    }
    h1 {
      font-size: 18pt;
      font-weight: 800;
      color: #0f172a;
      margin: 8px 0 4px;
      line-height: 1.2;
    }
    .meta {
      font-size: 9pt;
      color: #64748b;
      margin-bottom: 4px;
    }
    h2 {
      font-size: 13pt;
      font-weight: 700;
      color: #1e293b;
      margin: 20px 0 8px;
      border-bottom: 1px solid #cbd5e1;
      padding-bottom: 4px;
      page-break-after: avoid;
    }
    h3 {
      font-size: 11pt;
      font-weight: 600;
      color: #0f172a;
      margin: 12px 0 4px;
      page-break-after: avoid;
    }
    p {
      margin-bottom: 8px;
    }
    .overview-box {
      background: #f8fafc;
      border-left: 4px solid #6366f1;
      padding: 10px 14px;
      font-size: 10pt;
      color: #334155;
      margin-bottom: 16px;
    }
    .concept-card {
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 12px;
      margin-bottom: 12px;
      page-break-inside: avoid;
      background: #ffffff;
    }
    .formula {
      font-family: "Courier New", Courier, monospace;
      background: #f1f5f9;
      padding: 6px 10px;
      border-radius: 4px;
      font-size: 9.5pt;
      color: #1e1b4b;
      margin: 6px 0;
      border: 1px solid #e2e8f0;
    }
    .takeaways {
      margin-top: 6px;
      padding-left: 18px;
      font-size: 9pt;
      color: #475569;
    }
    .quiz-card {
      background: #fdf4ff;
      border: 1px solid #f0abfc;
      border-radius: 6px;
      padding: 10px 14px;
      margin-bottom: 12px;
      page-break-inside: avoid;
    }
    .trap-box {
      background: #fff1f2;
      border-left: 3px solid #f43f5e;
      padding: 6px 10px;
      font-size: 8.5pt;
      color: #881337;
      margin-top: 6px;
    }
    .flashcard-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin-top: 8px;
    }
    .flashcard-item {
      border: 1px dashed #94a3b8;
      border-radius: 6px;
      padding: 10px;
      font-size: 9pt;
      page-break-inside: avoid;
    }
    .print-footer {
      margin-top: 30px;
      padding-top: 10px;
      border-top: 1px solid #cbd5e1;
      font-size: 8pt;
      color: #94a3b8;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <span class="badge">${artifact.course}</span>
      <span class="badge">${artifact.date}</span>
      <span class="badge">${artifact.durationFormatted}</span>
    </div>
    <h1>${artifact.title}</h1>
    <div class="meta">Lecturer: ${artifact.lecturer} | Synthesized via Lecture-Summariser AI Engine</div>
  </div>

  <h2>1. Executive Summary &amp; Themes</h2>
  <div class="overview-box">
    ${artifact.overview}
  </div>
  <p style="font-size: 9.5pt; color: #475569;"><strong>Core Themes:</strong> ${artifact.keyThemes.join(' • ')}</p>

  <h2>2. Concept Mastery &amp; Mathematical Formulations</h2>
  ${artifact.concepts
    .map(
      (c) => `
    <div class="concept-card">
      <div style="display: flex; justify-content: space-between; align-items: baseline;">
        <h3>${c.title}</h3>
        <span style="font-size: 8pt; color: #64748b; font-family: monospace;">[${c.timestampFormatted}] - ${c.importance.toUpperCase()}</span>
      </div>
      <p style="font-size: 9.5pt; color: #334155; margin-top: 4px;">${c.explanation}</p>
      ${c.formulaLatex ? `<div class="formula"><strong>Formula:</strong> ${c.formulaLatex}</div>` : ''}
      <ul class="takeaways">
        ${c.keyTakeaways.map((t) => `<li>${t}</li>`).join('')}
      </ul>
    </div>
  `
    )
    .join('')}

  <h2>3. High-Yield Diagnostic Misconception Quizzes</h2>
  ${artifact.diagnosticQuestions
    .map((dq) => {
      const correct = dq.options.find((o) => o.isCorrect);
      const traps = dq.options.filter((o) => !o.isCorrect);
      return `
      <div class="quiz-card">
        <strong>Question:</strong> ${dq.question}
        <div style="margin-top: 6px; font-size: 9.5pt; color: #15803d;">
          <strong>✔ Correct:</strong> ${correct ? correct.text : 'Verified'}
        </div>
        ${traps
          .map(
            (t) => `
          <div class="trap-box">
            <strong>Cognitive Trap:</strong> "${t.text}"<br>
            <em>Why it fails:</em> ${t.misconceptionExplanation}
          </div>
        `
          )
          .join('')}
      </div>
    `;
    })
    .join('')}

  <h2>4. Spaced-Repetition Study Cards</h2>
  <div class="flashcard-grid">
    ${artifact.flashcards
      .map(
        (fc) => `
      <div class="flashcard-item">
        <strong>Q: ${fc.front}</strong>
        <p style="margin-top: 6px; color: #334155;"><strong>A:</strong> ${fc.back}</p>
        ${fc.hint ? `<span style="font-size: 8pt; color: #6366f1;">💡 Hint: ${fc.hint}</span>` : ''}
      </div>
    `
      )
      .join('')}
  </div>

  <div class="print-footer">
    Generated with Lecture-Summariser • Zero-Trust Client-Side Vault • Ready for Print / PDF Export
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 400);
    };
  </script>
</body>
</html>`;

  printWindow.document.open();
  printWindow.document.write(htmlContent);
  printWindow.document.close();
}
