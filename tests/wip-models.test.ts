import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// data/wip-models.json lists the models the viewer's menu groups under Work in progress: those
// whose README card is marked WIP, and those the README doesn't show yet. The rest work in full.
const wip: string[] = JSON.parse(readFileSync('data/wip-models.json', 'utf-8'));
const models = Object.keys(JSON.parse(readFileSync('packed/models.json', 'utf-8')));
const readme = readFileSync('README.md', 'utf-8');

describe('the models still in progress', () => {
  it('are those marked WIP in the README, or not in it yet', () => {
    // Each README card, by the model it opens: whether it's marked WIP.
    const cards = new Map<string, boolean>();
    for (const card of readme.match(/<td[\s\S]*?<\/td>/g) ?? []) {
      const model = /\?model=([^&"\s)]+)/.exec(card);
      if (model) cards.set(decodeURIComponent(model[1].replaceAll('+', ' ')), card.includes('· WIP'));
    }
    expect([...wip].sort()).toEqual(models.filter((m) => cards.get(m) ?? true).sort());
  });
});
