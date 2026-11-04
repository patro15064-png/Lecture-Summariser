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
    assert.strictEqual(isMeaninglessFilename('WhatsApp Image 2026 08 05 at 7.45.52 PM (1).jpeg'), true);
    assert.strictEqual(isMeaninglessFilename('IMG_20261104_182931.png'), true);
    assert.strictEqual(isMeaninglessFilename('PXL_10293847.jpg'), true);
    assert.strictEqual(isMeaninglessFilename('Screenshot_2026-11-04.png'), true);
    assert.strictEqual(isMeaninglessFilename('frame-1.jpg'), true);
    assert.strictEqual(isMeaninglessFilename('photo'), true);
    assert.strictEqual(isMeaninglessFilename(''), true);

    // Real human titles should be preserved
    assert.strictEqual(isMeaninglessFilename('Multivariable Calculus Gradient Vectors.pdf'), false);
    assert.strictEqual(isMeaninglessFilename('Cellular Mitosis and Genetics.docx'), false);
    assert.strictEqual(isMeaninglessFilename('Photographic Scene & Visual Environmental Analysis'), false);
    assert.strictEqual(isMeaninglessFilename('Image Processing and Deep Neural Networks'), false);
    assert.strictEqual(isMeaninglessFilename('Digital Art: Mythical Frost Dragon & Traveler Encounter'), false);
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

  await t.test('analyzePixelData identifies human portrait with raised hand gesture', () => {
    const width = 64;
    const height = 64;
    const pixels = new Uint8ClampedArray(width * height * 4);

    // Fill background with room wall color (#e0e0e0)
    for (let i = 0; i < width * height; i++) {
      const idx = i * 4;
      pixels[idx] = 224;
      pixels[idx + 1] = 224;
      pixels[idx + 2] = 224;
      pixels[idx + 3] = 255;
    }

    // 1. Person face (skin tone: R=210, G=150, B=120) in center (x=26..38, y=14..32)
    for (let y = 14; y <= 32; y++) {
      for (let x = 26; x <= 38; x++) {
        const idx = (y * width + x) * 4;
        pixels[idx] = 210;
        pixels[idx + 1] = 150;
        pixels[idx + 2] = 120;
      }
    }

    // 2. Person dark shirt (R=30, G=40, B=50) below face (x=20..44, y=36..56)
    for (let y = 36; y <= 56; y++) {
      for (let x = 20; x <= 44; x++) {
        const idx = (y * width + x) * 4;
        pixels[idx] = 30;
        pixels[idx + 1] = 40;
        pixels[idx + 2] = 50;
      }
    }

    // 3. Raised hand on left side (x=8..18, y=10..24) with skin tone (R=210, G=150, B=120)
    for (let y = 10; y <= 24; y++) {
      for (let x = 8; x <= 18; x++) {
        const idx = (y * width + x) * 4;
        pixels[idx] = 210;
        pixels[idx + 1] = 150;
        pixels[idx + 2] = 120;
      }
    }

    const report = analyzePixelData(pixels, width, height);
    assert.strictEqual(report.detectedType, 'person_raised_hand');
    assert.match(report.title, /Raised Hand Gesture/i);
    assert.match(report.subjectDescription, /raising their hand|open-palm|gesture/i);
    // Must NOT contain scenery or geology mentions
    assert.doesNotMatch(report.notesMarkdown, /geomorphology/i);
    assert.doesNotMatch(report.notesMarkdown, /atmospheric scattering/i);
  });

  await t.test('analyzePixelData describes who is there, what he is wearing, and how he is looking in formal headshot', () => {
    const width = 64;
    const height = 64;
    const pixels = new Uint8ClampedArray(width * height * 4);

    // 1. Fill background with solid white (#ffffff)
    for (let i = 0; i < width * height; i++) {
      const idx = i * 4;
      pixels[idx] = 255;
      pixels[idx + 1] = 255;
      pixels[idx + 2] = 255;
      pixels[idx + 3] = 255;
    }

    // 2. Person dark hair directly above face (x=24..40, y=8..15)
    for (let y = 8; y <= 15; y++) {
      for (let x = 24; x <= 40; x++) {
        const idx = (y * width + x) * 4;
        pixels[idx] = 20;
        pixels[idx + 1] = 20;
        pixels[idx + 2] = 25;
      }
    }

    // 3. Person face (skin tone: R=210, G=150, B=120) centered (x=24..40, y=16..34)
    for (let y = 16; y <= 34; y++) {
      for (let x = 24; x <= 40; x++) {
        const idx = (y * width + x) * 4;
        pixels[idx] = 210;
        pixels[idx + 1] = 150;
        pixels[idx + 2] = 120;
      }
    }

    // 4. Person royal blue shirt (R=0, G=56, B=160) below face (x=16..48, y=36..63)
    for (let y = 36; y <= 63; y++) {
      for (let x = 16; x <= 48; x++) {
        const idx = (y * width + x) * 4;
        pixels[idx] = 0;
        pixels[idx + 1] = 56;
        pixels[idx + 2] = 160;
      }
    }

    const report = analyzePixelData(pixels, width, height);
    assert.strictEqual(report.detectedType, 'person_portrait');
    assert.match(report.title, /Royal Blue/i);
    assert.match(report.notesMarkdown, /royal blue/i);
    assert.match(report.notesMarkdown, /short dark/i);
    assert.match(report.notesMarkdown, /friendly|calm/i);
    assert.match(report.notesMarkdown, /white/i);
    assert.match(report.notesMarkdown, /## 1\. What is Happening in the Photo/i);
    // Must NOT contain geomorphology or atmospheric scattering
    assert.doesNotMatch(report.notesMarkdown, /geomorphology/i);
    assert.doesNotMatch(report.notesMarkdown, /atmospheric scattering/i);
  });

  await t.test('analyzePixelData identifies fantasy dragon artwork with glowing cyan eye and deep blue tones', () => {
    const width = 64;
    const height = 64;
    const pixels = new Uint8ClampedArray(width * height * 4);

    // Fill background with deep sapphire / midnight blue tones (#102870) with painterly shading
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const shade = (x + y) % 30;
        pixels[idx] = 16 + shade;
        pixels[idx + 1] = 40 + shade;
        pixels[idx + 2] = 112 + shade * 2;
        pixels[idx + 3] = 255;
      }
    }

    // Glowing cyan/blue dragon eye in center (x=24..40, y=20..32)
    for (let y = 20; y <= 32; y++) {
      for (let x = 24; x <= 40; x++) {
        const idx = (y * width + x) * 4;
        pixels[idx] = 20;
        pixels[idx + 1] = 180;
        pixels[idx + 2] = 255;
      }
    }

    const report = analyzePixelData(pixels, width, height);
    assert.strictEqual(report.detectedType, 'fantasy_creature_art');
    assert.match(report.title, /Mythical Frost Dragon|Digital Art/i);
    assert.match(report.notesMarkdown, /## 1\. What is Happening in the Scene/i);
    assert.match(report.notesMarkdown, /dragon|creature|traveler/i);
    // Must NOT contain meaningless calculus formulas
    assert.doesNotMatch(report.notesMarkdown, /\\nabla f/);
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

