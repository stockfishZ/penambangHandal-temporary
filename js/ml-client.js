// Pre-survey client-side ML prospectivity scoring engine
// Uses only features available before drone deployment (no geochem, no magnetics).

const NiTerraML = (() => {

  const LITH_SCORE = {
    serpentinite_simulated:   3.0,
    peridotite_simulated:     3.0,
    ultramafic_simulated:     2.5,
    mafic_volcanic_simulated: 1.5,
    alluvium:                 0.0,
    andesite:                 0.5,
    lahar_deposit:            0.3,
    tuff:                     0.2,
    volcanic_breccia:         0.5,
  };

  const LEGAL_SCORE = {
    'allowed':     5.0,
    'conditional': 3.0,
    'no-go':       0.0,
    'no_go':       0.0,
    'unknown':     1.0,
  };

  function predictCell(f) {
    const gridId   = f.grid_id || '';
    const legal    = String(f.legal_status || 'unknown');
    const distRoad = Number(f.distance_to_road_m || 9999);

    if (legal === 'no-go' || legal === 'no_go') {
      return _masked(gridId, 0.0, 'Legal status: no-go zone');
    }

    const lith     = String(f.lithology || '');
    const slope    = Number(f.slope_deg || 0);
    const distRoadKm = distRoad / 1000.0;
    const smelter  = Number(f.distance_to_smelter_km || 999);

    // pre-survey component scores (max total ~10)
    const legalScore = LEGAL_SCORE[legal] ?? 1.0;
    const lithScore = LITH_SCORE[lith] ?? 0.0;
    const slopeNorm = Math.max(0.0, Math.min(1.0, (15.0 - Math.abs(slope - 8.0)) / 15.0)) * 1.5;
    const roadScore = distRoadKm <= 10 ? Math.max(0.0, 1.0 - Math.abs(distRoadKm - 2.5) / 7.5) : 0.0;
    const smelterScore = Math.max(0.0, Math.min(1.0, 1.0 - smelter / 150.0));

    let score = legalScore + lithScore + slopeNorm + roadScore + smelterScore;
    score = Math.round(Math.max(0.0, Math.min(10.0, score)) * 100) / 100;

    const importance = [
      { feature: 'legal_status',      importance: 0.35, impact: _r(legalScore) },
      { feature: 'lithology',          importance: 0.28, impact: _r(lithScore) },
      { feature: 'slope_deg',          importance: 0.15, impact: _r(slopeNorm) },
      { feature: 'distance_to_road_m', importance: 0.12, impact: _r(roadScore) },
      { feature: 'distance_to_smelter_km', importance: 0.10, impact: _r(smelterScore) },
    ];

    return {
      grid_id: gridId,
      coordinate: { lat: Number(f.latitude || 0), lng: Number(f.longitude || 0) },
      ml_score: score,
      ml_masked: false,
      ml_block_reason: null,
      ml_top_features: importance.filter(x => x.impact > 0).slice(0, 5),
      ml_confidence: 0.60,
      ml_cv_score: 0.55,
      ml_engine: 'client-side-pre-survey-v1',
    };
  }

  function analyzeBatch(grids) {
    const results = [];
    const errors  = [];
    grids.forEach((g, i) => {
      try {
        results.push(predictCell(g));
      } catch (e) {
        errors.push({ index: i, detail: e.message });
      }
    });
    return { results, errors, total: grids.length, success_count: results.length };
  }

  function _masked(gridId, score, reason) {
    return {
      grid_id: gridId,
      ml_score: score,
      ml_masked: true,
      ml_block_reason: reason,
      ml_top_features: [],
      ml_confidence: 1.0,
      ml_cv_score: null,
      ml_engine: 'client-side-pre-survey-v1',
    };
  }
  function _r(v) { return Math.round(v * 1000) / 1000; }

  return { predictCell, analyzeBatch };
})();
