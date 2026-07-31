# CR-1 — Supplier Evidence Request (DRAFT to send)

**Status:** ⏳ **FINALIZED except recipient — not sent.** For **Brandon** to send to the AForce formulation manufacturer / contract lab. Product/SKU details are filled in; the **only** field left is the recipient name (`[name]`) and, if your manufacturer uses them, internal formula/lot codes. Sending is the founder's action.
**Purpose:** obtain the product-specific documentation needed to **restore the held claims** (ER-1, ER-2) and close the open evidence items in `governance/reviews/CR-1-EVIDENCE-REQUESTS.md`. Until each document is received **and** validated by the performance-scientist, the corresponding claim stays removed from copy.
**Prepared:** 2026-07-31.

---

## Part A — Cover note (paste into email/portal)

> Subject: **AForce — pre-launch documentation request (CoA + specs)**
>
> Hi [name],
>
> Ahead of launch we're finalizing our claims substantiation file and need current, product-specific documentation for the AForce line — our two formats (**RTD cans**, 6-pack; **hydration sticks**, 20 servings/box) across three flavors: **Watermelon Surge + Chlorella**, **Berry Blast + Dulse**, and **Soursop Edge + Sea Moss** (please cross-reference your internal formula/lot codes). Could you provide the items in the checklist below — ideally the most recent production lot, dated, with the testing method noted for each analytical result?
>
> A few are standard (CoA, spec sheet, contaminant panel); two are more specific (a distinct-mineral count and any time-release/absorption data you hold). Where a test hasn't been run, just say so — we'd rather know than assume.
>
> Please send digital PDFs and note the accrediting body (e.g. ISO/IEC 17025) for any lab results. Happy to hop on a call if easier.
>
> Thanks,
> Brandon — AForce Hydration, Inc.

---

## Part B — Evidence checklist (what to request)

| # | Document / test | Substantiates | Acceptance criteria | Priority |
|---|---|---|---|---|
| **1** | **Certificate of Analysis (CoA)** — full mineral panel, per serving | ER-1 "Trace Minerals" (and the specific **"72"** count, if restored) | Accredited-lab CoA (ICP-MS or equiv.) listing each mineral + per-serving amount; a **distinct-mineral count** stated or derivable; dated + lot-referenced | **High** — restores the "72" count |
| **2** | **Sodium content per serving** (on the CoA) | The in-app "25 mg sodium" figure | Confirms 25 mg/serving (or the true value) so the app number matches the formulation | **High** |
| **3** | **pH measurement** (spec sheet or CoA) | "pH 8.8" brand-standard statement | Measured finished-product pH with method; confirms 8.8 (or true value) | **Medium** |
| **4** | **Time-release / dissolution or PK data** | ER-2 "4-Hour Recovery Window / time-released absorption" | Any dissolution-profile or pharmacokinetic data for the finished product showing a time-release characteristic. **If none exists, confirm that** — the claim stays out | **Medium** (hardest; may not exist) |
| **5** | **Mineral bioavailability / absorption data** | ER-6 "marine-sourced minerals" if ever upgraded to a "bioavailable"/absorption claim | Absorption or bioavailability study for the formulation's minerals | **Low** (only to *reinstate* an absorption claim) |
| **6** | **Ingredient identity + source docs** — Irish sea moss (*Chondrus crispus*), Atlantic dulse, chlorella | Ingredient names + any future ingredient statements | Botanical/species identity, country of origin, supplier CoA per ingredient | **Medium** |
| **7** | **Iodine content** (dulse; on CoA) | Any iodine/dulse statement + **safety** | Per-serving iodine; flag if variable/high (seaweed iodine varies — safety-relevant, not a benefit to tout) | **Medium** |
| **8** | **Contaminant panel** — heavy metals (Pb, As, Cd, Hg), microbials | Safety + Prop 65 posture (seaweed can accumulate metals) | Accredited-lab results within spec/limits; per lot | **High** (safety) |
| **9** | **Master formulation / finished-product spec sheet + nutrition facts** | The authoritative per-serving amounts behind all label + calculator numbers | Full spec: serving size, all actives + amounts, allergens, shelf life | **High** |

---

## Part C — Mapping back to the register + what evidence does NOT rehabilitate

**Restores a held/removed claim (evidence-gated):**
- **Item 1 → ER-1.** A CoA proving ≥72 distinct minerals lets "72 Trace Minerals" come back. Absent it, the copy stays "Trace Minerals."
- **Item 4 → ER-2.** Time-release/PK data lets the "4-Hour Recovery Window / time-released absorption" row be restored. Absent it, the row stays removed.
- **Item 5 → ER-6.** Absorption data would be needed to reinstate any "bioavailable"/absorption wording (currently "marine-sourced").

**Evidence does NOT bring these back — they are barred by COMPLIANCE §2 regardless of any lab result** (medical/structure-function/organ claims):
- "…critical to **cellular function**" / "structured water for **cellular uptake**" / "drive **cellular recovery**"
- Chlorella "**binds heavy metals**" (detox/chelation) · Dulse "for **thyroid**"

Send Item 7's iodine data to the reviewer for the *dulse ingredient statement*, but the "thyroid" framing stays out. Even a strong CoA/PK file must still clear the **external CR-1 regulatory review** before any restored claim ships — the supplier docs are necessary, not sufficient.

---

## Part D — On receipt (internal)

1. **performance-scientist** validates each doc supports the exact claim wording (not just "is plausible").
2. Update `CR-1-EVIDENCE-REQUESTS.md`: OPEN/HELD → RECEIVED → VALIDATED.
3. Restored wording flows into `CLAIMS-REGISTER.md` **only after** the external regulatory reviewer signs off.
4. For anything the supplier says isn't tested, log it as "no evidence — claim stays out" so it doesn't get re-litigated.

*Finalized except recipient. No message has been sent. Add the recipient name (`[name]`) — and internal formula/lot codes if your manufacturer uses them — then send from your own mail/portal.*
