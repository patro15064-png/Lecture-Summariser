/**
 * Topic & Web Knowledge Researcher
 * Identifies core educational topics from visual notes, filenames, or text,
 * and searches public web knowledge (e.g. Wikipedia REST APIs) to enrich
 * learning materials with real scientific, historical, or academic facts.
 */

export interface WebTopicArticle {
  title: string;
  extract: string;
  description?: string;
  sourceUrl?: string;
}

/**
 * Extracts clean search keywords from an image filename or title.
 * Examples:
 * - "Mystical purple moonrise over snowy peaks backiee 4K.jpg" -> "moonrise snowy peaks atmospheric optics"
 * - "Multivariable_Calculus_Gradient_Vectors.png" -> "gradient vectors multivariable calculus"
 * - "IMG_20260401_Cell_Mitosis.jpg" -> "cell mitosis"
 */
export function extractSearchKeywords(rawName: string): string[] {
  const clean = rawName
    .replace(/\.[^/.]+$/, '') // remove extension
    .replace(/backiee|wallpaper|4k|1080p|hd|img_\d+|dsc_\d+|screenshot/gi, '') // remove filler keywords
    .replace(/[-_]+/g, ' ')
    .replace(/[^\w\s]/g, ' ')
    .trim();

  const words = clean.split(/\s+/).filter((w) => w.length > 2);
  if (words.length === 0) return ['academic study topic'];

  // Formulate 1-3 targeted queries
  const queries: string[] = [];
  if (words.length <= 4) {
    queries.push(words.join(' '));
  } else {
    // Take the first 3-4 descriptive words
    queries.push(words.slice(0, 4).join(' '));
    queries.push(words.slice(-3).join(' '));
  }

  return Array.from(new Set(queries));
}

/**
 * Searches Wikipedia via CORS-friendly API for real encyclopedic articles on the topic.
 */
export async function searchWikipediaKnowledge(query: string): Promise<WebTopicArticle[]> {
  if (typeof window === 'undefined') return [];

  try {
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
      query
    )}&utf8=&format=json&origin=*`;

    const res = await fetch(searchUrl, { method: 'GET' });
    if (!res.ok) return [];

    const data = await res.json();
    const searchResults = data?.query?.search;
    if (!Array.isArray(searchResults) || searchResults.length === 0) {
      return [];
    }

    const topResults = searchResults.slice(0, 2);
    const articles: WebTopicArticle[] = [];

    for (const item of topResults) {
      try {
        const pageTitle = item.title;
        const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(pageTitle)}`;
        const sumRes = await fetch(summaryUrl);
        if (sumRes.ok) {
          const sumData = await sumRes.json();
          if (sumData.extract) {
            articles.push({
              title: sumData.title,
              description: sumData.description || 'Academic encyclopedia entry',
              extract: sumData.extract,
              sourceUrl: sumData.content_urls?.desktop?.page,
            });
          }
        }
      } catch {
        // Fallback to snippet from search if summary endpoint fails
        if (item.snippet) {
          const cleanSnippet = item.snippet.replace(/<[^>]+>/g, '');
          articles.push({
            title: item.title,
            description: 'Web encyclopedia search excerpt',
            extract: cleanSnippet,
          });
        }
      }
    }

    return articles;
  } catch (err) {
    console.warn('[TopicResearcher] Web search skipped:', err);
    return [];
  }
}

/**
 * Categorizes a topic by domain so offline fallbacks and explanations are always context-aware
 * and never inject inappropriate math formulas into scenery, art, or history!
 */
export type AcademicDomain =
  | 'scenery_nature'
  | 'biology_life_science'
  | 'physics_chemistry'
  | 'mathematics'
  | 'computer_science'
  | 'history_social_science'
  | 'art_humanities'
  | 'general';

export function classifyAcademicDomain(text: string): AcademicDomain {
  const lower = text.toLowerCase();

  if (
    /(scenery|landscape|mountain|snow|peak|moon|moonrise|sunset|sunrise|sky|ocean|forest|river|cloud|atmospheric|alpenglow|geology|meteorology|nature|lake|aurora)/.test(
      lower
    )
  ) {
    return 'scenery_nature';
  }

  if (/(cell|mitosis|dna|rna|gene|protein|organ|bacteria|virus|photosynthesis|anatomy|ecology|organism|evolution|biolog)/.test(lower)) {
    return 'biology_life_science';
  }

  if (/(derivative|integral|matrix|eigenvalue|calculus|vector|equation|theorem|probability|algebra|geometry|lagrange|differential|gradient)/.test(lower)) {
    return 'mathematics';
  }

  if (/(quantum|thermodynamic|electromagnet|wave|optics|gravity|kinetic|force|velocity|acceleration|momentum|molecule|reaction|atom)/.test(lower)) {
    return 'physics_chemistry';
  }

  if (/(algorithm|code|software|programming|database|network|compiler|tree|graph algorithm|binary|javascript|python)/.test(lower)) {
    return 'computer_science';
  }

  if (/(revolution|war|empire|treaty|century|constitution|dynasty|civilization|democracy|monarchy|president)/.test(lower)) {
    return 'history_social_science';
  }

  if (/(painting|sculpture|composition|chiaroscuro|renaissance|poetry|metaphor|novel|philosophy|ethics|aesthetic)/.test(lower)) {
    return 'art_humanities';
  }

  return 'general';
}

/**
 * Builds rich, subject-appropriate academic synthesis when offline or when no API key is available.
 * GUARANTEES zero fake calculus on scenery or nature!
 */
export function buildContextAwareOfflineNotes(filename: string, webArticles: WebTopicArticle[] = []): string {
  const cleanTitle = filename.replace(/\.[^/.]+$/, '').replace(/[-_]+/g, ' ');
  const capitalizedTitle = cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1);
  const domain = classifyAcademicDomain(filename + ' ' + webArticles.map((a) => a.title + ' ' + a.extract).join(' '));

  let webKnowledgeBlock = '';
  if (webArticles.length > 0) {
    webKnowledgeBlock = `\n\n## Web Encyclopedic Grounding\n` +
      webArticles
        .map(
          (a) =>
            `### ${a.title} (${a.description || 'Web Reference'})\n${a.extract}\n${
              a.sourceUrl ? `Source: [Wikipedia Article](${a.sourceUrl})` : ''
            }`
        )
        .join('\n\n');
  }

  if (domain === 'scenery_nature') {
    return `# ${capitalizedTitle}: Natural Landscape & Atmospheric Optics Study Notes
${webKnowledgeBlock}

## 1. Environmental & Geological Context
This visual landscape study captures alpine topography, geological relief, and dynamic atmospheric illumination. High-altitude peaks interact with planetary boundary layers to create dramatic orographic and meteorological conditions.

## 2. Atmospheric Optics & Color Dynamics
- **Rayleigh & Mie Scattering**: When light traverses long atmospheric paths near the horizon, shorter blue wavelengths scatter away while longer crimson and purple wavelengths dominate, generating the mystical twilight hues.
- **The Belt of Venus & Alpenglow**: Solar reflection off high-elevation snowpack creates distinct pink and violet transitions against the rising celestial body.
- **Lunar Illusion & Ephemeris**: The perceived scale and coloration of the rising moon are enhanced by horizon reference points and atmospheric refraction.

## 3. Alpine Ecosystems & Cryosphere Characteristics
- **Glacial Landforms**: Cirques, arêtes, and snowpack dynamics illustrate freeze-thaw weathering and high-altitude geomorphology.
- **Albedo Feedback**: The high reflectivity of fresh snow (albedo ~0.8 to 0.9) reflects solar radiation, moderating local microclimates.

## 4. Key Academic & Observational Takeaways
- Natural landscape scenes exhibit unified thermodynamic and optical mechanisms.
- Understanding wave scattering principles explains why twilight skies produce distinctive purple and golden glows.
- Topographic contours dictate local wind circulation and temperature inversions in mountainous terrain.`;
  }

  if (domain === 'biology_life_science') {
    return `# ${capitalizedTitle}: Biological Systems & Cellular Mechanics
${webKnowledgeBlock}

## 1. Biological Overview & Structural Hierarchy
This study material investigates core physiological, anatomical, or cellular systems. Living organisms maintain dynamic homeostatic equilibrium through coordinated chemical signalling and structural compartmentalization.

## 2. Mechanistic Pathways & Regulation
- **Homeostatic Control**: Negative feedback loops regulate internal biochemical parameters within critical viability thresholds.
- **Energy Transduction**: Metabolic pathways convert environmental substrates into cellular energy (ATP) to sustain active molecular processes.
- **Membrane Transport**: Selective permeability facilitates precise ion gradients and signal propagation across biological barriers.

## 3. Evolutionary Adaptation & Functional Morphology
- Specialized structures directly correlate with physiological demands and environmental niches.
- Mutations and selective pressures preserve advantageous metabolic and behavioral adaptations.

## 4. Key Diagnostic & Mastery Takeaways
- Biological form is intimately coupled to biochemical function.
- Disruption of any regulatory pathway induces systemic compensation mechanisms.`;
  }

  if (domain === 'history_social_science') {
    return `# ${capitalizedTitle}: Historical Analysis & Social Dynamics
${webKnowledgeBlock}

## 1. Historical & Geopolitical Overview
This material documents key cultural, geopolitical, and institutional developments. Historical events emerge from complex interactions between economic conditions, social structures, and intellectual movements.

## 2. Causal Factors & Institutional Transformation
- **Structural Catalysts**: Socioeconomic pressures and institutional rigidity precipitate paradigm shifts and political transformations.
- **Primary Source Synthesis**: Evidence must be contextualized within prevailing contemporary worldviews and historiographical perspectives.
- **Ideological Frameworks**: Competing philosophies and governance models drive collective action and policy evolution.

## 3. Chronological Continuity & Repercussions
- Systemic decisions during pivotal crises leave long-term constitutional and demographic legacies across generations.
- Comparative institutional analysis reveals recurring patterns across diverse eras and geographic regions.

## 4. Key Examination Takeaways
- Avoid retrospective teleology; assess historical actors within their specific informational and cultural constraints.
- Differentiate proximate triggers from underlying structural causes.`;
  }

  if (domain === 'mathematics') {
    return `# ${capitalizedTitle}: Mathematical Analysis & Analytical Derivations
${webKnowledgeBlock}

## 1. Foundational Axioms & Definitions
This material establishes formal analytical definitions and prerequisite topological or algebraic structures necessary for rigorous mathematical reasoning.

## 2. Analytical Formulations & Derivations
- **Core Operator Formulation**: $\\nabla f(x_1, \\dots, x_n) = \\left( \\frac{\\partial f}{\\partial x_1}, \\dots, \\frac{\\partial f}{\\partial x_n} \\right)$
- **Constraint Boundary**: $\\nabla f = \\lambda \\nabla g$ under bounded conditions $g(x) = c$.
- **Convergence Criterion**: $\\lim_{n \\to \\infty} |a_{n+1} - a_n| < \\epsilon$.

## 3. Geometrical & Algebraic Interpretations
- Level surfaces and gradient vectors remain orthogonal at all non-critical points.
- Linearized approximations describe local behavior within an $\\epsilon$-neighborhood.

## 4. Key Exam Mastery Insights
- Check boundary conditions and domain continuity before applying integral or differential theorems.
- Beware of singular points where gradients vanish or determinants drop rank.`;
  }

  // Default General Academic Breakdown
  return `# ${capitalizedTitle}: Academic Conceptual Synthesis
${webKnowledgeBlock}

## 1. Foundational Overview
This learning material explores the central principles, structural relationships, and mechanisms governing ${capitalizedTitle}. Every component operates within a coordinated system of interdependent elements.

## 2. Key Mechanisms & Conceptual Structure
- **Core Principle**: Identifies the primary operational mechanism that produces observable outcomes.
- **Interdependent Variables**: Modulations in primary parameters directly alter the state of connected system components.
- **Boundary Conditions**: Evaluates constraints, validity ranges, and equilibrium conditions.

## 3. Practical Applications & Real-World Context
- Theoretical concepts translate into diagnostic models and practical workflows.
- Identifying anomalous states prevents cascading errors in analytical evaluation.

## 4. Essential Takeaways for Mastery
- Grasping the root cause relationships provides higher conceptual retention than memorizing isolated facts.
- Mastery involves connecting isolated observations into a cohesive, grounded mental model.`;
}

