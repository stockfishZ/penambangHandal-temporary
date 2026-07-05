# **NiTERRA Architecture Blueprint: Phases 3 & 4 (Finalized)**

**Role Assignment:** You are the Senior Backend & Database Coding Agent. Your objective is to build a high-performance, strictly typed spatial machine learning pipeline for nickel prospectivity and operational viability in Indonesia.

## **Phase 3: Spatial Risk & Feasibility Engine**

### **Milestone 3.2 (Revised): Database-Level Spatial Computation & Distance Bands**

* **Dynamic Hydrological Buffers:** The database must use ST\_Intersection to differentiate between *Kawasan Hutan* and *APL* (Non-Forest Land) for hydrological buffers.  
  * **If Kawasan Hutan:** Apply ST\_Buffer of 100m for rivers, 50m for tributaries, 200m for springs, 500m for lakes/reservoirs, and 2x depth for ravines.  
  * **If APL:** Apply ST\_Buffer of 100m for rivers with DAS \> 500km² and 50m for rivers with DAS ≤ 500km² (Permen PUPR 28/2015).  
* **Distance Penalty Bands (Logistical Friction):** Use continuous distances to calculate viability weights.  
  * **Penalty Zone (Hard 0):** Distance \< 500m from settlements, public roads, or public facilities (Permen LH 4/2012).  
  * **Optimal Logistical Zone:** Distance \> 500m from all civilian infrastructure.

### **Milestone 3.3 (Revised): Kill Zones (Hard 0 Viability)**

* **Deterministic Exclusion Mask:** The PostGIS mask must be a boolean TRUE (Exclude) if any grid cell intersects:  
  * **Hutan Konservasi:** All sub-categories (Cagar Alam, Taman Nasional, etc.).  
  * **Hutan Lindung:** Strictly prohibited for open-pit mining (UU 41/1999).  
  * **Hydrological Exclusions:** All forest-zone hydrological buffers defined in Milestone 3.2.

## **Phase 4: Deterministic Legal Lookup Engine**

### **Milestone 4.3 (Revised): Legal Dictionary Matrix**

Implement this relational table in PostgreSQL to serve the legal metadata appends.

| Spatial Zone | Permit Required | Legal Reference |
| :---- | :---- | :---- |
| **Areal Penggunaan Lain (APL)** | IUP (AMDAL/UKL-UPL) | UU 3/2020; PP 96/2021 |
| **Hutan Produksi (HP/HPT)** | PPKH (Persetujuan Penggunaan Kawasan Hutan) | PP 23/2021 |
| **Hutan Produksi Konversi (HPK)** | PPKH | PP 23/2021 |

* **Metadata Appends:** If an API query detects a polygon in HP/HPT/HPK, the backend must fetch and append the corresponding mitigation requirements (e.g., "Requires PPKH, PNBP payment, and watershed rehabilitation (Rehabilitasi DAS) at a 1:1 ratio") to the JSON response.  
* **Temporal Logic:** Exclude historical "Keterlanjuran" (grandfathered) concessions from viability scoring. The ML model must only score new application viability based on current 2026 regulations, flagging legacy sites as historical anomalies rather than viable targets.

### **Architect's Final Notes for the Coding Agent:**

1. **No ML Hallucinations:** The ML model is forbidden from predicting permits. The Legal Dictionary Matrix above must be queried by FastAPI as a deterministic lookup based on the PostGIS spatial intersection result.  
2. **Standardization:** All spatial calculations must use a metric projection (e.g., UTM) to ensure distances are measured in meters, not degrees.  
3. **Safety Override:** The 500m settlement buffer is a hard kill-switch unless the input flag kajian\_teknis\_kestabilan is set to TRUE, at which point the buffer penalty is mitigated.