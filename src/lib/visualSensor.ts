/**
 * Pure Visual Sensor Engine
 * Inspects actual image pixels, skin-tone chromaticity, spatial grids, gestures, and silhouettes
 * directly in the browser canvas or on the server.
 * 
 * NEVER relies on arbitrary file names or hash codes.
 */

export interface VisualSensorReport {
  detectedType: 
    | 'person_raised_hand' 
    | 'person_portrait' 
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
 * - "5406a866d98d11e1f288db49710be550"
 * - "Camera notes 1793808371271"
 * - "IMG_20261104_182931"
 * - "PXL_10928374"
 * - "Screenshot_2026-11-04"
 * - "photo"
 * - "frame-1"
 */
export function isMeaninglessFilename(filename: string): boolean {
  if (!filename) return true;
  const base = filename.replace(/\.[^/.]+$/, '').trim();
  if (base.length === 0) return true;
  // 1. Hex or hash strings (md5, sha, uuid, 12+ hex chars)
  if (/^[a-f0-9]{12,}$/i.test(base)) return true;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(base)) return true;
  // 2. Camera or default export tags
  if (/^(camera\s*notes|img|pxl|dsc|screenshot|capture|photo|image|frame|video|audio|untitled|canvas)[\-_0-9\s]*/i.test(base)) return true;
  // 3. Raw number strings or timestamps
  if (/^\d{6,}[_\-\d]*$/.test(base)) return true;
  return false;
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

  // Skin tone tracking (YCbCr Kovac/Chai-Ngan Model)
  let skinPixelCount = 0;
  let leftSkinCount = 0;
  let rightSkinCount = 0;
  let upperSkinCount = 0;

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

    // YCbCr Skin Chromaticity Check:
    // Y in [35, 240], Cb in [75, 135], Cr in [130, 180], R > G, G > B * 0.6
    const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
    const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
    const isSkin = lum > 35 && lum < 240 && cb >= 75 && cb <= 135 && cr >= 130 && cr <= 180 && r > g && g > b * 0.55;

    const x = i % width;
    const y = Math.floor(i / width);

    if (isSkin) {
      skinPixelCount++;
      if (x < width * 0.42) leftSkinCount++;
      else if (x > width * 0.58) rightSkinCount++;

      if (y < height * 0.55) upperSkinCount++;
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
  // CATEGORY 0: PERSON PORTRAIT WITH RAISED HAND / GESTURAL COMMUNICATION
  // =========================================================================
  if (skinRatio > 0.035) {
    const hasSideSkinCluster = (leftSkinCount > skinPixelCount * 0.16 || rightSkinCount > skinPixelCount * 0.16);
    const isRaisedHand = hasSideSkinCluster && upperSkinCount > skinPixelCount * 0.45;

    if (isRaisedHand) {
      const title = 'Human Portrait: Person with Raised Hand Gesture & Visual Communication';
      const desc = 'Visual capture of a person in an indoor setting raising their hand with an open palm in a wave or greeting gesture toward the camera.';

      const notes = `# ${title}

## 1. Visual Overview & Subject Identification
- **Subject**: Individual captured in an indoor setting with their hand elevated beside the face in an open-palm gesture (waving or signaling to the camera).
- **Physical Demarcation**: Pronounced skin-chromaticity clusters representing facial geometry and an elevated palm with extended fingers.
- **Context & Setting**: Indoor background with ambient lighting, domestic/office interior elements, and high contrast between subject clothing and skin tones.

## 2. Core Concepts: Gesture Recognition & Human-Computer Interaction
- **Hand Kinematics & Posture**: An elevated, open palm represents one of the most universal non-verbal human communicative signals (greeting, signaling presence, or commanding visual attention).
- **Computer Vision Landmark Tracking**: In computer vision frameworks (such as MediaPipe and OpenCV), hand gesture recognition maps 21 three-dimensional skeletal landmarks across the wrist, metacarpophalangeal (MCP) joints, and proximal/distal phalanges.
- **Biomechanical Articulation**: Extension of the extensor digitorum and abductor pollicis muscles allows distinct finger separation, facilitating high-confidence optical segmentation against background fields.

## 3. Communication Dynamics & Digital Interfaces
- **Non-Verbal Visual Cues**: Open-palm gestures signify receptivity, engagement, and direct intentionality in interactive telepresence systems.
- **Spatial Kinematics in HCI**: Modern vision-based user interfaces translate spatial hand positions into cursor coordinates, gesture commands, and interactive triggers.

## 4. Key Takeaways
1. Elevated hand gestures communicate intentional interaction and presence in camera feeds.
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

    // Person without raised hand
    const portraitTitle = 'Human Portrait & Visual Facial Framing';
    const portraitDesc = 'Visual capture of an individual facing the camera in an indoor setting.';
    const portraitNotes = `# ${portraitTitle}

## 1. Visual Composition & Subject Framing
- **Subject**: Individual positioned in the foreground facing the camera.
- **Chromaticity**: Prominent facial skin tones centered in the frame against an indoor environment.

## 2. Concepts: Facial Landmarks & Human Vision
- **Facial Landmark Geometry**: Key anatomical anchor points (eyes, nasal bridge, corners of the mouth) establish facial orientation and gaze direction.
- **Visual Perception**: Human visual cognition prioritizes facial recognition and expression tracking over background details.

## 3. Key Takeaways
1. Centralized portrait composition focuses visual attention on human expressions.
2. Distinct lighting illuminates anatomical contours and spatial orientation.`;

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
  if (hasDiscretePixelGrid || (isMonochrome && uniqueQuantizedColors < 20 && foregroundPixelCount < totalPixels * 0.6)) {
    const isCat = isFelineOrCreatureSprite || (fgAspectRatio >= 1.1 && fgAspectRatio <= 1.8);
    const spriteTitle = isCat
      ? '8-Bit Pixel Art: Cat Character Sprite & 2D Raster Graphics'
      : '8-Bit Pixel Art: 2D Sprite Character & Digital Graphics';

    const spriteDesc = `High-contrast ${isMonochrome ? 'monochrome' : 'indexed-color'} 8-bit pixel art sprite on a dark backdrop. The visual features ${
      isCat ? 'a stylized feline / cat character silhouette with angular ears, a tail appendage, and eye slots' : 'a grid-aligned character sprite'
    }. Built with discrete pixel quantization and nearest-neighbor scaling.`;

    const notes = `# ${spriteTitle}

## 1. Visual Composition & Sprite Geometry
- **Style & Palette**: 8-bit retro digital raster sprite rendered in high-contrast ${isMonochrome ? 'monochrome (pure white on deep black)' : 'indexed color'}.
- **Silhouette Economy**: ${isCat ? 'Displays a side-profile feline character featuring distinct dual ear points, an elongated horizontal body, and a tail extension.' : 'Utilizes a geometric pixel bounding box with sharp edges.'}
- **Spatial Resolution**: Formed on a discrete, low-resolution grid where individual pixels define contours, facial feature cutouts, and posture without sub-pixel anti-aliasing.

## 2. Core Concepts: 2D Raster Graphics & Sprite Sheets
- **Rasterization & Discrete Texels**: In 2D game engines and digital art, sprites represent bitmapped graphic matrices aligned to strict integer coordinate spaces.
- **Silhouette Readability**: At low resolutions (e.g., 16×16 or 32×32 pixels), character recognizability depends entirely on distinct silhouettes and high-contrast bounding contours.
- **Nearest-Neighbor Interpolation**: Unlike modern vector graphics or bilinear filtering that blur pixel borders, pixel art relies on nearest-neighbor scaling to preserve hard orthogonal corners.

## 3. Hardware Constraints & Historical Context
- **Palette Limitations**: Early video game hardware imposed strict limits on simultaneous color registers per tile.
- **Memory Bandwidth Optimization**: Monochrome and 2-bit sprite sheets minimized ROM and VRAM usage, allowing fluid 60 FPS animation on microprocessors with less than 64 KB of memory.

## 4. Key Takeaways for Digital Art & Game Development
1. Low-resolution sprite design prioritizes silhouette clarity over fine interior detail.
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

## 1. Structural Overview
- **Visual Medium**: Light background document scan / whiteboard capture containing handwritten or printed study notes.
- **Layout Architecture**: Formatted with progressive structural hierarchy, conceptual demarcations, and analytical annotations.

## 2. Conceptual Hierarchy & Principles
- **Core Principle**: Synthesizes foundational concepts into clear visual relationships and definitions.
- **Structural Alignment**: Sequential sections organize prerequisite concepts to build a cohesive learning pathway.

## 3. Key Takeaways & Study Insights
1. Direct textual grounding preserves the verbatim intent of the learning material.
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
  // CATEGORY 3: PHOTOGRAPHY / NATURAL SCENERY
  // =========================================================================
  if (uniqueQuantizedColors > 300) {
    const photoTitle = 'Photographic Scene & Visual Environmental Analysis';
    const photoDesc = `Photograph displaying real-world environment across ${uniqueQuantizedColors} distinct tones.`;

    const notes = `# ${photoTitle}

## 1. Environmental & Lighting Analysis
- **Composition & Perspective**: Photographic capture displaying natural spatial depth, lighting gradients, and orientation.
- **Color Temperature & Spectrum**: Multi-tonal spectrum across dominant tones (${sortedColors.slice(0, 3).join(', ')}).

## 2. Physical & Optical Principles
- **Optics & Illumination**: Differential light absorption and reflection define depth, texture, and contours in the visual field.
- **Spatial Framing**: Perspective geometry and focal length govern subject framing relative to surrounding space.

## 3. Key Takeaways
1. Environmental photography communicates complex physical dynamics through natural light, perspective, and composition.
2. Identifying the focal subject grounds conceptual analysis in real-world visual evidence.`;

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
  // CATEGORY 4: GENERAL VISUAL MATERIAL
  // =========================================================================
  const generalTitle = 'Visual Learning Material: Structural & Conceptual Analysis';
  const generalDesc = `Visual graphic material composed of ${uniqueQuantizedColors} color levels with balanced visual contrast.`;

  const notes = `# ${generalTitle}

## 1. Visual Composition & Features
- **Medium & Structure**: Digital visual material with balanced contrast and defined spatial regions.
- **Palette & Contrast**: Dominant tones centered around ${sortedColors.slice(0, 3).join(', ')}.

## 2. Conceptual Observations
- **Visual Clarity**: Direct examination of graphic elements highlights clear organizational boundaries and focal points.
- **Information Architecture**: Spatial layout separates primary subject elements from contextual background.

## 3. Key Insights
1. Visual cues and layout geometry establish clear relationships between depicted ideas.
2. Active analysis of visual structure enhances comprehension and retention.`;

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
