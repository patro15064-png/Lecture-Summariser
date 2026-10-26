import { describe, it } from 'node:test';
import assert from 'node:assert';
import { calculateSm2 } from '../src/lib/grounding';

describe('SuperMemo SM-2 Spaced Repetition Algorithm', () => {
  it('correctly schedules first review with good rating', () => {
    const res = calculateSm2(0, 0, 2.5, 'good');
    assert.strictEqual(res.repetition, 1);
    assert.strictEqual(res.interval, 1);
    assert.ok(new Date(res.dueDate).getTime() > Date.now());
  });

  it('advances interval to 6 days on second successful review', () => {
    const res = calculateSm2(1, 1, 2.5, 'good');
    assert.strictEqual(res.repetition, 2);
    assert.strictEqual(res.interval, 6);
  });

  it('multiplies interval by ease factor on third review', () => {
    const res = calculateSm2(2, 6, 2.5, 'good');
    assert.strictEqual(res.repetition, 3);
    assert.strictEqual(res.interval, 15); // Math.round(6 * 2.46)
  });

  it('resets repetition and interval upon recall failure (again)', () => {
    const res = calculateSm2(3, 15, 2.46, 'again');
    assert.strictEqual(res.repetition, 0);
    assert.strictEqual(res.interval, 1);
  });
});
