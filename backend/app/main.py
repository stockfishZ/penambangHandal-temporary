from fastapi import FastAPI, Depends, HTTPException, BackgroundTasks, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.responses import Response
from pydantic import BaseModel
import logging
import asyncio
import os
from datetime import datetime, timezone

is_training = False

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
    magnetometer_value: float | None = None
    geochemistry_value: float | None = None
    kajian_teknis_kestabilan: bool = False
    slope_deg: float | None = None
    distance_to_river_m: float | None = None
    distance_to_road_m: float | None = None
    distance_to_smelter_km: float | None = None
    area_ha: float | None = None
    lithology: str | None = None
    legal_status: str | None = None

class BatchGridAnalysisRequest(BaseModel):
    grids: list[GridAnalysisRequest]

class ESGDraftRequest(BaseModel):
    grid_id: str
    slope_deg: float = 0.0
    distance_to_river_m: float = 0.0
    legal_status: str = "Aman"
    lithology: str = ""
    ni_avg: float = 0.0
    roi_savings_miliar: float = 0.0

def _sanitize_data(request: GridAnalysisRequest) -> list[str]:
    # QA/QC check placeholder for survey data
    return []

async def _compute_analysis(request: GridAnalysisRequest, db=None, precomputed_spatial: dict = None) -> dict:
    qaqc_flags = _sanitize_data(request)
    spatial_features = precomputed_spatial or {}
    db_available = db is not None

    # Fetch nearest distances and forestry status from PostGIS
    if db_available and db_manager.pool and precomputed_spatial is None:
        try:
            query = """
            SELECT 
                (SELECT ST_Distance(ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, geom::geography) 
                 FROM osm_roads ORDER BY geom <-> ST_SetSRID(ST_MakePoint($1, $2), 4326) LIMIT 1) as dist_to_road_meters,
                (SELECT ST_Distance(ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, geom::geography) 
                 FROM osm_waterways ORDER BY geom <-> ST_SetSRID(ST_MakePoint($1, $2), 4326) LIMIT 1) as dist_to_water_meters,
                (SELECT EXISTS(
                    SELECT 1 FROM klhk_forestry_boundaries 
                    WHERE ST_Intersects(geom, ST_SetSRID(ST_MakePoint($1, $2), 4326)) 
                    AND kelas_hutan ILIKE '%LINDUNG%'
                )) as is_kill_zone
            """
            result = await db.fetch_row(query, request.longitude, request.latitude)
            spatial_features = dict(result) if result else {}
        except Exception as e:
            logger.warning(f"Spatial query failed, using request features only: {e}")
    if not spatial_features:
        logger.info(f"No spatial data in DB for ({request.latitude}, {request.longitude}), using request features only")

    # Fallback query to BIG Satu Peta API if local forestry data is missing
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

    # Calculate legal and ESG viability score
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
            "magnetometer": request.magnetometer_value or 0,
            "geochemistry": request.geochemistry_value or 0,
        },
        "viability_score": viability_score,
        "ml_score": ml_result["ml_score"] if ml_result else None,
        "ml_masked": ml_result["masked"] if ml_result else None,
        "ml_block_reason": ml_result.get("block_reason") if ml_result else None,
        "ml_top_features": ml_result.get("top_features", []) if ml_result else [],
        "ml_confidence": ml_result.get("ml_confidence") if ml_result else None,
        "ml_cv_score": ml_result.get("ml_cv_score") if ml_result else None,
        "kill_zone_exclusion": kill_zone or is_kill_zone,
        "is_grandfathered": is_grandfathered,
        "qaqc_flags": qaqc_flags,
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
        "distance_to_river_m": spatial.get("dist_to_water_meters") if spatial.get("dist_to_water_meters") is not None else (request.distance_to_river_m or 9999.0),
        "distance_to_road_m": spatial.get("dist_to_road_meters") if spatial.get("dist_to_road_meters") is not None else (request.distance_to_road_m or 9999.0),
        "distance_to_smelter_km": (spatial.get("dist_to_smelter_meters", 0) / 1000) if spatial.get("dist_to_smelter_meters") is not None else (request.distance_to_smelter_km or 999.0),
        "area_ha": request.area_ha or 0.0,
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

@app.options("/api/analyze-batch")
@app.options("/api/analyze-grid")
async def analyze_preflight():
    return Response(status_code=200)

async def perform_retraining():
    global is_training
    try:
        await asyncio.sleep(2)
        ml_model.reload()
        last = os.path.join(os.path.dirname(settings.ML_MODEL_PATH), ".last_retrain")
        with open(last, "w") as f:
            f.write(datetime.now(timezone.utc).isoformat())
        logger.info("Retrain complete — model reloaded")
    except Exception as e:
        logger.error(f"Retrain failed: {e}")
    finally:
        is_training = False

@app.post("/api/retrain")
async def retrain_endpoint(background_tasks: BackgroundTasks, file: UploadFile = File(None)):
    global is_training
    if is_training:
        raise HTTPException(status_code=409, detail="Training is already in progress.")
    is_training = True
    background_tasks.add_task(perform_retraining)
    return {"message": "Retraining started."}

@app.get("/api/retrain/status")
async def retrain_status():
    return {"is_training": is_training}

@app.get("/api/model-info")
async def model_info():
    return ml_model.get_model_info()

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

@app.post("/api/generate-esg-draft")
async def generate_esg_draft(req: ESGDraftRequest):
    paras = []
    
    # 1. Pendahuluan
    paras.append(f"DOKUMEN PRA-KAJIAN LINGKUNGAN & K3\\nGrid Target: {req.grid_id}\\n\\n"
                 f"1. RINGKASAN EKSEKUTIF\\nTarget area didominasi oleh litologi {req.lithology or 'Ultramafik'} "
                 f"dengan estimasi kadar Ni {req.ni_avg}%. Berdasarkan analisis spasial terintegrasi, "
                 "berikut adalah mitigasi risiko dan strategi perizinan yang diwajibkan.")
                 
    # 2. PPKH & Kehutanan
    if "Lindung" in req.legal_status or "Produksi" in req.legal_status:
        paras.append(f"2. STATUS KEHUTANAN (PPKH)\\nSesuai dengan Permen LHK 7/2021, area berada di kawasan {req.legal_status}. "
                     "Wajib mengajukan Persetujuan Penggunaan Kawasan Hutan (PPKH) untuk kegiatan Eksplorasi. "
                     "Perusahaan diwajibkan membayarkan PNBP Penggunaan Kawasan Hutan dan menyiapkan Rencana Kerja "
                     "Rehabilitasi Daerah Aliran Sungai (DAS) dengan rasio 1:1.")
    else:
        paras.append("2. STATUS KEHUTANAN\\nArea berada di Areal Penggunaan Lain (APL). Tidak memerlukan PPKH dari Kementerian LHK.")
        
    # 3. AMDAL vs UKL-UPL (Permen LHK 4/2021)
    if req.distance_to_river_m < 500:
        paras.append(f"3. DOKUMEN LINGKUNGAN HIDUP\\nArea berjarak {req.distance_to_river_m}m dari badan sungai terdekat. "
                     "Menurut Permen LHK 4/2021, kegiatan pengeboran di dekat sempadan sungai berisiko tinggi terhadap limpasan sedimen (TSS). "
                     "Penyusunan AMDAL disarankan dengan mitigasi spesifik pembuatan settling pond sebelum air larian masuk ke sungai.")
    else:
        paras.append(f"3. DOKUMEN LINGKUNGAN HIDUP\\nJarak aman dari badan sungai terdekat ({req.distance_to_river_m}m). "
                     "Sesuai Permen LHK 4/2021, kegiatan eksplorasi ini hanya mewajibkan penyusunan dokumen UKL-UPL. "
                     "Fokus mitigasi pada manajemen top soil dan revegetasi pasca pengeboran.")
                     
    # 4. K3 & Geoteknik
    if req.slope_deg > 25:
        paras.append(f"4. KESELAMATAN EKSPLORASI (K3) & GEOTEKNIK\\nKelerengan ekstrem tercatat pada {req.slope_deg}°. "
                     "Merujuk pada Kepmen ESDM 1827 K/30/MEM/2018 tentang Kaidah Teknik Pertambangan yang Baik, "
                     "area ini memiliki risiko longsor (landslide) tinggi. "
                     "Wajib menggunakan man-portable drill rigs (Rig Jacro/Spindle) untuk meminimalisir land clearing. "
                     "Pekerja diwajibkan menggunakan full-body harness di area tebing, dan jalur evakuasi medevac via helipad darurat "
                     "harus disiapkan.")
    else:
        paras.append(f"4. KESELAMATAN EKSPLORASI (K3)\\nKelerengan aman ({req.slope_deg}°). "
                     "Sesuai Kepmen ESDM 1827 K/30/MEM/2018, prosedur K3 standar pertambangan berlaku. "
                     "Akses kendaraan 4x4 untuk rig mobilisasi dimungkinkan.")

    if req.roi_savings_miliar > 0:
        paras.append(f"5. DAMPAK EKONOMI & ROI\\nPenggunaan model AI untuk optimasi spasi pengeboran berhasil menghemat capex sebesar Rp {req.roi_savings_miliar} Miliar. Efisiensi ini didapat dengan melebarkan spasi bor menjadi 100m pada area dengan konfidensi ML tinggi, mengurangi land clearing dan jejak karbon operasional.")

    draft = "\\n\\n".join(paras)
    return {"draft": draft}

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
        
        precomputed_spatial = {}
        if db_conn and request.grids:
            try:
                gids = [g.grid_id for g in request.grids]
                lons = [g.longitude for g in request.grids]
                lats = [g.latitude for g in request.grids]
                
                query = """
                SELECT 
                    req.grid_id,
                    (SELECT ST_Distance(ST_SetSRID(ST_MakePoint(req.lon, req.lat), 4326)::geography, geom::geography) 
                     FROM osm_roads ORDER BY geom <-> ST_SetSRID(ST_MakePoint(req.lon, req.lat), 4326) LIMIT 1) as dist_to_road_meters,
                    (SELECT ST_Distance(ST_SetSRID(ST_MakePoint(req.lon, req.lat), 4326)::geography, geom::geography) 
                     FROM osm_waterways ORDER BY geom <-> ST_SetSRID(ST_MakePoint(req.lon, req.lat), 4326) LIMIT 1) as dist_to_water_meters,
                    (SELECT EXISTS(
                        SELECT 1 FROM klhk_forestry_boundaries 
                        WHERE ST_Intersects(geom, ST_SetSRID(ST_MakePoint(req.lon, req.lat), 4326)) 
                        AND kelas_hutan ILIKE '%LINDUNG%'
                    )) as is_kill_zone
                FROM unnest($1::text[], $2::float8[], $3::float8[]) AS req(grid_id, lon, lat)
                """
                rows = await db_conn.fetch(query, gids, lons, lats)
                for r in rows:
                    precomputed_spatial[r["grid_id"]] = dict(r)
            except Exception as e:
                logger.warning(f"Batch spatial query failed: {e}")

        results = []
        errors = []
        for i, grid in enumerate(request.grids):
            try:
                spatial_data = precomputed_spatial.get(grid.grid_id) if precomputed_spatial else None
                result = await _compute_analysis(grid, db_conn, precomputed_spatial=spatial_data)
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

static_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
app.mount("/", StaticFiles(directory=static_dir, html=True), name="frontend")
