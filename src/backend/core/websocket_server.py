#!/usr/bin/env python3
"""
WebSocket 전용 서버
- 랜드마크 데이터 수신 및 처리
- 클라이언트와의 실시간 통신
- MediaPipe 분석기 통합
"""

import asyncio
import json
import time
import logging
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

# MediaPipe 분석기 import
try:
    from ..services.analysis.mediapipe_analyzer import mediapipe_analyzer
    MEDIAPIPE_AVAILABLE = True
    print("✅ MediaPipe 분석기 로드됨")
except ImportError as e:
    print(f"⚠️ MediaPipe 분석기 로드 실패: {e}")
    MEDIAPIPE_AVAILABLE = False

# 로깅 설정
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# WebSocket 연결 관리
class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"🔗 WebSocket 연결 수락: {websocket.client.host}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        logger.info(f"🔌 WebSocket 연결 종료: {websocket.client.host}")

    async def send_personal_message(self, message: str, websocket: WebSocket):
        await websocket.send_text(message)

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except Exception as e:
                logger.error(f"브로드캐스트 실패: {e}")
                # 연결이 끊어진 경우 제거
                if connection in self.active_connections:
                    self.active_connections.remove(connection)

manager = ConnectionManager()

# FastAPI 앱 생성
app = FastAPI(title="WebSocket Server", version="1.0.0")

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"message": "WebSocket Server", "active_connections": len(manager.active_connections)}

@app.get("/health")
async def health():
    return {"status": "healthy", "active_connections": len(manager.active_connections)}

@app.get("/api/mediapipe/status")
async def get_mediapipe_status():
    """MediaPipe 분석기 상태를 반환합니다."""
    try:
        if not MEDIAPIPE_AVAILABLE:
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
        logger.error(f"❌ [MEDIAPIPE] 상태 확인 실패: {e}")
        return {
            "success": False,
            "error": str(e)
        }

@app.post("/api/mediapipe/initialize")
async def initialize_mediapipe():
    """MediaPipe 분석기를 초기화합니다."""
    try:
        if not MEDIAPIPE_AVAILABLE:
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
        logger.error(f"❌ [MEDIAPIPE] 초기화 실패: {e}")
        return {
            "success": False,
            "error": str(e)
        }

@app.get("/api/mediapipe/summary")
async def get_mediapipe_summary():
    """MediaPipe 분석 결과 요약을 반환합니다."""
    try:
        if not MEDIAPIPE_AVAILABLE or not mediapipe_analyzer.is_initialized:
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
        logger.error(f"❌ [MEDIAPIPE] 요약 조회 실패: {e}")
        return {
            "success": False,
            "error": str(e)
        }

@app.websocket("/ws/landmarks")
async def websocket_landmarks(websocket: WebSocket):
    await manager.connect(websocket)
    
    # MediaPipe 분석기 초기화
    if MEDIAPIPE_AVAILABLE and not mediapipe_analyzer.is_initialized:
        mediapipe_analyzer.initialize()
    
    try:
        while True:
            # 클라이언트로부터 데이터 수신
            data = await websocket.receive_json()
            
            # 랜드마크 배치 데이터 처리
            if data.get("type") == "landmarks_batch":
                frames = data.get("frames", [])
                fps = data.get("fps", 10)
                timestamp = data.get("ts", time.time())
                
                # 로그 빈도 조절 (과부하 방지)
                if len(frames) > 0:
                    logger.info(f"📊 랜드마크 배치 수신: {len(frames)}개 프레임, FPS: {fps}")
                
                # MediaPipe 분석 수행
                analysis_results = []
                if MEDIAPIPE_AVAILABLE and mediapipe_analyzer.is_initialized:
                    for frame in frames:
                        face_landmarks = frame.get("face_landmarks", [])
                        pose_landmarks = frame.get("pose_landmarks", [])
                        
                        if face_landmarks or pose_landmarks:
                            result = mediapipe_analyzer.analyze_landmarks(face_landmarks, pose_landmarks)
                            if result:
                                analysis_results.append({
                                    "timestamp": result.timestamp,
                                    "scores": result.scores,
                                    "metrics": result.metrics
                                })
                
                # 응답 전송 (분석 결과 포함)
                response = {
                    "ok": True,
                    "message": "랜드마크 데이터 분석 완료",
                    "frames_processed": len(frames),
                    "analysis_results": analysis_results,
                    "fps": fps,
                    "timestamp": timestamp,
                    "server_time": time.time()
                }
                
                await manager.send_personal_message(json.dumps(response), websocket)
                
            elif data.get("type") == "ping":
                # 핑/퐁 응답
                await manager.send_personal_message(json.dumps({
                    "type": "pong",
                    "timestamp": time.time()
                }), websocket)
                
            else:
                # 기타 메시지 처리
                logger.info(f"📨 메시지 수신: {data.get('type', 'unknown')}")
                await manager.send_personal_message(json.dumps({
                    "ok": True,
                    "message": "메시지 수신됨",
                    "data": data
                }), websocket)
                
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"❌ WebSocket 오류: {e}")
        manager.disconnect(websocket)

@app.websocket("/ws/telemetry")
async def websocket_telemetry(websocket: WebSocket):
    await manager.connect(websocket)
    
    try:
        while True:
            # 텔레메트리 데이터 전송 (시뮬레이션)
            telemetry_data = {
                "ok": True,
                "simulation_mode": True,
                "message": "WebSocket 서버에서 텔레메트리 데이터 전송",
                "timestamp": time.time(),
                "active_connections": len(manager.active_connections)
            }
            
            await manager.send_personal_message(json.dumps(telemetry_data), websocket)
            await asyncio.sleep(2)  # 2초마다 전송
            
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"❌ 텔레메트리 WebSocket 오류: {e}")
        manager.disconnect(websocket)

@app.websocket("/ws/analysis")
async def websocket_analysis(websocket: WebSocket):
    """실시간 분석 결과 전송용 웹소켓"""
    await manager.connect(websocket)
    
    # MediaPipe 분석기 초기화
    if MEDIAPIPE_AVAILABLE and not mediapipe_analyzer.is_initialized:
        mediapipe_analyzer.initialize()
    
    try:
        while True:
            # 클라이언트로부터 분석 요청 수신
            data = await websocket.receive_json()
            
            if data.get("type") == "get_analysis_summary":
                # 최근 분석 결과 요약 전송
                if MEDIAPIPE_AVAILABLE and mediapipe_analyzer.is_initialized:
                    summary = mediapipe_analyzer.get_analysis_summary()
                    response = {
                        "ok": True,
                        "type": "analysis_summary",
                        "summary": summary,
                        "timestamp": time.time()
                    }
                else:
                    response = {
                        "ok": False,
                        "type": "analysis_summary",
                        "error": "MediaPipe 분석기를 사용할 수 없습니다",
                        "timestamp": time.time()
                    }
                
                await manager.send_personal_message(json.dumps(response), websocket)
                
            elif data.get("type") == "start_realtime_analysis":
                # 실시간 분석 시작
                response = {
                    "ok": True,
                    "type": "realtime_analysis_started",
                    "message": "실시간 분석이 시작되었습니다",
                    "timestamp": time.time()
                }
                await manager.send_personal_message(json.dumps(response), websocket)
                
            elif data.get("type") == "stop_realtime_analysis":
                # 실시간 분석 중지
                response = {
                    "ok": True,
                    "type": "realtime_analysis_stopped",
                    "message": "실시간 분석이 중지되었습니다",
                    "timestamp": time.time()
                }
                await manager.send_personal_message(json.dumps(response), websocket)
                
            else:
                # 기타 메시지 처리
                response = {
                    "ok": True,
                    "message": "분석 웹소켓 메시지 수신됨",
                    "data": data,
                    "timestamp": time.time()
                }
                await manager.send_personal_message(json.dumps(response), websocket)
                
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"❌ 분석 WebSocket 오류: {e}")
        manager.disconnect(websocket)

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="WebSocket Server")
    parser.add_argument("--host", default="0.0.0.0", help="호스트 주소")
    parser.add_argument("--port", type=int, default=8001, help="포트 번호")
    parser.add_argument("--reload", action="store_true", help="자동 리로드")
    
    args = parser.parse_args()
    
    logger.info(f"🚀 WebSocket 서버 시작 중... (포트: {args.port})")
    
    uvicorn.run(
        "src.backend.core.websocket_server:app",
        host=args.host,
        port=args.port,
        reload=args.reload,
        log_level="info"
    )
