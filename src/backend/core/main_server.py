import os
import time
import json
from dotenv import load_dotenv

# .env 파일 로드
load_dotenv()

# 로그 레벨 설정
import logging
logging.basicConfig(level=logging.INFO)
import asyncio
from fastapi import FastAPI, UploadFile, WebSocket, WebSocketDisconnect, File, Response, HTTPException, Depends, Request
from fastapi.security import HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from starlette.responses import JSONResponse
from pathlib import Path
from pydantic import BaseModel
from typing import List, Optional, Dict, Any

# 데이터베이스 및 인증 모듈 import (선택적)
try:
    from ..database.database import init_database, create_chat_session, create_chat_session_with_persona, get_user_sessions, save_message, get_session_messages, get_session_info, get_user_by_email, users_collection, chat_sessions_collection, diagnose_database, supabase_uuid_to_objectid
    from ..auth.auth import get_current_user, get_current_user_id
    MONGODB_AVAILABLE = True
except ImportError as e:
    print(f"⚠️ MongoDB 모듈 로드 실패: {e}")
    MONGODB_AVAILABLE = False

# 모니터링 모듈 import (선택적)
try:
    from ..monitoring.monitoring import monitoring, get_metrics, start_timer, record_request_metrics
    MONITORING_AVAILABLE = True
    print("✅ 모니터링 모듈 로드됨")
except ImportError as e:
    print(f"⚠️ 모니터링 모듈 로드 실패: {e}")
    MONITORING_AVAILABLE = False


# MediaPipe 전면 제거: 환경변수/임포트/초기화 모두 삭제

# analyzers 모듈 제거됨 - 클라이언트 측에서 처리

# 표정 분석 모듈 import
try:
    from ..services.analysis.expression_analyzer import expression_analyzer
    EXPRESSION_ANALYSIS_AVAILABLE = True
    print("✅ 표정 분석 모듈 로드됨")
except ImportError as e:
    print(f"⚠️ 표정 분석 모듈 로드 실패: {e}")
    EXPRESSION_ANALYSIS_AVAILABLE = False

# MediaPipe 분석 모듈 import
try:
    from ..services.analysis.mediapipe_analyzer import mediapipe_analyzer
    MEDIAPIPE_ANALYSIS_AVAILABLE = True
    print("✅ MediaPipe 분석 모듈 로드됨")
except ImportError as e:
    print(f"⚠️ MediaPipe 분석 모듈 로드 실패: {e}")
    MEDIAPIPE_ANALYSIS_AVAILABLE = False

# 벡터 서비스 모듈 import
try:
    from ..services.vector_service import vector_service
    VECTOR_SERVICE_AVAILABLE = True
    print("✅ 벡터 서비스 모듈 로드됨")
except ImportError as e:
    print(f"⚠️ 벡터 서비스 모듈 로드 실패: {e}")
    VECTOR_SERVICE_AVAILABLE = False

# 음성 분석 모듈 import (지연 로딩으로 메모리 최적화)
VOICE_ANALYSIS_AVAILABLE = False
_voice_models_loaded = False

def load_voice_models():
    """지연 로딩으로 음성 모델 로드"""
    global VOICE_ANALYSIS_AVAILABLE, _voice_models_loaded
    if _voice_models_loaded:
        return VOICE_ANALYSIS_AVAILABLE
    
    try:
        from ..services.voice.voice_api import preload_voice_models, process_audio_simple
        VOICE_ANALYSIS_AVAILABLE = True
        _voice_models_loaded = True
        print("✅ 음성 분석 모듈 지연 로딩 성공")
        return True
    except Exception as e:
        print(f"⚠️ 음성 분석 모듈 지연 로딩 실패: {e}")
        return False

# TTS 모듈 import
try:
    import edge_tts
    import tempfile
    TTS_AVAILABLE = True
    print("✅ Edge-TTS 모듈 로드 성공")
except ImportError as e:
    print(f"⚠️ Edge-TTS 모듈 로드 실패: {e}")
    TTS_AVAILABLE = False

# PyTorch CUDA 지원 상태 확인
try:
    import torch
    cuda_available = torch.cuda.is_available()
    print(f"🖥️ PyTorch CUDA 지원 상태: {cuda_available}")
    
    if cuda_available:
        print(f"🎮 GPU 개수: {torch.cuda.device_count()}")
        print(f"🎮 현재 GPU: {torch.cuda.current_device()}")
        print(f"🎮 GPU 이름: {torch.cuda.get_device_name(0)}")
        print(f"🎮 GPU 메모리: {torch.cuda.get_device_properties(0).total_memory / 1024**3:.1f} GB")
        print(f"🎮 CUDA 버전: {torch.version.cuda}")
        print(f"🎮 PyTorch 버전: {torch.__version__}")
    else:
        print("⚠️ CUDA가 지원되지 않는 환경입니다. CPU를 사용합니다.")
        print(f"🎮 PyTorch 버전: {torch.__version__}")
except ImportError as e:
    print(f"⚠️ PyTorch 모듈 로드 실패: {e}")

# OpenAI API 설정
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
if OPENAI_API_KEY:
    print("✅ OpenAI API 키 설정 완료")
else:
    print("⚠️ OpenAI API 키가 설정되지 않았습니다")

APP_NAME = os.getenv("APP_NAME", "vision-backend")
PORT = int(os.getenv("PORT", "8000"))
ALLOWED_ORIGINS = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "*").split(",") if o.strip()]
MAX_UPLOAD_BYTES = int(os.getenv("MAX_UPLOAD_BYTES", str(32 * 1024 * 1024)))  # 32MB (2K 해상도 지원)

# ====== 서버 설정 ======
RUNPOD_URL = os.getenv("RUNPOD_URL", "https://runpod.io")  # RunPod URL 환경변수

# ====== Pydantic 모델 ======
class ChatMessage(BaseModel):
    content: str
    role: str = "user"
    user_id: Optional[str] = None
    email: Optional[str] = None

class ChatSession(BaseModel):
    session_name: str = "새로운 대화"
    user_id: Optional[str] = None
    email: Optional[str] = None
    persona_name: Optional[str] = None
    persona_age: Optional[str] = None
    persona_mbti: Optional[str] = None
    persona_job: Optional[str] = None
    persona_personality: Optional[str] = None
    persona_image: Optional[str] = None

class MessageResponse(BaseModel):
    id: str
    content: str
    role: str
    timestamp: str
    user_id: str

# app = FastAPI(...) 아래에 경로 상수 추가
BASE_DIR = Path(__file__).resolve().parent.parent.parent.parent  # 프로젝트 루트로
TEMPLATES_DIR = BASE_DIR / "src" / "backend" / "templates"

app = FastAPI(title=APP_NAME)

# 정적 파일 서빙 설정
app.mount("/frontend", StaticFiles(directory=str(BASE_DIR / "src" / "frontend")), name="frontend")
app.mount("/api/gke/frontend", StaticFiles(directory=str(BASE_DIR / "src" / "frontend")), name="api_gke_frontend")
app.mount("/dys_studio", StaticFiles(directory=str(BASE_DIR / "src" / "frontend")), name="dys_studio")
app.mount("/dys_studio/pages", StaticFiles(directory=str(BASE_DIR / "src" / "frontend" / "pages")), name="dys_studio_pages")
app.mount("/dys_studio/assets", StaticFiles(directory=str(BASE_DIR / "src" / "frontend" / "assets")), name="dys_studio_assets")
app.mount("/dys_studio/popups", StaticFiles(directory=str(BASE_DIR / "src" / "frontend" / "assets" / "popups")), name="dys_studio_popups")
app.mount("/assets", StaticFiles(directory=str(BASE_DIR / "src" / "frontend" / "assets")), name="assets")
app.mount("/api/gke/assets", StaticFiles(directory=str(BASE_DIR / "src" / "frontend" / "assets")), name="api_gke_assets")

# CORS 허용 도메인 설정 - 환경변수에서 가져오기
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "*").split(",")
if "*" not in CORS_ORIGINS:
    # 기본 도메인들 추가
    default_origins = [
        "https://dys-phi.vercel.app",
        "http://localhost:3000",
        "http://localhost:8000", 
        "https://localhost:3000",
        "https://localhost:8000"
    ]
    CORS_ORIGINS.extend(default_origins)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# FastAPI 이벤트 핸들러 추가
@app.on_event("startup")
async def startup_event():
    """서버 시작 시 실행"""
    print(f"🚀 {APP_NAME} 서버 시작됨 (포트: {PORT})")
    print(f"📋 [STARTUP] MongoDB 연결 상태: {MONGODB_AVAILABLE}")
    print(f"📋 [STARTUP] 서버 URL: http://0.0.0.0:{PORT}")

@app.on_event("shutdown")
async def shutdown_event():
    """서버 종료 시 실행"""
    print("🛑 서버 종료 이벤트 수신 - 리소스 정리 중...")
    await cleanup_on_shutdown()


# 파이프라인 관련 코드 제거됨 - 클라이언트에서 처리

# 전역 변수 초기화 (UI-only mode)
_pipeline = None
process_interval_sec = 1.0
debug_overlay = False

# 파이프라인 제거됨 - 클라이언트 측에서 모든 분석 처리



@app.get("/")
def root():
    return {"ok": True, "service": APP_NAME}

@app.get("/health")
def health():
    """헬스체크 엔드포인트"""
    return {
        "ok": True, 
        "service": APP_NAME,
        "mongodb_available": MONGODB_AVAILABLE,
        "timestamp": time.time()
    }

# MediaPipe Self-Test 제거됨

# /webcam 엔드포인트 제거됨 - 사용하지 않음

@app.get("/frontend/video/{filename}")
@app.get("/api/gke/frontend/video/{filename}")
async def get_video(filename: str):
    """비디오 파일 직접 서빙"""
    import os
    print(f"🔍 [VIDEO] 요청: {filename}")
    
    # 가능한 경로들
    possible_paths = [
        str(BASE_DIR / "src" / "frontend" / "assets" / "videos" / filename),
        f"src/frontend/assets/videos/{filename}",
        f"frontend/assets/videos/{filename}",
        f"assets/videos/{filename}",
        f"videos/{filename}",
        f"/usr/src/app/src/frontend/assets/videos/{filename}",
        f"/workspace/app/src/frontend/assets/videos/{filename}"
    ]
    
    for i, file_path in enumerate(possible_paths, 1):
        print(f"📁 [VIDEO] 시도 {i}: {file_path}")
        if os.path.exists(file_path):
            print(f"✅ [VIDEO] 파일 발견: {file_path}")
            # 파일 크기 확인
            file_size = os.path.getsize(file_path)
            print(f"📊 [VIDEO] 파일 크기: {file_size} bytes")
            
            # 파일 확장자에 따른 MIME 타입 설정
            if filename.endswith('.mp4'):
                media_type = "video/mp4"
            elif filename.endswith('.webm'):
                media_type = "video/webm"
            elif filename.endswith('.avi'):
                media_type = "video/x-msvideo"
            else:
                media_type = "video/*"
            
            return FileResponse(file_path, media_type=media_type)
    
    print(f"❌ [VIDEO] 파일을 찾을 수 없음: {filename}")
    print(f"📋 [VIDEO] 시도한 경로들: {possible_paths}")
    return Response(status_code=404, content=f"Video {filename} not found")

# 대시보드 엔드포인트 제거됨 - 사용하지 않음

# 사용하지 않는 페이지 엔드포인트들 제거됨 (/app.js, /studio, /dys_studio)

@app.get("/frontend/studio_calibration")
def frontend_studio_calibration():
    """Frontend Studio 캘리브레이션 페이지 제공"""
    try:
        return FileResponse(str(BASE_DIR / "src" / "frontend" / "pages" / "studio_calibration.html"), media_type="text/html")
    except FileNotFoundError:
        return Response(status_code=404, content="studio_calibration.html not found")

@app.get("/frontend/studio_calibration.html")
def frontend_studio_calibration_html():
    """Frontend Studio 캘리브레이션 페이지 제공 (.html 확장자 포함)"""
    try:
        return FileResponse(str(BASE_DIR / "src" / "frontend" / "pages" / "studio_calibration.html"), media_type="text/html")
    except FileNotFoundError:
        return Response(status_code=404, content="studio_calibration.html not found")



@app.get("/dys_studio/studio_calibration")
def dys_studio_calibration():
    """DYS Studio 캘리브레이션 페이지 제공 (기존 경로 호환성)"""
    try:
        return FileResponse(str(BASE_DIR / "src" / "frontend" / "pages" / "studio_calibration.html"), media_type="text/html")
    except FileNotFoundError:
        return Response(status_code=404, content="studio_calibration.html not found")

@app.get("/dys_studio/studio_calibration.html")
def dys_studio_calibration_html():
    """DYS Studio 캘리브레이션 페이지 제공 (.html 확장자 포함, 기존 경로 호환성)"""
    try:
        return FileResponse(str(BASE_DIR / "src" / "frontend" / "pages" / "studio_calibration.html"), media_type="text/html")
    except FileNotFoundError:
        return Response(status_code=404, content="studio_calibration.html not found")

@app.get("/api/gke/dys_studio/studio_calibration")
def api_gke_dys_studio_calibration():
    """API GKE DYS Studio 캘리브레이션 페이지 제공 (Vercel 프록시 호환성)"""
    try:
        return FileResponse(str(BASE_DIR / "src" / "frontend" / "pages" / "studio_calibration.html"), media_type="text/html")
    except FileNotFoundError:
        return Response(status_code=404, content="studio_calibration.html not found")

@app.get("/api/gke/dys_studio/studio_calibration.html")
def api_gke_dys_studio_calibration_html():
    """API GKE DYS Studio 캘리브레이션 페이지 제공 (.html 확장자 포함, Vercel 프록시 호환성)"""
    try:
        return FileResponse(str(BASE_DIR / "src" / "frontend" / "pages" / "studio_calibration.html"), media_type="text/html")
    except FileNotFoundError:
        return Response(status_code=404, content="studio_calibration.html not found")

@app.get("/runpod")
def runpod_studio():
    """RunPod Studio iframe 페이지 제공"""
    try:
        return FileResponse(str(BASE_DIR / "templates" / "runpod_studio.html"), media_type="text/html")
    except FileNotFoundError:
        return Response(status_code=404, content="runpod_studio.html not found")

@app.get("/studio/img/{filename}")
def serve_studio_image(filename: str):
    """studio 이미지 파일 제공"""
    try:
        return FileResponse(str(BASE_DIR / "src" / "frontend" / "assets" / "images" / filename), media_type="image/svg+xml" if filename.endswith('.svg') else "image/*")
    except FileNotFoundError:
        return Response(status_code=404, content=f"Image {filename} not found")



@app.get("/dys_logo.png")
def serve_dys_logo():
    """데연소 로고 파일 제공"""
    try:
        return FileResponse(str(BASE_DIR / "src" / "frontend" / "assets" / "images" / "dys_logo.png"), media_type="image/png")
    except FileNotFoundError:
        return Response(status_code=404, content="dys_logo.png not found")

@app.get("/api/runpod/config")
def get_runpod_config():
    """RunPod 설정 정보 반환"""
    return {
        "runpod_url": RUNPOD_URL,
        "studio_url": f"{RUNPOD_URL}/studio"
    }

@app.get("/api/supabase/config")
def get_supabase_config():
    """Supabase 설정 정보 반환 (클라이언트 초기화용)"""
    try:
        # 지연 import로 순환참조 회피
        from ..auth.auth import SUPABASE_URL, SUPABASE_ANON_KEY
    except Exception:
        # 환경변수로 폴백
        SUPABASE_URL = os.getenv("SUPABASE_URL", "")
        SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "")
    return {"url": SUPABASE_URL, "anonKey": SUPABASE_ANON_KEY}

@app.get("/api/websocket/config")
def get_websocket_config():
    """WebSocket 서버 설정 정보 반환"""
    try:
        # 환경에 따른 WebSocket 설정
        # GKE 환경 감지
        is_gke = os.getenv('KUBERNETES_SERVICE_HOST') is not None
        
        if is_gke:
            # GKE 환경 설정
            config = {
                "protocol": "wss",
                "host": "34.64.136.237",  # GKE WebSocket 서버 IP
                "port": 8001,
                "environment": "gke"
            }
        else:
            # 로컬/개발 환경 설정
            config = {
                "protocol": "ws",
                "host": "localhost",
                "port": 8001,
                "environment": "local"
            }
        
        return {
            "success": True,
            "config": config,
            "message": "WebSocket 설정 정보"
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "config": {
                "protocol": "ws",
                "host": "localhost",
                "port": 8001,
                "environment": "fallback"
            }
        }
    
    return {
        "websocket_host": ws_host,
        "websocket_port": ws_port,
        "endpoints": {
            "landmarks": f"/ws/landmarks",
            "telemetry": f"/ws/telemetry"
        }
    }

@app.post("/api/frame")
async def api_frame(frame: UploadFile = File(...)):
    """프레임 분석 - 클라이언트에서 처리하므로 비활성화"""
    return JSONResponse({
        "ok": True,
        "message": "클라이언트 측에서 분석 처리 중",
        "simulation_mode": True,
        "data_source": "client_only"
    })

@app.get("/api/overlay.jpg")
def api_overlay():
    # 서버 측 오버레이 비활성화 - 클라이언트에서 처리
    return Response(status_code=204, content="Server-side overlay disabled")

# /api/overlay/clear 엔드포인트 제거됨 - 클라이언트에서 처리

# /api/data 엔드포인트 제거됨 - 클라이언트에서 처리

# /api/config 엔드포인트 제거됨 - 클라이언트에서 처리

# /api/start, /api/stop 엔드포인트 제거됨 - 클라이언트에서 처리

# 비디오 스트림 및 파이프라인 설정 엔드포인트들 제거됨 - 클라이언트에서 처리

# 파이프라인 관련 엔드포인트들 제거됨 (UI-only mode)

# ====== 캘리브레이션 API 엔드포인트 ======

# 캘리브레이션 모델 import
try:
    from ..models.calibration import CalibrationRequest, CalibrationResponse, CalibrationStatus
    from ..services.calibration_service import calibration_service
    CALIBRATION_AVAILABLE = True
    print("✅ 캘리브레이션 모듈 로드 성공")
except ImportError as e:
    print(f"⚠️ 캘리브레이션 모듈 로드 실패: {e}")
    CALIBRATION_AVAILABLE = False

# ====== 채팅 API 엔드포인트 ======

@app.post("/api/chat/sessions")
async def create_session(
    session: ChatSession,
    request: Request
):
    """새 채팅 세션 생성"""
    print(f"🔍 [CREATE_SESSION] 요청 받음 - session_name: {session.session_name}")
    print(f"📋 [CREATE_SESSION] 요청 헤더: {dict(request.headers)}")
    print(f"📋 [CREATE_SESSION] 요청 메서드: {request.method}")
    print(f"📋 [CREATE_SESSION] 요청 URL: {request.url}")
    
    # 인증 토큰 확인 (선택적)
    current_user_id = None
    try:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
            from ..auth.auth import get_current_user
            user_data = await get_current_user(HTTPAuthorizationCredentials(scheme="Bearer", credentials=token))
            current_user_id = user_data.get("id")
            print(f"✅ [CREATE_SESSION] 인증 성공 - user_id: {current_user_id}")
    except Exception as e:
        print(f"⚠️ [CREATE_SESSION] 인증 실패: {e}")
    
    # 인증 실패 시 고유한 임시 사용자 ID 생성
    if not current_user_id:
        import uuid
        import hashlib
        # 클라이언트 IP와 User-Agent를 기반으로 고유 ID 생성
        client_ip = request.client.host if request.client else "unknown"
        user_agent = request.headers.get("User-Agent", "unknown")
        unique_string = f"{client_ip}:{user_agent}"
        unique_hash = hashlib.md5(unique_string.encode()).hexdigest()[:24]  # MongoDB ObjectId 길이
        current_user_id = unique_hash
        print(f"⚠️ [CREATE_SESSION] 인증 없음, 고유 임시 사용자 ID 생성: {current_user_id}")
        print(f"📋 [CREATE_SESSION] 클라이언트 정보: IP={client_ip}, UA={user_agent[:50]}...")
    
    # MongoDB 연결 실패 시 임시 세션 ID 생성
    if not MONGODB_AVAILABLE:
        print("⚠️ [CREATE_SESSION] MongoDB not available - 임시 세션 생성")
        import uuid
        temp_session_id = str(uuid.uuid4())
        print(f"✅ [CREATE_SESSION] 임시 세션 생성 성공: {temp_session_id}")
        return {"ok": True, "session_id": temp_session_id}
    
    try:
        print(f"🔄 [CREATE_SESSION] 세션 생성 시작...")
        
        # 새로운 페르소나 시스템에서 기본 페르소나 가져오기
        from ..services.personas.persona_manager import get_persona_manager
        manager = get_persona_manager()
        active_persona = manager.get_active_persona()
        
        # 클라이언트에서 전송한 페르소나가 있으면 사용, 없으면 활성 페르소나 사용
        persona_name = session.persona_name or (active_persona["name"] if active_persona else "이서아")
        
        # 세션 이름 설정
        session_name = session.session_name
        if persona_name:
            session_name = f"{persona_name}와의 데이트"
            print(f"📝 [CREATE_SESSION] Persona 정보 포함: {persona_name}")
        
        # 클라이언트에서 전송한 user_id가 있으면 사용, 없으면 생성된 ID 사용
        final_user_id = session.user_id if session.user_id else current_user_id
        
        print(f"🎭 [CREATE_SESSION] 사용할 페르소나: {persona_name}")
        
        # 페르소나 정보를 포함하여 세션 생성
        session_id = await create_chat_session_with_persona(
            final_user_id, 
            session_name,
            {
                "persona_name": persona_name,
                "persona_age": session.persona_age or "28",
                "persona_mbti": session.persona_mbti or "ENFP",
                "persona_job": session.persona_job or "마케팅 담당자",
                "persona_personality": session.persona_personality or "밝고 친근한",
                "persona_image": session.persona_image or "woman1.webp"
            }
        )
        if session_id:
            print(f"✅ [CREATE_SESSION] 세션 생성 성공: {session_id}")
            print(f"👤 [CREATE_SESSION] 사용자 ID: {final_user_id}")
            return {"ok": True, "session_id": session_id}
        else:
            print("❌ [CREATE_SESSION] 세션 생성 실패")
            raise HTTPException(status_code=500, detail="Failed to create session")
    except Exception as e:
        print(f"❌ [CREATE_SESSION] 오류 발생: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/chat/sessions")
async def get_sessions(current_user_id: str = Depends(get_current_user_id) if MONGODB_AVAILABLE else None):
    """사용자의 채팅 세션 목록 조회"""
    if not MONGODB_AVAILABLE:
        raise HTTPException(status_code=503, detail="MongoDB not available")
    
    try:
        sessions = await get_user_sessions(current_user_id)
        return {"ok": True, "sessions": sessions}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/chat/sessions/{session_id}/messages")
async def get_messages(
    session_id: str,
    current_user_id: str = Depends(get_current_user_id) if MONGODB_AVAILABLE else None,
    limit: int = 50
):
    """세션의 메시지 목록 조회"""
    if not MONGODB_AVAILABLE:
        print("⚠️ [GET_MESSAGES] MongoDB not available")
        raise HTTPException(status_code=503, detail="MongoDB not available")
    
    try:
        messages = await get_session_messages(session_id, limit)
        return {"ok": True, "messages": messages}
    except Exception as e:
        import traceback
        print(f"❌ [GET_MESSAGES] 오류: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/chat/sessions/{session_id}/messages")
async def send_message(
    session_id: str,
    message: ChatMessage,
    request: Request
):
    """새 메시지 전송"""
    print(f"🔍 [SEND_MESSAGE] 요청 받음 - session_id: {session_id}")
    print(f"📝 [SEND_MESSAGE] 메시지 내용: {message.content[:50]}...")
    
    # session_id가 null이거나 유효하지 않은 경우 처리
    if not session_id or session_id == "null":
        print("❌ [SEND_MESSAGE] 유효하지 않은 session_id")
        print(f"📋 [SEND_MESSAGE] session_id 값: '{session_id}'")
        print(f"📋 [SEND_MESSAGE] session_id 타입: {type(session_id)}")
        print(f"📋 [SEND_MESSAGE] session_id 길이: {len(str(session_id)) if session_id else 0}")
        raise HTTPException(status_code=400, detail="Invalid session_id")
    
    # 인증 토큰 확인 (선택적)
    current_user_id = None
    try:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
            from ..auth.auth import get_current_user
            user_data = await get_current_user(HTTPAuthorizationCredentials(scheme="Bearer", credentials=token))
            current_user_id = user_data.get("id")
            print(f"✅ [SEND_MESSAGE] 인증 성공 - user_id: {current_user_id}")
    except Exception as e:
        print(f"⚠️ [SEND_MESSAGE] 인증 실패: {e}")
    
    # 인증 실패 시 고유한 임시 사용자 ID 생성
    if not current_user_id:
        import uuid
        import hashlib
        # 클라이언트 IP와 User-Agent를 기반으로 고유 ID 생성
        client_ip = request.client.host if request.client else "unknown"
        user_agent = request.headers.get("User-Agent", "unknown")
        unique_string = f"{client_ip}:{user_agent}"
        unique_hash = hashlib.md5(unique_string.encode()).hexdigest()[:24]  # MongoDB ObjectId 길이
        current_user_id = unique_hash
        print(f"⚠️ [SEND_MESSAGE] 인증 없음, 고유 임시 사용자 ID 생성: {current_user_id}")
        print(f"📋 [SEND_MESSAGE] 클라이언트 정보: IP={client_ip}, UA={user_agent[:50]}...")
    
    # MongoDB 사용 불가 시 명시적 에러 반환
    if not MONGODB_AVAILABLE:
        print("⚠️ [SEND_MESSAGE] MongoDB not available")
        raise HTTPException(status_code=503, detail="MongoDB not available")
    
    try:
        # 사용자 메시지 저장
        print(f"🔄 [SEND_MESSAGE] 사용자 메시지 저장 시작...")
        
        # 클라이언트에서 전송한 user_id가 있으면 사용, 없으면 생성된 ID 사용
        final_user_id = message.user_id if message.user_id else current_user_id
        print(f"📋 [SEND_MESSAGE] 최종 user_id: {final_user_id}")
        
        try:
            message_id = await save_message(
                final_user_id, 
                session_id, 
                message.role, 
                message.content
            )
            
            if not message_id:
                print("❌ [SEND_MESSAGE] 사용자 메시지 저장 실패 - message_id가 None")
                raise HTTPException(status_code=500, detail="Failed to save message")
        except Exception as save_error:
            print(f"❌ [SEND_MESSAGE] 메시지 저장 중 예외 발생: {save_error}")
            import traceback
            traceback.print_exc()
            raise HTTPException(status_code=500, detail=f"Message save error: {str(save_error)}")
        
        print(f"✅ [SEND_MESSAGE] 사용자 메시지 저장 성공: {message_id}")
        
        # OpenAI GPT-4o-mini로 AI 응답 생성
        print(f"🤖 [SEND_MESSAGE] GPT 호출 시작 - 메시지: {message.content[:50]}...")
        ai_response = await generate_ai_response(message.content, session_id)
        print(f"🤖 [SEND_MESSAGE] AI 응답 생성 완료: {ai_response[:50]}...")
        
        # AI 응답 저장
        print(f"🔄 [SEND_MESSAGE] AI 응답 저장 시작...")
        ai_message_id = await save_message(
            final_user_id,
            session_id,
            "assistant",
            ai_response
        )
        
        print(f"✅ [SEND_MESSAGE] AI 응답 저장 성공: {ai_message_id}")
        
        result = {
            "ok": True,
            "user_message_id": message_id,
            "ai_message_id": ai_message_id,
            "ai_response": ai_response
        }
        
        print(f"🎉 [SEND_MESSAGE] 전체 처리 완료: {result}")
        return result
        
    except Exception as e:
        print(f"❌ [SEND_MESSAGE] 오류 발생: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ====== 테스트용 엔드포인트 ======
@app.post("/api/chat/test/create-session")
async def create_test_session():
    """테스트용 세션 생성 (인증 없음)"""
    print("🔍 [TEST_CREATE_SESSION] 테스트 세션 생성 요청")
    
    if not MONGODB_AVAILABLE:
        print("❌ [TEST_CREATE_SESSION] MongoDB not available")
        raise HTTPException(status_code=503, detail="MongoDB not available")
    
    try:
        test_user_id = "507f1f77bcf86cd799439011"  # 유효한 ObjectId 형식
        session_name = "테스트 대화"
        
        print(f"🔄 [TEST_CREATE_SESSION] 세션 생성 시작...")
        session_id = await create_chat_session(test_user_id, session_name)
        
        if session_id:
            print(f"✅ [TEST_CREATE_SESSION] 세션 생성 성공: {session_id}")
            return {"ok": True, "session_id": session_id}
        else:
            print("❌ [TEST_CREATE_SESSION] 세션 생성 실패")
            raise HTTPException(status_code=500, detail="Failed to create session")
    except Exception as e:
        print(f"❌ [TEST_CREATE_SESSION] 오류 발생: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/auth/verify")
async def verify_auth(current_user_id: str = Depends(get_current_user_id) if MONGODB_AVAILABLE else None):
    """인증 상태 검증 API"""
    try:
        if not current_user_id:
            return {"authenticated": False, "message": "인증되지 않은 사용자"}
        
        # 사용자 정보 반환 (민감한 정보 제외)
        return {
            "authenticated": True,
            "user_id": current_user_id,
            "message": "인증된 사용자"
        }
    except Exception as e:
        print(f"❌ [AUTH_VERIFY] 오류: {e}")
        return {"authenticated": False, "message": "인증 검증 실패"}

@app.post("/api/auth/refresh")
async def refresh_token(current_user_id: str = Depends(get_current_user_id) if MONGODB_AVAILABLE else None):
    """토큰 갱신 API (필요시)"""
    try:
        if not current_user_id:
            raise HTTPException(status_code=401, detail="인증되지 않은 사용자")
        
        # 토큰 갱신 로직 (필요시 구현)
        return {"ok": True, "message": "토큰이 유효합니다"}
    except Exception as e:
        print(f"❌ [AUTH_REFRESH] 오류: {e}")
        raise HTTPException(status_code=401, detail="토큰 갱신 실패")

@app.get("/auth/verify")
async def verify_auth_legacy(current_user_id: str = Depends(get_current_user_id) if MONGODB_AVAILABLE else None):
    """레거시 인증 검증 API (/auth/verify)"""
    try:
        if not current_user_id:
            return {"authenticated": False, "message": "인증되지 않은 사용자"}
        
        # 사용자 정보 반환 (민감한 정보 제외)
        return {
            "authenticated": True,
            "user_id": current_user_id,
            "message": "인증된 사용자"
        }
    except Exception as e:
        print(f"❌ [AUTH_VERIFY_LEGACY] 오류: {e}")
        return {"authenticated": False, "message": "인증 검증 실패"}

@app.post("/auth/verify")
async def verify_auth_legacy_post(current_user_id: str = Depends(get_current_user_id) if MONGODB_AVAILABLE else None):
    """레거시 인증 검증 API POST (/auth/verify)"""
    try:
        if not current_user_id:
            return {"authenticated": False, "message": "인증되지 않은 사용자"}
        
        # 사용자 정보 반환 (민감한 정보 제외)
        return {
            "authenticated": True,
            "user_id": current_user_id,
            "message": "인증된 사용자"
        }
    except Exception as e:
        print(f"❌ [AUTH_VERIFY_LEGACY_POST] 오류: {e}")
        return {"authenticated": False, "message": "인증 검증 실패"}

# ====== 애플리케이션 시작 이벤트 ======
@app.on_event("startup")
async def startup_event():
    """애플리케이션 시작 시 실행"""
    print("🚀 애플리케이션 시작 중...")
    
    # MongoDB 초기화 (선택적)
    if MONGODB_AVAILABLE:
        try:
            db_success = await init_database()
            if not db_success:
                print("⚠️ MongoDB 초기화 실패 - 일부 기능이 제한될 수 있습니다")
            else:
                print("✅ MongoDB 초기화 완료")
        except Exception as e:
            print(f"⚠️ MongoDB 초기화 중 오류: {e}")
    else:
        print("⚠️ MongoDB 모듈 없음 - 채팅 기능이 제한됩니다")
    
    # 음성 분석 모델 로드 (백그라운드에서) - 첫 번째 성공 모델 채택
    global VOICE_ANALYSIS_AVAILABLE
    if VOICE_ANALYSIS_AVAILABLE:
        try:
            print("🔄 음성 분석 모델 로딩 시작...")
            from ..services.voice.voice_api import preload_models
            await asyncio.to_thread(preload_models)
            print("✅ 음성 분석 모델 로딩 완료 - 첫 번째 성공 모델 채택")
        except Exception as e:
            print(f"⚠️ 음성 분석 모델 로딩 실패: {e}")
            print("⚠️ 대안 STT 방법으로 fallback")
            # 음성 분석 모듈은 비활성화하되 대안 STT는 사용 가능
            VOICE_ANALYSIS_AVAILABLE = False
    else:
        print("⚠️ 음성 분석 모듈 비활성화됨 - 대안 STT 사용")
        
    # 대안 STT 기능 확인 (첫 번째 성공 모델 채택)
    stt_available = False
    stt_method = "none"
    
    # 1. faster-whisper 확인 (libctranslate2 오류 방지)
    try:
        from faster_whisper import WhisperModel
        print("✅ faster-whisper 모듈 확인됨")
        stt_available = True
        stt_method = "faster-whisper"
    except ImportError as e:
        print(f"❌ faster-whisper 모듈 없음: {e}")
    except Exception as e:
        if "libctranslate2" in str(e).lower():
            print("⚠️ libctranslate2 오류로 faster-whisper 비활성화")
        else:
            print(f"❌ faster-whisper 모듈 오류: {e}")
    
    # 2. OpenAI Whisper API 확인 (faster-whisper 실패 시)
    if not stt_available:
        try:
            from openai import OpenAI
            if os.getenv('OPENAI_API_KEY'):
                print("✅ OpenAI Whisper API 사용 가능")
                stt_available = True
                stt_method = "openai-whisper"
            else:
                print("⚠️ OpenAI API 키가 설정되지 않음")
        except ImportError:
            print("⚠️ OpenAI 라이브러리 미설치")
    
    # 3. Google Speech-to-Text API 확인 (이전 방법들 실패 시)
    if not stt_available:
        try:
            from google.cloud import speech
            print("✅ Google Speech-to-Text API 사용 가능")
            stt_available = True
            stt_method = "google-speech"
        except ImportError:
            print("⚠️ Google Speech-to-Text API 미설치")
        except Exception as e:
            print(f"⚠️ Google Speech-to-Text API 설정 실패: {e}")
    
    if stt_available:
        print(f"✅ STT 기능 사용 가능: {stt_method}")
    else:
        print("❌ 모든 STT 방법 실패 - 음성 인식 기능이 제한됩니다")
    
    # MediaPipe 제거됨: 클라이언트 랜드마크 흐름만 유지

# WebSocket 연결 관리 (websocket_server.py 통합)
_active_websockets = set()

class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        print(f"🔗 WebSocket 연결 수락: {websocket.client.host}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        print(f"🔌 WebSocket 연결 종료: {websocket.client.host}")

    async def send_personal_message(self, message: str, websocket: WebSocket):
        await websocket.send_text(message)

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except Exception as e:
                print(f"브로드캐스트 실패: {e}")
                if connection in self.active_connections:
                    self.active_connections.remove(connection)

# 전역 WebSocket 매니저 인스턴스
ws_manager = ConnectionManager()

# 서버 종료 시 정리 함수
async def cleanup_on_shutdown():
    """서버 종료 시 리소스 정리"""
    global _pipeline, _active_websockets
    print("\n🛑 서버 종료 중 - 리소스 정리...")
    
    try:
        # WebSocket 연결 정리
        if _active_websockets:
            print(f"🔌 {len(_active_websockets)}개 WebSocket 연결 종료 중...")
            for ws in list(_active_websockets):
                try:
                    if not ws.client_state.disconnected:
                        await ws.close(code=1000, reason="Server shutdown")
                except Exception as e:
                    print(f"⚠️ WebSocket 종료 중 오류: {e}")
            _active_websockets.clear()
            print("✅ WebSocket 연결 정리 완료")
    except Exception as e:
        print(f"⚠️ WebSocket 정리 중 오류: {e}")
    
    try:
        # 파이프라인 정리
        if _pipeline:
            if hasattr(_pipeline, 'stop'):
                _pipeline.stop()
                print("✅ 파이프라인 정리 완료")
            if hasattr(_pipeline, 'cleanup'):
                _pipeline.cleanup()
                print("✅ 파이프라인 리소스 정리 완료")
    except Exception as e:
        print(f"⚠️ 파이프라인 정리 중 오류: {e}")
    
    try:
        # OpenCV 윈도우 정리
        import cv2
        cv2.destroyAllWindows()
        print("✅ OpenCV 윈도우 정리 완료")
    except ImportError:
        print("ℹ️ OpenCV 모듈이 없습니다 - 건너뜁니다")
    except Exception as e:
        print(f"⚠️ OpenCV 정리 중 오류: {e}")
    
    print("🎉 서버 종료 완료")

# 동기 버전 정리 함수 (시그널 핸들러용)
def cleanup_on_shutdown_sync():
    """서버 종료 시 리소스 정리 (동기 버전)"""
    global _pipeline, _active_websockets
    print("\n🛑 서버 종료 중 - 리소스 정리...")
    
    try:
        # WebSocket 연결 정리 (동기적으로)
        if _active_websockets:
            print(f"🔌 {len(_active_websockets)}개 WebSocket 연결 종료 중...")
            _active_websockets.clear()
            print("✅ WebSocket 연결 정리 완료")
    except Exception as e:
        print(f"⚠️ WebSocket 정리 중 오류: {e}")
    
    try:
        # 파이프라인 정리
        if _pipeline:
            if hasattr(_pipeline, 'stop'):
                _pipeline.stop()
                print("✅ 파이프라인 정리 완료")
            if hasattr(_pipeline, 'cleanup'):
                _pipeline.cleanup()
                print("✅ 파이프라인 리소스 정리 완료")
    except Exception as e:
        print(f"⚠️ 파이프라인 정리 중 오류: {e}")
    
    try:
        # OpenCV 윈도우 정리
        import cv2
        cv2.destroyAllWindows()
        print("✅ OpenCV 윈도우 정리 완료")
    except ImportError:
        print("ℹ️ OpenCV 모듈이 없습니다 - 건너뜁니다")
    except Exception as e:
        print(f"⚠️ OpenCV 정리 중 오류: {e}")
    
    print("🎉 서버 종료 완료")

if __name__ == "__main__":
    import uvicorn
    import signal
    import sys
    
    # 시그널 핸들러 등록
    def signal_handler(signum, frame):
        print(f"\n📡 시그널 {signum} 수신 - 서버 종료 시작")
        cleanup_on_shutdown_sync()
        sys.exit(0)
    
    # SIGINT (Ctrl+C) 및 SIGTERM 핸들러 등록
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    try:
        print(f"🚀 서버 시작 중... (포트: {PORT})")
        uvicorn.run("server:app", host="0.0.0.0", port=PORT, log_level="info")
    except KeyboardInterrupt:
        print("\n⌨️ KeyboardInterrupt 수신")
        cleanup_on_shutdown_sync()
    except Exception as e:
        print(f"\n❌ 서버 실행 중 오류: {e}")
        cleanup_on_shutdown_sync()
        sys.exit(1)

# ----------------------------------------
# 텔레메트리 추출 유틸 (파이프라인 메서드/필드 이름이 달라도 최대한 대응)
# ----------------------------------------
def _to_jsonable(x):
    """numpy 타입 등을 JSON 직렬화 가능하게 변환"""
    import numpy as np
    if isinstance(x, (np.floating,)):
        return float(x)
    if isinstance(x, (np.integer,)):
        return int(x)
    if isinstance(x, (np.ndarray,)):
        return x.tolist()
    return x

def _normalize_dict(d: dict) -> dict:
    return {k: _to_jsonable(v) for k, v in d.items()}

def _get_telemetry() -> dict:
    """
    UI-only mode 텔레메트리 데이터 반환
    """
    return {
        "ok": True,
        "simulation_mode": True,
        "message": "UI-only mode로 동작 중입니다.",
        "data_source": "ui_only",
        "debug_info": {
            "pipeline_mode": "ui_only",
            "camera_connected": False,
            "reason": "UI 디자인 모드 - 실제 분석 비활성화"
        },
        "pipeline_running": False,
        "pipeline_interval": 1.0,
        "timestamp": time.time()
    }

def _ensure_pipeline_started():
    """UI-only mode에서는 파이프라인 시작 불필요"""
    pass

def _current_interval() -> float:
    """UI-only mode 전송 주기"""
    return 2.0  # 2초마다 전송

# ----------------------------------------
# 실제 웹소켓 핸들러
# ----------------------------------------
@app.websocket("/ws/telemetry")
async def ws_telemetry(ws: WebSocket):
    await ws.accept()
    print(f"🔗 WebSocket 연결 수락: {ws.client.host}")
    
    # 연결을 관리 세트에 추가
    _active_websockets.add(ws)
    _ensure_pipeline_started()

    try:
        while True:
            d = _get_telemetry()

            # 서버 전역 토글/메타 추가
            d["debug_overlay"] = bool(debug_overlay)
            d.setdefault("ok", True)
            
            # 타임스탬프 추가
            d["timestamp"] = time.time()

            await ws.send_json(d)
            await asyncio.sleep(_current_interval())
    except WebSocketDisconnect:
        print(f"🔌 WebSocket 연결 종료: {ws.client.host}")
    except Exception as e:
        print(f"❌ WebSocket 오류: {e}")
        # 예외 발생 시 잠깐 쉬고 재시도 루프 재가동
        await asyncio.sleep(0.5)
    finally:
        # 연결을 관리 세트에서 제거
        _active_websockets.discard(ws)

@app.websocket("/ws/landmarks")
async def ws_landmarks(ws: WebSocket):
    """랜드마크 데이터를 위한 WebSocket 엔드포인트"""
    await ws.accept()
    print(f"🔗 랜드마크 WebSocket 연결 수락: {ws.client.host}")
    
    # 연결을 관리 세트에 추가
    _active_websockets.add(ws)
    
    try:
        while True:
            # 클라이언트로부터 랜드마크 데이터 수신
            data = await ws.receive_json()
            
            # 랜드마크 데이터 처리 (현재는 로그만 출력)
            if data.get("type") == "landmarks_batch":
                # 로그 빈도 조절 (과부하 방지)
                frame_count = len(data.get('frames', []))
                if frame_count > 0:
                    # 첫 번째 프레임의 랜드마크 정보 확인
                    first_frame = data.get('frames', [])[0] if data.get('frames') else None
                    landmark_info = "없음"
                    if first_frame and 'lm' in first_frame:
                        # base64 디코딩하여 랜드마크 개수 확인
                        import base64
                        try:
                            decoded_data = base64.b64decode(first_frame['lm'])
                            # Float32Array로 변환 (3개 값씩 x, y, z)
                            import struct
                            float_count = len(decoded_data) // 4  # 4 bytes per float32
                            landmark_count = float_count // 3  # 3개 값씩 (x, y, z)
                            
                            # 실제 MediaPipe FaceMesh는 468개 랜드마크
                            expected_count = 468
                            is_valid = landmark_count == expected_count
                            
                            landmark_info = f"{landmark_count}개 랜드마크 (예상: {expected_count}개, 유효: {'✅' if is_valid else '❌'})"
                            
                            # 첫 번째 랜드마크 값들 확인 (디버깅용)
                            if float_count >= 6:
                                values = struct.unpack('6f', decoded_data[:24])  # 첫 2개 랜드마크 (x,y,z) × 2
                                landmark_info += f" | 첫 값들: {values[:3]}"
                        except Exception as e:
                            landmark_info = f"디코딩 오류: {e}"
                    
                    print(f"📊 랜드마크 배치 수신: {frame_count}개 프레임, {landmark_info}")
                # 0개 프레임 로그는 제거
                
                # 여기에 랜드마크 데이터 처리 로직 추가 가능
                # 예: 파이프라인에 전달, 분석 등
                
                # 응답 전송
                await ws.send_json({
                    "ok": True,
                    "message": "랜드마크 데이터 수신 완료",
                    "frames_processed": len(data.get('frames', [])),
                    "timestamp": time.time()
                })
            else:
                # 기타 메시지 처리
                await ws.send_json({
                    "ok": True,
                    "message": "메시지 수신됨",
                    "data": data
                })
                
    except WebSocketDisconnect:
        print(f"🔌 랜드마크 WebSocket 연결 종료: {ws.client.host}")
    except Exception as e:
        print(f"❌ 랜드마크 WebSocket 오류: {e}")
    finally:
        # 연결을 관리 세트에서 제거
        _active_websockets.discard(ws)


# ----------------------------------------
# Studio Calibration API 엔드포인트
# ----------------------------------------

class UserCheckRequest(BaseModel):
    user_id: str
    email: str
    token: str

class CalibrationRequest(BaseModel):
    user_id: str
    email: str
    token: str
    calibration_data: Dict[str, Any]

class UserCalibrationUpdateRequest(BaseModel):
    user_id: str
    email: str
    token: str
    cam_calibration: bool

@app.post("/api/user/check")
@app.post("/user/check")
async def check_user_calibration(request: UserCheckRequest):
    """사용자 캘리브레이션 상태 확인 (사용자가 없으면 자동 생성)"""
    try:
        print(f"🔍 [USER_CHECK] 요청 받음 - email: {request.email}")
        
        if MONGODB_AVAILABLE:
            try:
                # MongoDB에서 사용자 정보 확인
                user = await get_user_by_email(request.email)
                if user:
                    cam_calibration = user.get('cam_calibration', False)
                    print(f"✅ [USER_CHECK] 사용자 발견 - cam_calibration: {cam_calibration}")
                    return {
                        "has_calibration": cam_calibration,
                        "cam_calibration": cam_calibration,
                        "user_id": str(user.get('_id')),
                        "message": "사용자 캘리브레이션 상태 확인 완료"
                    }
                else:
                    # 사용자가 없으면 자동 생성
                    print(f"⚠️ [USER_CHECK] 사용자 없음 - 자동 생성 시작")
                    from database import create_user
                    from datetime import datetime
                    
                    new_user_data = {
                        "email": request.email,
                        "created_at": datetime.utcnow(),
                        "updated_at": datetime.utcnow(),
                        "cam_calibration": False,
                        "is_active": True
                    }
                    
                    try:
                        user_id = await create_user(new_user_data)
                        if user_id:
                            print(f"✅ [USER_CHECK] 새 사용자 생성 완료: {user_id}")
                            return {
                                "has_calibration": False,
                                "cam_calibration": False,
                                "user_id": user_id,
                                "message": "새 사용자가 생성되었습니다"
                            }
                        else:
                            print(f"❌ [USER_CHECK] 사용자 생성 실패 - user_id가 None")
                    except Exception as create_error:
                        print(f"❌ [USER_CHECK] 사용자 생성 중 예외 발생: {create_error}")
                        import traceback
                        traceback.print_exc()
                        
            except Exception as db_error:
                print(f"⚠️ [USER_CHECK] 데이터베이스 조회 실패: {db_error}")
        
        # MongoDB가 없거나 사용자 생성에 실패한 경우
        print(f"⚠️ [USER_CHECK] 사용자 정보 없음 - MongoDB: {MONGODB_AVAILABLE}")
        return {
            "has_calibration": False,
            "cam_calibration": False,
            "message": "사용자 정보를 찾을 수 없습니다"
        }
    except Exception as e:
        print(f"❌ [USER_CHECK] 오류 발생: {e}")
        return {
            "has_calibration": False,
            "cam_calibration": False,
            "message": "상태 확인 중 오류 발생"
        }

@app.post("/api/user/update-calibration")
@app.post("/user/update-calibration")
async def update_user_calibration_status(request: UserCalibrationUpdateRequest):
    """Supabase users 테이블의 cam_calibration 필드 업데이트"""
    try:
        if MONGODB_AVAILABLE:
            # MongoDB에서 사용자 정보 업데이트
            from bson import ObjectId
            from datetime import datetime
            
            # 사용자 ID로 업데이트 (email로도 가능)
            user_id = supabase_uuid_to_objectid(request.user_id)
            
            update_result = await users_collection.update_one(
                {"_id": ObjectId(user_id)},
                {
                    "$set": {
                        "cam_calibration": request.cam_calibration,
                        "updated_at": datetime.utcnow()
                    }
                }
            )
            
            if update_result.modified_count > 0:
                print(f"사용자 캘리브레이션 상태 업데이트 완료: {request.user_id} -> {request.cam_calibration}")
                return {
                    "success": True,
                    "message": "캘리브레이션 상태 업데이트 완료",
                    "cam_calibration": request.cam_calibration
                }
            else:
                print(f"사용자를 찾을 수 없음: {request.user_id}")
                return {
                    "success": False,
                    "message": "사용자를 찾을 수 없습니다"
                }
        
        # MongoDB가 없는 경우
        return {
            "success": False,
            "message": "데이터베이스 연결이 불가능합니다"
        }
    except Exception as e:
        print(f"사용자 캘리브레이션 상태 업데이트 오류: {e}")
        return {
            "success": False,
            "message": f"업데이트 중 오류 발생: {str(e)}"
        }

@app.post("/api/calibration")
@app.post("/calibration")
async def save_calibration(request: CalibrationRequest):
    """캘리브레이션 데이터를 Supabase에 저장"""
    try:
        if MONGODB_AVAILABLE:
            from bson import ObjectId
            from datetime import datetime
            
            # 사용자 ID 변환
            user_id = supabase_uuid_to_objectid(request.user_id)
            
            # 캘리브레이션 데이터 준비
            calibration_data = request.calibration_data.copy()
            calibration_data["user_id"] = request.user_id
            calibration_data["email"] = request.email
            calibration_data["saved_at"] = datetime.utcnow()
            calibration_data["updated_at"] = datetime.utcnow()
            
            # 기존 캘리브레이션 데이터가 있는지 확인
            existing_calibration = await chat_sessions_collection.find_one({
                "user_id": request.user_id,
                "type": "calibration"
            })
            
            if existing_calibration:
                # 기존 데이터 업데이트
                update_result = await chat_sessions_collection.update_one(
                    {"_id": existing_calibration["_id"]},
                    {
                        "$set": {
                            "calibration_data": calibration_data,
                            "updated_at": datetime.utcnow()
                        }
                    }
                )
                print(f"캘리브레이션 데이터 업데이트 완료: {request.user_id}")
            else:
                # 새 캘리브레이션 데이터 저장
                calibration_doc = {
                    "user_id": request.user_id,
                    "email": request.email,
                    "type": "calibration",
                    "calibration_data": calibration_data,
                    "created_at": datetime.utcnow(),
                    "updated_at": datetime.utcnow()
                }
                
                insert_result = await chat_sessions_collection.insert_one(calibration_doc)
                print(f"캘리브레이션 데이터 저장 완료: {request.user_id}")
            
            return {
                "success": True,
                "message": "캘리브레이션 데이터 저장 완료",
                "user_id": request.user_id
            }
        else:
            return {
                "success": False,
                "message": "데이터베이스 연결이 불가능합니다"
            }
    except Exception as e:
        print(f"캘리브레이션 저장 오류: {e}")
        return {
            "success": False,
            "message": f"저장 중 오류 발생: {str(e)}"
        }

@app.get("/api/calibration/user/{user_id}")
@app.get("/calibration/user/{user_id}")
async def get_user_calibration(user_id: str):
    """사용자의 개인 캘리브레이션 데이터 조회"""
    try:
        if MONGODB_AVAILABLE:
            # 사용자의 캘리브레이션 데이터 조회
            calibration_doc = await chat_sessions_collection.find_one({
                "user_id": user_id,
                "type": "calibration"
            })
            
            if calibration_doc and calibration_doc.get("calibration_data"):
                calibration_data = calibration_doc["calibration_data"]
                print(f"개인 캘리브레이션 데이터 조회 완료: {user_id}")
                return {
                    "success": True,
                    "calibration_data": calibration_data,
                    "message": "개인 캘리브레이션 데이터 조회 완료"
                }
            else:
                print(f"개인 캘리브레이션 데이터 없음: {user_id}")
                return {
                    "success": False,
                    "message": "개인 캘리브레이션 데이터가 없습니다"
                }
        else:
            return {
                "success": False,
                "message": "데이터베이스 연결이 불가능합니다"
            }
    except Exception as e:
        print(f"개인 캘리브레이션 데이터 조회 오류: {e}")
        return {
            "success": False,
            "message": f"조회 중 오류 발생: {str(e)}"
        }

@app.post("/api/chat")
async def chat_with_ai(request: Request):
    """AI 채팅 응답"""
    try:
        data = await request.json()
        messages = data.get("messages", [])
        user_id = data.get("user_id", "unknown")
        session_id = data.get("session_id", "default")
        
        print(f"🤖 [CHAT] 채팅 요청 받음 - 사용자: {user_id}, 세션: {session_id}")
        
        # 사용자 메시지 추출
        if not messages:
            return {
                "response": "안녕하세요! 무엇을 도와드릴까요?",
                "message": "메시지가 없습니다"
            }
        
        # 마지막 사용자 메시지 추출
        last_message = ""
        for message in reversed(messages):
            if message.get("role") == "user":
                parts = message.get("parts", [])
                if parts and isinstance(parts[0], dict):
                    last_message = parts[0].get("text", "")
                elif isinstance(parts[0], str):
                    last_message = parts[0]
                break
        
        if not last_message:
            return {
                "response": "메시지를 이해하지 못했습니다. 다시 말씀해 주세요.",
                "message": "메시지 추출 실패"
            }
        
        print(f"📝 [CHAT] 사용자 메시지: {last_message}")
        
        # 실제 GPT 호출
        ai_response = await generate_ai_response(last_message, session_id)
        
        print(f"✅ [CHAT] AI 응답 생성 완료: {ai_response}")
        
        return {
            "response": ai_response,
            "message": "AI 응답 생성 완료"
        }
    except Exception as e:
        print(f"❌ [CHAT] AI 채팅 오류: {e}")
        return {
            "response": "죄송합니다. 현재 응답을 생성할 수 없습니다.",
            "message": f"오류 발생: {str(e)}"
        }

@app.post("/api/feedback")
async def analyze_feedback(request: Request):
    """피드백 분석"""
    try:
        data = await request.json()
        chat_history = data.get("chatHistory", [])
        user_id = data.get("user_id", "unknown")
        
        # 임시 피드백 데이터 (실제로는 AI 분석)
        feedback = {
            "likability": 85,
            "initiative": 70,
            "tone": 80,
            "concentration": 75,
            "gaze_stability": 90,
            "blinking": 85,
            "posture": 80,
            "expression": "긍정적",
            "summary": "전반적으로 좋은 대화를 하고 계십니다. 특히 시선 안정성이 뛰어나고 호감도도 높습니다."
        }
        
        return feedback
    except Exception as e:
        print(f"피드백 분석 오류: {e}")
        return {
            "likability": 0,
            "initiative": 0,
            "tone": 0,
            "concentration": 0,
            "gaze_stability": 0,
            "blinking": 0,
            "posture": 0,
            "expression": "분석 실패",
            "summary": "분석 중 오류가 발생했습니다."
        }

# ====== 캘리브레이션 API 엔드포인트 ======

@app.get("/api/calibration/status/{user_id}")
async def get_calibration_status(user_id: str):
    """사용자의 캘리브레이션 상태 확인"""
    try:
        if not CALIBRATION_AVAILABLE:
            return {
                "success": False,
                "message": "캘리브레이션 모듈이 사용 불가능합니다."
            }
        
        status = await calibration_service.check_user_calibration_status(user_id)
        return {
            "success": True,
            "status": status.dict()
        }
    except Exception as e:
        print(f"❌ 캘리브레이션 상태 확인 실패: {e}")
        return {
            "success": False,
            "message": f"캘리브레이션 상태 확인 중 오류 발생: {str(e)}"
        }

# 중복된 엔드포인트 제거됨

@app.post("/api/user/update-calibration")
async def update_user_calibration_status(request: Request):
    """사용자 캘리브레이션 상태 업데이트"""
    try:
        data = await request.json()
        user_id = data.get("user_id")
        email = data.get("email")
        cam_calibration = data.get("cam_calibration", True)
        
        if not user_id:
            return {
                "success": False,
                "message": "user_id가 필요합니다."
            }
        
        # Supabase users 테이블 업데이트
        if CALIBRATION_AVAILABLE and calibration_service.supabase_client:
            response = calibration_service.supabase_client.table("users").update({
                "cam_calibration": cam_calibration,
                "updated_at": datetime.utcnow().isoformat()
            }).eq("id", user_id).execute()
            
            if response.data:
                return {
                    "success": True,
                    "message": "사용자 캘리브레이션 상태가 업데이트되었습니다.",
                    "user_id": user_id,
                    "cam_calibration": cam_calibration
                }
            else:
                return {
                    "success": False,
                    "message": "사용자 정보 업데이트에 실패했습니다."
                }
        else:
            return {
                "success": False,
                "message": "Supabase 연결이 불가능합니다."
            }
    except Exception as e:
        print(f"❌ 사용자 캘리브레이션 상태 업데이트 실패: {e}")
        return {
            "success": False,
            "message": f"사용자 상태 업데이트 중 오류 발생: {str(e)}"
        }

@app.get("/api/calibration/data/{user_id}")
async def get_calibration_data(user_id: str, profile_name: str = "default"):
    """사용자의 캘리브레이션 데이터 조회"""
    try:
        if not CALIBRATION_AVAILABLE:
            return {
                "success": False,
                "message": "캘리브레이션 모듈이 사용 불가능합니다."
            }
        
        calibration_data = await calibration_service.get_user_calibration(user_id, profile_name)
        
        if calibration_data:
            return {
                "success": True,
                "calibration_data": calibration_data.dict()
            }
        else:
            return {
                "success": False,
                "message": "캘리브레이션 데이터를 찾을 수 없습니다."
            }
    except Exception as e:
        print(f"❌ 캘리브레이션 데이터 조회 실패: {e}")
        return {
            "success": False,
            "message": f"캘리브레이션 데이터 조회 중 오류 발생: {str(e)}"
        }

@app.get("/api/calibration/user/{user_id}")
async def get_user_calibration_data(user_id: str, profile_name: str = "default"):
    """사용자 캘리브레이션 데이터 조회 (기존 API와 호환)"""
    try:
        if not CALIBRATION_AVAILABLE:
            return {
                "success": False,
                "message": "캘리브레이션 모듈이 사용 불가능합니다."
            }
        
        calibration_data = await calibration_service.get_user_calibration(user_id, profile_name)
        
        if calibration_data:
            return {
                "success": True,
                "calibration_data": calibration_data.dict()
            }
        else:
            return {
                "success": False,
                "message": "캘리브레이션 데이터를 찾을 수 없습니다."
            }
    except Exception as e:
        print(f"❌ 사용자 캘리브레이션 데이터 조회 실패: {e}")
        return {
            "success": False,
            "message": f"캘리브레이션 데이터 조회 중 오류 발생: {str(e)}"
        }

@app.post("/api/calibration/start")
async def start_calibration(request: CalibrationRequest):
    """캘리브레이션 세션 시작"""
    try:
        if not CALIBRATION_AVAILABLE:
            return {
                "success": False,
                "message": "캘리브레이션 모듈이 사용 불가능합니다."
            }
        
        session_id = await calibration_service.start_calibration_session(
            request.user_id, 
            duration_seconds=5
        )
        
        return {
            "success": True,
            "session_id": session_id,
            "message": "캘리브레이션 세션이 시작되었습니다. 5초간 자세를 유지해주세요."
        }
    except Exception as e:
        print(f"❌ 캘리브레이션 세션 시작 실패: {e}")
        return {
            "success": False,
            "message": f"캘리브레이션 세션 시작 중 오류 발생: {str(e)}"
        }

@app.post("/api/calibration/process")
async def process_calibration(request: Request):
    """캘리브레이션 세션 데이터 처리"""
    try:
        if not CALIBRATION_AVAILABLE:
            return {
                "success": False,
                "message": "캘리브레이션 모듈이 사용 불가능합니다."
            }
        
        data = await request.json()
        user_id = data.get("user_id")
        session_data = data.get("session_data", {})
        
        if not user_id:
            return {
                "success": False,
                "message": "user_id가 필요합니다."
            }
        
        response = await calibration_service.process_calibration_session(user_id, session_data)
        
        return response.dict()
    except Exception as e:
        print(f"❌ 캘리브레이션 처리 실패: {e}")
        return {
            "success": False,
            "message": f"캘리브레이션 처리 중 오류 발생: {str(e)}"
        }

@app.post("/api/calibration")
async def save_calibration_data(request: Request):
    """캘리브레이션 데이터 저장 (기존 API와 호환)"""
    try:
        if not CALIBRATION_AVAILABLE:
            return {
                "success": False,
                "message": "캘리브레이션 모듈이 사용 불가능합니다."
            }
        
        data = await request.json()
        user_id = data.get("user_id")
        email = data.get("email")
        calibration_data = data.get("calibration_data", {})
        
        if not user_id:
            return {
                "success": False,
                "message": "user_id가 필요합니다."
            }
        
        # 캘리브레이션 데이터 생성
        from models.calibration import CalibrationData
        calib_data = CalibrationData(
            user_id=user_id,
            profile_name="default",
            **calibration_data
        )
        
        # 데이터 저장
        save_success = await calibration_service.save_calibration_data(calib_data)
        
        if save_success:
            return {
                "success": True,
                "message": "캘리브레이션 데이터가 성공적으로 저장되었습니다.",
                "user_id": user_id,
                "calibration_data": calib_data.dict()
            }
        else:
            return {
                "success": False,
                "message": "캘리브레이션 데이터 저장에 실패했습니다."
            }
    except Exception as e:
        print(f"❌ 캘리브레이션 데이터 저장 실패: {e}")
        return {
            "success": False,
            "message": f"캘리브레이션 데이터 저장 중 오류 발생: {str(e)}"
        }

@app.post("/api/calibration/collect")
async def collect_calibration_frame(request: Request):
    """캘리브레이션 프레임 데이터 수집"""
    try:
        if not CALIBRATION_AVAILABLE:
            return {
                "success": False,
                "message": "캘리브레이션 모듈이 사용 불가능합니다."
            }
        
        data = await request.json()
        session_id = data.get("session_id")
        frame_data = data.get("frame_data", {})
        
        if not session_id:
            return {
                "success": False,
                "message": "session_id가 필요합니다."
            }
        
        success = await calibration_service.collect_calibration_data(session_id, frame_data)
        
        return {
            "success": success,
            "message": "프레임 데이터가 수집되었습니다." if success else "프레임 데이터 수집에 실패했습니다."
        }
    except Exception as e:
        print(f"❌ 캘리브레이션 프레임 수집 실패: {e}")
        return {
            "success": False,
            "message": f"프레임 데이터 수집 중 오류 발생: {str(e)}"
        }

# ====== 페르소나 정보 로드 함수 ======

async def load_persona_context(session_id: str) -> str:
    """새로운 프로토콜 기반 페르소나 컨텍스트 로드"""
    try:
        # 새로운 페르소나 관리자 사용
        from ..services.personas.persona_manager import get_persona_manager
        from ..services.personas.prompt_protocol import read_system_text
        
        manager = get_persona_manager()
        active_persona = manager.get_active_persona()
        
        if active_persona:
            persona_id = active_persona["id"]
            print(f"🎭 [PERSONA] 활성 페르소나: {active_persona['name']} ({persona_id})")
            
            # 시스템 텍스트 로드
            system_text = read_system_text(persona_id)
            print(f"✅ [PERSONA] 시스템 텍스트 로드 완료: {len(system_text)}자")
            return system_text
        else:
            print(f"⚠️ [PERSONA] 활성 페르소나 없음 - 기본값 사용")
            return "당신은 '이서아'입니다. 처음 뵙는 사람에게 정중하고 따뜻하게 대화하는 마케팅 담당자입니다."
            
    except Exception as e:
        print(f"❌ [PERSONA] 페르소나 정보 로드 실패: {e}")
        return "당신은 '이서아'입니다. 처음 뵙는 사람에게 정중하고 따뜻하게 대화하는 마케팅 담당자입니다."

# ====== AI 응답 생성 함수 ======

async def generate_ai_response(user_message: str, session_id: str) -> str:
    """새로운 프로토콜 기반 AI 응답 생성"""
    try:
        print(f"🤖 [AI_RESPONSE] 함수 시작 - 메시지: {user_message[:50]}...")
        
        if not OPENAI_API_KEY:
            print("❌ [AI_RESPONSE] OpenAI API 키가 없음 - 오류 반환")
            raise HTTPException(status_code=503, detail="OpenAI API key not configured")
        
        print(f"✅ [AI_RESPONSE] OpenAI API 키 확인됨")
        
        # 새로운 프로토콜 시스템 사용
        from ..services.personas.prompt_protocol import compile_messages, apply_style_constraints
        from ..services.personas.persona_manager import get_persona_manager
        
        # 활성 페르소나 가져오기
        manager = get_persona_manager()
        active_persona = manager.get_active_persona()
        persona_id = active_persona["id"] if active_persona else "이서아"
        
        print(f"🤖 [AI_RESPONSE] OpenAI API 호출 시작...")
        print(f"📝 [AI_RESPONSE] 사용자 메시지: {user_message}")
        print(f"👤 [AI_RESPONSE] 세션 ID: {session_id}")
        print(f"🎭 [AI_RESPONSE] 페르소나: {persona_id}")
        
        # 메시지 컴파일
        print(f"📝 [AI_RESPONSE] 메시지 컴파일 시작...")
        messages = compile_messages(user_message, persona_id)
        print(f"📝 [AI_RESPONSE] 메시지 컴파일 완료 - 메시지 수: {len(messages)}")
        
        # OpenAI API 호출
        from openai import OpenAI
        import os
        
        print(f"🔗 [AI_RESPONSE] OpenAI 클라이언트 초기화 시작...")
        # 환경 변수에서 proxies 제거 (OpenAI 클라이언트 오류 방지)
        original_proxies = os.environ.pop('HTTP_PROXY', None)
        original_https_proxies = os.environ.pop('HTTPS_PROXY', None)
        
        try:
            client = OpenAI(api_key=OPENAI_API_KEY)
            print(f"✅ [AI_RESPONSE] OpenAI 클라이언트 초기화 완료")
        finally:
            # 환경 변수 복원
            if original_proxies:
                os.environ['HTTP_PROXY'] = original_proxies
            if original_https_proxies:
                os.environ['HTTPS_PROXY'] = original_https_proxies
        
        print(f"🚀 [AI_RESPONSE] OpenAI API 호출 시작...")
        print(f"📋 [AI_RESPONSE] 요청 파라미터: model=gpt-4o-mini, max_tokens=80, temperature=0.8")
        
        response = await asyncio.to_thread(
            client.chat.completions.create,
            model="gpt-4o-mini",
            messages=messages,
            max_tokens=80,
            temperature=0.8,
            frequency_penalty=0.3,
            presence_penalty=0.3
        )
        
        ai_response = response.choices[0].message.content.strip()
        print(f"✅ [AI_RESPONSE] OpenAI 응답 생성 완료: {len(ai_response)}자")
        print(f"💬 [AI_RESPONSE] AI 응답: {ai_response}")
        
        # TTS 최적화 적용
        final_response = apply_style_constraints(user_message, ai_response)
        print(f"🎤 [AI_RESPONSE] TTS 최적화 완료: {final_response}")
        
        return final_response
        
    except Exception as e:
        print(f"❌ [AI_RESPONSE] OpenAI API 호출 실패: {e}")
        print(f"📋 [AI_RESPONSE] 상세 오류: {e}")
        return "처음 뵙겠습니다."

# ====== 음성 분석 API 엔드포인트 ======

@app.post("/api/voice/analyze")
async def analyze_voice(audio: UploadFile = File(...)):
    """음성 파일을 텍스트로 변환 (faster-whisper 사용)"""
    print(f"🎤 [VOICE_ANALYZE] 음성 분석 요청 받음 - 파일명: {audio.filename}")
    
    if not VOICE_ANALYSIS_AVAILABLE:
        print("❌ [VOICE_ANALYZE] 음성 분석 모듈 비활성화됨 - 기본 STT 시도")
        # 기본 STT 기능 시도
        try:
            # 오디오 파일 읽기
            audio_data = await audio.read()
            print(f"📊 [VOICE_ANALYZE] 오디오 데이터 크기: {len(audio_data)} bytes")
            
            # 기본 STT 처리 (faster-whisper 직접 사용)
            import tempfile
            import os
            from faster_whisper import WhisperModel
            
            # 임시 파일 생성
            with tempfile.NamedTemporaryFile(suffix='.webm', delete=False) as temp_webm:
                temp_webm.write(audio_data)
                temp_webm_path = temp_webm.name
            
            try:
                # faster-whisper 모델 로드 및 STT 실행
                model = WhisperModel("base", device="cpu", compute_type="int8")
                segments, info = model.transcribe(temp_webm_path, language="ko")
                
                # 전사 결과 수집
                transcript = ""
                for segment in segments:
                    transcript += segment.text
                
                if not transcript.strip():
                    transcript = "음성을 인식하지 못했습니다."
                
                print(f"✅ [VOICE_ANALYZE] 기본 STT 성공: {transcript}")
                
                return {
                    "success": True,
                    "analysis": {
                        "transcript": transcript,
                        "emotion": "중립",
                        "emotion_score": 0.5,
                        "total_score": 60.0,
                        "voice_tone_score": 60.0,
                        "word_choice_score": 60.0,
                        "voice_details": {"stt_method": "faster-whisper-direct"},
                        "word_details": {},
                        "weights": {"voice": 0.4, "word": 0.4, "emotion": 0.2},
                        "positive_words": [],
                        "negative_words": []
                    },
                    "message": "기본 STT 기능으로 음성 인식 완료",
                    "details": {
                        "stt_method": "faster-whisper-direct",
                        "status": "basic_stt",
                        "message": "기본 음성 인식 모드로 동작 중입니다."
                    }
                }
                
            finally:
                # 임시 파일 정리
                os.unlink(temp_webm_path)
                
        except Exception as e:
            print(f"❌ [VOICE_ANALYZE] 기본 STT도 실패: {e}")
            return {
                "success": True,
                "analysis": {
                    "transcript": "음성 분석 기능이 일시적으로 비활성화되었습니다.",
                    "emotion": "중립",
                    "emotion_score": 0.5,
                    "total_score": 50.0,
                    "voice_tone_score": 50.0,
                    "word_choice_score": 50.0,
                    "voice_details": {},
                    "word_details": {},
                    "weights": {"voice": 0.4, "word": 0.4, "emotion": 0.2},
                    "positive_words": [],
                    "negative_words": []
                },
                "message": "음성 분석 기능이 일시적으로 비활성화되어 기본 응답을 제공합니다.",
                "details": {
                    "issue": "모든 STT 방법 실패",
                    "status": "fallback",
                    "message": "기본 응답 모드로 동작 중입니다."
                }
            }
    
    try:
        # 오디오 파일 읽기
        audio_data = await audio.read()
        print(f"📊 [VOICE_ANALYZE] 오디오 데이터 크기: {len(audio_data)} bytes")
        
        # 오디오 데이터를 numpy 배열로 변환
        import io
        import torchaudio
        import tempfile
        import os
        
        # WebM 또는 WAV 파일 처리
        with tempfile.NamedTemporaryFile(suffix='.webm', delete=False) as temp_webm:
            temp_webm.write(audio_data)
            temp_webm_path = temp_webm.name
        
        with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as temp_wav:
            temp_wav_path = temp_wav.name
        
        try:
            # ffmpeg로 WebM → WAV 변환 (오류 처리 개선)
            import subprocess
            try:
                subprocess.run([
                    'ffmpeg', '-i', temp_webm_path, 
                    '-ar', '16000',  # 16kHz 샘플링
                    '-ac', '1',      # 모노
                    '-y',            # 덮어쓰기
                    temp_wav_path
                ], check=True, capture_output=True)
                
                # 변환된 WAV 파일 로드
                waveform, sample_rate = torchaudio.load(temp_wav_path)
                
                # numpy 배열로 변환
                audio_array = waveform.squeeze().numpy()
                print(f"🔄 [VOICE_ANALYZE] WebM→WAV 변환 및 전처리 완료 - 길이: {len(audio_array)}, 샘플레이트: {sample_rate}Hz")
                
            except (subprocess.CalledProcessError, FileNotFoundError) as e:
                print(f"⚠️ [VOICE_ANALYZE] ffmpeg 변환 실패: {e}")
                # WebM 파일을 직접 faster-whisper로 처리
                print("🔄 [VOICE_ANALYZE] WebM 파일 직접 처리 시도...")
                from faster_whisper import WhisperModel
                model = WhisperModel("base", device="cpu", compute_type="int8")
                segments, info = model.transcribe(temp_webm_path, language="ko")
                
                # 전사 결과 수집
                transcript = ""
                for segment in segments:
                    transcript += segment.text
                
                if not transcript.strip():
                    transcript = "음성을 인식하지 못했습니다."
                
                print(f"✅ [VOICE_ANALYZE] WebM 직접 STT 성공: {transcript}")
                
                return {
                    "success": True,
                    "analysis": {
                        "transcript": transcript,
                        "emotion": "중립",
                        "emotion_score": 0.5,
                        "total_score": 60.0,
                        "voice_tone_score": 60.0,
                        "word_choice_score": 60.0,
                        "voice_details": {"stt_method": "faster-whisper-webm-direct"},
                        "word_details": {},
                        "weights": {"voice": 0.4, "word": 0.4, "emotion": 0.2},
                        "positive_words": [],
                        "negative_words": []
                    },
                    "message": "WebM 직접 STT로 음성 인식 완료",
                    "details": {
                        "stt_method": "faster-whisper-webm-direct",
                        "status": "webm_direct_stt",
                        "message": "WebM 파일 직접 처리 모드로 동작 중입니다."
                    }
                }
            
            # 지연 로딩으로 음성 모델 로드
            if not load_voice_models():
                return {
                    "success": False,
                    "error": "음성 분석 모델을 로드할 수 없습니다.",
                    "analysis": None
                }
            
            # faster-whisper로 음성 분석 수행
            print("🔄 [VOICE_ANALYZE] faster-whisper로 음성 분석 시작...")
            from ..services.voice.voice_api import process_audio_simple
            analysis_result = await asyncio.to_thread(process_audio_simple, audio_array)
            print(f"✅ [VOICE_ANALYZE] 음성 분석 완료")
            
            # 결과 로그
            print(f"📝 [VOICE_ANALYZE] 분석 결과:")
            print(f"   - 인식된 텍스트: {analysis_result.get('transcript', 'N/A')}")
            print(f"   - 감정: {analysis_result.get('emotion', 'N/A')} ({analysis_result.get('emotion_score', 0):.2f})")
            print(f"   - 종합 점수: {analysis_result.get('total_score', 0):.1f}")
            print(f"   - 음성 톤 점수: {analysis_result.get('voice_tone_score', 0):.1f}")
            print(f"   - 단어 선택 점수: {analysis_result.get('word_choice_score', 0):.1f}")
            
            return {
                "success": True,
                "analysis": analysis_result,
                "message": "음성 분석 완료 - faster-whisper 사용"
            }
            
        finally:
            # 임시 파일 정리
            os.unlink(temp_webm_path)
            os.unlink(temp_wav_path)
        
    except Exception as e:
        print(f"❌ [VOICE_ANALYZE] 음성 분석 중 오류: {e}")
        return {
            "success": False,
            "error": f"음성 분석 중 오류 발생: {str(e)}",
            "analysis": None
        }

# ====== TTS 관련 API ======

@app.post("/api/tts/speak")
async def text_to_speech(request: Request):
    """텍스트를 음성으로 변환 (Edge-TTS 사용)"""
    if not TTS_AVAILABLE:
        raise HTTPException(status_code=503, detail="TTS not available")
    
    try:
        data = await request.json()
        text = data.get("text", "")
        voice = data.get("voice", "ko-KR-SunHiNeural")  # 기본 한국어 여성 목소리
        
        if not text:
            raise HTTPException(status_code=400, detail="Text is required")
        
        print(f"🔊 [TTS] 음성 합성 요청: {text[:50]}... (목소리: {voice})")
        
        # 사용 가능한 목소리 목록 (대체용)
        available_voices = [
            "ko-KR-SunHiNeural",
            "ko-KR-HyunsuMultilingualNeural",
            "ko-KR-InJoonNeural",  # 남성 목소리 (최후의 대안)
            "en-US-JennyNeural"    # 영어 목소리 (최후의 대안)
        ]
        
        # 임시 파일 생성
        import tempfile
        import os
        
        with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as temp_file:
            temp_path = temp_file.name
        
        # 목소리 시도 (첫 번째 실패 시 대체 목소리 사용)
        audio_data = None
        used_voice = voice
        
        for try_voice in available_voices:
            try:
                print(f"🔄 [TTS] 목소리 시도: {try_voice}")
                
                # Edge-TTS로 음성 생성
                communicate = edge_tts.Communicate(text, try_voice)
                await communicate.save(temp_path)
                
                # 파일 읽기
                with open(temp_path, 'rb') as f:
                    audio_data = f.read()
                
                used_voice = try_voice
                print(f"✅ [TTS] 목소리 성공: {try_voice}")
                break
                
            except Exception as voice_error:
                print(f"⚠️ [TTS] 목소리 실패 ({try_voice}): {voice_error}")
                continue
        
        # 임시 파일 삭제
        os.unlink(temp_path)
        
        if not audio_data:
            raise Exception("모든 목소리 시도 실패")
        
        print(f"✅ [TTS] 음성 합성 완료: {len(audio_data)} bytes (사용된 목소리: {used_voice})")
        
        return Response(
            content=audio_data,
            media_type="audio/wav",
            headers={
                "Content-Disposition": "inline; filename=tts_output.wav",
                "Cache-Control": "no-cache"
            }
        )
        
    except Exception as e:
        print(f"❌ [TTS] 음성 합성 실패: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/tts/voices")
async def get_available_voices():
    """사용 가능한 한국어 목소리 목록"""
    if not TTS_AVAILABLE:
        raise HTTPException(status_code=503, detail="TTS not available")
    
    try:
        # 한국어 여성 목소리들
        korean_voices = [
            {
                "id": "ko-KR-SunHiNeural",
                "name": "선희 (여성, 밝고 친근한)",
                "gender": "female",
                "description": "밝고 친근한 목소리"
            },
            {
                "id": "ko-KR-HyunsuMultilingualNeural",
                "name": "현수 (여성, 다국어 지원)",
                "gender": "female",
                "description": "다국어를 지원하는 우아한 목소리"
            }
        ]
        
        return {"voices": korean_voices, "default": "ko-KR-SunHiNeural"}
        
    except Exception as e:
        print(f"❌ [TTS] 목소리 목록 조회 실패: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ====== 세션 종료 API 엔드포인트 ======

class SessionEndRequest(BaseModel):
    session_id: str
    user_id: str
    email: str
    token: Optional[str] = None
    end_reason: Optional[str] = "user_request"  # "user_request", "timeout", "error"
    final_feedback: Optional[Dict[str, Any]] = None

@app.post("/api/session/end")
async def end_session(request: SessionEndRequest):
    """대화 세션 종료 및 정리 - 빠른 응답 버전"""
    print(f"🔍 [END_SESSION] 요청 받음 - session_id: {request.session_id}")
    
    # 즉시 성공 응답 반환 (비동기로 백그라운드에서 처리)
    response_data = {
        "success": True,
        "message": "세션이 성공적으로 종료되었습니다.",
        "session_stats": {
            "session_id": request.session_id,
            "user_id": request.user_id,
            "end_reason": request.end_reason,
            "end_time": time.time()
        },
        "redirect_url": f"/frontend/studio_calibration.html?user_id={request.user_id}&email={request.email}&session_ended=true&session_id={request.session_id}&skip_calibration=true"
    }
    
    # 백그라운드에서 세션 정리 작업 수행
    import asyncio
    asyncio.create_task(_cleanup_session_background(request))
    
    return response_data

async def _cleanup_session_background(request: SessionEndRequest):
    """백그라운드에서 세션 정리 작업 수행"""
    try:
        print(f"🔄 [CLEANUP] 백그라운드 세션 정리 시작: {request.session_id}")
        
        # 1. 세션 상태 업데이트 (MongoDB가 있는 경우)
        if MONGODB_AVAILABLE:
            try:
                from database import update_session_end_time
                await update_session_end_time(request.session_id)
                print(f"✅ [CLEANUP] 세션 종료 시간 기록 완료")
            except Exception as e:
                print(f"⚠️ [CLEANUP] 세션 종료 시간 기록 실패: {e}")
        
        # 2. 최종 피드백 저장 (있는 경우)
        if request.final_feedback:
            try:
                feedback_data = {
                    "session_id": request.session_id,
                    "user_id": request.user_id,
                    "feedback": request.final_feedback,
                    "created_at": time.time()
                }
                
                import json
                import os
                os.makedirs("feedback", exist_ok=True)
                feedback_file = f"feedback/session_{request.session_id}_feedback.json"
                
                with open(feedback_file, "w", encoding="utf-8") as f:
                    json.dump(feedback_data, f, ensure_ascii=False, indent=2)
                
                print(f"✅ [CLEANUP] 최종 피드백 저장 완료: {feedback_file}")
            except Exception as e:
                print(f"⚠️ [CLEANUP] 피드백 저장 실패: {e}")
        
        # 3. 리소스 정리 (파이프라인 제거됨)
        
        print(f"✅ [CLEANUP] 백그라운드 세션 정리 완료: {request.session_id}")
        
    except Exception as e:
        print(f"❌ [CLEANUP] 백그라운드 세션 정리 중 오류: {e}")

# 표정 분석기 import 추가
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'services'))

try:
    # 표정 분석기 모듈 강제 로드 시도
    sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'services'))
    
    # 필수 라이브러리 체크
    import torch
    print("✅ PyTorch 확인됨")
    
    try:
        import mlflow.pytorch
        print("✅ MLflow 확인됨")
        MLFLOW_AVAILABLE = True
    except ImportError:
        print("⚠️ MLflow 없음 - PyTorch 직접 로드 방식 사용")
        MLFLOW_AVAILABLE = False
    
    from analysis.expression_analyzer import ExpressionAnalyzer
    EXPRESSION_ANALYZER_AVAILABLE = True
    print("✅ 표정 분석기 모듈 로드 성공")
except ImportError as e:
    EXPRESSION_ANALYZER_AVAILABLE = False
    print(f"⚠️ 표정 분석기 모듈 로드 실패: {e}")
    print("⚠️ 필요한 라이브러리: torch, mlflow, PIL, cv2")

# 전역 표정 분석기 인스턴스
_expression_analyzer = None

@app.get("/api/expression/initialize")
@app.post("/api/expression/initialize") 
async def initialize_expression_analyzer_api():
    """표정 분석기를 초기화합니다."""
    global _expression_analyzer
    
    try:
        print("🔍 [EXPRESSION] 표정 분석기 초기화 요청 받음")
        
        if not EXPRESSION_ANALYZER_AVAILABLE:
            print("❌ [EXPRESSION] 표정 분석기 모듈이 사용 불가능")
            return {
                "success": False, 
                "error": "Expression analyzer module not available. Missing required libraries.",
                "details": "PyTorch, MLflow, or other dependencies may be missing."
            }
        
        # 새 인스턴스 생성 및 초기화
        print("🔄 [EXPRESSION] ExpressionAnalyzer 인스턴스 생성 중...")
        _expression_analyzer = ExpressionAnalyzer()
        print("🔄 [EXPRESSION] ExpressionAnalyzer 초기화 시작...")
        print("🔄 [EXPRESSION] MLflow 모델 로딩 시도 중...")
        success = _expression_analyzer.initialize()
        print(f"🔄 [EXPRESSION] ExpressionAnalyzer 초기화 완료: {success}")
        print(f"🔄 [EXPRESSION] is_initialized 상태: {_expression_analyzer.is_initialized}")
        print(f"🔄 [EXPRESSION] 모델 타입: {type(_expression_analyzer.model) if _expression_analyzer.model else 'None'}")
        
        print(f"✅ [EXPRESSION] 표정 분석기 초기화 결과: {success}")
        
        if success:
            return {
                "success": True,
                "message": "Expression analyzer initialized successfully",
                "model_loaded": True
            }
        else:
            return {
                "success": False,
                "error": "Failed to initialize expression analyzer",
                "details": "Model files may be missing or corrupted"
            }
            
    except Exception as e:
        print(f"❌ [EXPRESSION] 표정 분석기 초기화 실패: {e}")
        import traceback
        traceback.print_exc()
        return {
            "success": False, 
            "error": str(e),
            "details": "Check server logs for detailed error information"
        }

@app.post("/api/expression/analyze")
async def analyze_expression_api(request: Request):
    """이미지에서 표정을 분석합니다."""
    global _expression_analyzer
    
    try:
        if not EXPRESSION_ANALYZER_AVAILABLE:
            return {
                "success": False, 
                "error": "Expression analyzer not available",
                "details": "Module not loaded or dependencies missing"
            }
        
        if not _expression_analyzer or not _expression_analyzer.is_initialized:
            return {
                "success": False, 
                "error": "Expression analyzer not initialized",
                "details": "Call /api/expression/initialize first"
            }
        
        data = await request.json()
        image_data = data.get('image_data')
        
        if not image_data:
            return {
                "success": False, 
                "error": "No image data provided",
                "details": "image_data field is required"
            }
        
        print(f"🎭 [EXPRESSION] 표정 분석 요청 받음 - 이미지 데이터 크기: {len(image_data)}")
        
        # 표정 분석 실행
        result = _expression_analyzer.analyze_expression(image_data)
        
        # 점수 변환
        if result.get('success', False):
            score_result = _expression_analyzer.get_expression_score(result)
            result['score'] = score_result
            # probabilities 필드가 있으면 유지
            if 'probabilities' not in result:
                result['probabilities'] = {}
            print(f"✅ [EXPRESSION] 분석 완료: {result.get('expression', 'Unknown')} (신뢰도: {result.get('confidence', 0):.3f})")
        else:
            print(f"❌ [EXPRESSION] 분석 실패: {result.get('error', 'Unknown error')}")
        
        return result
        
    except Exception as e:
        print(f"❌ [EXPRESSION] 표정 분석 API 오류: {e}")
        import traceback
        traceback.print_exc()
        return {
            "success": False, 
            "error": str(e),
            "details": "Check server logs for detailed error information"
        }

# 이미지 파일 서빙 개선
@app.get("/frontend/img/{filename:path}")
def serve_frontend_image(filename: str):
    """frontend 이미지 파일 제공"""
    import os
    print(f"🔍 [IMAGE] 요청: {filename}")
    
    # 가능한 경로들 (더 많은 경로 추가)
    possible_paths = [
        f"src/frontend/assets/images/{filename}",
        f"frontend/assets/images/{filename}",
        f"assets/images/{filename}",
        f"images/{filename}",
        f"/usr/src/app/src/frontend/assets/images/{filename}",
        f"/workspace/app/src/frontend/assets/images/{filename}"
    ]
    
    for i, file_path in enumerate(possible_paths, 1):
        print(f"📁 [IMAGE] 시도 {i}: {file_path}")
        if os.path.exists(file_path):
            print(f"✅ [IMAGE] 파일 발견: {file_path}")
            # 파일 크기 확인
            file_size = os.path.getsize(file_path)
            print(f"📊 [IMAGE] 파일 크기: {file_size} bytes")
            
            # 파일 확장자에 따른 MIME 타입 설정
            if filename.endswith('.webp'):
                media_type = "image/webp"
            elif filename.endswith('.png'):
                media_type = "image/png"
            elif filename.endswith('.jpg') or filename.endswith('.jpeg'):
                media_type = "image/jpeg"
            elif filename.endswith('.svg'):
                media_type = "image/svg+xml"
            else:
                media_type = "image/*"
            
            return FileResponse(file_path, media_type=media_type)
    
    print(f"❌ [IMAGE] 파일을 찾을 수 없음: {filename}")
    print(f"📋 [IMAGE] 시도한 경로들: {possible_paths}")
    return Response(status_code=404, content=f"Image {filename} not found")

# 비디오 파일 서빙 추가
@app.get("/frontend/video/{filename:path}")
def serve_frontend_video(filename: str):
    """frontend 비디오 파일 제공"""
    import os
    print(f"🔍 [VIDEO] 요청: {filename}")
    
    # 가능한 경로들
    possible_paths = [
        f"src/frontend/assets/videos/{filename}",
        f"frontend/assets/videos/{filename}",
        f"assets/videos/{filename}",
        f"videos/{filename}",
        f"/usr/src/app/src/frontend/assets/videos/{filename}",
        f"/workspace/app/src/frontend/assets/videos/{filename}"
    ]
    
    for i, file_path in enumerate(possible_paths, 1):
        print(f"📁 [VIDEO] 시도 {i}: {file_path}")
        if os.path.exists(file_path):
            print(f"✅ [VIDEO] 파일 발견: {file_path}")
            # 파일 크기 확인
            file_size = os.path.getsize(file_path)
            print(f"📊 [VIDEO] 파일 크기: {file_size} bytes")
            
            # 파일 확장자에 따른 MIME 타입 설정
            if filename.endswith('.mp4'):
                media_type = "video/mp4"
            elif filename.endswith('.webm'):
                media_type = "video/webm"
            elif filename.endswith('.avi'):
                media_type = "video/x-msvideo"
            else:
                media_type = "video/*"
            
            return FileResponse(file_path, media_type=media_type)
    
    print(f"❌ [VIDEO] 파일을 찾을 수 없음: {filename}")
    print(f"📋 [VIDEO] 시도한 경로들: {possible_paths}")
    return Response(status_code=404, content=f"Video {filename} not found")

# === 모니터링 엔드포인트 ===

@app.get("/metrics")
def prometheus_metrics():
    """Prometheus 메트릭 엔드포인트"""
    if MONITORING_AVAILABLE:
        return get_metrics()
    else:
        return Response(
            content="# Monitoring not available\n",
            media_type="text/plain"
        )

@app.get("/api/monitoring/health")
def monitoring_health():
    """모니터링 헬스체크"""
    return {
        "status": "ok",
        "monitoring_available": MONITORING_AVAILABLE,
        "timestamp": time.time(),
        "version": "1.0.0"
    }

@app.post("/api/monitoring/alerts")
async def receive_alert(request: Request):
    """AlertManager 웹훅 수신"""
    try:
        alert_data = await request.json()
        print(f"🚨 [ALERT] 수신: {alert_data}")
        
        # 알림 처리 로직 추가 가능
        # 예: 이메일 발송, Slack 알림 등
        
        return {"status": "received"}
    except Exception as e:
        print(f"❌ [ALERT] 처리 실패: {e}")
        return {"status": "error", "message": str(e)}

# === 표정 분석 API 엔드포인트 ===

@app.post("/api/expression/analyze")
async def analyze_expression(request: Request):
    """이미지에서 표정을 분석합니다."""
    try:
        if not EXPRESSION_ANALYSIS_AVAILABLE:
            return {
                "success": False,
                "error": "Expression analysis module not available"
            }
        
        # 요청 데이터 파싱
        data = await request.json()
        image_data = data.get('image_data')
        
        if not image_data:
            return {
                "success": False,
                "error": "Image data is required"
            }
        
        # 표정 분석기 초기화 확인
        if not expression_analyzer.is_initialized:
            if not expression_analyzer.initialize():
                return {
                    "success": False,
                    "error": "Failed to initialize expression analyzer"
                }
        
        # 표정 분석 실행
        result = expression_analyzer.analyze_expression(image_data)
        
        return result
        
    except Exception as e:
        print(f"❌ [EXPRESSION] 분석 실패: {e}")
        import traceback
        traceback.print_exc()
        return {
            "success": False,
            "error": str(e)
        }

@app.post("/api/expression/analyze-batch")
async def analyze_expression_batch(request: Request):
    """여러 이미지의 표정을 일괄 분석합니다."""
    try:
        if not EXPRESSION_ANALYSIS_AVAILABLE:
            return {
                "success": False,
                "error": "Expression analysis module not available"
            }
        
        # 요청 데이터 파싱
        data = await request.json()
        image_data_list = data.get('image_data_list', [])
        
        if not image_data_list:
            return {
                "success": False,
                "error": "Image data list is required"
            }
        
        # 표정 분석기 초기화 확인
        if not expression_analyzer.is_initialized:
            if not expression_analyzer.initialize():
                return {
                    "success": False,
                    "error": "Failed to initialize expression analyzer"
                }
        
        # 일괄 표정 분석 실행
        results = expression_analyzer.analyze_expression_batch(image_data_list)
        
        return {
            "success": True,
            "results": results
        }
        
    except Exception as e:
        print(f"❌ [EXPRESSION] 일괄 분석 실패: {e}")
        import traceback
        traceback.print_exc()
        return {
            "success": False,
            "error": str(e)
        }

@app.get("/api/expression/status")
def get_expression_analyzer_status():
    """표정 분석기 상태를 확인합니다."""
    try:
        if not EXPRESSION_ANALYSIS_AVAILABLE:
            return {
                "success": False,
                "error": "Expression analysis module not available",
                "module_available": False
            }
        
        return {
            "success": True,
            "module_available": True,
            "is_initialized": expression_analyzer.is_initialized,
            "device": str(expression_analyzer.device) if expression_analyzer.device else None,
            "expression_categories": expression_analyzer.expression_categories
        }
        
    except Exception as e:
        print(f"❌ [EXPRESSION] 상태 확인 실패: {e}")
        return {
            "success": False,
            "error": str(e)
        }

@app.get("/api/mediapipe/status")
def get_mediapipe_analyzer_status():
    """MediaPipe 분석기 상태를 확인합니다."""
    try:
        if not MEDIAPIPE_ANALYSIS_AVAILABLE:
            return {
                "success": False,
                "error": "MediaPipe analysis module not available",
                "module_available": False
            }
        
        return {
            "success": True,
            "module_available": True,
            "is_initialized": mediapipe_analyzer.is_initialized,
            "analysis_history_count": len(mediapipe_analyzer.analysis_history) if mediapipe_analyzer.analysis_history else 0
        }
        
    except Exception as e:
        print(f"❌ [MEDIAPIPE] 상태 확인 실패: {e}")
        return {
            "success": False,
            "error": str(e)
        }

@app.post("/api/mediapipe/initialize")
def initialize_mediapipe_analyzer():
    """MediaPipe 분석기를 초기화합니다."""
    try:
        if not MEDIAPIPE_ANALYSIS_AVAILABLE:
            return {
                "success": False,
                "error": "MediaPipe analysis module not available"
            }
        
        success = mediapipe_analyzer.initialize()
        return {
            "success": success,
            "is_initialized": mediapipe_analyzer.is_initialized,
            "message": "MediaPipe 분석기 초기화 완료" if success else "MediaPipe 분석기 초기화 실패"
        }
        
    except Exception as e:
        print(f"❌ [MEDIAPIPE] 초기화 실패: {e}")
        return {
            "success": False,
            "error": str(e)
        }

@app.get("/api/mediapipe/summary")
def get_mediapipe_summary():
    """MediaPipe 분석 결과 요약을 반환합니다."""
    try:
        if not MEDIAPIPE_ANALYSIS_AVAILABLE or not mediapipe_analyzer.is_initialized:
            return {
                "success": False,
                "error": "MediaPipe analysis module not available or not initialized"
            }
        
        summary = mediapipe_analyzer.get_analysis_summary()
        return {
            "success": True,
            "summary": summary,
            "timestamp": time.time()
        }
        
    except Exception as e:
        print(f"❌ [MEDIAPIPE] 요약 조회 실패: {e}")
        return {
            "success": False,
            "error": str(e)
        }

# === 벡터 서비스 API 엔드포인트 ===

@app.get("/api/vector/status")
async def get_vector_service_status():
    """벡터 서비스 상태를 확인합니다."""
    try:
        if not VECTOR_SERVICE_AVAILABLE:
            return {
                "success": False,
                "error": "Vector service module not available",
                "module_available": False
            }
        
        health = await vector_service.health_check()
        return {
            "success": True,
            "module_available": True,
            "health": health
        }
        
    except Exception as e:
        print(f"❌ [VECTOR] 상태 확인 실패: {e}")
        return {
            "success": False,
            "error": str(e)
        }

@app.post("/api/vector/initialize")
async def initialize_vector_service():
    """벡터 서비스를 초기화합니다."""
    try:
        if not VECTOR_SERVICE_AVAILABLE:
            return {
                "success": False,
                "error": "Vector service module not available"
            }
        
        success = await vector_service.initialize()
        return {
            "success": success,
            "message": "벡터 서비스 초기화 완료" if success else "벡터 서비스 초기화 실패"
        }
        
    except Exception as e:
        print(f"❌ [VECTOR] 초기화 실패: {e}")
        return {
            "success": False,
            "error": str(e)
        }

@app.post("/api/vector/store")
async def store_text_with_embedding(request: dict):
    """텍스트와 임베딩을 저장합니다."""
    try:
        if not VECTOR_SERVICE_AVAILABLE:
            return {
                "success": False,
                "error": "Vector service module not available"
            }
        
        text = request.get("text")
        content_type = request.get("content_type")
        content_id = request.get("content_id")
        metadata = request.get("metadata")
        
        if not all([text, content_type, content_id]):
            return {
                "success": False,
                "error": "text, content_type, content_id는 필수입니다"
            }
        
        success = await vector_service.store_text_with_embedding(
            text=text,
            content_type=content_type,
            content_id=content_id,
            metadata=metadata
        )
        
        return {
            "success": success,
            "message": "텍스트 및 임베딩 저장 완료" if success else "텍스트 및 임베딩 저장 실패"
        }
        
    except Exception as e:
        print(f"❌ [VECTOR] 저장 실패: {e}")
        return {
            "success": False,
            "error": str(e)
        }

@app.post("/api/vector/search")
async def search_similar_texts(request: dict):
    """유사한 텍스트를 검색합니다."""
    try:
        if not VECTOR_SERVICE_AVAILABLE:
            return {
                "success": False,
                "error": "Vector service module not available"
            }
        
        query_text = request.get("query_text")
        content_type = request.get("content_type")
        top_k = request.get("top_k", 10)
        
        if not query_text:
            return {
                "success": False,
                "error": "query_text는 필수입니다"
            }
        
        results = await vector_service.search_similar_texts(
            query_text=query_text,
            content_type=content_type,
            top_k=top_k
        )
        
        return {
            "success": True,
            "results": results,
            "count": len(results)
        }
        
    except Exception as e:
        print(f"❌ [VECTOR] 검색 실패: {e}")
        return {
            "success": False,
            "error": str(e)
        }

@app.get("/api/vector/statistics")
async def get_vector_statistics():
    """벡터 서비스 통계를 조회합니다."""
    try:
        if not VECTOR_SERVICE_AVAILABLE:
            return {
                "success": False,
                "error": "Vector service module not available"
            }
        
        stats = await vector_service.get_statistics()
        return {
            "success": True,
            "statistics": stats
        }
        
    except Exception as e:
        print(f"❌ [VECTOR] 통계 조회 실패: {e}")
        return {
            "success": False,
            "error": str(e)
        }

@app.delete("/api/vector/{vector_id}")
async def delete_embedding(vector_id: str):
    """임베딩을 삭제합니다."""
    try:
        if not VECTOR_SERVICE_AVAILABLE:
            return {
                "success": False,
                "error": "Vector service module not available"
            }
        
        success = await vector_service.delete_embedding(vector_id)
        return {
            "success": success,
            "message": "임베딩 삭제 완료" if success else "임베딩 삭제 실패"
        }
        
    except Exception as e:
        print(f"❌ [VECTOR] 삭제 실패: {e}")
        return {
            "success": False,
            "error": str(e)
        }

# === 진단 엔드포인트 ===

@app.get("/api/diagnose/database")
async def diagnose_mongodb():
    """MongoDB 데이터베이스 상태 진단"""
    try:
        print("🔍 [DIAGNOSE_API] MongoDB 진단 요청")
        
        if not MONGODB_AVAILABLE:
            return {
                "status": "error",
                "message": "MongoDB 모듈이 로드되지 않음",
                "mongodb_available": False
            }
        
        result = await diagnose_database()
        return {
            "status": "success",
            "mongodb_available": True,
            "diagnosis": result
        }
        
    except Exception as e:
        print(f"❌ [DIAGNOSE_API] 진단 실패: {e}")
        return {
            "status": "error",
            "message": str(e),
            "mongodb_available": MONGODB_AVAILABLE
        }

@app.get("/api/diagnose/user/{email}")
async def diagnose_user(email: str):
    """특정 사용자 상태 진단"""
    try:
        print(f"🔍 [DIAGNOSE_USER] 사용자 진단 요청: {email}")
        
        if not MONGODB_AVAILABLE:
            return {
                "status": "error",
                "message": "MongoDB 모듈이 로드되지 않음"
            }
        
        # 사용자 조회
        user = await get_user_by_email(email)
        
        if user:
            # 사용자의 세션 조회
            user_sessions = await get_user_sessions(str(user.get('_id')))
            
            return {
                "status": "success",
                "user_found": True,
                "user_id": str(user.get('_id')),
                "email": user.get('email'),
                "created_at": user.get('created_at'),
                "cam_calibration": user.get('cam_calibration', False),
                "sessions_count": len(user_sessions),
                "sessions": user_sessions[:5]  # 최근 5개 세션만
            }
        else:
            return {
                "status": "success",
                "user_found": False,
                "email": email,
                "message": "사용자를 찾을 수 없음"
            }
            
    except Exception as e:
        print(f"❌ [DIAGNOSE_USER] 사용자 진단 실패: {e}")
        return {
            "status": "error",
            "message": str(e)
        }

