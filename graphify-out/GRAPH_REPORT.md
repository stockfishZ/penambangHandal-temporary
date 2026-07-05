# Graph Report - .  (2026-07-04)

## Corpus Check
- Corpus is ~7,782 words - fits in a single context window. You may not need a graph.

## Summary
- 89 nodes · 132 edges · 11 communities (10 shown, 1 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 5 edges (avg confidence: 0.5)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Frontend UI & Map|Frontend UI & Map]]
- [[_COMMUNITY_BIG API Integration|BIG API Integration]]
- [[_COMMUNITY_FastAPI Backend|FastAPI Backend]]
- [[_COMMUNITY_Database Layer|Database Layer]]
- [[_COMMUNITY_Frontend Logic & Events|Frontend Logic & Events]]
- [[_COMMUNITY_Config & DB Setup|Config & DB Setup]]
- [[_COMMUNITY_Styling & UI State|Styling & UI State]]
- [[_COMMUNITY_CSV Upload Processing|CSV Upload Processing]]
- [[_COMMUNITY_Results Builder|Results Builder]]

## God Nodes (most connected - your core abstractions)
1. `runAnalysis()` - 10 edges
2. `iter_all_features()` - 6 edges
3. `DatabaseManager` - 6 edges
4. `import_forestry_data()` - 6 edges
5. `_client()` - 5 edges
6. `transform_feature()` - 5 edges
7. `bindEvents()` - 5 edges
8. `fetch_features()` - 4 edges
9. `query_point()` - 4 edges
10. `Settings` - 4 edges

## Surprising Connections (you probably didn't know these)
- `import_forestry_data()` --calls--> `iter_all_features()`  [EXTRACTED]
  backend/scripts/import_big_forestry.py → backend/app/big_api.py
- `import_forestry_data()` --calls--> `transform_feature()`  [EXTRACTED]
  backend/scripts/import_big_forestry.py → backend/app/big_api.py

## Import Cycles
- None detected.

## Communities (11 total, 1 thin omitted)

### Community 0 - "Frontend UI & Map"
Cohesion: 0.09
Nodes (5): els, rawGeo, rawMagnet, resultRows, weights

### Community 1 - "BIG API Integration"
Cohesion: 0.27
Nodes (14): Any, AsyncClient, _client(), fetch_features(), get_total_count(), iter_all_features(), query_point(), resolve_fungsitap() (+6 more)

### Community 2 - "FastAPI Backend"
Cohesion: 0.26
Nodes (6): analyze_batch(), analyze_grid(), BatchGridAnalysisRequest, _compute_analysis(), GridAnalysisRequest, BaseModel

### Community 3 - "Database Layer"
Cohesion: 0.20
Nodes (5): DatabaseManager, Initialize the asyncpg Connection Pool., Close the asyncpg Connection Pool., Utility to fetch a single row from the database using a connection from the pool, Utility to fetch multiple rows from the database.

### Community 4 - "Frontend Logic & Events"
Cohesion: 0.33
Nodes (9): bindEvents(), downloadResults(), forceMapResize(), loadDummyData(), renderMapLayers(), renderRanking(), renderSummary(), runAnalysis() (+1 more)

### Community 5 - "Config & DB Setup"
Cohesion: 0.25
Nodes (4): Settings, get_db(), FastAPI Dependency for accessing the database pool., BaseSettings

### Community 6 - "Styling & UI State"
Cohesion: 0.40
Nodes (5): colorRamp(), gridStyle(), priorityColor(), priorityKey(), selectTarget()

### Community 7 - "CSV Upload Processing"
Cohesion: 0.67
Nodes (3): parseCSV(), readUploadedFiles(), splitCSVLine()

## Knowledge Gaps
- **5 isolated node(s):** `resultRows`, `rawMagnet`, `rawGeo`, `weights`, `els`
  These have ≤1 connection - possible missing edges or undocumented components.
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `DatabaseManager` connect `Database Layer` to `Config & DB Setup`?**
  _High betweenness centrality (0.093) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `runAnalysis()` (e.g. with `bindEvents()` and `forceMapResize()`) actually correct?**
  _`runAnalysis()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Initialize the asyncpg Connection Pool.`, `Close the asyncpg Connection Pool.`, `Utility to fetch a single row from the database using a connection from the pool` to the rest of the system?**
  _11 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Frontend UI & Map` be split into smaller, more focused modules?**
  _Cohesion score 0.09090909090909091 - nodes in this community are weakly interconnected._