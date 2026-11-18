/**
 * Circle landing hierarchy (App Spec v1.8.2 · Appendix D §2, Circle v1.2).
 * Header "Circles · Your people. Your moments.", then your people, then what
 * your Circle can see. Red is not used for section labels.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const screen = readFileSync(join(__dirname, '..', 'CircleScreenV4.tsx'), 'utf8');
const panel = readFileSync(join(__dirname, '..', 'CircleMembersPanel.tsx'), 'utf8');

describe('Circle landing hierarchy', () => {
  it('uses the approved header', () => {
    expect(screen).toContain('style={styles.title}>Circles</Text>');
    expect(screen).toContain('Your people. Your moments.');
    expect(screen).not.toContain('CIRCLE / YOUR PEOPLE');
  });

  it('shows people before the sharing notice', () => {
    expect(screen.indexOf('<CircleMembersPanel')).toBeGreaterThan(-1);
    expect(screen.indexOf('<CircleMembersPanel')).toBeLessThan(screen.indexOf('circle-v4-privacy'));
  });

  it('keeps the privacy promise word for word', () => {
    expect(screen).toContain('Nothing is shared by default.');
    expect(screen).toContain('Scores, HydroState, ranks, streaks, and health data never appear in a Circle.');
  });

  it('section labels are muted, not red', () => {
    expect(screen).not.toMatch(/af\.red(Text)?\b/);
    expect(panel).toMatch(/kicker: \{ color: af\.textSecondary,/);
  });

  it('error text in the panel stays red', () => {
    expect(panel).toMatch(/error: \{ color: af\.redText,/);
  });

  it('does not draw controls for features that are not built', () => {
    expect(screen).not.toMatch(/label="Start a Moment"|>Start a Moment</);
  });
});
