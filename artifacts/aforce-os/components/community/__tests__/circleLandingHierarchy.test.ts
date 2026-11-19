/**
 * Circles tab, laid out as the approved prototype: mark + "Circles" and the
 * member photo, "Your people. Your Moments.", the status line, "Start a
 * Moment" / "Invite someone", people, pending, one privacy card.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const screen = readFileSync(join(__dirname, '..', 'CircleScreenV4.tsx'), 'utf8');
const panel = readFileSync(join(__dirname, '..', 'CircleMembersPanel.tsx'), 'utf8');

describe('Circles tab (prototype layout)', () => {
  it('uses the demo header and hero', () => {
    expect(screen).toContain('>CIRCLES</Text>');
    expect(screen).toContain("Your people.{'\\n'}Your Moments.");
    expect(screen).toContain('Plans you make together, then both make it back.');
    expect(screen).not.toContain('CIRCLE / YOUR PEOPLE');
  });

  it('has the two actions; Start a Moment opens One Breath, Invite opens the invite form', () => {
    expect(screen).toMatch(/onPress=\{\(\) => router\.push\('\/one-breath'\)\}[\s\S]{0,200}accessibilityLabel="Start a Moment"/);
    expect(screen).toContain('accessibilityLabel="Invite someone"');
    expect(screen).toContain('inviteOpen={inviteOpen}');
  });

  it('people come before the privacy card', () => {
    expect(screen.indexOf('<CircleMembersPanel')).toBeGreaterThan(-1);
    expect(screen.indexOf('<CircleMembersPanel')).toBeLessThan(screen.indexOf('circle-v4-privacy'));
    expect(screen).toContain('layout="demo"');
  });

  it('keeps the privacy promise word for word', () => {
    expect(screen).toContain('Choose what your Circle can see');
    expect(screen).toContain('Private by default');
    expect(screen).toContain('Nothing is shared by default.');
    expect(screen).toContain('Scores, HydroState, ranks, streaks, and health data never appear in a Circle.');
  });

  it('uses no red on the screen; error text in the panel stays red', () => {
    expect(screen).not.toMatch(/af\.red(Text)?\b/);
    expect(panel).toMatch(/error: \{ color: af\.redText,/);
  });

  it('the demo layout keeps every control: remove with confirmation, revoke, invite, accept', () => {
    expect(panel).toContain("copy('confirm_remove')");
    expect(panel).toContain("accessibilityLabel={copy('revoke')}");
    expect(panel).toContain('client.invite(name)');
    expect(panel).toContain('client.accept(code, name)');
    // The membership disclosure is still shown in the demo layout.
    expect(panel).toMatch(/demo \? \(\s*<Text style=\{styles\.demoNote\}>/);
  });

  it('shows no leaderboard, score or availability claim', () => {
    expect(screen).not.toMatch(/leaderboard|Available/);
  });

  it('does not draw the gallery that is not built', () => {
    expect(screen).not.toContain('Your Moments</Text>');
    expect(screen).not.toContain('Private keepsakes');
  });
});

describe('Empty Circle (prototype card)', () => {
  it('shows the card only when there is nobody and no pending invitation', () => {
    expect(panel).toContain(
      "{demo && loaded && !loading && !members.length && !invitations.some((invite) => invite.status === 'pending') ? (",
    );
    expect(panel).toContain('Prepare with the people you trust.');
    expect(panel).toContain('Private by default. Nothing is shared until you confirm it.');
  });

  it('its one action opens the same invite form as the button above', () => {
    expect(panel).toMatch(/onPress=\{onInvite\}[\s\S]{0,200}testID="circle-empty-invite"/);
    expect(screen).toContain('onInvite={() => setInviteOpen(true)}');
  });

  it('promises nothing the app cannot do: no per-Moment or time-limited invite', () => {
    const card = panel.slice(panel.indexOf('circle-empty-card'), panel.indexOf('{!demo && loaded'));
    expect(card).not.toMatch(/for how long|check-in after dinner|to a Moment/);
  });

  it('the older layout keeps its own empty state', () => {
    expect(panel).toContain('{!demo && loaded && !loading && !members.length && (');
    expect(panel).toContain('Start with one person.');
  });
});
