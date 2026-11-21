/**
 * HydroScan label evidence engine. Lives in utils/__tests__ because
 * utils/hydroscan/__tests__ matches no vitest include glob.
 */
import { describe, expect, it } from 'vitest';
import {
  addSample,
  answerQuestion,
  applyOverride,
  createEvidence,
  displayNameFor,
  formatOz,
  HINTS,
  readEvidence,
  type EvidenceState,
  type LabelLine,
  type SampleInput,
} from '../hydroscan/labelEvidence';

const lines = (...text: string[]): LabelLine[] => text.map((t) => ({ text: t, confidence: 0.9 }));
const frame = (...text: string[]): SampleInput => ({ lines: lines(...text) });
const feed = (...samples: SampleInput[]): EvidenceState => samples.reduce(addSample, createEvidence());
const read = (...samples: SampleInput[]) => readEvidence(feed(...samples));

describe('package volume: net contents is not serving size', () => {
  it('a 20 fl oz bottle with a 12 fl oz serving is a 20 fl oz bottle', () => {
    const r = read(
      frame('GATORADE', 'THIRST QUENCHER', 'FRUIT PUNCH', '20 FL OZ (591 mL)'),
      frame('Nutrition Facts', 'Serving size 12 fl oz (355 mL)', 'Servings per container about 1.7'),
    );
    expect(r.volume.value).toBe(20);
    // Seen in one sample only: likely until a second sample or the member agrees.
    expect(r.volume.confidence).toBe('likely');
    expect(r.volume.source).toBe('label');
    expect(r.serving.oz).toBe(12);
    expect(r.serving.perContainer).toBe(1.7);
    expect(r.multipack.detected).toBe(false);
  });

  it('a serving size split from its value by the line break is still a serving', () => {
    const r = read(frame('Serving size', '12 fl oz (355 mL)', 'NET 20 FL OZ (591 mL)'));
    expect(r.volume.value).toBe(20);
    expect(r.serving.oz).toBe(12);
  });

  it('"per 12 fl oz" on a calories line is a serving, not the container', () => {
    const r = read(frame('Calories 140 per 12 fl oz', '20 FL OZ'));
    expect(r.volume.value).toBe(20);
    expect(r.serving.oz).toBe(12);
  });

  it('parses the common net-contents spellings', () => {
    expect(read(frame('NET 500 mL')).volume.value).toBe(16.9);
    expect(read(frame('1 L')).volume.value).toBe(33.8);
    expect(read(frame('12 fl oz')).volume.value).toBe(12);
    expect(read(frame('20 FL OZ (1 PT 4 OZ) 591 mL')).volume.value).toBe(20);
    expect(read(frame('0,5 L')).volume.value).toBe(16.9);
  });

  it('a lone unmarked size is likely until a second sample agrees', () => {
    const one = read(frame('16 FL OZ'));
    expect(one.volume).toMatchObject({ value: 16, confidence: 'likely' });
    const two = read(frame('16 FL OZ'), frame('16 FL OZ'));
    expect(two.volume).toMatchObject({ value: 16, confidence: 'confirmed' });
  });

  it('a net weight on a stick pack is not a drink volume', () => {
    expect(read(frame('NET WT 0.35 OZ (10 g)')).volume.value).toBeNull();
  });

  it('two different unmarked sizes become one question, not a guess', () => {
    const r = read(frame('12 FL OZ'), frame('20 FL OZ'), frame('12 FL OZ'), frame('20 FL OZ'));
    expect(r.question?.id).toBe('volume');
    expect(r.question?.choices.map((c) => c.label)).toEqual(['12 fl oz', '20 fl oz']);
    expect(r.volume.value).toBeNull();
  });
});

describe('multipacks', () => {
  it.each([
    ['12 PACK', '12 FL OZ (355 mL) CANS'],
    ['6 x 12 FL OZ', 'CANS'],
    ['12-12 FL OZ CANS', 'x'],
    ['CASE OF 24', '12 FL OZ'],
  ])('detects %s', (a, b) => {
    const r = read(frame(a, b), frame(a, b));
    expect(r.multipack.detected).toBe(true);
    expect(r.volume.value).toBe(12);
    expect(r.volume.confidence).not.toBe('confirmed');
    expect(r.question?.id).toBe('multipack');
    expect(r.status).toBe('question');
  });

  it('the pack total is never offered as the container', () => {
    const r = read(frame('12 PACK', '12 FL OZ', 'NET 144 FL OZ (4.5 QT)'));
    expect(r.volume.value).toBe(12);
    expect(r.multipack.count).toBe(12);
  });

  it('the member says one can, and the size is then theirs', () => {
    let s = feed(frame('12 PACK', '12 FL OZ (355 mL)'), frame('12 PACK', '12 FL OZ'));
    s = answerQuestion(s, 'multipack', 'one');
    const r = readEvidence(s);
    expect(r.volume).toMatchObject({ value: 12, confidence: 'confirmed', source: 'user' });
    expect(r.question).toBeNull();
  });

  it('"a different size" leaves the size unknown and is not asked again', () => {
    let s = feed(frame('6 PACK', '16 FL OZ'), frame('6 PACK', '16 FL OZ'));
    s = answerQuestion(s, 'multipack', 'other');
    const r = readEvidence(s);
    expect(r.volume.value).toBeNull();
    expect(r.question).toBeNull();
  });

  it('a single can is not a multipack', () => {
    expect(read(frame('1 CAN', '12 FL OZ')).multipack.detected).toBe(false);
  });
});

describe('look-alikes are explicit signals', () => {
  it('regular and zero sugar from the same brand are told apart by the label', () => {
    const zero = read(frame('COCA-COLA', 'ZERO SUGAR', '12 FL OZ'), frame('COCA-COLA ZERO SUGAR'));
    expect(zero.product).toMatchObject({ value: 'Coke Zero', confidence: 'confirmed', source: 'label' });
    expect(zero.traits.sugar.value).toBe('zero');
    const classic = read(frame('COCA-COLA', 'CLASSIC'), frame('COCA-COLA CLASSIC'));
    expect(classic.product.value).toBe('Coca-Cola Classic');
    expect(classic.traits.sugar.value).toBe('regular');
  });

  it('a brand with both versions and no signal asks, and offers both', () => {
    const r = read(frame('COCA-COLA'), frame('COCA-COLA'));
    expect(r.question?.id).toBe('product');
    expect(r.question?.choices.map((c) => c.label)).toEqual(
      expect.arrayContaining(['Coca-Cola Classic', 'Coke Zero', 'Something else']),
    );
    expect(r.product.value).toBeNull();
    expect(r.status).toBe('question');
  });

  it('answering the question records the member as the source', () => {
    let s = feed(frame('GATORADE'), frame('GATORADE'));
    expect(readEvidence(s).question?.id).toBe('product');
    s = answerQuestion(s, 'product', 'sd-gatorade-zero');
    const r = readEvidence(s);
    expect(r.product).toMatchObject({ value: 'Gatorade Zero', confidence: 'confirmed', source: 'user' });
    expect(r.question).toBeNull();
  });

  it('"something else" keeps the brand and leaves the product open, once', () => {
    let s = feed(frame('GATORADE'), frame('GATORADE'));
    s = answerQuestion(s, 'product', 'none');
    const r = readEvidence(s);
    expect(r.brand.value).toBe('Gatorade');
    expect(r.product.value).toBeNull();
    expect(r.question).toBeNull();
  });

  it('a single-version brand whose label says zero sugar is not called the regular product', () => {
    const r = read(frame('MONSTER', 'ENERGY', 'ZERO SUGAR'), frame('MONSTER ENERGY ZERO SUGAR'));
    expect(r.brand.value).toBe('Monster');
    expect(r.product.value).toBeNull();
    expect(r.variant.value).toBe('Zero Sugar');
    expect(r.drinkType.value).toBe('energy_drink');
  });

  it('a sugary drink named without any sugar word is at best likely, never confirmed', () => {
    const r = read(frame('PEPSI'), frame('PEPSI'), frame('PEPSI'));
    expect(r.product.value).toBe('Pepsi');
    expect(r.product.confidence).toBe('likely');
  });

  it('caffeine free is read from the label and keeps the product from being called the caffeinated one', () => {
    const r = read(frame('COCA-COLA', 'CLASSIC', 'CAFFEINE FREE'), frame('COCA-COLA CLASSIC CAFFEINE-FREE'));
    expect(r.traits.caffeine).toMatchObject({ value: 'free', confidence: 'confirmed' });
    expect(r.product.value).toBeNull();
    expect(r.variant.value).toContain('Caffeine Free');
    expect(displayNameFor(r)).toContain('Caffeine Free');
  });

  it('decaf and a caffeine amount are told apart', () => {
    expect(read(frame('DECAF COFFEE')).traits.caffeine.value).toBe('free');
    expect(read(frame('CAFFEINE 200 MG')).traits.caffeine.value).toBe('caffeinated');
    expect(read(frame('0 MG CAFFEINE')).traits.caffeine.value).toBe('free');
  });

  it('"no sugar added" on a juice is not a zero-sugar variant', () => {
    expect(read(frame('ORANGE JUICE', 'NO SUGAR ADDED')).traits.sugar.value).toBeNull();
  });
});

describe('alcohol is never a confident guess', () => {
  it('an ABV and a warning read as alcoholic, after a second sample confirms', () => {
    const one = read(frame('HARD SELTZER', '5% ALC/VOL'));
    expect(one.traits.alcohol).toMatchObject({ value: 'alcoholic', confidence: 'likely' });
    const two = read(frame('HARD SELTZER', '5% ALC/VOL'), frame('GOVERNMENT WARNING', '5% ALC/VOL'));
    expect(two.traits.alcohol).toMatchObject({ value: 'alcoholic', confidence: 'confirmed' });
    expect(two.drinkType.value).toBe('alcohol');
  });

  it('non-alcoholic and 0.0% read as non-alcoholic, not as alcohol', () => {
    for (const t of ['NON-ALCOHOLIC BEER', 'ALCOHOL FREE', 'LAGER 0.0%']) {
      const r = read(frame(t), frame(t));
      expect(r.traits.alcohol.value, t).toBe('non_alcoholic');
      expect(r.drinkType.value, t).not.toBe('alcohol');
    }
  });

  it('a beer word with no strength and no "non-alcoholic" is a question', () => {
    const r = read(frame('PALE ALE'), frame('PALE ALE'));
    expect(r.question?.id).toBe('alcohol');
    expect(r.traits.alcohol.value).toBeNull();
    expect(r.status).toBe('question');
  });

  it('root beer and ginger ale are soda, not alcohol', () => {
    const r = read(frame('ROOT BEER'), frame('ROOT BEER'));
    expect(r.question).toBeNull();
    expect(r.drinkType.value).toBe('soda');
  });

  it('"non-alcoholic" next to an alcohol strength is a conflict and a question', () => {
    const r = read(frame('NON-ALCOHOLIC', '5% ALC/VOL'), frame('NON-ALCOHOLIC', '5% ALC/VOL'));
    expect(r.question?.id).toBe('alcohol');
  });

  it('a strength under 1% (0.5%) is a question', () => {
    const r = read(frame('KOMBUCHA 0.5% ALC/VOL'), frame('KOMBUCHA 0.5% ABV'));
    expect(r.question?.id).toBe('alcohol');
  });

  it('a strength on a catalog soft drink is a question, not an alcohol log', () => {
    const r = read(frame('COCA-COLA CLASSIC', '5% ALC/VOL'), frame('COCA-COLA CLASSIC', '5% ALC/VOL'));
    expect(r.question?.id).toBe('alcohol');
    expect(r.drinkType.value).not.toBe('alcohol');
  });

  it('the member answers, and the answer holds', () => {
    let s = feed(frame('PALE ALE'), frame('PALE ALE'));
    s = answerQuestion(s, 'alcohol', 'alcoholic');
    const r = readEvidence(s);
    expect(r.traits.alcohol).toMatchObject({ value: 'alcoholic', confidence: 'confirmed', source: 'user' });
    expect(r.drinkType.value).toBe('alcohol');
    expect(r.question).toBeNull();
  });

  it('a barcode that says alcohol still needs the label or the member for how strong', () => {
    const r = readEvidence(
      addSample(createEvidence(), { barcode: { code: '1', product: { id: 'x', name: 'Lager', category: 'alcohol', reliable: true } } }),
    );
    expect(r.question?.id).toBe('alcohol');
  });
});

describe('barcode and label together', () => {
  const originalCoke = {
    code: '049000028911',
    product: { id: 'sx-coke', name: 'Coca-Cola Classic', brand: 'Coca-Cola', category: 'soda' as const, reliable: true },
  };

  it('a reliable barcode match stands on its own when the label is unreadable', () => {
    const r = read({ barcode: originalCoke }, frame('', ''), frame(''), frame(''));
    expect(r.product).toMatchObject({ value: 'Coca-Cola Classic', confidence: 'confirmed', source: 'barcode' });
    expect(r.drinkType.value).toBe('soda');
    expect(r.status).toBe('ready');
  });

  it('a barcode alone waits a few frames for a size, then is ready without one', () => {
    let s = addSample(createEvidence(), { barcode: originalCoke });
    expect(readEvidence(s).status).toBe('reading');
    s = addSample(addSample(addSample(s, frame('x')), frame('x')), frame('x'));
    expect(readEvidence(s).status).toBe('ready');
    expect(readEvidence(s).volume.value).toBeNull();
  });

  it('a barcode plus a net size on the label is ready at once', () => {
    const r = read({ barcode: originalCoke }, frame('COCA-COLA CLASSIC', '12 FL OZ (355 mL)'));
    expect(r.status).toBe('ready');
    expect(r.volume.value).toBe(12);
  });

  it('barcode says Original, label says Zero Sugar: one short question', () => {
    const r = read({ barcode: originalCoke }, frame('COCA-COLA', 'ZERO SUGAR'));
    expect(r.question?.id).toBe('barcode-conflict');
    expect(r.question?.text).toBe('The barcode matches Original. The label says Zero Sugar. Which one is this?');
    expect(r.question?.choices.map((c) => c.id)).toEqual(['barcode', 'label']);
    expect(r.status).toBe('question');
  });

  it('answering the conflict makes the member the source', () => {
    let s = feed({ barcode: originalCoke }, frame('COCA-COLA', 'ZERO SUGAR'));
    s = answerQuestion(s, 'barcode-conflict', 'label');
    let r = readEvidence(s);
    expect(r.product).toMatchObject({ value: 'Coke Zero', source: 'user', confidence: 'confirmed' });
    expect(r.question).toBeNull();
    s = feed({ barcode: originalCoke }, frame('COCA-COLA', 'ZERO SUGAR'));
    s = answerQuestion(s, 'barcode-conflict', 'barcode');
    r = readEvidence(s);
    expect(r.product).toMatchObject({ value: 'Coca-Cola Classic', source: 'user' });
    expect(r.traits.sugar.value).toBe('regular');
  });

  it('a different brand on the label than on the barcode is a question with both names', () => {
    const r = read({ barcode: originalCoke }, frame('GATORADE', 'ZERO SUGAR'));
    expect(r.question?.id).toBe('barcode-conflict');
    expect(r.question?.text).toContain('Coca-Cola Classic');
  });

  it('a public record (not the app catalog) is only likely', () => {
    const r = readEvidence(
      addSample(createEvidence(), { barcode: { code: '1', product: { id: 'off_1', name: 'Some Soda', brand: 'Acme', category: 'soda', reliable: false } } }),
    );
    expect(r.product.confidence).toBe('likely');
    expect(r.catalogProductId).toBeNull();
  });

  it('a barcode with no match leaves the drink to the label', () => {
    const r = read({ barcode: { code: '9', product: null } }, frame('SPARKLING WATER', '16.9 FL OZ'), frame('SPARKLING WATER'));
    expect(['water', 'bottled_water']).toContain(r.drinkType.value);
    expect(r.barcodeCode).toBe('9');
  });
});

describe('category-only is a valid result', () => {
  it('sparkling water with brand and size unknown', () => {
    const r = read(frame('LIME', 'SPARKLING WATER'), frame('SPARKLING WATER', 'NATURAL FLAVOR'), frame('SPARKLING WATER'), frame('SPARKLING WATER'));
    expect(['water', 'bottled_water']).toContain(r.drinkType.value);
    expect(r.drinkType).toMatchObject({ confidence: 'confirmed', source: 'label' });
    expect(r.sparkling).toBe(true);
    expect(r.brand.value).toBeNull();
    expect(r.volume.value).toBeNull();
    expect(r.status).toBe('ready');
    expect(r.hint).toBeNull();
    expect(displayNameFor(r)).toBe('Sparkling Water Lime');
  });

  it('still bottled water is not called sparkling', () => {
    const r = read(frame('PURIFIED WATER'), frame('PURIFIED WATER'));
    expect(r.sparkling).toBe(false);
    expect(displayNameFor(r)).toBe('Bottled water');
  });

  it('two kinds named equally ask which one', () => {
    const r = read(frame('ELECTROLYTE', 'ENERGY DRINK'), frame('ELECTROLYTE', 'ENERGY DRINK'));
    expect(r.question?.id).toBe('category');
    expect(r.drinkType.value).toBeNull();
  });
});

describe('catalog matching uses the app\'s own catalogs', () => {
  it('an AFORCE front label that does not say the format asks which product, from the catalog', () => {
    const r = read(frame('AFORCE', 'BERRY BLAST'), frame('AFORCE BERRY BLAST'));
    expect(r.question?.id).toBe('product');
    const labels = r.question!.choices.map((c) => c.label);
    expect(labels.some((l) => /Berry Blast/.test(l))).toBe(true);
    expect(labels).toContain('Something else');
    expect(r.question!.choices.length).toBeLessThanOrEqual(5);
  });

  it('a full AFORCE product name resolves and keeps the catalog id for the hand-off', () => {
    const r = read(frame('AFORCE', 'BERRY BLAST + DULSE'), frame('AFORCE BERRY BLAST DULSE'));
    expect(r.product.value).toBe('AForce Berry Blast +Dulse');
    expect(r.catalogProductId).toBe('aforce_berry_blast');
    expect(r.catalogSource).toBe('compare');
  });

  it('an AFORCE match is marked unverified until its packaging facts are supplied', () => {
    const r = read(frame('AFORCE', 'BERRY BLAST + DULSE'), frame('AFORCE BERRY BLAST DULSE'));
    expect(r.packagingVerified).toBe(false);
  });

  it('a drink that is not AFORCE carries no packaging mark', () => {
    const r = read(frame('ELECTROLYTE', 'ENERGY DRINK'), frame('ELECTROLYTE', 'ENERGY DRINK'));
    expect(r.packagingVerified).toBeNull();
  });

  it('the more specific catalog row wins when its word is on the label', () => {
    expect(read(frame('PEDIALYTE', 'SPORT'), frame('PEDIALYTE SPORT')).product.value).toBe('Pedialyte Sport');
    expect(read(frame('PEDIALYTE'), frame('PEDIALYTE')).product.value).toBe('Pedialyte');
  });

  it('a brand that is not in either catalog is never invented', () => {
    const r = read(frame('ZZYZX COLA CO', 'COLA'), frame('ZZYZX COLA CO', 'COLA'));
    expect(r.brand.value).toBeNull();
    expect(r.product.value).toBeNull();
    expect(r.drinkType.value).toBe('soda');
  });
});

describe('evidence accumulates over samples of one package', () => {
  it('one clear read of the identity is not shown until a second agrees', () => {
    expect(read(frame('LMNT')).status).toBe('reading');
    const r = read(frame('LMNT', '16 FL OZ'), frame('LMNT'));
    expect(r.brand).toMatchObject({ value: 'LMNT', confidence: 'confirmed' });
    expect(r.status).toBe('ready');
  });

  it('one read is shown after enough frames when nothing better arrives', () => {
    const r = read(frame('LMNT'), frame('...'), frame('...'), frame('...'));
    expect(r.status).toBe('ready');
    expect(r.brand.confidence).toBe('likely');
  });

  it('a flavor on a short line is read; an ingredient list is not a flavor', () => {
    const f = read(frame('GATORADE', 'THIRST QUENCHER', 'FRUIT PUNCH'), frame('GATORADE', 'FRUIT PUNCH'));
    expect(f.variant.value).toContain('Fruit Punch');
    const i = read(frame('GATORADE', 'INGREDIENTS: WATER, SUGAR, CITRIC ACID, NATURAL ORANGE FLAVOR, SALT'));
    expect(i.variant.value).toBeNull();
  });

  it('keeps no raw text: a state holds signals, not the lines', () => {
    const s = feed(frame('GATORADE THIRST QUENCHER SECRET-MARKER-TEXT'));
    expect(JSON.stringify(s)).not.toContain('SECRET-MARKER');
  });
});

describe('reset when a different drink is in view', () => {
  it('a different barcode starts over', () => {
    let s = feed({ barcode: { code: '1', product: { id: 'a', name: 'A', category: 'soda', reliable: true } } }, frame('GATORADE'));
    s = addSample(s, { barcode: { code: '2', product: null } });
    const r = readEvidence(s);
    expect(r.product.value).toBeNull();
    expect(r.brand.value).toBeNull();
    expect(r.samples).toBe(0);
    expect(r.barcodeCode).toBe('2');
  });

  it('label text that contradicts the accumulated brand starts over', () => {
    let s = feed(frame('GATORADE', '20 FL OZ'), frame('GATORADE'));
    s = addSample(s, frame('RED BULL', '8.4 FL OZ'));
    const r = readEvidence(s);
    expect(r.brand.value).toBe('Red Bull');
    expect(r.volume.value).toBe(8.4);
    expect(r.samples).toBe(1);
  });

  it('a reset drops the old answers and the old barcode', () => {
    let s = feed({ barcode: { code: '1', product: null } }, frame('PALE ALE'), frame('PALE ALE'));
    s = answerQuestion(s, 'alcohol', 'alcoholic');
    s = addSample(s, { barcode: { code: '2', product: null } });
    expect(s.overrides).toEqual({});
  });

  it('the same brand again (a better view of the same can) does not reset', () => {
    const s = feed(frame('GATORADE'), frame('GATORADE', '20 FL OZ'));
    expect(s.samples).toBe(2);
  });

  it('createEvidence() is the explicit reset for "Scan again"', () => {
    expect(readEvidence(createEvidence()).status).toBe('reading');
  });
});

describe('weak evidence gives a hint, not a guess', () => {
  it('glare or low-confidence text says to tilt', () => {
    const r = readEvidence(
      addSample(createEvidence(), { lines: [{ text: 'GAT RA E', confidence: 0.2 }, { text: 'F UIT', confidence: 0.3 }] }),
    );
    expect(r.hint).toBe('Tilt to reduce glare');
    expect(r.brand.value).toBeNull();
    expect(r.status).toBe('reading');
  });

  it('a nutrition panel says to try the front label', () => {
    expect(read(frame('Nutrition Facts', 'Serving size 12 fl oz', 'Ingredients: water')).hint).toBe('Try the front label');
  });

  it('nothing readable says to try the front label, then to turn to the barcode', () => {
    expect(read(frame('')).hint).toBe('Try the front label');
    expect(read(frame(''), frame(''), frame(''), frame('')).hint).toBe('Turn to the barcode');
  });

  it('readable but unknown text asks for the front, then the barcode', () => {
    expect(read(frame('Brewed in a small town')).hint).toBe('Try the front label');
    expect(read(...Array(4).fill(frame('Brewed in a small town'))).hint).toBe('Turn to the barcode');
  });

  it('an identity without a size, after a few frames, says to show the size', () => {
    const r = read(frame('LMNT'), frame('LMNT'), frame('LMNT'));
    expect(r.volume.value).toBeNull();
    expect(r.status).toBe('ready');
    const waiting = read(frame('LMNT'), frame('x'));
    expect(waiting.hint).toBeNull();
  });

  it('only the four approved hints can ever be returned', () => {
    expect([...HINTS]).toEqual(['Try the front label', 'Tilt to reduce glare', 'Show the size on the label', 'Turn to the barcode']);
  });

  it('a hint is shown only while reading, never next to a result or a question', () => {
    const q = read(frame('COCA-COLA'), frame('COCA-COLA'));
    expect(q.question).not.toBeNull();
    expect(q.hint).toBeNull();
    const ready = read(frame('LMNT', '16 FL OZ'), frame('LMNT'));
    expect(ready.hint).toBeNull();
  });
});

describe('the member can edit what was read', () => {
  it('a typed size is the member\'s, confirmed', () => {
    const s = applyOverride(feed(frame('LMNT'), frame('LMNT')), { volumeOz: 17 });
    expect(readEvidence(s).volume).toMatchObject({ value: 17, confidence: 'confirmed', source: 'user' });
  });

  it('a chosen drink type is the member\'s and wins over the label', () => {
    const s = applyOverride(feed(frame('SPARKLING WATER'), frame('SPARKLING WATER')), { drinkType: 'soda' });
    expect(readEvidence(s).drinkType).toMatchObject({ value: 'soda', confidence: 'confirmed', source: 'user' });
  });

  it('an answer to a question that is not being asked changes nothing', () => {
    const s = feed(frame('LMNT'), frame('LMNT'));
    expect(answerQuestion(s, 'alcohol', 'alcoholic')).toBe(s);
    expect(answerQuestion(feed(frame('COCA-COLA'), frame('COCA-COLA')), 'product', 'nope').overrides).toEqual({});
  });
});

describe('display', () => {
  it('formats sizes plainly', () => {
    expect(formatOz(20)).toBe('20 fl oz');
    expect(formatOz(16.9)).toBe('16.9 fl oz');
    expect(formatOz(8.45)).toBe('8.5 fl oz');
  });

  it('builds a name from the reading and never from the lines', () => {
    expect(displayNameFor(read(frame('COCA-COLA', 'ZERO SUGAR'), frame('COCA-COLA ZERO SUGAR')))).toBe('Coke Zero');
    expect(displayNameFor(read(frame('GATORADE THIRST QUENCHER', 'FRUIT PUNCH'), frame('GATORADE THIRST QUENCHER', 'FRUIT PUNCH')))).toBe(
      'Gatorade Thirst Quencher Fruit Punch',
    );
  });
});

describe('review fixes, 2026-11-21', () => {
  const size = (...lines: string[]) => read(frame(...lines), frame(...lines)).volume;

  it('reads sizes over 999 mL whole, never their last three digits', () => {
    expect(size('TEST WATER', 'PURIFIED WATER', '1500 mL').value).toBeCloseTo(50.7, 1);
    expect(size('TEST WATER', 'PURIFIED WATER', '1000 mL').value).toBeCloseTo(33.8, 1);
    expect(size('TEST WATER', 'PURIFIED WATER', '1,000 mL').value).toBeCloseTo(33.8, 1);
    expect(size('TEST WATER', 'PURIFIED WATER', '1250 mL').value).toBeCloseTo(42.3, 1);
  });

  it('a decimal comma is still a decimal', () => {
    expect(size('TEST COLA', 'COLA', '0,5 L').value).toBeCloseTo(16.9, 1);
  });

  it('a size seen in one sample is likely, never confirmed, however clearly printed', () => {
    const one = read(frame('TEST COLA', 'COLA', 'NET 20 FL OZ (591 mL)'));
    expect(one.volume.confidence).not.toBe('confirmed');
    const two = read(frame('TEST COLA', 'COLA', '20 FL OZ (591 mL)'), frame('TEST COLA', 'COLA', '20 FL OZ (591 mL)'));
    expect(two.volume.confidence).toBe('confirmed');
  });

  it('a pack total is never offered as one can', () => {
    const r = read(frame('TEST COLA', 'COLA', '6 PACK', '101.4 FL OZ (3 L)'), frame('TEST COLA', 'COLA', '6 PACK', '101.4 FL OZ (3 L)'));
    expect(r.volume.value).toBeNull();
    expect(r.question?.id).not.toBe('multipack');
  });

  it('a flavoured bottled water is named so it cannot be saved as plain water', () => {
    const r = read(frame('TEST WATER', 'PURIFIED WATER', 'LEMON'), frame('TEST WATER', 'PURIFIED WATER', 'LEMON'));
    if (r.flavored) expect(displayNameFor(r)).toMatch(/flavou?red/i);
    expect(r.flavored).toBe(true);
  });
});
