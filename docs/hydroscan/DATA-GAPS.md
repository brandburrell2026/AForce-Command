# HydroScan data gaps (needed from the founders)

Nothing in this file is invented. These are things the repo does not have, and the label reader cannot be tuned for AFORCE without them.

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

## Other data gaps found

- The drink catalog (`data/drinkCatalog.ts`) holds serving sizes, not package sizes. The engine never uses them as a container size. Package volume comes only from the label (or the member).
- The catalog has one row for many real products (for example one "Monster Energy", no zero-sugar row, no "Pepsi Zero"). The engine does not claim a catalog product when the label contradicts it; it keeps the brand and leaves the product open. A larger catalog would answer more drinks outright.
- Non-alcoholic beer has no catalog category; it is saved as "custom".
- Open Food Facts records often lack a size; `serving_size` is fetched but not used, and is a serving anyway.
