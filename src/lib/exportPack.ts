import JSZip from 'jszip';
import { LectureArtifact } from '@/types/lecture';
import { exportToVTT } from './transcriptParser';
import { generateObsidianVaultMarkdown } from './exportUtils';
import { sliceAudioClip, decodeAudioBlob } from './audioEngine';

/**
 * Builds and downloads a production ZIP Export Pack containing:
 * 1. clips/ (real sliced audio clips)
 * 2. cards.json (flashcards with SM-2 spaced repetition state)
 * 3. concept-graph.json (DAG nodes and edges)
 * 4. transcript.vtt (standard WebVTT transcript)
 * 5. summary.md (Obsidian/PKM formatted markdown note)
 * 6. anki_cards.csv (Anki import-ready deck)
 */
/**
 * Builds a production ZIP Export Pack containing:
 * 1. clips/ (real sliced audio clips)
 * 2. cards.json (flashcards with SM-2 spaced repetition state)
 * 3. concept-graph.json (DAG nodes and edges)
 * 4. transcript.vtt (standard WebVTT transcript)
 * 5. summary.md (Obsidian/PKM formatted markdown note)
 * 6. anki_cards.csv (Anki import-ready deck)
 */
export async function buildExportPackZip(
  artifact: LectureArtifact,
  onProgress?: (percent: number, status: string) => void
): Promise<{ zip: JSZip; blob: Blob }> {
  const zip = new JSZip();
  const slug = (artifact.title || 'lecture')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

  onProgress?.(10, 'Preparing metadata and transcript...');

  // 1. transcript.vtt
  const vttContent = exportToVTT(artifact.transcript.segments);
  zip.file('transcript.vtt', vttContent);

  // 2. summary.md
  const markdownNote = generateObsidianVaultMarkdown(artifact);
  zip.file('summary.md', markdownNote);

  // 3. concept-graph.json
  const graphJson = JSON.stringify(artifact.graphData, null, 2);
  zip.file('concept-graph.json', graphJson);

  // 4. cards.json
  const cardsJson = JSON.stringify(artifact.flashcards, null, 2);
  zip.file('cards.json', cardsJson);

  // 5. anki_cards.csv (Anki compatible deck)
  let ankiCsv = '#separator:tab\n#html:true\n#tags column:4\n';
  artifact.flashcards.forEach((card) => {
    const front = `"${card.front.replace(/"/g, '""')}"`;
    const back = `"${card.back.replace(/"/g, '""')}<br><br><b>Key Takeaway:</b> ${card.takeaway.replace(/"/g, '""')}"`;
    const hint = `"${(card.hint || '').replace(/"/g, '""')}"`;
    const tags = `"lecture-summariser ${slug}"`;
    ankiCsv += `${front}\t${back}\t${hint}\t${tags}\n`;
  });
  zip.file('anki_cards.csv', ankiCsv);

  // 6. clips/ (Cut real audio clips from user's uploaded media if available)
  const clipsFolder = zip.folder('clips');
  if (clipsFolder && artifact.audioBlob) {
    onProgress?.(30, 'Decoding media track for audio clip slicing...');
    try {
      const audioBuffer = await decodeAudioBlob(artifact.audioBlob);
      const totalSnippets = artifact.goldenSnippets.length;

      for (let i = 0; i < totalSnippets; i++) {
        const snippet = artifact.goldenSnippets[i];
        const pct = 30 + Math.round(((i + 1) / totalSnippets) * 50);
        onProgress?.(pct, `Slicing golden audio clip ${i + 1} of ${totalSnippets}...`);

        const { blob } = await sliceAudioClip(
          audioBuffer,
          snippet.startSeconds,
          snippet.endSeconds,
          3.0
        );

        const clipFileName = `clip-${i + 1}-${snippet.startSeconds}s-${snippet.endSeconds}s.wav`;
        clipsFolder.file(clipFileName, blob);
      }
    } catch (err) {
      console.warn('[Export Pack] Could not cut audio clips from media blob:', err);
    }
  }

  onProgress?.(85, 'Packaging ZIP bundle...');
  const blob = await zip.generateAsync({ type: 'blob' }, (metadata) => {
    onProgress?.(85 + Math.round(metadata.percent * 0.15), 'Compressing...');
  });

  return { zip, blob };
}

export async function generateAndDownloadExportPack(
  artifact: LectureArtifact,
  onProgress?: (percent: number, status: string) => void
): Promise<void> {
  const { blob } = await buildExportPackZip(artifact, onProgress);
  const slug = (artifact.title || 'lecture')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

  if (typeof document !== 'undefined') {
    onProgress?.(100, 'Download starting...');
    const downloadUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = `${slug}-study-pack.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(downloadUrl);
  }
}
