/**
 * The connected One Breath conversation is not reachable by members until it
 * has passed device testing and its wording is reviewed (founder decision,
 * 2026-11-20). Routing it is a deliberate change that removes this test.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const AOS = join(__dirname, '..', '..', '..');
function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '__tests__' || name.startsWith('.')) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(full);
  }
  return out;
}

describe('One Breath conversation · not routed yet', () => {
  it('no route file mounts or imports the connected screen', () => {
    for (const file of walk(join(AOS, 'app'))) {
      expect(readFileSync(file, 'utf8'), file).not.toMatch(/OneBreathConversationScreen/);
    }
  });

  it('nothing but its own file refers to it', () => {
    const users = [...walk(join(AOS, 'components')), ...walk(join(AOS, 'screens')), ...walk(join(AOS, 'hooks'))]
      .filter((f) => !f.endsWith('OneBreathConversationScreen.tsx'))
      .filter((f) => /OneBreathConversationScreen/.test(readFileSync(f, 'utf8')));
    expect(users).toEqual([]);
  });

  it('the connected screen uses no AI model and writes nothing itself', () => {
    const src = readFileSync(join(AOS, 'components', 'oneBreath', 'OneBreathConversationScreen.tsx'), 'utf8');
    expect(src).not.toMatch(/anthropic|openai|fetch\(|scopedStorage|AsyncStorage/i);
    expect(src).toMatch(/commitReviewedMoment/);
    expect(src).toMatch(/lockInWithoutReminders/);
    expect(src).toMatch(/postRecordedDrink/);
  });
});
