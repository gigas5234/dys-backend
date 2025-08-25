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
    from database import init_database, create_chat_session, create_chat_session_with_persona, get_user_sessions, save_message, get_session_messages, get_session_info
    from auth import get_current_user, get_current_user_id
    MONGODB_AVAILABLE = True
except ImportError as e:
    print(f"⚠️ MongoDB 모듈 로드 실패: {e}")
    MONGODB_AVAILABLE = False


# analyzers 모듈 제거됨 - 클라이언트 측에서 처리

# 음성 분석 모듈 import
try:
    from dys_studio.voice_input import preload_models, process_audio_simple
    VOICE_ANALYSIS_AVAILABLE = True
    print("✅ 음성 분석 모듈 로드 성공")
except ImportError as e:
    print(f"⚠️ 음성 분석 모듈 로드 실패: {e}")
    VOICE_ANALYSIS_AVAILABLE = False

# TTS 모듈 import
try:
    import edge_tts
    import tempfile
    TTS_AVAILABLE = True
    print("✅ Edge-TTS 모듈 로드 성공")
except ImportError as e:
    print(f"⚠️ Edge-TTS 모듈 로드 실패: {e}")
    TTS_AVAILABLE = False

# OpenAI API 설정
import openai
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
if OPENAI_API_KEY:
    openai.api_key = OPENAI_API_KEY
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
BASE_DIR = Path(__file__).resolve().parent
TEMPLATES_DIR = BASE_DIR / "templates"

app = FastAPI(title=APP_NAME)

# 정적 파일 서빙 설정
app.mount("/dys_studio", StaticFiles(directory=str(BASE_DIR / "dys_studio")), name="dys_studio")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 모든 도메인 허용 (개발 중)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# FastAPI 이벤트 핸들러 추가
@app.on_event("startup")
async def startup_event():
    """서버 시작 시 실행"""
    print(f"🚀 {APP_NAME} 서버 시작됨 (포트: {PORT})")

@app.on_event("shutdown")
async def shutdown_event():
    """서버 종료 시 실행"""
    print("🛑 서버 종료 이벤트 수신 - 리소스 정리 중...")
    cleanup_on_shutdown()


# 파이프라인 관련 코드 제거됨 - 클라이언트에서 처리

# 파이프라인 제거됨 - 클라이언트 측에서 모든 분석 처리



@app.get("/")
def root():
    return {"ok": True, "service": APP_NAME}

@app.get("/health")
def health():
    return {"ok": True}

# /webcam 엔드포인트 제거됨 - 사용하지 않음

@app.get("/dys_studio/video/{filename}")
async def get_video(filename: str):
    """비디오 파일 직접 서빙"""
    video_path = BASE_DIR / "dys_studio" / "video" / filename
    if video_path.exists():
        return FileResponse(str(video_path), media_type="video/mp4")
    else:
        raise HTTPException(status_code=404, detail=f"Video file {filename} not found")

# 대시보드 엔드포인트 제거됨 - 사용하지 않음

# 사용하지 않는 페이지 엔드포인트들 제거됨 (/app.js, /studio, /dys_studio)

@app.get("/dys_studio/studio_calibration")
def dys_studio_calibration():
    """DYS Studio 캘리브레이션 페이지 제공"""
    try:
        return FileResponse("dys_studio/studio_calibration.html", media_type="text/html")
    except FileNotFoundError:
        return Response(status_code=404, content="dys_studio/studio_calibration.html not found")

@app.get("/dys_studio/studio_calibration.html")
def dys_studio_calibration_html():
    """DYS Studio 캘리브레이션 페이지 제공 (.html 확장자 포함)"""
    try:
        return FileResponse("dys_studio/studio_calibration.html", media_type="text/html")
    except FileNotFoundError:
        return Response(status_code=404, content="dys_studio/studio_calibration.html not found")

@app.get("/runpod")
def runpod_studio():
    """RunPod Studio iframe 페이지 제공"""
    try:
        return FileResponse("templates/runpod_studio.html", media_type="text/html")
    except FileNotFoundError:
        return Response(status_code=404, content="runpod_studio.html not found")

@app.get("/studio/img/{filename}")
def serve_studio_image(filename: str):
    """studio 이미지 파일 제공"""
    try:
        return FileResponse(f"studio/img/{filename}", media_type="image/svg+xml" if filename.endswith('.svg') else "image/*")
    except FileNotFoundError:
        return Response(status_code=404, content=f"Image {filename} not found")

@app.get("/dys_studio/img/{filename:path}")
def serve_dys_studio_image(filename: str):
    """dys_studio 이미지 파일 제공"""
    import os
    print(f"🔍 이미지 요청: {filename}")
    
    # 첫 번째 시도: dys_studio/img/{filename}
    file_path = f"dys_studio/img/{filename}"
    print(f"📁 시도 1: {file_path}")
    if os.path.exists(file_path):
        print(f"✅ 파일 발견: {file_path}")
        return FileResponse(file_path, media_type="image/svg+xml" if filename.endswith('.svg') else "image/*")
    
    # 두 번째 시도: img/{filename}
    file_path = f"img/{filename}"
    print(f"📁 시도 2: {file_path}")
    if os.path.exists(file_path):
        print(f"✅ 파일 발견: {file_path}")
        return FileResponse(file_path, media_type="image/svg+xml" if filename.endswith('.svg') else "image/*")
    
    # 세 번째 시도: studio/img/{filename}
    file_path = f"studio/img/{filename}"
    print(f"📁 시도 3: {file_path}")
    if os.path.exists(file_path):
        print(f"✅ 파일 발견: {file_path}")
        return FileResponse(file_path, media_type="image/svg+xml" if filename.endswith('.svg') else "image/*")
    
    print(f"❌ 파일을 찾을 수 없음: {filename}")
    return Response(status_code=404, content=f"Image {filename} not found")

@app.get("/dys_logo.png")
def serve_dys_logo():
    """데연소 로고 파일 제공"""
    try:
        return FileResponse("dys_logo.png", media_type="image/png")
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
        from auth import SUPABASE_URL, SUPABASE_ANON_KEY
    except Exception:
        # 환경변수로 폴백
        SUPABASE_URL = os.getenv("SUPABASE_URL", "")
        SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "")
    return {"url": SUPABASE_URL, "anonKey": SUPABASE_ANON_KEY}

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

@app.post("/api/calibrate/start")
def api_calibrate_start(user_id: str = "default", seconds: int = 5):
    """캘리브레이션 시작 (개선됨)"""
    global _pipeline
    if _pipeline and hasattr(_pipeline, 'calib'):
        try:
            _pipeline.calib.start(user_id=user_id, duration_sec=seconds)
            return {"ok": True, "message": f"Calibration started for user {user_id} ({seconds}s)"}
        except Exception as e:
            return {"ok": False, "error": str(e)}
    return {"ok": False, "error": "Calibration not available"}

@app.get("/api/calibrate/status")
def api_calibrate_status():
    """캘리브레이션 상태 (개선됨)"""
    global _pipeline
    if _pipeline and hasattr(_pipeline, 'calib'):
        try:
            status = _pipeline.calib.status()
            return status
        except Exception as e:
            return {"ok": False, "error": str(e)}
    return {"ok": False, "error": "Calibration not available"}

@app.get("/api/calibrate/info")
def api_calibrate_info(user_id: str = "default"):
    """캘리브레이션 정보 조회"""
    global _pipeline
    if _pipeline and hasattr(_pipeline, 'calib'):
        try:
            info = _pipeline.calib.get_calibration_info(user_id)
            return {"ok": True, "info": info}
        except Exception as e:
            return {"ok": False, "error": str(e)}
    return {"ok": False, "error": "Calibration not available"}

@app.delete("/api/calibrate/user")
def api_calibrate_delete_user(user_id: str):
    """사용자 캘리브레이션 삭제"""
    global _pipeline
    if _pipeline and hasattr(_pipeline, 'calib'):
        try:
            success = _pipeline.calib.delete_user(user_id)
            if success:
                return {"ok": True, "message": f"User {user_id} calibration deleted"}
            else:
                return {"ok": False, "error": f"Failed to delete user {user_id} calibration"}
        except Exception as e:
            return {"ok": False, "error": str(e)}
    return {"ok": False, "error": "Calibration not available"}

@app.get("/api/users/list")
def api_users_list():
    """사용 가능한 사용자 목록"""
    global _pipeline
    if _pipeline and hasattr(_pipeline, 'calib'):
        try:
            users = _pipeline.calib.get_available_users()
            return {"ok": True, "users": users}
        except Exception as e:
            return {"ok": False, "error": str(e)}
    return {"ok": False, "error": "Calibration not available"}

@app.get("/api/users/info")
def api_users_info(user_id: str = "default"):
    """사용자 정보 조회"""
    global _pipeline
    if _pipeline and hasattr(_pipeline, 'calib'):
        try:
            info = _pipeline.calib.get_calibration_info(user_id)
            return {"ok": True, "user_info": info}
        except Exception as e:
            return {"ok": False, "error": str(e)}
    return {"ok": False, "error": "Calibration not available"}

@app.get("/api/pipeline/status")
def api_pipeline_status():
    """파이프라인 상태 확인"""
    global _pipeline
    if not _pipeline:
        return {
            "available": False,
            "status": "not_initialized",
            "message": "파이프라인이 초기화되지 않았습니다."
        }
    
    try:
        return {
            "available": True,
            "status": "simulation" if _pipeline.simulation_mode else "real_camera",
            "running": _pipeline.is_running,
            "process_interval_sec": _pipeline.process_interval_sec,
            "message": "시뮬레이션 모드로 동작 중입니다." if _pipeline.simulation_mode else "실제 카메라로 동작 중입니다."
        }
    except Exception as e:
        return {
            "available": False,
            "status": "error",
            "message": f"파이프라인 상태 확인 중 오류: {str(e)}"
        }

# ====== 채팅 API 엔드포인트 ======

@app.post("/api/chat/sessions")
async def create_session(
    session: ChatSession,
    request: Request
):
    """새 채팅 세션 생성"""
    print(f"🔍 [CREATE_SESSION] 요청 받음 - session_name: {session.session_name}")
    
    # 인증 토큰 확인 (선택적)
    current_user_id = None
    try:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
            from auth import get_current_user
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
        
        # persona 정보가 있으면 세션 이름에 포함
        session_name = session.session_name
        if session.persona_name:
            session_name = f"{session.persona_name}와의 데이트"
            print(f"📝 [CREATE_SESSION] Persona 정보 포함: {session.persona_name}")
        
        # 클라이언트에서 전송한 user_id가 있으면 사용, 없으면 생성된 ID 사용
        final_user_id = session.user_id if session.user_id else current_user_id
        
        # 페르소나 정보를 포함하여 세션 생성
        session_id = await create_chat_session_with_persona(
            final_user_id, 
            session_name,
            {
                "persona_name": session.persona_name,
                "persona_age": session.persona_age,
                "persona_mbti": session.persona_mbti,
                "persona_job": session.persona_job,
                "persona_personality": session.persona_personality,
                "persona_image": session.persona_image
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
        raise HTTPException(status_code=503, detail="MongoDB not available")
    
    try:
        messages = await get_session_messages(session_id, limit)
        return {"ok": True, "messages": messages}
    except Exception as e:
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
    
    # 인증 토큰 확인 (선택적)
    current_user_id = None
    try:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
            from auth import get_current_user
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
    
    # MongoDB 연결 실패 시 임시 응답 (OpenAI 사용)
    if not MONGODB_AVAILABLE:
        print("⚠️ [SEND_MESSAGE] MongoDB not available - OpenAI 응답만 생성")
        import uuid
        temp_message_id = str(uuid.uuid4())
        
        # OpenAI로 AI 응답 생성
        ai_response = await generate_ai_response(message.content, session_id)
        
        print(f"✅ [SEND_MESSAGE] 임시 응답 생성: {ai_response[:50]}...")
        return {
            "ok": True,
            "user_message_id": temp_message_id,
            "ai_message_id": str(uuid.uuid4()),
            "ai_response": ai_response
        }
    
    try:
        # 사용자 메시지 저장
        print(f"🔄 [SEND_MESSAGE] 사용자 메시지 저장 시작...")
        
        # 클라이언트에서 전송한 user_id가 있으면 사용, 없으면 생성된 ID 사용
        final_user_id = message.user_id if message.user_id else current_user_id
        
        message_id = await save_message(
            final_user_id, 
            session_id, 
            message.role, 
            message.content
        )
        
        if not message_id:
            print("❌ [SEND_MESSAGE] 사용자 메시지 저장 실패")
            raise HTTPException(status_code=500, detail="Failed to save message")
        
        print(f"✅ [SEND_MESSAGE] 사용자 메시지 저장 성공: {message_id}")
        
        # OpenAI GPT-4o-mini로 AI 응답 생성
        ai_response = await generate_ai_response(message.content, session_id)
        print(f"🤖 [SEND_MESSAGE] AI 응답 생성: {ai_response[:50]}...")
        
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
        db_success = await init_database()
        if not db_success:
            print("⚠️ MongoDB 초기화 실패 - 일부 기능이 제한될 수 있습니다")
        else:
            print("✅ MongoDB 초기화 완료")
    else:
        print("⚠️ MongoDB 모듈 없음 - 채팅 기능이 제한됩니다")
    
    # 음성 분석 모델 로드 (백그라운드에서)
    if VOICE_ANALYSIS_AVAILABLE:
        try:
            print("🔄 음성 분석 모델 로딩 시작...")
            await asyncio.to_thread(preload_models)
            print("✅ 음성 분석 모델 로딩 완료")
        except Exception as e:
            print(f"⚠️ 음성 분석 모델 로딩 실패: {e}")
    else:
        print("⚠️ 음성 분석 모듈 없음 - 음성 분석 기능이 제한됩니다")

# WebSocket 연결 관리
_active_websockets = set()

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
        cv2.destroyAllWindows()
        print("✅ OpenCV 윈도우 정리 완료")
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
        cv2.destroyAllWindows()
        print("✅ OpenCV 윈도우 정리 완료")
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
    Pipeline에서 현재 지표를 읽어 dict로 반환.
    메서드/필드 이름이 프로젝트마다 달 수 있으니 여러 후보를 시도.
    실패 시 _fake_scores()로 폴백.
    """
    global _pipeline
    if not _pipeline:
        print("⚠️ 파이프라인이 없음 - 더미 데이터 반환")
        d = _fake_scores()
        d["simulation_mode"] = True
        d["message"] = "파이프라인이 초기화되지 않았습니다."
        d["data_source"] = "no_pipeline"
        return d

    # Pipeline의 latest() 메서드 시도
    try:
        if hasattr(_pipeline, "latest"):
            d = _pipeline.latest()
            if isinstance(d, dict) and d:
                # 시뮬레이션 모드인지 확인하여 메타데이터 추가
                if _pipeline.simulation_mode:
                    d["simulation_mode"] = True
                    d["message"] = "시뮬레이션 모드로 동작 중입니다. (클라이언트 카메라 대기)"
                    d["data_source"] = "simulation"
                    d["debug_info"] = {
                        "pipeline_mode": "simulation",
                        "camera_connected": False,
                        "reason": "클라이언트에서 카메라를 시작해주세요"
                    }
                else:
                    d["simulation_mode"] = False
                    d["message"] = "클라이언트 카메라 프레임 분석 중입니다."
                    d["data_source"] = "client_frame"
                    d["debug_info"] = {
                        "pipeline_mode": "real_camera",
                        "camera_connected": True,
                        "reason": "클라이언트 카메라 프레임 처리 중"
                    }
                
                # 파이프라인 상태 정보 추가
                d["pipeline_running"] = _pipeline.is_running
                d["pipeline_interval"] = _pipeline.process_interval_sec
                
                return _normalize_dict(d)
    except Exception as e:
        print(f"⚠️ WebSocket 텔레메트리 가져오기 실패: {e}")
        pass

    # 폴백: 더미 데이터
    print("⚠️ 파이프라인 데이터 가져오기 실패 - 더미 데이터 반환")
    d = _fake_scores()
    d["simulation_mode"] = True
    d["message"] = "파이프라인 오류로 더미 데이터를 사용합니다."
    d["data_source"] = "fallback"
    return d

def _ensure_pipeline_started():
    """파이프라인이 start 가능한 경우 보장 시작."""
    global _pipeline
    if _pipeline:
        try:
            # 보편적인 running 플래그 이름들
            running_flags = ("running", "is_running", "started")
            is_running = any(getattr(_pipeline, f, False) for f in running_flags if hasattr(_pipeline, f))
            if not is_running and hasattr(_pipeline, "start"):
                _pipeline.start()
                print("✅ Pipeline started via ensure method")
        except Exception as e:
            print(f"⚠️ Failed to start pipeline: {e}")
            pass

def _current_interval() -> float:
    """전송 주기 결정: pipeline.process_interval_sec > server.process_interval_sec > 1.0"""
    iv = getattr(_pipeline, "process_interval_sec", None) if _pipeline else None
    if isinstance(iv, (int, float)) and iv > 0:
        return float(iv)
    return float(process_interval_sec or 1.0)

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
async def check_user_calibration(request: UserCheckRequest):
    """사용자 캘리브레이션 상태 확인 (Supabase users 테이블의 cam_calibration 필드 확인)"""
    try:
        if MONGODB_AVAILABLE:
            # MongoDB에서 사용자 정보 확인
            user = await get_user_by_email(request.email)
            if user:
                cam_calibration = user.get('cam_calibration', False)
                return {
                    "has_calibration": cam_calibration,
                    "cam_calibration": cam_calibration,
                    "user_id": str(user.get('_id')),
                    "message": "사용자 캘리브레이션 상태 확인 완료"
                }
        
        # MongoDB가 없거나 사용자를 찾을 수 없는 경우
        return {
            "has_calibration": False,
            "cam_calibration": False,
            "message": "사용자 정보를 찾을 수 없습니다"
        }
    except Exception as e:
        print(f"사용자 상태 확인 오류: {e}")
        return {
            "has_calibration": False,
            "cam_calibration": False,
            "message": "상태 확인 중 오류 발생"
        }

@app.post("/api/user/update-calibration")
async def update_user_calibration_status(request: UserCalibrationUpdateRequest):
    """Supabase users 테이블의 cam_calibration 필드 업데이트"""
    try:
        if MONGODB_AVAILABLE:
            # MongoDB에서 사용자 정보 업데이트
            from bson import ObjectId
            
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
async def save_calibration(request: CalibrationRequest):
    """캘리브레이션 데이터를 Supabase에 저장"""
    try:
        if MONGODB_AVAILABLE:
            from bson import ObjectId
            
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
        
        # 임시 AI 응답 (실제로는 AI 모델 호출)
        last_message = messages[-1]["parts"][0]["text"] if messages else ""
        
        ai_response = f"안녕하세요! '{last_message}'에 대해 답변드리겠습니다. 현재는 테스트 모드입니다."
        
        return {
            "response": ai_response,
            "message": "AI 응답 생성 완료"
        }
    except Exception as e:
        print(f"AI 채팅 오류: {e}")
        return {
            "response": "죄송합니다. 현재 응답을 생성할 수 없습니다.",
            "message": "오류 발생"
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

# ====== 페르소나 정보 로드 함수 ======

async def load_persona_context(session_id: str) -> str:
    "세션 정보 또는 JSON 파일에서 페르소나 정보를 로드하여 컨텍스트 생성"
    try:
        # 기본 페르소나 이름 (세션에서 가져오거나 기본값)
        persona_name = ""
        
        # 세션에서 페르소나 정보 가져오기 시도
        if MONGODB_AVAILABLE:
            try:
                from database import get_session_info
                session_info = await get_session_info(session_id)
                if session_info and session_info.get('persona_name'):
                    persona_name = session_info.get('persona_name')
                    print(f" [PERSONA] 세션에서 페르소나 정보 가져옴: {persona_name}")
            except Exception as e:
                print(f" [PERSONA] 세션 정보 가져오기 실패: {e}")
        
        # JSON 파일에서 상세 페르소나 정보 로드
        persona_file = f"personas/{persona_name}.json"
        
        if os.path.exists(persona_file):
            print(f" [PERSONA] JSON 파일에서 페르소나 로드: {persona_file}")
            
            with open(persona_file, 'r', encoding='utf-8') as f:
                persona_data = json.load(f)
            
            # 상세한 페르소나 컨텍스트 생성
            personality_traits = ", ".join(persona_data.get('personality_traits', []))
            hobbies = ", ".join(persona_data.get('lifestyle_hobbies', []))
            interests = ", ".join(persona_data.get('activities_interests', []))
            music_prefs = ", ".join(persona_data.get('cultural_preferences', {}).get('music', []))
            
            persona_context = f"""
당신은 {persona_data.get('name', '')}입니다.

기본 정보:
- 이름: {persona_data.get('name', '')}
- 나이: {2025 - int(persona_data.get('birth_date', '1997-09-15').split('-')[0])}세 (1997년생)
- 거주지: {persona_data.get('residence', {}).get('city', '')} {persona_data.get('residence', {}).get('district', '')}
- 직업: {persona_data.get('job', '')}
- MBTI: {persona_data.get('mbti', '')}

성격 특성:
{personality_traits}

취미와 관심사:
- 라이프스타일: {hobbies}
- 활동: {interests}
- 음악 취향: {music_prefs}
- 미디어: {", ".join(persona_data.get('media_preferences', {}).get('netflix', []))}

좋아하는 것들:
- 연애 스타일: {", ".join(persona_data.get('romance_preferences', {}).get('likes', []))}
- 데이트 활동: {", ".join(persona_data.get('romance_preferences', {}).get('date_activities', []))}

싫어하는 것들:
- {", ".join(persona_data.get('romance_preferences', {}).get('dislikes', []))}
- 관심 없는 분야: {", ".join(persona_data.get('low_interest_domains', [])[:3])} 등
"""
            
            print(f" [PERSONA] 상세 페르소나 컨텍스트 생성 완료: {len(persona_context)}자")
            return persona_context
            
        else:
            print(f"[PERSONA] JSON 파일 없음: {persona_file}")
            # 기본 설정
            return """
당신은 AI 파트너입니다.

기본 정보:
- 이름: 
- 나이: 
- 거주지: 
- 직업: 
- MBTI: 

성격 특성:
- 

대화 스타일:
- 존댓말 사용
- 상대방 이야기에 관심과 공감

"""
            
    except Exception as e:
        print(f" [PERSONA] 페르소나 정보 로드 실패: {e}")
        return "당신은 친근하고 따뜻한 AI 파트너입니다."

# ====== AI 응답 생성 함수 ======

async def generate_ai_response(user_message: str, session_id: str) -> str:
    "OpenAI GPT-4o-mini를 사용하여 AI 응답 생성"
    try:
        if not OPENAI_API_KEY:
            print(" [AI_RESPONSE] OpenAI API 키가 없음 - 더미 응답 사용")
            return f"안녕하세요! '{user_message}'에 대해 답변드리겠습니다. (OpenAI API 키 필요)"
        
        # 페르소나 정보 로드 (JSON 파일에서)
        persona_context = await load_persona_context(session_id)
        
        # 시스템 프롬프트 설정
        system_prompt = f"""{persona_context}

대화 규칙:
1. 응답은 1-2문장으로 간결하게 유지
2. 첫 데이트 상황임을 고려하여 편안하고 조용한 대화
3. 이모지는 삭제


상황: 지금은 카페에서의 첫 데이트 중이며, 상대방을 편안하게 만들고 즐거운 대화를 나누는 것이 목표입니다."""

        print(f" [AI_RESPONSE] OpenAI API 호출 시작...")
        
        # OpenAI API 호출
        from openai import OpenAI
        client = OpenAI(api_key=OPENAI_API_KEY)
        
        response = await asyncio.to_thread(
            client.chat.completions.create,
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message}
            ],
            max_tokens=150,
            temperature=0.8,
            frequency_penalty=0.3,
            presence_penalty=0.3
        )
        
        ai_response = response.choices[0].message.content.strip()
        print(f" [AI_RESPONSE] OpenAI 응답 생성 완료: {len(ai_response)}자")
        
        return ai_response
        
    except Exception as e:
        print(f" [AI_RESPONSE] OpenAI API 호출 실패: {e}")
        # 폴백 응답
        fallback_responses = [
            "흥미로운 이야기네요! 더 자세히 들려주세요 ",
            "정말 좋은 생각이에요! 어떤 기분이셨나요?",
            "와, 그런 일이 있으셨군요! 더 들려주세요.",
            "재미있네요! 그때 어떤 느낌이었나요?",
            "좋은 말씀이에요! 다른 이야기도 들려주세요."
        ]
        return fallback_responses[hash(user_message) % len(fallback_responses)]

# ====== 음성 분석 API 엔드포인트 ======

@app.post("/api/voice/analyze")
async def analyze_voice(audio: UploadFile = File(...)):
    """음성 파일 분석 및 감정/톤 분석"""
    print(f"🎤 [VOICE_ANALYZE] 음성 분석 요청 받음 - 파일명: {audio.filename}")
    
    if not VOICE_ANALYSIS_AVAILABLE:
        print("❌ [VOICE_ANALYZE] 음성 분석 모듈 없음")
        return {
            "success": False,
            "error": "음성 분석 기능이 비활성화되어 있습니다.",
            "analysis": None
        }
    
    try:
        # 오디오 파일 읽기
        audio_data = await audio.read()
        print(f"📊 [VOICE_ANALYZE] 오디오 데이터 크기: {len(audio_data)} bytes")
        
        # 오디오 데이터를 numpy 배열로 변환
        import io
        import torchaudio
        
        # WebM 또는 WAV 파일 처리
        audio_bytes = io.BytesIO(audio_data)
        
        try:
            # WebM 파일을 WAV로 변환 (ffmpeg 사용)
            import subprocess
            import tempfile
            
            # 임시 파일 생성
            with tempfile.NamedTemporaryFile(suffix='.webm', delete=False) as temp_webm:
                temp_webm.write(audio_data)
                temp_webm_path = temp_webm.name
            
            with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as temp_wav:
                temp_wav_path = temp_wav.name
            
            # ffmpeg로 WebM → WAV 변환
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
            
            # 임시 파일 정리
            os.unlink(temp_webm_path)
            os.unlink(temp_wav_path)
            
        except Exception as e:
            print(f"❌ [VOICE_ANALYZE] 오디오 전처리 실패: {e}")
            return {
                "success": False,
                "error": f"오디오 파일 처리 실패: {str(e)}",
                "analysis": None
            }
        
        # 음성 분석 수행
        print("🔄 [VOICE_ANALYZE] 음성 분석 시작...")
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
            "message": "음성 분석 완료"
        }
        
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
        # rate는 클라이언트에서 처리 (SSML 방지)
        
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
        "redirect_url": f"/dys_studio/studio_calibration.html?user_id={request.user_id}&email={request.email}&session_ended=true&session_id={request.session_id}&skip_calibration=true"
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
sys.path.append(os.path.join(os.path.dirname(__file__), 'dys_studio'))

try:
    from dys_studio.expression_analyzer import initialize_expression_analyzer, analyze_expression_from_image, get_expression_score_from_result
    EXPRESSION_ANALYZER_AVAILABLE = True
    print("✅ 표정 분석기 모듈 로드 성공")
except ImportError as e:
    EXPRESSION_ANALYZER_AVAILABLE = False
    print(f"⚠️ 표정 분석기 모듈 로드 실패: {e}")

@app.post("/api/expression/initialize")
async def initialize_expression_analyzer_api():
    """표정 분석기를 초기화합니다."""
    try:
        if not EXPRESSION_ANALYZER_AVAILABLE:
            return {"success": False, "error": "Expression analyzer not available"}
        
        success = initialize_expression_analyzer()
        return {"success": success}
    except Exception as e:
        print(f"❌ 표정 분석기 초기화 실패: {e}")
        return {"success": False, "error": str(e)}

@app.post("/api/expression/analyze")
async def analyze_expression_api(request: Request):
    """이미지에서 표정을 분석합니다."""
    try:
        if not EXPRESSION_ANALYZER_AVAILABLE:
            return {"success": False, "error": "Expression analyzer not available"}
        
        data = await request.json()
        image_data = data.get('image_data')
        
        if not image_data:
            return {"success": False, "error": "No image data provided"}
        
        # 표정 분석
        result = analyze_expression_from_image(image_data)
        
        # 점수 변환
        if result.get('success', False):
            score_result = get_expression_score_from_result(result)
            result['score'] = score_result
        
        return result
    except Exception as e:
        print(f"❌ 표정 분석 실패: {e}")
        return {"success": False, "error": str(e)}

