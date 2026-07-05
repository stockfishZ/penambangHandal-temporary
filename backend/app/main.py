from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import logging

from app.database import db_manager, get_db
from app.config import settings
from app.big_api import query_point as big_query_point
from ml.inference import ProspectivityModel

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

ml_model = ProspectivityModel(settings.ML_MODEL_PATH)

app = FastAPI(title="NiTERRA Analysis API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup():
    try:
        await db_manager.connect()
    except Exception as e:
        logger.warning(f"Database unavailable, running in API-only mode: {e}")

@app.on_event("shutdown")
async def shutdown():
    try:
        await db_manager.disconnect()
    except Exception:
        pass

class GridAnalysisRequest(BaseModel):
    grid_id: str = ""
    latitude: float
    longitude: float
    magnetometer_value: float
    geochemistry_value: float
    kajian_teknis_kestabilan: bool = False
    # ML feature inputs
    slope_deg: float | None = None
    distance_to_river_m: float | None = None
    distance_to_road_m: float | None = None
    distance_to_smelter_km: float | None = None
    area_ha: float | None = None
    Ni_pct_mean: float | None = None
    Fe_pct_mean: float | None = None
    Co_pct_mean: float | None = None
    MgO_pct_mean: float | None = None
    SiO2_pct_mean: float | None = None
    mag_mean_nT: float | None = None
    mag_std_nT: float | None = None
    lithology: str | None = None
    legal_status: str | None = None

class BatchGridAnalysisRequest(BaseModel):
    grids: list[GridAnalysisRequest]

async def _compute_analysis(request: GridAnalysisRequest, db=None) -> dict:
    spatial_features = {}
    db_available = db is not None
    if db_available and db_manager.pool:
        try:
            query = """
            SELECT * FROM public.get_grid_spatial_features($1, $2)
            """
            result = await db.fetch_row(query, request.longitude, request.latitude)
            spatial_features = dict(result) if result else {}
        except Exception as e:
            logger.warning(f"Spatial query failed, using request features only: {e}")
    if not spatial_features:
        logger.info(f"No spatial data in DB for ({request.latitude}, {request.longitude}), using request features only")

    if spatial_features.get("kelas_hutan", "none") == "none" or spatial_features.get("kawasan_hutan", "none") == "none":
        try:
            big_result = await big_query_point(request.latitude, request.longitude)
            if big_result:
                spatial_features["kelas_hutan"] = big_result.get("kelas_hutan", spatial_features.get("kelas_hutan", "none"))
                spatial_features["kawasan_hutan"] = big_result.get("kawasan_hutan", spatial_features.get("kawasan_hutan", "none"))
                spatial_features["izin_no"] = big_result.get("izin_no", spatial_features.get("izin_no", "none"))
                spatial_features["legal_source"] = "big_kesatupeta"
        except Exception:
            logger.warning("BIG API fallback unavailable, using local data only")

    dist_to_settlement = spatial_features.get("dist_to_settlement_meters", 0.0)
    dist_to_road = spatial_features.get("dist_to_road_meters", 0.0)
    dist_to_public_facility = spatial_features.get("dist_to_public_facility_meters", 0.0)
    within_hydro_buffer = spatial_features.get("within_hydro_buffer", False)
    within_apl_hydro_buffer = spatial_features.get("within_apl_hydro_buffer", False)
    kill_zone = spatial_features.get("kill_zone_exclusion", False)
    is_kill_zone = spatial_features.get("is_kill_zone", False)
    is_grandfathered = spatial_features.get("is_grandfathered", False)

    viability_score = 1.0

    if kill_zone or is_kill_zone:
        viability_score = 0.0
    elif is_grandfathered:
        viability_score = 0.0
    elif dist_to_road < 500:
        viability_score = 0.0
    elif dist_to_public_facility < 500:
        viability_score = 0.0
    elif dist_to_settlement < 500:
        if request.kajian_teknis_kestabilan:
            viability_score *= 0.5
        else:
            viability_score = 0.0
    elif dist_to_settlement < 1000:
        viability_score *= 0.7
    elif dist_to_settlement < 2000:
        viability_score *= 0.85

    if dist_to_road > 10000:
        viability_score *= 0.5
    elif dist_to_road > 5000:
        viability_score *= 0.7

    if within_apl_hydro_buffer:
        viability_score *= 0.6
    elif within_hydro_buffer:
        viability_score *= 0.6

    permit_required = spatial_features.get("permit_required", "unknown")
    if permit_required == "EXCLUDED":
        viability_score = 0.0
    elif permit_required != "unknown":
        viability_score *= 0.85

    legal_zone = spatial_features.get("legal_zone", "unknown")
    compliance_status = spatial_features.get("compliance_status", "Verify permits")

    # ML inference
    ml_result = None
    if settings.ML_ENABLED:
        try:
            ml_features = _build_ml_features(request, spatial_features)
            ml_result = ml_model.predict_masked(ml_features)
        except Exception as e:
            logger.warning(f"ML inference failed: {e}")
            ml_result = {"ml_score": None, "error": str(e), "masked": False}

    result = {
        "grid_id": request.grid_id,
        "coordinate": {"lat": request.latitude, "lng": request.longitude},
        "spatial_features": {
            "dist_to_road_meters": spatial_features.get("dist_to_road_meters", 0.0),
            "nearest_road_type": spatial_features.get("nearest_road_type", "none"),
            "nearest_road_name": spatial_features.get("nearest_road_name", "none"),
            "dist_to_water_meters": spatial_features.get("dist_to_water_meters", 0.0),
            "nearest_water_type": spatial_features.get("nearest_water_type", "none"),
            "nearest_water_name": spatial_features.get("nearest_water_name", "none"),
            "water_das_km2": spatial_features.get("water_das_km2", 0.0),
            "dist_to_settlement_meters": spatial_features.get("dist_to_settlement_meters", 0.0),
            "nearest_settlement_type": spatial_features.get("nearest_settlement_type", "none"),
            "nearest_settlement_name": spatial_features.get("nearest_settlement_name", "none"),
            "settlement_population": spatial_features.get("settlement_population", 0),
            "dist_to_smelter_meters": spatial_features.get("dist_to_smelter_meters", 0.0),
            "nearest_smelter_name": spatial_features.get("nearest_smelter_name", "none"),
            "nearest_smelter_type": spatial_features.get("nearest_smelter_type", "none"),
            "nearest_smelter_source": spatial_features.get("nearest_smelter_source", "none"),
            "dist_to_public_facility_meters": spatial_features.get("dist_to_public_facility_meters", 0.0),
            "nearest_facility_type": spatial_features.get("nearest_facility_type", "none"),
            "nearest_facility_name": spatial_features.get("nearest_facility_name", "none"),
        },
        "legal_context": {
            "land_classification": spatial_features.get("land_classification", "unknown"),
            "landuse_name": spatial_features.get("landuse_name", "none"),
            "kawasan_hutan": spatial_features.get("kawasan_hutan", "none"),
            "kelas_hutan": spatial_features.get("kelas_hutan", "none"),
            "izin_no": spatial_features.get("izin_no", "none"),
            "izin_type": spatial_features.get("izin_type", "none"),
            "legal_zone": legal_zone,
            "permit_required": permit_required,
            "legal_reference": spatial_features.get("legal_reference", "UU 3/2020; PP 96/2021"),
            "mitigation_requirements": spatial_features.get("mitigation_requirements", "Verify permits with local authorities"),
            "compliance_status": compliance_status,
            "legal_source": spatial_features.get("legal_source", "local_postgis"),
        },
        "buffer_status": {
            "forest_hydro_buffer": within_hydro_buffer,
            "apl_hydro_buffer": within_apl_hydro_buffer,
            "settlement_500m_buffer": dist_to_settlement < 500,
            "road_500m_buffer": dist_to_road < 500,
            "public_facility_500m_buffer": dist_to_public_facility < 500,
        },
        "raw_inputs": {
            "magnetometer": request.magnetometer_value,
            "geochemistry": request.geochemistry_value,
        },
        "viability_score": viability_score,
        "ml_score": ml_result["ml_score"] if ml_result else None,
        "ml_masked": ml_result["masked"] if ml_result else None,
        "ml_block_reason": ml_result.get("block_reason") if ml_result else None,
        "ml_top_features": ml_result.get("top_features", []) if ml_result else [],
        "kill_zone_exclusion": kill_zone or is_kill_zone,
        "is_grandfathered": is_grandfathered,
        "compliance": {
            "kill_zone": is_kill_zone,
            "grandfathered": is_grandfathered,
            "buffer_zone": dist_to_settlement < 500 and not request.kajian_teknis_kestabilan,
            "road_buffer": dist_to_road < 500,
            "facility_buffer": dist_to_public_facility < 500,
            "permit_status": permit_required,
            "status_message": compliance_status,
        },
    }

    return result

def _build_ml_features(request: GridAnalysisRequest, spatial: dict) -> dict:
    return {
        "slope_deg": request.slope_deg or 0.0,
        "distance_to_river_m": request.distance_to_river_m or spatial.get("dist_to_water_meters", 0.0),
        "distance_to_road_m": request.distance_to_road_m if request.distance_to_road_m is not None else spatial.get("dist_to_road_meters", 9999),
        "distance_to_smelter_km": request.distance_to_smelter_km or (spatial.get("dist_to_smelter_meters", 0) / 1000),
        "area_ha": request.area_ha or 0.0,
        "Ni_pct_mean": request.Ni_pct_mean or 0.0,
        "Fe_pct_mean": request.Fe_pct_mean or 0.0,
        "Co_pct_mean": request.Co_pct_mean or 0.0,
        "MgO_pct_mean": request.MgO_pct_mean or 0.0,
        "SiO2_pct_mean": request.SiO2_pct_mean or 0.0,
        "mag_mean_nT": request.mag_mean_nT or request.magnetometer_value,
        "mag_std_nT": request.mag_std_nT or 0.0,
        "lithology": request.lithology or "unknown",
        "legal_status": request.legal_status or spatial.get("land_classification", "unknown"),
    }

@app.get("/health")
async def health_check():
    return {
        "status": "ok",
        "database": settings.DB_NAME,
        "ml_enabled": settings.ML_ENABLED,
        "ml_loaded": ml_model.loaded,
    }

@app.get("/api/verify-land-classification")
async def verify_land_classification(lat: float = -7.5, lon: float = 110.5):
    try:
        result = await big_query_point(lat, lon)
        if result is None:
            return {
                "source": "big_kesatupeta",
                "found": False,
                "kelas_hutan": None,
                "kawasan_hutan": None,
                "query_coordinate": {"lat": lat, "lon": lon},
                "message": "No forestry boundary intersects this coordinate in BIG One Map data.",
            }
        return {"found": True, **result}
    except Exception as e:
        logger.error(f"BIG API query failed: {e}")
        raise HTTPException(status_code=502, detail=f"BIG API unavailable: {e}")

@app.post("/api/analyze-grid")
async def analyze_grid(request: GridAnalysisRequest, db=None):
    try:
        db_conn = db_manager.pool if db_manager.pool else None
        return await _compute_analysis(request, db_conn)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error analyzing grid: {e}")
        raise HTTPException(status_code=500, detail="Internal server error during analysis")

@app.post("/api/analyze-batch")
async def analyze_batch(request: BatchGridAnalysisRequest, db=None):
    try:
        db_conn = db_manager.pool if db_manager.pool else None
        results = []
        errors = []
        for i, grid in enumerate(request.grids):
            try:
                result = await _compute_analysis(grid, db_conn)
                results.append(result)
            except HTTPException as e:
                errors.append({"index": i, "coordinate": {"lat": grid.latitude, "lng": grid.longitude}, "detail": e.detail})
            except Exception as e:
                logger.error(f"Error analyzing grid {i}: {e}")
                errors.append({"index": i, "coordinate": {"lat": grid.latitude, "lng": grid.longitude}, "detail": str(e)})
        return {"results": results, "errors": errors, "total": len(request.grids), "success_count": len(results)}
    except Exception as e:
        logger.error(f"Error in batch analysis: {e}")
        raise HTTPException(status_code=500, detail="Internal server error during batch analysis")
