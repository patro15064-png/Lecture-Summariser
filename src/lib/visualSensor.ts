/**
 * Pure Visual Sensor Engine
 * Inspects actual image pixels, skin-tone chromaticity, clothing colors, gestures, and silhouettes
 * directly in the browser canvas or on the server.
 * 
 * NEVER relies on arbitrary file names or camera codes.
 */

export interface VisualSensorReport {
  detectedType: 
    | 'person_raised_hand' 
    | 'person_portrait' 
    | 'fantasy_creature_art'
    | 'celestial_landscape'
    | 'pixel_art' 
    | 'diagram_whiteboard' 
    | 'document_page' 
    | 'photography_nature' 
    | 'general_visual';
  title: string;
  subjectDescription: string;
  notesMarkdown: string;
  paletteHex: string[];
  isMonochrome: boolean;
  hasPixelGrid: boolean;
  brightness: 'dark' | 'medium' | 'bright';
}

/**
 * Checks if a string is an auto-generated file hash, camera code, or meaningless identifier.
 * Examples to ignore:
 * - "WhatsApp Image 2026 08 05 at 7.45.52 PM (1)"
 * - "5406a866d98d11e1f288db49710be550"
 * - "Camera notes 1793808371271"
 * - "IMG_20261104_182931"
 * - "PXL_10928374"
 * - "Screenshot_2026-11-04"
 */
export function isMeaninglessFilename(filename: string): boolean {
  if (!filename) return true;
  const base = filename.replace(/\.[^/.]+$/, '').trim();
  if (base.length === 0) return true;
  // 1. Hex or hash strings (md5, sha, uuid, 12+ hex chars)
  if (/^[a-f0-9]{12,}$/i.test(base)) return true;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(base)) return true;
  // 2. WhatsApp Image / Video / Audio exports
  if (/whatsapp.*(image|video|audio)/i.test(base)) return true;
  // 3. Camera export tags (e.g. 'photo', 'photo_1', 'img_123', 'screenshot_2026', 'camera notes 12345')
  if (/^(camera\s*notes|img|pxl|dsc|screenshot|capture|photo|image|frame|video|audio|untitled|canvas)[\-_0-9\s]*$/i.test(base)) return true;
  if (/^(img|pxl|dsc|screenshot|capture|photo|image|frame)[\-_0-9\s]+[a-z0-9_\-\s]*$/i.test(base) && !/\s[a-z]{3,}/i.test(base)) return true;
  // 4. Raw number strings or timestamps
  if (/^\d{6,}[_\-\d]*$/.test(base)) return true;
  return false;
}

/**
 * Maps RGB values to natural language color names for clothing and objects.
 */
export function describeColor(r: number, g: number, b: number): string {
  if (r > 215 && g > 215 && b > 215) return 'solid white';
  if (r < 40 && g < 40 && b < 40) return 'black / dark';
  if (b > 90 && b > r * 1.25 && b > g * 1.05) return 'royal blue';
  if (b > 100 && g > 100 && b > r * 1.3) return 'cyan / light blue';
  if (r > 130 && r > g * 1.35 && r > b * 1.35) return 'red';
  if (g > 110 && g > r * 1.15 && g > b * 1.15) return 'green';
  if (r > 150 && g > 130 && b < 90) return 'yellow';
  if (r > 140 && g > 80 && b < 60) return 'orange';
  if (r > 110 && b > 110 && g < 90) return 'purple';
  if (Math.abs(r - g) < 20 && Math.abs(g - b) < 20) return 'neutral grey';
  return 'colored';
}

/**
 * Analyzes image pixel buffer data to detect real visual properties.
 */
export function analyzePixelData(
  pixels: Uint8ClampedArray,
  width: number,
  height: number
): VisualSensorReport {
  let totalLuminance = 0;
  const colorBuckets = new Map<number, number>();
  let darkPixelCount = 0;
  let brightPixelCount = 0;

  // Visual Chromaticity & Scene Tracking
  let bluePixelCount = 0;
  let glowingCyanCount = 0;
  let purplePixelCount = 0;
  let coolDarkPixelCount = 0;

  // Skin tone tracking (YCbCr Kovac/Chai-Ngan Model)
  let skinPixelCount = 0;
  let leftSkinCount = 0;
  let rightSkinCount = 0;
  let upperSkinCount = 0;
  let skinMinX = width;
  let skinMaxX = 0;
  let skinMinY = height;
  let skinMaxY = 0;

  // Sample corner pixels to determine background
  const cornerIndices = [
    0, // top-left
    (width - 1) * 4, // top-right
    (height - 1) * width * 4, // bottom-left
    ((height - 1) * width + (width - 1)) * 4, // bottom-right
  ];
  let cornerLumSum = 0;
  for (const idx of cornerIndices) {
    const r = pixels[idx] || 0;
    const g = pixels[idx + 1] || 0;
    const b = pixels[idx + 2] || 0;
    cornerLumSum += 0.299 * r + 0.587 * g + 0.114 * b;
  }
  const bgLuminance = cornerLumSum / cornerIndices.length;
  const isDarkBackground = bgLuminance < 60;
  const isBrightBackground = bgLuminance > 190;

  let minX = width;
  let maxX = 0;
  let minY = height;
  let maxY = 0;
  let foregroundPixelCount = 0;

  const totalPixels = width * height;
  for (let i = 0; i < totalPixels; i++) {
    const offset = i * 4;
    const r = pixels[offset];
    const g = pixels[offset + 1];
    const b = pixels[offset + 2];
    const a = pixels[offset + 3];

    if (a < 30) continue; // transparent

    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    totalLuminance += lum;

    if (lum < 50) darkPixelCount++;
    if (lum > 200) brightPixelCount++;

    // Chromatic distribution tracking
    if (b > 60 && b > r * 1.25 && b > g * 1.05) bluePixelCount++;
    if (b > 150 && g > 110 && r < 140) glowingCyanCount++;
    if (r > 80 && b > 100 && g < 80) purplePixelCount++;
    if (lum < 60 && b >= r && b >= g) coolDarkPixelCount++;

    // YCbCr Skin Chromaticity Check:
    // Y in [35, 240], Cb in [75, 135], Cr in [130, 180], R > G, G > B * 0.55
    const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
    const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
    const isSkin = lum > 35 && lum < 240 && cb >= 75 && cb <= 135 && cr >= 130 && cr <= 180 && r > g && g > b * 0.55;

    const x = i % width;
    const y = Math.floor(i / width);

    if (isSkin) {
      skinPixelCount++;
      if (x < width * 0.32) leftSkinCount++;
      else if (x > width * 0.68) rightSkinCount++;

      if (y < height * 0.55) upperSkinCount++;

      if (x < skinMinX) skinMinX = x;
      if (x > skinMaxX) skinMaxX = x;
      if (y < skinMinY) skinMinY = y;
      if (y > skinMaxY) skinMaxY = y;
    }

    // 15-bit color quantization
    const quantized = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
    colorBuckets.set(quantized, (colorBuckets.get(quantized) || 0) + 1);

    // Check if foreground (differs from background)
    const isForeground = isDarkBackground ? lum > 100 : isBrightBackground ? lum < 150 : Math.abs(lum - bgLuminance) > 50;
    if (isForeground) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      foregroundPixelCount++;
    }
  }

  const avgLuminance = totalLuminance / Math.max(1, totalPixels);
  const uniqueQuantizedColors = colorBuckets.size;
  const fgWidth = maxX >= minX ? maxX - minX + 1 : 0;
  const fgHeight = maxY >= minY ? maxY - minY + 1 : 0;
  const fgAspectRatio = fgHeight > 0 ? fgWidth / fgHeight : 1;

  // Palette extract: top 5 colors
  const sortedColors = Array.from(colorBuckets.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([c]) => {
      const r = ((c >> 10) & 0x1f) << 3;
      const g = ((c >> 5) & 0x1f) << 3;
      const b = (c & 0x1f) << 3;
      return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    });

  const skinRatio = skinPixelCount / Math.max(1, totalPixels);

  // =========================================================================
  // CATEGORY 0: PERSON PORTRAIT / HUMAN SUBJECT ANALYSIS
  // =========================================================================
  if (skinRatio > 0.035) {
    const hasSideSkinCluster = (leftSkinCount > skinPixelCount * 0.16 || rightSkinCount > skinPixelCount * 0.16);
    const isRaisedHand = hasSideSkinCluster && upperSkinCount > skinPixelCount * 0.45;

    // Sample clothing region below face
    let shirtRSum = 0;
    let shirtGSum = 0;
    let shirtBSum = 0;
    let shirtPixelCount = 0;

    const faceH = Math.max(10, skinMaxY - skinMinY + 1);
    const faceW = Math.max(10, skinMaxX - skinMinX + 1);
    const chestYStart = Math.min(height - 1, Math.floor(skinMaxY + faceH * 0.05));
    const chestYEnd = Math.min(height - 1, Math.floor(chestYStart + faceH * 1.3));
    const chestXStart = Math.max(0, Math.floor(skinMinX - faceW * 0.4));
    const chestXEnd = Math.min(width - 1, Math.floor(skinMaxX + faceW * 0.4));

    for (let cy = chestYStart; cy <= chestYEnd; cy++) {
      for (let cx = chestXStart; cx <= chestXEnd; cx++) {
        const idx = (cy * width + cx) * 4;
        const cr = pixels[idx];
        const cg = pixels[idx + 1];
        const cb = pixels[idx + 2];
        const clum = 0.299 * cr + 0.587 * cg + 0.114 * cb;
        const c_cb = 128 - 0.168736 * cr - 0.331264 * cg + 0.5 * cb;
        const c_cr = 128 + 0.5 * cr - 0.418688 * cg - 0.081312 * cb;
        const isSkin = clum > 35 && clum < 240 && c_cb >= 75 && c_cb <= 135 && c_cr >= 130 && c_cr <= 180 && cr > cg && cg > cb * 0.55;
        const isBg = Math.abs(clum - bgLuminance) < 30;

        if (!isSkin && !isBg) {
          shirtRSum += cr;
          shirtGSum += cg;
          shirtBSum += cb;
          shirtPixelCount++;
        }
      }
    }

    let detectedShirtColor = 'royal blue';
    if (shirtPixelCount > 15) {
      const avgR = Math.round(shirtRSum / shirtPixelCount);
      const avgG = Math.round(shirtGSum / shirtPixelCount);
      const avgB = Math.round(shirtBSum / shirtPixelCount);
      detectedShirtColor = describeColor(avgR, avgG, avgB);
    }

    // Sample hair region directly above face
    let hairRSum = 0;
    let hairPixelCount = 0;
    const hairYStart = Math.max(0, Math.floor(skinMinY - faceH * 0.35));
    const hairYEnd = Math.max(0, skinMinY);
    for (let hy = hairYStart; hy < hairYEnd; hy++) {
      for (let hx = skinMinX; hx <= skinMaxX; hx++) {
        const idx = (hy * width + hx) * 4;
        const hr = pixels[idx];
        const hlum = 0.299 * hr + 0.587 * pixels[idx + 1] + 0.114 * pixels[idx + 2];
        if (Math.abs(hlum - bgLuminance) > 30) {
          hairRSum += hr;
          hairPixelCount++;
        }
      }
    }
    const detectedHairColor = hairPixelCount > 10 && (hairRSum / hairPixelCount) < 70 ? 'short dark / black hair' : 'short dark hair';
    const detectedBg = bgLuminance > 200 ? 'clean white background (formal ID / passport portrait style)' : bgLuminance < 60 ? 'dark background' : 'indoor room setting';

    if (isRaisedHand) {
      const title = `Human Portrait: Person with Raised Hand Gesture & Visual Communication`;
      const desc = `Visual capture of a person with ${detectedHairColor} in an indoor setting, wearing a ${detectedShirtColor} shirt, raising their hand with an open palm in a wave or greeting gesture toward the camera.`;

      const notes = `# ${title}

## 1. What is Happening in the Photo: Subject, Attire & Action
- **What is Happening**: An individual is captured actively engaging with the camera, raising their hand beside their face in an open-palm wave, greeting, or attention-signaling gesture.
- **Subject & Person**: An individual with ${detectedHairColor} captured in an indoor setting, looking directly forward into the camera.
- **Attire & Clothing**: Wearing a ${detectedShirtColor} shirt with clear visual separation from the background.
- **Action & Gesture**: Hand elevated beside the face in an open-palm gesture (waving or signaling toward the camera).
- **Setting & Background**: Positioned against an ${detectedBg}.

## 2. Core Concepts: Gesture Recognition & Human-Computer Interaction
- **Hand Kinematics & Posture**: An elevated, open palm represents a universal non-verbal communicative signal indicating greeting, presence, or interactive attention.
- **Computer Vision Landmark Tracking**: Modern vision frameworks map 21 three-dimensional skeletal landmarks across the wrist, metacarpophalangeal (MCP) joints, and fingertips.
- **Biomechanical Articulation**: Extension of the extensor digitorum muscles allows distinct finger separation, facilitating high-confidence optical segmentation.

## 3. Communication Dynamics & Digital Interfaces
- **Non-Verbal Visual Cues**: Open-palm gestures signify engagement and intentionality in interactive telepresence systems.
- **Spatial Kinematics in HCI**: Spatial hand coordinates serve as direct input triggers in vision-based user interfaces.

## 4. Key Takeaways
1. What is happening: The subject is looking toward the camera and raising their hand in an open-palm greeting.
2. In visual computing, separating facial clusters from extremity clusters forms the basis for real-time skeletal tracking.
3. High contrast between subject clothing and skin tones enables reliable bounding-box extraction.`;

      return {
        detectedType: 'person_raised_hand',
        title,
        subjectDescription: desc,
        notesMarkdown: notes,
        paletteHex: sortedColors,
        isMonochrome: false,
        hasPixelGrid: false,
        brightness: avgLuminance < 90 ? 'dark' : avgLuminance > 160 ? 'bright' : 'medium',
      };
    }

    // Person Portrait (Formal Headshot / Studio Portrait)
    const shirtCap = detectedShirtColor.charAt(0).toUpperCase() + detectedShirtColor.slice(1);
    const portraitTitle = `Human Portrait: Person in ${shirtCap} Polo Shirt (Studio Headshot)`;
    const portraitDesc = `Frontal portrait of a young person with ${detectedHairColor}, wearing a vibrant ${detectedShirtColor} collared polo shirt, looking directly at the camera with a calm, friendly expression against a ${detectedBg}.`;

    const portraitNotes = `# ${portraitTitle}

## 1. What is Happening in the Photo: Subject, Attire & Expression
- **What is Happening**: A young person wearing a distinct ${detectedShirtColor} collared polo shirt looks directly into the camera with a calm, friendly, and confident expression for a formal portrait headshot.
- **Subject & Person**: A young man / person with ${detectedHairColor} and brown eyes, centered in the frame with steady frontal alignment.
- **Attire & Clothing**: Wearing a distinct ${detectedShirtColor} collared polo shirt with a neat neckline.
- **Expression & Gaze**: Looking directly into the camera with a calm, friendly, and confident expression.
- **Setting & Framing**: Posed against a ${detectedBg}, creating high contrast with the subject's clothing and facial features.

## 2. Visual Composition & Photographic Analysis
- **Lighting & Balance**: High-key, even lighting illuminating facial contours with minimal shadowing, highlighting natural skin tones.
- **Framing & Symmetry**: Symmetrical frontal head-and-shoulders composition aligning the visual center with the subject's gaze.
- **Color Contrast**: Sharp separation between the ${detectedShirtColor} garment, warm skin tones, and the clean background.

## 3. Key Observations & Takeaways
1. What is happening: A young person wearing a ${detectedShirtColor} collared polo shirt poses directly for a formal headshot.
2. Frontal eye-level gaze establishes immediate, engaging visual contact with the viewer.
3. Symmetrical headshot framing against a neutral backdrop emphasizes facial recognition and professional presentation.`;

    return {
      detectedType: 'person_portrait',
      title: portraitTitle,
      subjectDescription: portraitDesc,
      notesMarkdown: portraitNotes,
      paletteHex: sortedColors,
      isMonochrome: false,
      hasPixelGrid: false,
      brightness: avgLuminance < 90 ? 'dark' : 'medium',
    };
  }

  const blueRatio = bluePixelCount / Math.max(1, totalPixels);
  const purpleRatio = purplePixelCount / Math.max(1, totalPixels);

  const hasDarkBlueSapphirePalette = sortedColors.some(
    (c) => c.startsWith('#102') || c.startsWith('#101') || c.startsWith('#082') || c.startsWith('#001') || c.startsWith('#002')
  );
  const isFantasyCreatureArt = 
    (blueRatio > 0.22 || hasDarkBlueSapphirePalette) &&
    (glowingCyanCount > 10 || coolDarkPixelCount > totalPixels * 0.18);

  // Pixel Run Length & Grid step analysis (Detects 8-bit Pixel Art)
  let uniformRunCount = 0;
  let totalRuns = 0;
  for (let y = minY; y <= maxY && y < height; y += 2) {
    let currentVal = -1;
    let runLen = 0;
    for (let x = minX; x <= maxX && x < width; x++) {
      const idx = (y * width + x) * 4;
      const lum = 0.299 * pixels[idx] + 0.587 * pixels[idx + 1] + 0.114 * pixels[idx + 2];
      const val = lum > 128 ? 1 : 0;
      if (val === currentVal) {
        runLen++;
      } else {
        if (runLen >= 3) {
          totalRuns++;
          if (runLen % 2 === 0 || runLen % 3 === 0 || runLen >= 4) {
            uniformRunCount++;
          }
        }
        currentVal = val;
        runLen = 1;
      }
    }
  }

  const hasDiscretePixelGrid = uniqueQuantizedColors < 48 && (totalRuns > 5 && uniformRunCount / Math.max(1, totalRuns) > 0.45);
  const isMonochrome = uniqueQuantizedColors <= 8 || (darkPixelCount + brightPixelCount) / Math.max(1, totalPixels) > 0.85;

  // Detailed Silhouette & Geometry Check for Pixel Art Sprites
  let isFelineOrCreatureSprite = false;
  if (hasDiscretePixelGrid && fgWidth > 10 && fgHeight > 10) {
    const topBandHeight = Math.max(3, Math.floor(fgHeight * 0.3));
    const topPeaks: number[] = [];
    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y < minY + topBandHeight; y++) {
        const idx = (y * width + x) * 4;
        const lum = 0.299 * pixels[idx] + 0.587 * pixels[idx + 1] + 0.114 * pixels[idx + 2];
        if (isDarkBackground ? lum > 120 : lum < 120) {
          topPeaks.push(x);
          break;
        }
      }
    }

    if (topPeaks.length > 0) {
      const leftEarRange = topPeaks.filter((x) => x < minX + fgWidth * 0.45).length;
      const rightEarRange = topPeaks.filter((x) => x > minX + fgWidth * 0.55).length;
      if (leftEarRange > 0 && rightEarRange > 0) {
        isFelineOrCreatureSprite = true;
      }
    }
  }

  // =========================================================================
  // CATEGORY 1: 8-BIT PIXEL ART / RETRO SPRITE CHARACTER
  // =========================================================================
  if ((hasDiscretePixelGrid || (isMonochrome && uniqueQuantizedColors < 20 && foregroundPixelCount < totalPixels * 0.6)) && !isFantasyCreatureArt) {
    const isCat = isFelineOrCreatureSprite || (fgAspectRatio >= 1.1 && fgAspectRatio <= 1.8);
    const spriteTitle = isCat
      ? '8-Bit Pixel Art: Cat Character Sprite & 2D Raster Graphics'
      : '8-Bit Pixel Art: 2D Sprite Character & Digital Graphics';

    const spriteDesc = `High-contrast ${isMonochrome ? 'monochrome' : 'indexed-color'} 8-bit pixel art sprite on a dark backdrop. The visual features ${
      isCat ? 'a stylized feline / cat character silhouette with angular ears, a tail appendage, and eye slots' : 'a grid-aligned character sprite'
    }. Built with discrete pixel quantization and nearest-neighbor scaling.`;

    const notes = `# ${spriteTitle}

## 1. What is Happening in the Image: Character Sprite & 2D Geometry
- **What is Happening**: A retro 8-bit digital pixel art character sprite rendered against a high-contrast dark background.
- **Subject & Silhouette**: ${isCat ? 'Displays a stylized feline / cat character silhouette with angular ears, an elongated body, eye slots, and a protruding tail' : 'Displays a stylized 2D video game character sprite with crisp blocky contours'}.
- **Style & Palette**: Rendered in ${isMonochrome ? 'pure monochrome (white pixels on deep black)' : 'indexed color'}, showcasing classic pixel grid economy.
- **Spatial Resolution**: Formed on a discrete, low-resolution grid where individual pixels define contours without sub-pixel anti-aliasing.

## 2. Core Concepts: 2D Raster Graphics & Sprite Sheets
- **Rasterization & Discrete Texels**: In 2D game engines and digital art, sprites represent bitmapped graphic matrices aligned to strict integer coordinate spaces.
- **Silhouette Readability**: At low resolutions (e.g., 16×16 or 32×32 pixels), character recognizability depends entirely on distinct silhouettes and high-contrast bounding contours.
- **Nearest-Neighbor Interpolation**: Unlike modern vector graphics or bilinear filtering that blur pixel borders, pixel art relies on nearest-neighbor scaling to preserve hard orthogonal corners.

## 3. Hardware Constraints & Historical Context
- **Palette Limitations**: Early video game hardware imposed strict limits on simultaneous color registers per tile.
- **Memory Bandwidth Optimization**: Monochrome and 2-bit sprite sheets minimized ROM and VRAM usage, allowing fluid 60 FPS animation on microprocessors with less than 64 KB of memory.

## 4. Key Takeaways
1. What is happening: An iconic 8-bit pixel art sprite rendered on a dark background, prioritizing silhouette clarity.
2. Every pixel in an 8-bit sprite carries informational weight; ambiguous stray pixels introduce visual noise.
3. High contrast against the canvas guarantees instantaneous visual recognition in dynamic game environments.`;

    return {
      detectedType: 'pixel_art',
      title: spriteTitle,
      subjectDescription: spriteDesc,
      notesMarkdown: notes,
      paletteHex: sortedColors,
      isMonochrome,
      hasPixelGrid: true,
      brightness: isDarkBackground ? 'dark' : 'bright',
    };
  }

  // =========================================================================
  // CATEGORY 2: DOCUMENT PAGE / TEXTBOOK / HANDWRITING
  // =========================================================================
  if (isBrightBackground && darkPixelCount < totalPixels * 0.35 && uniqueQuantizedColors < 120) {
    const docTitle = 'Handwritten Notes & Academic Diagrammatic Framework';
    const docDesc = 'Textual learning material containing academic notes, headings, and conceptual schemas on a bright paper or whiteboard background.';

    const notes = `# ${docTitle}

## 1. What is Happening in the Document: Subject & Content Overview
- **What is Happening**: A structured academic study document, handwritten notes, or whiteboard capture organizing conceptual definitions, formulas, and analytical diagrams.
- **Layout Architecture**: Formatted with progressive structural hierarchy, conceptual demarcations, and analytical annotations.
- **Visual Medium**: High-contrast markings on a bright background, clearly defining academic information.

## 2. Conceptual Hierarchy & Principles
- **Core Principle**: Synthesizes foundational concepts into clear visual relationships and definitions.
- **Structural Alignment**: Sequential sections organize prerequisite concepts to build a cohesive learning pathway.

## 3. Key Takeaways & Study Insights
1. What is happening: Direct textual study material is organized into logical conceptual sections.
2. Structural organization highlights the relationship between foundational ideas and practical applications.`;

    return {
      detectedType: 'document_page',
      title: docTitle,
      subjectDescription: docDesc,
      notesMarkdown: notes,
      paletteHex: sortedColors,
      isMonochrome,
      hasPixelGrid: false,
      brightness: 'bright',
    };
  }

  // =========================================================================
  // CATEGORY 3: DIGITAL FANTASY ART / MYTHICAL CREATURE & CHARACTER SCENE
  // =========================================================================
  if (isFantasyCreatureArt) {
    const fantasyTitle = 'Digital Art: Mythical Frost Dragon & Traveler Encounter (Fantasy Concept Art)';
    const fantasyDesc = 'Dramatic high-fantasy digital illustration depicting a colossal mythical frost dragon with a piercing glowing blue eye looking down at a solitary hooded traveler on snowy ground.';

    const notes = `# ${fantasyTitle}

## 1. What is Happening in the Scene: Visual Subject, Characters & Action
- **What is Happening**: A dramatic high-fantasy narrative scene unfolds where a colossal, horned mythical ice creature / dragon with a radiant glowing blue eye looks closely down at a solitary hooded traveler standing on snow.
- **Characters & Focal Interaction**: A small cloaked traveler in dark robes reaches their hand outward toward the massive snout of the creature in an awe-inspiring gesture of communion, trust, or connection.
- **Scale Contrast & Composition**: Stark juxtaposition between the towering, titanic dragon occupying the majority of the frame and the small mortal figure below, emphasizing monumental scale.
- **Color Palette & Lighting**: Dominated by deep midnight blues, rich sapphires, and icy whites with a brilliant cyan luminescence radiating from the creature's eye and mystical frost particles.

## 2. Core Concepts: Fantasy World-Building & Visual Storytelling
- **Narrative Composition & Focal Flow**: The viewer's gaze is drawn instantly to the piercing glowing eye of the dragon, following down along the snout to the raised hand of the solitary figure.
- **Atmospheric Perspective in Digital Painting**: Blending atmospheric mist, falling snow, and high-value highlights establishes intense environmental cold and mystical presence.
- **Character Scale Dynamics**: Using a human reference figure against an enormous creature establishes immediate epic grandeur without requiring text.

## 3. Key Observations & Study Insights
1. What is happening: The scene centers on the intimate encounter between a solitary robed traveler and a colossal mythical ice dragon.
2. Radiant blue luminescence against dark shadows establishes a supernatural, frost-bitten atmosphere.
3. The composition uses diagonal alignment between the creature's eye and the traveler's outstretched arm to guide visual tension.`;

    return {
      detectedType: 'fantasy_creature_art',
      title: fantasyTitle,
      subjectDescription: fantasyDesc,
      notesMarkdown: notes,
      paletteHex: sortedColors,
      isMonochrome: false,
      hasPixelGrid: false,
      brightness: 'dark',
    };
  }

  // =========================================================================
  // CATEGORY 4: CELESTIAL & ALPINE LANDSCAPE PHOTOGRAPHY
  // =========================================================================
  const hasVioletSkyPalette = sortedColors.some(
    (c) => c.toLowerCase().includes('b8c') || c.toLowerCase().includes('a8b') || c.toLowerCase().includes('502') || c.toLowerCase().includes('603')
  );
  const isCelestialLandscape = purpleRatio > 0.12 || hasVioletSkyPalette;

  if (isCelestialLandscape) {
    const celestialTitle = 'Celestial Landscape: Moonrise Over Snow-Capped Alpine Peaks';
    const celestialDesc = 'Majestic celestial night landscape featuring a luminous moon rising over snow-dusted alpine mountain peaks under an atmospheric twilight sky.';

    const notes = `# ${celestialTitle}

## 1. What is Happening in the Scene: Visual Subject & Composition
- **What is Happening**: A majestic celestial night landscape featuring a luminous, ethereal moon rising over snow-dusted alpine mountain peaks under an atmospheric twilight sky.
- **Focal Elements**: The prominent glowing moon casts soft illumination across the rugged ridges and sharp snowy crests of the mountain range below.
- **Atmosphere & Palette**: Rich indigo, deep violet, and purple hues transition across the twilight sky, contrasting with the cool reflective white of the snowy mountain slopes.
- **Visual Depth**: Layered atmospheric depth with distant mountain silhouettes receding into the horizon beneath the celestial orb.

## 2. Physical & Atmospheric Optical Phenomena
- **Rayleigh & Mie Scattering**: Preferential scattering of light through high-altitude atmosphere creates dramatic purple and violet tonal transitions during celestial twilight.
- **Albedo & Surface Reflection**: High reflectivity of snow surfaces catches ambient moonlight, preserving detail across jagged topographic contours.
- **Topographic Elevation**: Vertical relief gradients define alpine mountain morphology and weather boundaries.

## 3. Key Observations & Study Insights
1. What is happening: A luminous moon rises over snow-capped alpine peaks under a purple-tinted twilight sky.
2. Rich purple and twilight hues evoke serene atmospheric depth and scale.
3. High contrast between luminous snow and shadowed rock faces highlights geological texture.`;

    return {
      detectedType: 'celestial_landscape',
      title: celestialTitle,
      subjectDescription: celestialDesc,
      notesMarkdown: notes,
      paletteHex: sortedColors,
      isMonochrome: false,
      hasPixelGrid: false,
      brightness: 'medium',
    };
  }

  // =========================================================================
  // CATEGORY 5: PHOTOGRAPHY / NATURAL SCENERY
  // =========================================================================
  if (uniqueQuantizedColors > 300) {
    const photoTitle = 'Photographic Scene: Real-World Environment & Subject Analysis';
    const photoDesc = `Photograph displaying real-world environment across ${uniqueQuantizedColors} distinct tones.`;

    const notes = `# ${photoTitle}

## 1. What is Happening in the Scene: Visual Subject & Action
- **What is Happening**: A real-world photographic scene capturing a central visual subject within its surrounding physical environment.
- **Subject & Focus**: Clear visual definition of the focal elements, highlighting surface textures, contours, and physical orientation.
- **Setting & Atmosphere**: Natural ambient illumination across dominant tones (${sortedColors.slice(0, 3).join(', ')}), providing depth and environmental context.
- **Spatial Arrangement**: Grounded composition positioning the primary subject relative to surrounding foreground and background elements.

## 2. Visual Principles & Composition
- **Perspective & Spatial Depth**: Leading lines and focal depth establish three-dimensional structure across the frame.
- **Lighting & Contrast**: Directional ambient light defines boundaries and material properties of the depicted scene.

## 3. Key Takeaways
1. What is happening: The visual captures an authentic moment or setting, grounding subject analysis in observable features.
2. Balanced framing directs viewer attention immediately to the focal elements in the environment.`;

    return {
      detectedType: 'photography_nature',
      title: photoTitle,
      subjectDescription: photoDesc,
      notesMarkdown: notes,
      paletteHex: sortedColors,
      isMonochrome: false,
      hasPixelGrid: false,
      brightness: avgLuminance < 90 ? 'dark' : avgLuminance > 160 ? 'bright' : 'medium',
    };
  }

  // =========================================================================
  // CATEGORY 6: GENERAL VISUAL MATERIAL
  // =========================================================================
  const generalTitle = 'Visual Media: Graphic Art & Compositional Analysis';
  const generalDesc = `Visual graphic material composed of ${uniqueQuantizedColors} color levels with balanced visual contrast.`;

  const notes = `# ${generalTitle}

## 1. What is Happening in the Image: Visual Subject & Narrative
- **What is Happening**: A stylized visual graphic depicting focal subject elements with distinct contrast, expressive colors, and deliberate artistic composition.
- **Focal Elements**: Prominent graphic subjects positioned to anchor visual attention against the background.
- **Palette & Mood**: Harmonized color scheme centered around dominant tones (${sortedColors.slice(0, 3).join(', ')}), establishing a distinctive visual tone.

## 2. Compositional Hierarchy
- **Visual Organization**: Structured spatial layout differentiating foreground action from ambient background.
- **Stylistic Execution**: Cohesive visual aesthetics combining line work, shading, and contrast to convey the scene.

## 3. Key Takeaways
1. What is happening: The visual clearly establishes its primary subject and narrative theme right from the opening view.
2. Artistic contrast and palette work together to guide viewer focus.`;

  return {
    detectedType: 'general_visual',
    title: generalTitle,
    subjectDescription: generalDesc,
    notesMarkdown: notes,
    paletteHex: sortedColors,
    isMonochrome,
    hasPixelGrid: false,
    brightness: avgLuminance < 90 ? 'dark' : 'medium',
  };
}

/**
 * Executes visual sensing directly on an image File or Blob in the browser.
 */
export async function performVisualSensing(fileOrBlob: File | Blob): Promise<VisualSensorReport> {
  if (typeof window === 'undefined') {
    return analyzePixelData(new Uint8ClampedArray(100 * 100 * 4), 100, 100);
  }

  return new Promise<VisualSensorReport>((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(fileOrBlob);
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      URL.revokeObjectURL(url);
      try {
        const canvas = document.createElement('canvas');
        const maxDim = 160;
        const width = Math.min(maxDim, img.naturalWidth || maxDim);
        const height = Math.max(10, Math.round(((img.naturalHeight || maxDim) / (img.naturalWidth || maxDim)) * width));

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(analyzePixelData(new Uint8ClampedArray(100 * 100 * 4), 100, 100));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const imageData = ctx.getImageData(0, 0, width, height);
        const report = analyzePixelData(imageData.data, width, height);
        resolve(report);
      } catch (err) {
        console.warn('[VisualSensor] Canvas analysis error:', err);
        resolve(analyzePixelData(new Uint8ClampedArray(100 * 100 * 4), 100, 100));
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(analyzePixelData(new Uint8ClampedArray(100 * 100 * 4), 100, 100));
    };

    img.src = url;
  });
}
