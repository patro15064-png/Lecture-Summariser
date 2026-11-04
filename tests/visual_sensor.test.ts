import test from 'node:test';
import assert from 'node:assert';
import { 
  isMeaninglessFilename, 
  analyzePixelData 
} from '../src/lib/visualSensor';
import { 
  extractTitleFromNotes, 
  generateSpokenAudioLecture 
} from '../src/lib/multimodalAnalyzer';
import { loadUserApiSettings } from '../src/lib/providerSettings';

test('Visual Sensor & Content Grounding Suite', async (t) => {
  await t.test('isMeaninglessFilename detects random hashes and camera tags', () => {
    // Hashes & camera tags should be detected as meaningless
    assert.strictEqual(isMeaninglessFilename('5406a866d98d11e1f288db49710be550.jpg'), true);
    assert.strictEqual(isMeaninglessFilename('IMG_20261104_182931.png'), true);
    assert.strictEqual(isMeaninglessFilename('PXL_10293847.jpg'), true);
    assert.strictEqual(isMeaninglessFilename('Screenshot_2026-11-04.png'), true);
    assert.strictEqual(isMeaninglessFilename('frame-1.jpg'), true);
    assert.strictEqual(isMeaninglessFilename('photo'), true);
    assert.strictEqual(isMeaninglessFilename(''), true);

    // Real human titles should be preserved
    assert.strictEqual(isMeaninglessFilename('Multivariable Calculus Gradient Vectors.pdf'), false);
    assert.strictEqual(isMeaninglessFilename('Cellular Mitosis and Genetics.docx'), false);
  });

  await t.test('analyzePixelData identifies 8-bit pixel art sprites from pixel buffer', () => {
    const width = 32;
    const height = 32;
    const pixels = new Uint8ClampedArray(width * height * 4);

    // Create a dark background (#000000) with a centered white pixel art feline sprite (#ffffff)
    for (let y = 10; y <= 22; y++) {
      for (let x = 8; x <= 24; x++) {
        // Ear notches at top (x=10..12 and x=20..22)
        if (y < 14 && (x > 12 && x < 20)) continue;
        // Tail protrusion at left (y=16..18, x=5..8)
        const idx = (y * width + x) * 4;
        pixels[idx] = 255;
        pixels[idx + 1] = 255;
        pixels[idx + 2] = 255;
        pixels[idx + 3] = 255;
      }
    }

    const report = analyzePixelData(pixels, width, height);
    assert.strictEqual(report.detectedType, 'pixel_art');
    assert.strictEqual(report.isMonochrome, true);
    assert.match(report.title, /Pixel Art/i);
    // Must NOT contain fake calculus formulas
    assert.doesNotMatch(report.notesMarkdown, /\\nabla f/);
    // Must NOT contain boilerplate filler text
    assert.doesNotMatch(report.notesMarkdown, /Every component operates within a coordinated system/);
    assert.doesNotMatch(report.notesMarkdown, /5406a866d98d11e1f288db49710be550/);
  });

  await t.test('extractTitleFromNotes parses clean title from Markdown', () => {
    const markdown = `# 8-Bit Pixel Art Cat Character Sprite: 2D Raster Graphics\n\n## 1. Visual Overview\n...`;
    const title = extractTitleFromNotes(markdown);
    assert.strictEqual(title, '8-Bit Pixel Art Cat Character Sprite: 2D Raster Graphics');
  });

  await t.test('generateSpokenAudioLecture sanitizes raw hash titles', async () => {
    const settings = loadUserApiSettings();
    const rawContent = `# 8-Bit Pixel Art Sprite Graphics\n\n## 1. Sprite Anatomy\nThis sprite demonstrates discrete pixel grid alignment and silhouette design.\n\n## 2. Raster Graphics\nNearest-neighbor scaling avoids bilinear blurring on 8-bit displays.`;
    
    // Pass meaningless hash as the title
    const transcript = await generateSpokenAudioLecture({
      rawContent,
      title: '5406a866d98d11e1f288db49710be550',
      settings,
    });

    assert.ok(transcript.segments.length > 0);
    // Ensure raw hash was NOT injected into spoken transcript text!
    for (const seg of transcript.segments) {
      assert.doesNotMatch(seg.text, /5406a866d98d11e1f288db49710be550/);
      assert.doesNotMatch(seg.text, /Every component operates within a coordinated system/);
    }
  });
});

