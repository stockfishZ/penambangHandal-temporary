# NI-TERRA DRILL CAMPAIGN OPTIMIZATION BLUEPRINT

TARGET: Coding AI (Backend & Frontend)

OBJECTIVE: Implement a dynamic drill-hole spacing and financial forecasting module (CAPEX) based on spatial ML confidence.

## SYSTEM DIRECTIVE FOR THE AI

Listen up. I do not care about your Python syntax or your JavaScript libraries. I care about operational reality. Right now, this dashboard colors a map. I need it to output a budget.

We are implementing a 2D heuristic model to calculate exactly how many drill holes we need on a given grid, what spacing to use, and how much it will cost in Rupiah (Rp).

You are to execute this across two distinct milestones. Do not deviate from these parameters.

## MILESTONE 1: THE CALCULATION ENGINE (BACKEND DATA PIPELINE)

Your first job is to handle the math in the backend API before it sends the JSON response to the front. We need to assess the risk of the grid and assign drill spacing accordingly.

## Sub-Milestone 1.1: Risk Assessment & Spacing Logic

If a grid is highly prospective but geophysically volatile, we need to drill tighter to prove the reserve. If it's uniform and high-confidence, we drill wider to save money.

\- Condition A (Low Confidence / High Variance): If the ml\_score is LESS THAN OR EQUAL TO 7.5 OR the mag\_std\_nT is GREATER THAN 15, the geology is erratic.

• Instruction: Set the drill spacing to 50 meters.

\- Condition B (High Confidence / Uniform): If the ml\_score is GREATER THAN 7.5 AND the mag\_std\_nT is LESS THAN OR EQUAL TO 15, the ore body is predictable.

• Instruction: Set the drill spacing to 100 meters.

## Sub-Milestone 1.2: Volumetric & Meterage Calculation

Once you have the spacing, calculate the physical drilling required.

\- Grid Area: Take the area\_hα of the grid and convert it to square meters (multiply by 10,000).

\- Hole Count: Divide the square meter area by the square of the drill spacing (e.g., Area / (50 \* 50)).

\- Instruction: Round this number UP to the nearest whole integer. We cannot drill half a hole. Store this as estimated\_drill\_holes.

• Total Meterage: Assume a standard nickel laterite profile depth of 20 meters per hole.

\- Instruction: Multiply estimated\_drill\_holes by 20. Store this as total\_meterage.

## Sub-Milestone 1.3: Financial Projection (CAPEX)

Drilling costs money. Assume a blended core drilling and mobilization cost of Rp 750.000 per meter.

\- Instruction: Multiply total\_meterage by 750,000. Store this as estimated\_cost\_rp .

\- Final Output: Bundle all of these (Spacing, Holes, Meterage, Cost) into a new object called exploration\_capex and ensure it is returned in the final API response for every single grid

analyzed.

## MILESTONE 2: EXECUTIVE DASHBOARD INTEGRATION (FRONTEND UI)

Your second job is to display this data so the exploration managers can actually see it when they click on a grid.

## Sub-Milestone 2.1: Target Detail Panel Injection

Locate the panel on the right side of the screen that shows the "Target Detail" when a user clicks a grid row or map polygon.

\- Instruction: You must extract the exploration\_capex data from the active row object.

## Sub-Milestone 2.2: Financial & Operational Display Rows

I want three new rows added to the detail panel, placed immediately below the "Final score" metric and above the geochemical/magnetic stats. They must look native to the existing UI design.

\- Row 1 - Drill Grid Spacing: Display it as "Recommended Spacing" with the value formatted as $[X]m \times [X]m$ (e.g., "50m x 50m").

\- Row 2 - Estimated Drill Holes: Display it as "Required Drill Holes" with the calculated integer value.

\- Row 3 - Exploration CAPEX: Display it as "Est. Drilling Cost".

\- Critical Formatting: You must format this number cleanly into Indonesian Rupiah. Use proper thousand separators. E.g., Rp 2.500.000.000. Do not show me raw unformatted integers.

## Sub-Milestone 2.3: The Reason Box (Justification)

At the bottom of the panel, there is an "Alasan rekomendasi" (Recommendation Reason) box.

\- Instruction: Dynamically append a sentence to this reason string based on the spacing.

\- If 50m: Append "Variansi magnetik tinggi/ML score marginal, direkomendasikan spasi rapat (50m) untuk de-risking."

\- If 100m: Append "Anomali seragam dan ML score tinggi, spasi lebar (100m) memadai untuk initial discovery."

EXECUTION MANDATE: Execute these milestones perfectly. Do not break the existing map rendering or the ML scoring. Just add this financial layer seamlessly. Get to work.
