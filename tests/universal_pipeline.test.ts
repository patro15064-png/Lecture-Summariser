import test from 'node:test';
import assert from 'node:assert';
import JSZip from 'jszip';
import { 
  detectFileSignature, 
  tryBestEffortFallback 
} from '../src/lib/fileSignatures';
import {
  extractDocxContent,
  extractPptxContent,
  extractAnyLearningMaterial,
} from '../src/lib/documentExtractors';
import {
  cleanAndRepairJson,
  runUniversalLearningPipeline,
} from '../src/lib/orchestrator';
import { loadUserApiSettings } from '../src/lib/providerSettings';
import { UniversalExtractionResult } from '../src/lib/documentExtractors';

test('Universal Pipeline: 1. Magic Bytes & File Signature Detection', async (t) => {
  await t.test('detects PDF magic header (%PDF)', async () => {
    const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]);
    const file = new File([pdfBytes], 'lecture_slides.pdf', { type: '' });
    const sig = await detectFileSignature(file);
    assert.strictEqual(sig.category, 'pdf');
    assert.strictEqual(sig.detectedMime, 'application/pdf');
    assert.strictEqual(sig.isSupported, true);
  });

  await t.test('detects PNG image magic signature', async () => {
    const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
    const file = new File([pngBytes], 'whiteboard_notes.png', { type: '' });
    const sig = await detectFileSignature(file);
    assert.strictEqual(sig.category, 'image');
    assert.strictEqual(sig.detectedMime, 'image/png');
    assert.strictEqual(sig.isSupported, true);
  });

  await t.test('detects JPEG / JPG photo of notes', async () => {
    const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
    const file = new File([jpegBytes], 'blurry_phone_photo.jpg', { type: '' });
    const sig = await detectFileSignature(file);
    assert.strictEqual(sig.category, 'image');
    assert.strictEqual(sig.detectedMime, 'image/jpeg');
    assert.strictEqual(sig.isSupported, true);
  });

  await t.test('detects audio formats (MP3 sync frame & ID3, WAV RIFF)', async () => {
    const mp3Id3Bytes = new Uint8Array([0x49, 0x44, 0x33, 0x03, 0x00, 0x00]);
    const mp3File = new File([mp3Id3Bytes], 'lecture_audio.mp3', { type: '' });
    const mp3Sig = await detectFileSignature(mp3File);
    assert.strictEqual(mp3Sig.category, 'audio');
    assert.strictEqual(mp3Sig.detectedMime, 'audio/mpeg');

    const wavBytes = new Uint8Array([
      0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00,
      0x57, 0x41, 0x56, 0x45, 0x66, 0x6d, 0x74, 0x20
    ]);
    const wavFile = new File([wavBytes], 'seminar.wav', { type: '' });
    const wavSig = await detectFileSignature(wavFile);
    assert.strictEqual(wavSig.category, 'audio');
    assert.strictEqual(wavSig.detectedMime, 'audio/wav');
  });

  await t.test('detects UTF-8 plain text, markdown, and csv', async () => {
    const txtFile = new File(['Hello world physics notes'], 'notes.txt', { type: 'text/plain' });
    const txtSig = await detectFileSignature(txtFile);
    assert.strictEqual(txtSig.category, 'text');
    assert.strictEqual(txtSig.isSupported, true);

    const mdFile = new File(['# Quantum Mechanics\nSuperposition is key.'], 'quantum.md', { type: 'text/markdown' });
    const mdSig = await detectFileSignature(mdFile);
    assert.strictEqual(mdSig.category, 'text');
    assert.strictEqual(mdSig.detectedMime, 'text/markdown');
  });
});

test('Universal Pipeline: 2. 0-Byte Empty Files & Corrupted / Unsupported Inputs', async (t) => {
  await t.test('handles 0-byte file gracefully with informative diagnostics', async () => {
    const emptyFile = new File([], 'empty_file.pdf', { type: 'application/pdf' });
    const sig = await detectFileSignature(emptyFile);
    assert.strictEqual(sig.detectedMime, 'application/x-empty');
    assert.strictEqual(sig.isSupported, false);
    assert.match(sig.diagnosticMessage, /File is empty \(0 bytes\)/);

    const extraction = await extractAnyLearningMaterial(emptyFile, 'empty_file.pdf');
    assert.strictEqual(extraction.success, false);
    assert.match(extraction.errorReason || '', /0 bytes/);
  });

  await t.test('handles corrupted / unknown binary file with best-effort fallback report', async () => {
    // Arbitrary unknown binary junk
    const junkBytes = new Uint8Array([0xde, 0xad, 0xbe, 0xef, 0x00, 0x01, 0x02, 0x03, 0xff, 0xfe]);
    const junkFile = new File([junkBytes], 'corrupt.dat', { type: 'application/octet-stream' });
    
    const sig = await detectFileSignature(junkFile);
    assert.strictEqual(sig.category, 'unknown');
    assert.strictEqual(sig.isSupported, false);

    const fallback = await tryBestEffortFallback(junkFile, 'corrupt.dat');
    assert.strictEqual(fallback.success, false);
    assert.strictEqual(fallback.type, 'failed');
    assert.match(fallback.diagnosticReport, /Could not parse "corrupt.dat"/);
    assert.match(fallback.diagnosticReport, /standard format like PDF, TXT, DOCX/);

    const extraction = await extractAnyLearningMaterial(junkFile, 'corrupt.dat');
    assert.strictEqual(extraction.success, false);
    assert.ok(extraction.errorReason);
  });

  await t.test('recovers text from unknown file extension if it contains valid UTF-8 text', async () => {
    const pseudoBinaryFile = new File(['This is a secret note containing vital biochemical reactions.'], 'notes.xyz', { type: '' });
    const fallback = await tryBestEffortFallback(pseudoBinaryFile, 'notes.xyz');
    assert.strictEqual(fallback.success, true);
    assert.strictEqual(fallback.type, 'text');
    assert.match(fallback.text || '', /biochemical reactions/);
  });
});

test('Universal Pipeline: 3. DOCX & PPTX Structured Extractors', async (t) => {
  await t.test('extracts DOCX paragraphs, headings, and source citations', async () => {
    const zip = new JSZip();
    const docXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
      <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
        <w:body>
          <w:p>
            <w:pPr><w:pStyle w:val="Heading1"/></w:pPr>
            <w:r><w:t>Neural Networks Architecture</w:t></w:r>
          </w:p>
          <w:p>
            <w:r><w:t>A multilayer perceptron contains input, hidden, and output layers.</w:t></w:r>
          </w:p>
          <w:p>
            <w:pPr><w:pStyle w:val="Heading2"/></w:pPr>
            <w:r><w:t>Backpropagation Algorithm</w:t></w:r>
          </w:p>
          <w:p>
            <w:r><w:t>Gradients of the loss function with respect to weights are computed via chain rule.</w:t></w:r>
          </w:p>
        </w:body>
      </w:document>`;
    zip.file('word/document.xml', docXml);
    const docxBlob = await zip.generateAsync({ type: 'blob' });
    const file = new File([docxBlob], 'deep_learning.docx');

    const res = await extractDocxContent(file, 'deep_learning.docx');
    assert.strictEqual(res.success, true);
    assert.ok(res.sections.length >= 2);
    assert.strictEqual(res.sections[0].title, 'Neural Networks Architecture');
    assert.match(res.sections[0].text, /multilayer perceptron/);
    assert.strictEqual(res.sections[0].sourceCitation.filename, 'deep_learning.docx');
    assert.strictEqual(res.sections[1].title, 'Backpropagation Algorithm');
    assert.match(res.sections[1].text, /chain rule/);
  });

  await t.test('extracts PPTX slide titles, bullet points, and speaker notes', async () => {
    const zip = new JSZip();
    const slide1Xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
      <p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
        <p:cSld>
          <p:spTree>
            <p:sp><p:txBody><a:p><a:r><a:t>Quantum Superposition</a:t></a:r></a:p></p:txBody></p:sp>
            <p:sp><p:txBody><a:p><a:r><a:t>Qubits can exist in state zero and state one simultaneously.</a:t></a:r></a:p></p:txBody></p:sp>
          </p:spTree>
        </p:cSld>
      </p:sld>`;
    const notes1Xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
      <p:notes xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
        <p:cSld>
          <p:spTree>
            <p:sp><p:txBody><a:p><a:r><a:t>Emphasize the Bloch sphere representation to students.</a:t></a:r></a:p></p:txBody></p:sp>
          </p:spTree>
        </p:cSld>
      </p:notes>`;

    zip.file('ppt/slides/slide1.xml', slide1Xml);
    zip.file('ppt/notesSlides/notesSlide1.xml', notes1Xml);
    const pptxBlob = await zip.generateAsync({ type: 'blob' });
    const file = new File([pptxBlob], 'quantum_intro.pptx');

    const res = await extractPptxContent(file, 'quantum_intro.pptx');
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.sections.length, 1);
    assert.match(res.sections[0].title, /Slide 1: Quantum Superposition/);
    assert.match(res.sections[0].text, /simultaneously/);
    assert.match(res.sections[0].text, /\[Speaker Notes\]: Emphasize the Bloch sphere/);
    assert.strictEqual(res.sections[0].sourceCitation.pageNumber, 1);
  });
});

test('Universal Pipeline: 4. JSON Auto-Repair & Schema Resilience', async (t) => {
  await t.test('strips markdown json fences', () => {
    const raw = '```json\n{"status": "ok", "count": 42}\n```';
    const cleaned = cleanAndRepairJson(raw);
    assert.strictEqual(JSON.parse(cleaned).count, 42);
  });

  await t.test('removes trailing commas from objects and arrays', () => {
    const raw = '{"name": "Entropy", "values": [1, 2, 3, ], }';
    const cleaned = cleanAndRepairJson(raw);
    const parsed = JSON.parse(cleaned);
    assert.strictEqual(parsed.name, 'Entropy');
    assert.strictEqual(parsed.values.length, 3);
  });

  await t.test('auto-repairs truncated JSON with unbalanced quotes and missing brackets', () => {
    const truncated = '{"concepts": [{"title": "Thermodynamics", "summary": "Study of heat energy';
    const repaired = cleanAndRepairJson(truncated);
    const parsed = JSON.parse(repaired);
    assert.ok(Array.isArray(parsed.concepts));
    assert.strictEqual(parsed.concepts[0].title, 'Thermodynamics');
  });
});

test('Universal Pipeline: 5. 20-Minute Audio / Video Input Handling', async (t) => {
  await t.test('preserves timestamps and duration across a 20-minute (1200s) timeline', async () => {
    // Generate 20-minute material
    const sections = [];
    for (let minute = 0; minute < 20; minute++) {
      const startSec = minute * 60;
      sections.push({
        title: `Minute ${minute + 1}: Astrobiology Part ${minute + 1}`,
        text: `At timestamp minute ${minute + 1}, we analyze planetary habitability and biomarker spectra. The Drake equation parameter ${minute + 1} dictates stellar formation rates.`,
        timestampSeconds: startSec,
        timestampFormatted: `${minute}:00`,
        sourceCitation: {
          filename: 'astrobiology_lecture_20min.mp3',
          timestampSeconds: startSec,
          snippet: `Minute ${minute + 1} analysis`,
        },
      });
    }

    const material: UniversalExtractionResult = {
      filename: 'astrobiology_lecture_20min.mp3',
      fileType: 'audio/mpeg',
      fileSize: 18000000,
      success: true,
      totalWordCount: sections.reduce((sum, s) => sum + s.text.split(' ').length, 0),
      sections,
      combinedText: sections.map((s) => s.text).join('\n\n'),
    };

    const settings = loadUserApiSettings();
    const kit = await runUniversalLearningPipeline({
      studyKitId: 'test-20min-kit',
      metadata: { title: 'Astrobiology 20min Lecture' },
      materials: [material],
      settings,
    });

    assert.strictEqual(kit.title, 'Astrobiology 20min Lecture');
    assert.ok(kit.durationSeconds >= 1100, `Expected duration >= 1100s, got ${kit.durationSeconds}`);
    assert.ok(kit.transcript.hasTimestamps, 'Expected transcript to preserve timestamps');
    assert.ok(kit.concepts.length >= 3, 'Expected at least 3 extracted concepts');
    // Ensure concepts have timestamps and citations
    kit.concepts.forEach((concept) => {
      assert.ok(concept.sourceCitation, 'Every concept must have a source citation');
      assert.strictEqual(concept.sourceCitation.filename, 'astrobiology_lecture_20min.mp3');
    });
  });
});

test('Universal Pipeline: 6. 10 Files Ingested at Once with Source Citations', async (t) => {
  await t.test('merges 10 distinct files and tracks citations per file', async () => {
    const materials: UniversalExtractionResult[] = [];
    const subjects = [
      'Kinematics', 'Dynamics', 'Thermodynamics', 'Electromagnetism', 'Optics',
      'Quantum_States', 'Nuclear_Physics', 'Relativity', 'Astrophysics', 'Cosmology'
    ];

    for (let i = 0; i < 10; i++) {
      const subject = subjects[i];
      const filename = `${subject}_handout.txt`;
      const text = `The primary principle of ${subject} states that energy and momentum obey fundamental conservation laws. In chapter ${i + 1}, we derive the specific mathematical formulation.`;
      
      materials.push({
        filename,
        fileType: 'text/plain',
        fileSize: text.length,
        success: true,
        totalWordCount: text.split(' ').length,
        sections: [
          {
            title: `Chapter ${i + 1}: ${subject}`,
            text,
            pageNumber: i + 1,
            sourceCitation: {
              filename,
              pageNumber: i + 1,
              snippet: text.slice(0, 60),
            },
          },
        ],
        combinedText: text,
      });
    }

    const settings = loadUserApiSettings();
    const kit = await runUniversalLearningPipeline({
      studyKitId: 'test-10-files-kit',
      metadata: { title: 'Master Physics Course (10 Handouts)' },
      materials,
      settings,
    });

    assert.strictEqual(kit.sourceFiles?.length, 10);
    assert.ok(kit.concepts.length >= 3);
    assert.ok(kit.flashcards.length >= 3);
    assert.ok(kit.diagnosticQuestions.length >= 3);
    assert.ok(kit.extras?.glossary.length && kit.extras.glossary.length >= 3);

    // Verify citations exist and point to actual filenames
    kit.concepts.forEach((c) => {
      assert.ok(c.sourceCitation);
      assert.ok(c.sourceCitation.filename.endsWith('_handout.txt'));
    });
  });
});

test('Universal Pipeline: 7. Partial Success Support (3 Valid Files + 2 Failed Files)', async (t) => {
  await t.test('succeeds with working files and records failed files with error reasons', async () => {
    const materials: UniversalExtractionResult[] = [
      {
        filename: 'valid_chemistry_notes.txt',
        fileType: 'text/plain',
        fileSize: 450,
        success: true,
        totalWordCount: 80,
        sections: [
          {
            title: 'Chemical Equilibrium',
            text: 'At equilibrium, the rate of forward reaction equals the rate of reverse reaction. Le Chatelier principle governs shifts.',
            pageNumber: 1,
            sourceCitation: { filename: 'valid_chemistry_notes.txt', pageNumber: 1, snippet: 'Chemical equilibrium' },
          },
        ],
        combinedText: 'At equilibrium, the rate of forward reaction equals the rate of reverse reaction.',
      },
      {
        filename: 'valid_biology_notes.txt',
        fileType: 'text/plain',
        fileSize: 520,
        success: true,
        totalWordCount: 95,
        sections: [
          {
            title: 'Cellular Respiration',
            text: 'Glycolysis breaks down glucose into pyruvate producing ATP and NADH in the cytoplasm.',
            pageNumber: 1,
            sourceCitation: { filename: 'valid_biology_notes.txt', pageNumber: 1, snippet: 'Cellular respiration' },
          },
        ],
        combinedText: 'Glycolysis breaks down glucose into pyruvate producing ATP and NADH.',
      },
      {
        filename: 'valid_math_notes.txt',
        fileType: 'text/plain',
        fileSize: 310,
        success: true,
        totalWordCount: 65,
        sections: [
          {
            title: 'Calculus Limits',
            text: 'The limit of a function as x approaches c represents the value the function nears arbitrarily closely.',
            pageNumber: 1,
            sourceCitation: { filename: 'valid_math_notes.txt', pageNumber: 1, snippet: 'Calculus limits' },
          },
        ],
        combinedText: 'The limit of a function as x approaches c represents the value the function nears.',
      },
      // Failed file 1: Empty file
      {
        filename: 'empty_bad_file.pdf',
        fileType: 'application/x-empty',
        fileSize: 0,
        success: false,
        totalWordCount: 0,
        sections: [],
        combinedText: '',
        errorReason: 'File is empty (0 bytes).',
      },
      // Failed file 2: Corrupted binary
      {
        filename: 'corrupted_archive.zip',
        fileType: 'application/zip',
        fileSize: 1024,
        success: false,
        totalWordCount: 0,
        sections: [],
        combinedText: '',
        errorReason: 'Archive is damaged or password-protected.',
      },
    ];

    const settings = loadUserApiSettings();
    const kit = await runUniversalLearningPipeline({
      studyKitId: 'test-partial-success-kit',
      metadata: { title: 'Multi-Topic Synthesis' },
      materials,
      settings,
    });

    assert.ok(kit.id);
    assert.strictEqual(kit.sourceFiles?.length, 3);
    assert.ok(kit.failedFiles, 'Expected failedFiles to be populated');
    assert.strictEqual(kit.failedFiles?.length, 2);
    assert.strictEqual(kit.failedFiles[0].filename, 'empty_bad_file.pdf');
    assert.match(kit.failedFiles[0].reason, /0 bytes/);
    assert.strictEqual(kit.failedFiles[1].filename, 'corrupted_archive.zip');
    assert.match(kit.failedFiles[1].reason, /damaged or password-protected/);
  });
});

test('Universal Pipeline: 8. Wrong / Invalid API Key Graceful Fallback', async (t) => {
  await t.test('falls back safely to deterministic local engine when API key is invalid', async () => {
    const invalidSettings = loadUserApiSettings();
    invalidSettings.useSingleModel = true;
    invalidSettings.singleProvider = 'gemini';
    invalidSettings.singleModel = 'gemini-2.0-flash';
    invalidSettings.providers.gemini = {
      provider: 'gemini',
      apiKey: 'AIzaSy_FAKE_INVALID_TEST_KEY_FOR_ROBUSTNESS_CHECK_12345',
      defaultModel: 'gemini-2.0-flash',
      status: 'untested',
    };

    const material: UniversalExtractionResult = {
      filename: 'fault_tolerance_notes.txt',
      fileType: 'text/plain',
      fileSize: 300,
      success: true,
      totalWordCount: 50,
      sections: [
        {
          title: 'Fault Tolerant Distributed Systems',
          text: 'Paxos and Raft consensus algorithms allow distributed clusters to agree on state transitions despite node crashes.',
          pageNumber: 1,
          sourceCitation: { filename: 'fault_tolerance_notes.txt', pageNumber: 1, snippet: 'Paxos and Raft' },
        },
      ],
      combinedText: 'Paxos and Raft consensus algorithms allow distributed clusters to agree on state transitions.',
    };

    // Must NOT throw unhandled error - must catch and fallback to deterministic local engine
    const kit = await runUniversalLearningPipeline({
      studyKitId: 'test-invalid-key-kit',
      metadata: { title: 'Fault Tolerance Test' },
      materials: [material],
      settings: invalidSettings,
    });

    assert.ok(kit);
    assert.strictEqual(kit.title, 'Fault Tolerance Test');
    assert.ok(kit.concepts.length > 0);
    assert.ok(kit.flashcards.length > 0);
    assert.ok(kit.diagnosticQuestions.length > 0);
  });
});
