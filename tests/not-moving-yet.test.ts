import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// data/not-moving-yet.json lists the moving parts KineBrick can't move yet, each with what it
// doesn't do, which the viewer shows when a model has one. A part that gets a role should come off it.
const notMovingYet: Record<string, string> = JSON.parse(readFileSync('data/not-moving-yet.json', 'utf-8'));
const roles: Record<string, string> = JSON.parse(readFileSync('data/roles.json', 'utf-8'));

describe('the parts that don\'t move yet', () => {
  it('have no role: a part KineBrick has learned to move comes off the list', () => {
    expect(Object.keys(notMovingYet).filter((name) => name in roles)).toEqual([]);
  });

  it('each say what they don\'t do', () => {
    for (const [name, what] of Object.entries(notMovingYet)) expect(what.trim(), name).not.toBe('');
  });
});
