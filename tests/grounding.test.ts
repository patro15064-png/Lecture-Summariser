import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  validateVerbatimGrounding,
  snapToSegmentBoundaries,
  enforceDAG,
} from '../src/lib/grounding';
import { TranscriptSegment, ConceptNode, GraphEdge } from '../src/types/lecture';

describe('Grounding & DAG Enforcer', () => {
  const sampleSegments: TranscriptSegment[] = [
    { id: 's1', start: 10, end: 18, text: 'The partial derivative evaluates the slope along a single axis.' },
    { id: 's2', start: 20, end: 32, text: 'The gradient vector always points in the direction of steepest ascent.' },
    { id: 's3', start: 35, end: 48, text: 'Lagrange multipliers allow us to solve constrained optimization problems.' },
  ];

  it('validates verbatim quote grounding against real transcript', () => {
    // Exact quote
    const res1 = validateVerbatimGrounding(
      'The gradient vector always points in the direction of steepest ascent.',
      sampleSegments
    );
    assert.strictEqual(res1.isGrounded, true);
    assert.strictEqual(res1.startSeconds, 20);

    // Minor punctuation / case differences
    const res2 = validateVerbatimGrounding(
      'gradient vector always points in the direction of steepest ascent',
      sampleSegments
    );
    assert.strictEqual(res2.isGrounded, true);
    assert.strictEqual(res2.startSeconds, 20);

    // Hallucinated quote
    const res3 = validateVerbatimGrounding(
      'Quantum entanglement produces instantaneous spooky action at a distance',
      sampleSegments
    );
    assert.strictEqual(res3.isGrounded, false);
  });

  it('snaps candidate moments strictly to segment borders with duration bounds', () => {
    const snapped = snapToSegmentBoundaries(12, 28, sampleSegments, 20, 45);
    assert.strictEqual(snapped.startSeconds, 10);
    assert.ok(snapped.durationSeconds >= 20);
    assert.ok(snapped.endSeconds >= 32);
  });

  it('detects cycles and enforces strict DAG topology', () => {
    const nodes: ConceptNode[] = [
      {
        id: 'A',
        title: 'A',
        type: 'core',
        timestampSeconds: 10,
        timestampFormatted: '00:10',
        summary: '',
        explanation: '',
        prerequisites: [],
        related: [],
        keyTakeaways: [],
        importance: 'foundational',
      },
      {
        id: 'B',
        title: 'B',
        type: 'core',
        timestampSeconds: 20,
        timestampFormatted: '00:20',
        summary: '',
        explanation: '',
        prerequisites: ['A'],
        related: [],
        keyTakeaways: [],
        importance: 'core',
      },
      {
        id: 'C',
        title: 'C',
        type: 'core',
        timestampSeconds: 30,
        timestampFormatted: '00:30',
        summary: '',
        explanation: '',
        prerequisites: ['B'],
        related: [],
        keyTakeaways: [],
        importance: 'advanced',
      },
    ];

    // Edges with a circular cycle: A -> B -> C -> A
    const circularEdges: GraphEdge[] = [
      { id: 'e1', source: 'A', target: 'B', type: 'prerequisite' },
      { id: 'e2', source: 'B', target: 'C', type: 'prerequisite' },
      { id: 'e3', source: 'C', target: 'A', type: 'prerequisite' }, // Cycle back-edge!
    ];

    const dag = enforceDAG(nodes, circularEdges);
    assert.strictEqual(dag.isDag, true);
    // Cycle edge e3 must have been dropped
    assert.strictEqual(dag.edges.length, 2);
    assert.ok(!dag.edges.some((e) => e.source === 'C' && e.target === 'A'));
  });
});
