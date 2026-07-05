# Drilling Cost Benchmarks — Indonesian Nickel Laterite

Sources for the capex estimator in `buildResults()`. All figures are from public disclosures (IDX-listed companies) and published contractor rates.

## Spacing

| Spacing | Use case | Source |
|---------|----------|--------|
| 100m | Standard resource definition | MBMA, Tambang SCM Konawe — 301 holes at 100m spacing (Q4 2024), 20 holes at BR1, 36 holes at PB |
| 50m | Infill / resource category upgrade | MBMA, Tambang SCM — 173 holes at 50m spacing (Q4 2024) |
| 50m | Standard exploration spacing | Central Halmahera study — 953 drill holes at 50m spacing (2026, MMExp journal) |

**Decision:** 100m for high-confidence zones, 50m for high-variance zones. Matches industry practice.

## Cost per meter (full coring / diamond drilling)

| Rate (Rp/m) | Context | Source |
|-------------|---------|--------|
| 800.000 – 1.500.000 | Full coring, published 2025 rate | PT Arrahman (drilling contractor) |
| ~825.000 | Effective rate, Q4 2025 large campaign | MBMA — Rp 44.37B / 53,749m |
| ~2.420.000 | All-in (drilling + analysis + overhead), Q4 2024 | MBMA — Rp 33.87B / 14,005m |
| 750.000 | Original spec assumption | NEW MILESTONE.md |

**Decision:** Use **Rp 1.000.000/m** — midpoint of the published full-coring range, rounded. This is the pure drilling rate (not all-in), appropriate for a direct drill-cost estimate. The MBMA large-campaign rate of ~825K confirms this is competitive.

> If the estimator is meant to represent total exploration cost (drilling + analysis + logistics + overhead), use Rp 2.000.000/m (conservative all-in blend from MBMA Q4 2024 data).

## Depth per hole

| Depth | Context | Source |
|-------|---------|--------|
| 20m | Original spec assumption | NEW MILESTONE.md |
| 20–50m | Typical laterite profile thickness | Multiple industry sources |
| Up to 75m | Deep saprolite zones | Groundradar, UltraGPR case studies |

**Decision:** Use **25m** — conservative for exploration-stage drilling (not full resource definition). Underestimating depth is safer for budget planning than overestimating.

## Summary: calibrated parameters for the estimator

| Parameter | Value | Source |
|-----------|-------|--------|
| Spacing (high conf) | 100m × 100m | MBMA, Halmahera research |
| Spacing (low conf) | 50m × 50m | MBMA, Halmahera research |
| Cost per meter | Rp 1.000.000 | PT Arrahman 2025 rate card (midpoint) |
| Depth per hole | 25m | Industry average, conservative |
| Hole area unit | ha → m² (×10,000) | Standard |
| Math | `Math.ceil(area_m² / spacing²)` holes | Standard |
