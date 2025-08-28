#!/usr/bin/env python3
"""
통합 서버 시작 스크립트
- 메인 서버와 WebSocket 서버를 하나의 프로세스에서 실행
- 환경 설정 및 모델 다운로드
- 프로세스 관리 및 모니터링
"""

import os
import sys
import asyncio
import signal
import logging
from pathlib import Path

# 로깅 설정
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def download_model_if_not_exists():
    """필요한 모델 파일 다운로드"""
    model_path = "src/backend/models/ml_models/data/model.pth"
    model_url = "https://storage.googleapis.com/dys-model-storage/model.pth"

    if not os.path.exists(model_path):
        logger.info(f"'{model_path}'를 찾을 수 없습니다. GCS에서 모델을 다운로드합니다...")
        os.makedirs(os.path.dirname(model_path), exist_ok=True)
        
        try:
            import requests
            response = requests.get(model_url, stream=True)
            response.raise_for_status()
            
            with open(model_path, "wb") as f:
                for chunk in response.iter_content(chunk_size=8192):
                    f.write(chunk)
            logger.info("✅ 모델 다운로드 완료.")
        except Exception as e:
            logger.error(f"❌ 모델 다운로드 실패: {e}")
            logger.warning("⚠️ 서버는 계속 실행되지만 일부 기능이 제한될 수 있습니다.")
    else:
        logger.info("✅ 모델이 이미 존재합니다.")

def check_environment():
    """환경 설정 확인"""
    logger.info("🔍 환경 설정 확인 중...")
    
    # .env 파일 확인
    env_file = Path(".env")
    if env_file.exists():
        logger.info("✅ .env 파일 발견")
    else:
        logger.warning("⚠️ .env 파일이 없습니다. 환경변수를 직접 사용합니다.")
    
    # 필수 디렉토리 확인
    required_dirs = [
        "src/frontend/pages",
        "src/frontend/assets/js",
        "src/frontend/assets/styles",
        "src/frontend/components/popups"
    ]
    
    for dir_path in required_dirs:
        if os.path.exists(dir_path):
            logger.info(f"✅ 디렉토리 확인: {dir_path}")
        else:
            logger.warning(f"⚠️ 디렉토리 없음: {dir_path}")

def initialize_mediapipe():
    """MediaPipe 분석기 초기화"""
    try:
        logger.info("🎭 MediaPipe 분석기 초기화 중...")
        
        # src 디렉토리를 Python 경로에 추가
        src_path = Path(__file__).parent.parent.parent / "src"
        sys.path.insert(0, str(src_path))
        
        from backend.services.analysis.mediapipe_analyzer import mediapipe_analyzer
        
        if mediapipe_analyzer.initialize():
            logger.info("✅ MediaPipe 분석기 초기화 완료")
        else:
            logger.warning("⚠️ MediaPipe 분석기 초기화 실패")
            
    except ImportError as e:
        logger.warning(f"⚠️ MediaPipe 분석기 모듈을 찾을 수 없습니다: {e}")
    except Exception as e:
        logger.error(f"❌ MediaPipe 분석기 초기화 오류: {e}")

async def initialize_vector_service():
    """벡터 서비스 초기화"""
    try:
        logger.info("🔗 벡터 서비스 초기화 중...")
        
        # src 디렉토리를 Python 경로에 추가
        src_path = Path(__file__).parent.parent.parent / "src"
        sys.path.insert(0, str(src_path))
        
        from backend.services.vector_service import vector_service
        
        if await vector_service.initialize():
            logger.info("✅ 벡터 서비스 초기화 완료")
        else:
            logger.warning("⚠️ 벡터 서비스 초기화 실패")
            
    except ImportError as e:
        logger.warning(f"⚠️ 벡터 서비스 모듈을 찾을 수 없습니다: {e}")
    except Exception as e:
        logger.error(f"❌ 벡터 서비스 초기화 오류: {e}")

async def run_integrated_server():
    """통합 서버 실행"""
    try:
        # src 디렉토리를 Python 경로에 추가
        src_path = Path(__file__).parent.parent.parent / "src"
        sys.path.insert(0, str(src_path))
        
        # 벡터 서비스 초기화 (선택적)
        try:
            await initialize_vector_service()
        except Exception as e:
            logger.warning(f"⚠️ 벡터 서비스 초기화 실패 (서버는 계속 실행됩니다): {e}")
        
        # 통합 서버 매니저 import 및 실행
        from backend.core.server_manager import IntegratedServerManager
        
        manager = IntegratedServerManager()
        await manager.run_servers()
        
    except ImportError as e:
        logger.error(f"❌ 서버 매니저 import 실패: {e}")
        raise
    except Exception as e:
        logger.error(f"❌ 서버 실행 실패: {e}")
        raise

def signal_handler(signum, frame):
    """시그널 핸들러"""
    logger.info(f"🛑 시그널 {signum} 수신, 종료 시작...")
    sys.exit(0)

def main():
    """메인 함수"""
    logger.info("🚀 통합 서버 시작 스크립트 실행")
    
    # 시그널 핸들러 등록
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    try:
        # 환경 설정 확인
        check_environment()
        
        # 모델 다운로드
        download_model_if_not_exists()
        
        # MediaPipe 분석기 초기화
        initialize_mediapipe()
        
        # .env 파일 로드
        from dotenv import load_dotenv
        load_dotenv()
        
        logger.info("🎉 모든 준비 완료! 서버 시작...")
        
        # 통합 서버 실행 (벡터 서비스 초기화 포함)
        asyncio.run(run_integrated_server())
        
    except KeyboardInterrupt:
        logger.info("🛑 사용자에 의해 중단되었습니다.")
    except Exception as e:
        logger.error(f"❌ 예기치 않은 오류: {e}")
        sys.exit(1)
    finally:
        logger.info("👋 통합 서버 종료")

if __name__ == "__main__":
    main()
