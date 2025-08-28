#!/usr/bin/env python3
"""
통합 서버 매니저
- 메인 서버와 WebSocket 서버를 하나의 프로세스에서 관리
- MongoDB 연결 관리
- 프로세스 모니터링 및 정리
"""

import os
import sys
import time
import signal
import asyncio
import logging
from pathlib import Path
from typing import Optional

# 로깅 설정
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class IntegratedServerManager:
    def __init__(self):
        self.main_server_task: Optional[asyncio.Task] = None
        self.websocket_server_task: Optional[asyncio.Task] = None
        self.shutdown_event = asyncio.Event()
        
    async def start_main_server(self):
        """메인 서버 시작 (포트 8000)"""
        try:
            from backend.core.main_server import app
            import uvicorn
            
            config = uvicorn.Config(
                app=app,
                host="0.0.0.0",
                port=8000,
                log_level="info",
                access_log=True
            )
            
            server = uvicorn.Server(config)
            logger.info("🚀 메인 서버 시작 중... (포트: 8000)")
            await server.serve()
            
        except Exception as e:
            logger.error(f"❌ 메인 서버 시작 실패: {e}")
            raise
    
    async def start_websocket_server(self):
        """WebSocket 서버 시작 (포트 8001)"""
        try:
            from backend.core.websocket_server import app as ws_app
            import uvicorn
            
            config = uvicorn.Config(
                app=ws_app,
                host="0.0.0.0",
                port=8001,
                log_level="info",
                access_log=True
            )
            
            server = uvicorn.Server(config)
            logger.info("🔗 WebSocket 서버 시작 중... (포트: 8001)")
            await server.serve()
            
        except Exception as e:
            logger.error(f"❌ WebSocket 서버 시작 실패: {e}")
            raise
    
    async def run_servers(self):
        """두 서버를 동시에 실행"""
        try:
            # 두 서버를 동시에 시작
            self.main_server_task = asyncio.create_task(self.start_main_server())
            self.websocket_server_task = asyncio.create_task(self.start_websocket_server())
            
            logger.info("🎉 모든 서버가 시작되었습니다!")
            logger.info("📊 메인 서버: http://localhost:8000")
            logger.info("🔗 WebSocket 서버: ws://localhost:8001")
            logger.info("⏹️  종료하려면 Ctrl+C를 누르세요.")
            
            # 종료 이벤트 대기
            await self.shutdown_event.wait()
            
        except Exception as e:
            logger.error(f"❌ 서버 실행 중 오류: {e}")
            raise
        finally:
            await self.cleanup()
    
    async def cleanup(self):
        """리소스 정리"""
        logger.info("🧹 서버 정리 중...")
        
        # 태스크 취소
        if self.main_server_task:
            self.main_server_task.cancel()
        if self.websocket_server_task:
            self.websocket_server_task.cancel()
        
        # 취소된 태스크들 대기
        if self.main_server_task:
            try:
                await self.main_server_task
            except asyncio.CancelledError:
                pass
        
        if self.websocket_server_task:
            try:
                await self.websocket_server_task
            except asyncio.CancelledError:
                pass
        
        logger.info("✅ 서버 정리 완료")
    
    def signal_handler(self, signum, frame):
        """시그널 핸들러"""
        logger.info(f"🛑 시그널 {signum} 수신, 종료 시작...")
        self.shutdown_event.set()
    
    def run(self):
        """메인 실행 함수"""
        # 시그널 핸들러 등록
        signal.signal(signal.SIGINT, self.signal_handler)
        signal.signal(signal.SIGTERM, self.signal_handler)
        
        try:
            # 이벤트 루프 실행
            asyncio.run(self.run_servers())
        except KeyboardInterrupt:
            logger.info("🛑 사용자에 의해 중단되었습니다.")
        except Exception as e:
            logger.error(f"❌ 예기치 않은 오류: {e}")
        finally:
            logger.info("👋 서버 매니저 종료")

if __name__ == "__main__":
    manager = IntegratedServerManager()
    manager.run()
