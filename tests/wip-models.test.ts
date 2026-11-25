import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// data/wip-models.json lists the sets the viewer's menu groups under Work in progress: those
// whose README card is marked WIP, and those the README doesn't show yet. The rest work in full.
// Kinebrick's own test models (a name with no set number: gear-train, four-bar) have their own
// group in the menu and all work; the README does not show them.
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
    // A set's name starts with its number; a model with no number is a test model.
    const isSet = (m: string) => /^\d/.test(m);
    expect([...wip].sort()).toEqual(models.filter((m) => cards.get(m) ?? isSet(m)).sort());
  });
});
