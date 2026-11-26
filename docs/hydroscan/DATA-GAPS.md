# HydroScan data gaps (needed from the founders)

Nothing in this file is invented. These are things the repo does not have, and the label reader cannot be tuned for AFORCE without them.

## Update 2026-11-25: registered barcodes supplied

The founder supplied nine registered UPCs (all pass the UPC-A check digit):

| Flavor | 20-count stick carton | Single can | Can six-pack |
|---|---|---|---|
| Berry Blast | 860014045011 | 860014380709 | 860014045066 |
| Watermelon Surge | 860014380716 | 860014045004 | 860014380723 |
| Soursop Edge | 860014045028 | 860014045042 | 860014045073 |

`BARCODE_INDEX` in `services/productRecognitionService.ts` now holds these and only these for AFORCE; its `85000000xxxx` placeholders are removed. A six-pack code resolves to that flavor's can. The stick carton and single can codes are the unit UPCs in `data/aforcePackaging.ts`.

Still open:

- No code was supplied for the canisters or the FIELD BAG. They no longer match any barcode.
- **Decided 2026-11-26 (Brandon):** `data/pricing.ts` no longer carries placeholders. The three stick packs carry the registered carton codes. The RTD 12-pack and the canisters carry no `upc`, because no registered code exists for those exact packs (the can codes are for a single can and a six-pack).
- **Decided 2026-11-26 (Brandon):** the stick carton is **20-count**. The Store stick rows now say "20 ct" with 20 servings, so the price per serving shown is the same price divided by 20 rather than 12. Stick prices themselves are unchanged.
- The supplied names are "Watermelon Surge" and "Soursop Edge"; the catalog rows the codes resolve to are named "Watermelon + Chlorella" and "Soursop + Seamoss". The name on the real label has not been confirmed.
- Net contents and front-label text are still missing for every product, so every product is still unverified.

The section below is the state before this update, kept for the record.

## AFORCE barcodes are placeholders, and two tables disagree

`services/productRecognitionService.ts` (`BARCODE_INDEX`) and `data/pricing.ts` (`upc`) both use `85000000xxxx` sequences, which are placeholder numbers, not registered UPCs. They also map the same code to different products:

| Code | recognition service | pricing table |
|---|---|---|
| 850000000055 | `aforce_berry_blast` (12-stick bag) | `sku_stick_berry` (Berry Blast + Dulse sticks, 12 ct) |
| 850000000017 | `aforce_stick` | an RTD 12-pack SKU (`upc` at `data/pricing.ts:156`, "RTD Can, 12-pack") |
| 850000000086 | `aforce_sku_berry_stick` | the 30-serving canister SKU (`sku_can_berry`) |

(Verify the full list when the real codes arrive; the three rows above are the ones read for this report.) Until real UPCs exist, an AFORCE barcode scan matches by luck of the placeholder, and the label reader cannot cross-check a barcode against the front label for AFORCE.

## Needed from the founders

1. The real UPC/GTIN for every AFORCE SKU (format x flavor), and which one table is the source of truth.
2. Real package sizes: fl oz on the can or bottle, count per multipack, stick and canister net contents (a weight, not a volume, for powders).
3. The exact **front-label text** of each SKU as printed (brand line, product line, flavor, variant words such as "Zero Sugar" if any, size line). The engine matches AFORCE products on the words in `data/productDatabase.ts` names ("Berry Blast +Dulse", "Watermelon + Chlorella", "Soursop + Seamoss", "Stick", "RTD", "Canister"). If the printed label differs, the match will ask a question instead of resolving.
4. Which AFORCE products are a drink-in-a-package (RTD can) versus a mix; the reader hands AFORCE products to the existing AFORCE flow, which counts them as their mixing water. That rule is unchanged and needs the founders' confirmation that a label-read AFORCE log should follow it.
5. Photos of the real cans and sticks (reflective surfaces) for the benchmark set.

## Missing fields per AFORCE product (2026-11-21)

Every AFORCE product is marked **unverified** in `artifacts/aforce-os/data/aforcePackaging.ts`. A product becomes verified only when all three fields are filled in from the approved packaging. While unverified, the label reader shows "AFORCE PACKAGING · NOT VERIFIED YET" on an AFORCE match, and the benchmark does not count AFORCE results. A test refuses any `85000000xxxx` placeholder as a unit UPC.

| Product | Format | Unit UPC | Exact net contents | Final front-label text |
|---|---|---|---|---|
| Berry Blast + Dulse | Hydration Sticks | 860014045011 | missing | missing |
| Watermelon + Chlorella | Hydration Sticks | 860014380716 | missing | missing |
| Soursop + Seamoss | Hydration Sticks | 860014045028 | missing | missing |
| Berry Blast + Dulse | RTD can | 860014380709 | missing | missing |
| Watermelon + Chlorella | RTD can | 860014045004 | missing | missing |
| Soursop + Seamoss | RTD can | 860014045042 | missing | missing |
| Berry Blast + Dulse | Canister | missing | missing | missing |
| Watermelon + Chlorella | Canister | missing | missing | missing |
| Soursop + Seamoss | Canister | missing | missing | missing |
| FIELD BAG | Bulk bag | missing | missing | missing |

What each field means, so it can be read straight off the packaging:

- **Unit UPC:** the barcode number on the one package a member holds. For the RTD that is the single can, not the 12-pack case (send the case code too if the can and the case differ). For sticks, the code on the carton, and say whether a single stick carries any code.
- **Exact net contents:** as printed, with units. Cans: fl oz and mL. Sticks: net weight per stick and sticks per carton. Canister and bag: net weight and servings.
- **Final front-label text:** every line on the front panel as printed, in order, including capitalisation, "+" signs and any words such as "Zero Sugar" or "Electrolyte Drink Mix".

Questions the packaging will also answer:

- Does the FIELD BAG exist as a product a member can buy? It is in the catalog and has no store SKU.
- The app says the RTD is 12 oz and a stick mixes into 12 oz, a canister serving into 18 oz. These are the app's working numbers, not packaging facts.
- The names differ between tables today ("Berry Blast +Dulse", "Berry Blast + Dulse Stick", "Berry Blast Canister"). The printed label decides.

## Test products

Automated tests and the benchmark use clearly labelled test products, not AFORCE claims: label text typed into the tests as fixtures, and shop-bought drinks in the benchmark. The AFORCE cases in `labelEvidence.test.ts` use the catalog's placeholder names and prove only the matching logic, not that a real AFORCE label reads correctly.

## Other data gaps found

- The drink catalog (`data/drinkCatalog.ts`) holds serving sizes, not package sizes. The engine never uses them as a container size. Package volume comes only from the label (or the member).
- The catalog has one row for many real products (for example one "Monster Energy", no zero-sugar row, no "Pepsi Zero"). The engine does not claim a catalog product when the label contradicts it; it keeps the brand and leaves the product open. A larger catalog would answer more drinks outright.
- Non-alcoholic beer has no catalog category; it is saved as "custom".
- Open Food Facts records often lack a size; `serving_size` is fetched but not used, and is a serving anyway.
