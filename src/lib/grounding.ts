import { TranscriptSegment, ConceptNode, GraphEdge, ConceptGraphData, Sm2Rating } from '@/types/lecture';

/**
 * Normalizes text for strict verbatim grounding comparison:
 * lowercase, stripped punctuation, normalized whitespace.
 */
export function normalizeForGrounding(str: string): string {
  return str
    .toLowerCase()
    .replace(/['"“”‘’`]/g, '')
    .replace(/[.,!?;:()\[\]{}_\\/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface GroundingMatchResult {
  isGrounded: boolean;
  verbatimQuote?: string;
  startSeconds: number;
  endSeconds: number;
  similarityRatio: number;
}

/**
 * Validates that an agent's extracted quote or statement is genuinely grounded
 * in the real transcript. Tolerates only whitespace and minor punctuation discrepancies.
 */
export function validateVerbatimGrounding(
  candidateQuote: string,
  segments: TranscriptSegment[],
  fullTranscriptText?: string
): GroundingMatchResult {
  if (!candidateQuote || segments.length === 0) {
    return { isGrounded: false, startSeconds: 0, endSeconds: 0, similarityRatio: 0 };
  }

  const rawTranscript = fullTranscriptText || segments.map((s) => s.text).join(' ');
  const normCandidate = normalizeForGrounding(candidateQuote);
  const normFullTranscript = normalizeForGrounding(rawTranscript);

  // Exact normalized substring match
  if (normFullTranscript.includes(normCandidate)) {
    // Find the segments spanning this quote to get precise timestamps
    const { startSeconds, endSeconds, matchedText } = findSegmentsForSubstring(normCandidate, segments);
    return {
      isGrounded: true,
      verbatimQuote: matchedText || candidateQuote,
      startSeconds,
      endSeconds,
      similarityRatio: 1.0,
    };
  }

  // Sliding window token match for slight ASR / boundary offset
  const candidateWords = normCandidate.split(' ').filter(Boolean);
  if (candidateWords.length >= 3) {
    // Check if at least 85% of consecutive words match in order
    const windowSize = candidateWords.length;
    const transcriptWords = normFullTranscript.split(' ').filter(Boolean);

    for (let i = 0; i <= transcriptWords.length - windowSize; i++) {
      const window = transcriptWords.slice(i, i + windowSize);
      let matchCount = 0;
      for (let j = 0; j < windowSize; j++) {
        if (window[j] === candidateWords[j]) {
          matchCount++;
        }
      }

      const ratio = matchCount / windowSize;
      if (ratio >= 0.88) {
        const { startSeconds, endSeconds, matchedText } = findSegmentsForSubstring(window.join(' '), segments);
        return {
          isGrounded: true,
          verbatimQuote: matchedText || candidateQuote,
          startSeconds,
          endSeconds,
          similarityRatio: ratio,
        };
      }
    }
  }

  return {
    isGrounded: false,
    startSeconds: 0,
    endSeconds: 0,
    similarityRatio: 0,
  };
}

/**
 * Finds the segment time boundaries corresponding to a normalized substring match.
 */
function findSegmentsForSubstring(
  normSearch: string,
  segments: TranscriptSegment[]
): { startSeconds: number; endSeconds: number; matchedText: string } {
  const words = normSearch.split(' ').filter(Boolean);
  // Use a 2-3 word prefix to avoid matching ubiquitous stop-words like 'the' or 'a'
  const prefix = words.slice(0, Math.min(3, words.length)).join(' ');
  const suffix = words.slice(Math.max(0, words.length - 3)).join(' ');

  let startSegmentIndex = -1;
  let endSegmentIndex = -1;

  for (let i = 0; i < segments.length; i++) {
    const segNorm = normalizeForGrounding(segments[i].text);
    if (startSegmentIndex === -1 && (segNorm.includes(prefix) || (words[0] && segNorm.split(' ').includes(words[0]) && words.length === 1))) {
      startSegmentIndex = i;
    }
    if (startSegmentIndex !== -1 && (segNorm.includes(suffix) || i >= startSegmentIndex)) {
      endSegmentIndex = i;
      if (segNorm.includes(suffix)) break;
    }
  }

  if (startSegmentIndex === -1) {
    // Fallback: search individual non-stop words
    const stopWords = new Set(['the', 'a', 'an', 'is', 'in', 'of', 'and', 'to', 'we', 'it']);
    const nonStop = words.filter((w) => !stopWords.has(w));
    const searchTarget = nonStop[0] || words[0];

    for (let i = 0; i < segments.length; i++) {
      const segNorm = normalizeForGrounding(segments[i].text);
      if (segNorm.includes(searchTarget)) {
        startSegmentIndex = i;
        break;
      }
    }
  }

  if (startSegmentIndex === -1) startSegmentIndex = 0;
  if (endSegmentIndex === -1 || endSegmentIndex < startSegmentIndex) {
    endSegmentIndex = Math.min(segments.length - 1, startSegmentIndex + 1);
  }

  const startSeconds = segments[startSegmentIndex].start;
  const endSeconds = segments[endSegmentIndex].end;
  const matchedText = segments
    .slice(startSegmentIndex, endSegmentIndex + 1)
    .map((s) => s.text)
    .join(' ');

  return { startSeconds, endSeconds, matchedText };
}

/**
 * Snaps candidate clip timestamps strictly to sentence/segment boundaries.
 * Enforces golden moment duration rules (min 20s, max 45-50s).
 */
export function snapToSegmentBoundaries(
  rawStart: number,
  rawEnd: number,
  segments: TranscriptSegment[],
  minDuration = 20,
  maxDuration = 45
): { startSeconds: number; endSeconds: number; durationSeconds: number; quote: string } {
  if (segments.length === 0) {
    return {
      startSeconds: rawStart,
      endSeconds: Math.max(rawStart + minDuration, rawEnd),
      durationSeconds: Math.max(minDuration, rawEnd - rawStart),
      quote: '',
    };
  }

  // Find segment containing or closest to rawStart
  let startIdx = 0;
  let minStartDiff = Infinity;
  for (let i = 0; i < segments.length; i++) {
    const diff = Math.abs(segments[i].start - rawStart);
    if (diff < minStartDiff) {
      minStartDiff = diff;
      startIdx = i;
    }
  }

  // Accumulate segments forward until duration is between minDuration and maxDuration
  let endIdx = startIdx;
  let accumulatedTime = segments[endIdx].end - segments[startIdx].start;

  while (endIdx < segments.length - 1 && accumulatedTime < minDuration) {
    endIdx++;
    accumulatedTime = segments[endIdx].end - segments[startIdx].start;
  }

  // If accumulated time exceeded maxDuration, back off if possible
  if (accumulatedTime > maxDuration && endIdx > startIdx) {
    endIdx--;
  }

  const finalStart = segments[startIdx].start;
  const finalEnd = segments[endIdx].end;
  const quote = segments
    .slice(startIdx, endIdx + 1)
    .map((s) => s.text)
    .join(' ');

  return {
    startSeconds: Math.round(finalStart * 100) / 100,
    endSeconds: Math.round(finalEnd * 100) / 100,
    durationSeconds: Math.round((finalEnd - finalStart) * 100) / 100,
    quote,
  };
}

/**
 * Enforces that a concept dependency graph is a valid Directed Acyclic Graph (DAG).
 * Detects cycles using Depth-First Search (DFS) and automatically cuts back-edges
 * to guarantee no infinite recursion or circular prerequisite deadlocks.
 */
export function enforceDAG(nodes: ConceptNode[], edges: GraphEdge[]): ConceptGraphData {
  const nodeMap = new Map<string, ConceptNode>();
  nodes.forEach((n) => nodeMap.set(n.id, n));

  const validEdges = edges.filter((e) => nodeMap.has(e.source) && nodeMap.has(e.target));
  const adj = new Map<string, string[]>();
  nodes.forEach((n) => adj.set(n.id, []));

  const keptEdges: GraphEdge[] = [];
  const edgeSet = new Set<string>();

  // Helper to detect if adding an edge creates a cycle
  function createsCycle(src: string, dest: string, currentAdj: Map<string, string[]>): boolean {
    if (src === dest) return true;
    const visited = new Set<string>();
    const stack = [dest];

    while (stack.length > 0) {
      const curr = stack.pop()!;
      if (curr === src) return true;
      if (!visited.has(curr)) {
        visited.add(curr);
        const neighbors = currentAdj.get(curr) || [];
        for (const next of neighbors) {
          stack.push(next);
        }
      }
    }
    return false;
  }

  for (const edge of validEdges) {
    const key = `${edge.source}->${edge.target}`;
    if (edgeSet.has(key)) continue;

    // Prerequisite edges must not introduce cycles
    if (edge.type === 'prerequisite') {
      if (createsCycle(edge.source, edge.target, adj)) {
        console.warn(`[DAG Enforcer] Cycle detected on edge ${edge.source} -> ${edge.target}. Edge dropped to maintain strict DAG topology.`);
        continue;
      }
      adj.get(edge.source)!.push(edge.target);
    }

    edgeSet.add(key);
    keptEdges.push(edge);
  }

  // Update node prerequisites based on surviving kept edges
  const prunedNodes = nodes.map((n) => {
    const activePrereqs = keptEdges
      .filter((e) => e.target === n.id && e.type === 'prerequisite')
      .map((e) => e.source);

    const activeRelated = keptEdges
      .filter((e) => (e.target === n.id || e.source === n.id) && e.type === 'related')
      .map((e) => (e.source === n.id ? e.target : e.source));

    return {
      ...n,
      prerequisites: Array.from(new Set(activePrereqs)),
      related: Array.from(new Set(activeRelated)),
    };
  });

  return {
    nodes: prunedNodes,
    edges: keptEdges,
    isDag: true,
  };
}

/**
 * SuperMemo SM-2 Spaced Repetition Scheduling Algorithm.
 * Returns updated repetition count, interval (days), ease factor, and due date.
 */
export function calculateSm2(
  currentRepetition = 0,
  currentInterval = 0,
  currentEaseFactor = 2.5,
  rating: Sm2Rating
): {
  repetition: number;
  interval: number;
  easeFactor: number;
  dueDate: string;
} {
  // Map rating to grade (0-5)
  // 'again' = 0 (complete blackout), 'hard' = 3 (serious hesitation), 'good' = 4 (correct), 'easy' = 5 (instant recall)
  const gradeMap: Record<Sm2Rating, number> = {
    again: 0,
    hard: 3,
    good: 4,
    easy: 5,
  };
  const q = gradeMap[rating];

  // Calculate new Ease Factor (EF)
  let newEf = currentEaseFactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
  if (newEf < 1.3) newEf = 1.3;

  let newRepetition = currentRepetition;
  let newInterval = currentInterval;

  if (q < 3) {
    // Failure: reset repetitions and schedule for immediate review tomorrow
    newRepetition = 0;
    newInterval = 1;
  } else {
    // Success: advance spaced repetition interval
    if (newRepetition === 0) {
      newInterval = 1;
    } else if (newRepetition === 1) {
      newInterval = 6;
    } else {
      newInterval = Math.round(currentInterval * newEf);
    }
    newRepetition++;
  }

  // Calculate Due Date
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + newInterval);

  return {
    repetition: newRepetition,
    interval: newInterval,
    easeFactor: Math.round(newEf * 100) / 100,
    dueDate: dueDate.toISOString(),
  };
}
