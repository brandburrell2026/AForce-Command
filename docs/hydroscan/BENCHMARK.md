# HydroScan benchmark: barcode only vs the label reader

Status: protocol only. **Every result is Not run.** No number in this document is a measurement.

## Question

Does the label reader (barcode plus on-device label text) log the right drink and size at least as often as barcode only, ask rather than guess when unsure, and never confuse an alcoholic drink with a non-alcoholic one?

## Arms

- A: the existing barcode scanner (flag off).
- B: the label reader (flag on). Same phone, same drinks, same lighting, in a counterbalanced order (half the drinks A first, half B first).

## Drink sets (physical drinks, bought, not photos)

1. AFORCE products (every SKU that exists). **Blocked: unverified.** Not run and not counted until the unit UPC, net contents and front-label text for each are in `data/aforcePackaging.ts` (see DATA-GAPS.md).
2. Common drinks in the catalog (Gatorade, Coca-Cola, Pepsi, Monster, Red Bull, LMNT, Liquid IV, Pedialyte, Smartwater, Fiji, and so on).
3. Imported drinks (non-US labels: mL only, other languages, no "fl oz").
4. Look-alike variants, in pairs: regular vs zero sugar; caffeinated vs caffeine free; alcoholic vs non-alcoholic (beer and 0.0% beer; hard seltzer and seltzer; hard cider and cider); a 0.5% kombucha.
5. Unknown brands (not in either catalog, including store brands, sparkling water, local drinks).
6. Multipacks (cartons and 6-packs) with a single can shown, and the carton shown.
7. Reflective cans, curved bottles, partial labels (label half covered), dim light, glare from a window.

**Held-out set:** at least 30% of the drinks are set aside before any tuning, are never run during development, and are run once at the end. Any change to the engine after seeing held-out results invalidates that set and needs a new one.

## Devices

At least: a current iPhone, the oldest supported iPhone, a current Android, and an older mid-range Android. Report separately per device.

## Procedure per drink and arm

1. Fresh Scan screen, drink in hand, member-style framing (no staging).
2. Start a timer when the camera is pointed at the drink.
3. Record the first result shown, its stated confidence, any question asked and the answer given, and every tap until the Done card.
4. The truth (brand, product, variant, type, container size) is recorded from the physical drink before the run.
5. Group each run as **barcode visible** (barcode facing the camera) or **label only** (barcode hidden or absent).

## Metrics

Reported separately for barcode-visible and label-only, per device, per arm:

- Exact product + variant accuracy.
- Per-field accuracy: brand, product, variant, drink type, container size.
- **Confident wrong matches**: a result presented as the answer (not a question, not "likely" waiting for the member) that is wrong in any field. The most important number.
- Ask rate and abstain rate: how often it asks a question, and how often it shows nothing or only a hint.
- Question quality: share of questions whose choices contained the truth.
- Time to first correct result (seconds from pointing to a correct card).
- Taps to log.
- Alcohol: every alcoholic/non-alcoholic call, as a confusion table.

## Release thresholds (set before any run; change only with the founder)

Label-only, held-out set, on every device class:

- Confident wrong matches: at most 2% of runs, and zero for drink type.
- **Any confident alcoholic / non-alcoholic mix-up in the held-out set blocks release.** One is enough.
- Exact product + variant accuracy plus correct questions (the truth offered and chosen) at least 90%.
- Container size: when a size is shown as confirmed, correct at least 98%.
- Median time to first correct result at most 5 seconds on the current devices and at most 8 seconds on the older ones.
- Taps to log: median at most 3 beyond barcode only, and never more than the Type it path.

Barcode-visible: arm B must not be worse than arm A on accuracy, nor slower on median time to first result by more than 1 second.

No metric may be met by lowering what counts as a "confident" result after the fact.

## Recording sheet (CSV template)

```csv
run_id,date,device,os,arm,set,drink_description,truth_brand,truth_product,truth_variant,truth_type,truth_container_oz,truth_alcohol,barcode_visible,lighting,heldout,first_result_brand,first_result_product,first_result_variant,first_result_type,first_result_container_oz,first_result_confidence,question_asked,question_choices_included_truth,answer_given,final_brand,final_product,final_variant,final_type,final_container_oz,final_alcohol,confident_wrong,abstained,seconds_to_first_correct,taps_to_log,notes,result
```

`result` is "Not run" until a human has run the drink. `confident_wrong` is yes only when a result was presented as the answer and any field is wrong.

## Results

| Set | Device | Arm | Runs | Exact accuracy | Confident wrong | Ask rate | Abstain rate | Median seconds | Median taps | Result |
|---|---|---|---|---|---|---|---|---|---|---|
| AFORCE | each | A, B | 0 | n/a | n/a | n/a | n/a | n/a | n/a | Not run |
| Common | each | A, B | 0 | n/a | n/a | n/a | n/a | n/a | n/a | Not run |
| Imported | each | A, B | 0 | n/a | n/a | n/a | n/a | n/a | n/a | Not run |
| Look-alikes | each | A, B | 0 | n/a | n/a | n/a | n/a | n/a | n/a | Not run |
| Unknown brands | each | A, B | 0 | n/a | n/a | n/a | n/a | n/a | n/a | Not run |
| Multipacks | each | A, B | 0 | n/a | n/a | n/a | n/a | n/a | n/a | Not run |
| Reflective / curved / partial / dim | each | A, B | 0 | n/a | n/a | n/a | n/a | n/a | n/a | Not run |
| Held-out (all sets) | each | A, B | 0 | n/a | n/a | n/a | n/a | n/a | n/a | Not run |
