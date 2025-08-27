#!/usr/bin/env python3
"""
DYS Backend - 간단한 시작 스크립트
"""

import subprocess
import sys
import os

def main():
    """메인 함수"""
    print("🚀 DYS Backend 시작...")
    
    # Python 버전 확인
    if sys.version_info < (3, 8):
        print("❌ Python 3.8 이상이 필요합니다.")
        sys.exit(1)
    
    # requirements.txt 설치 확인
    try:
        import fastapi
        import uvicorn
        print("✅ 필수 패키지 확인 완료")
    except ImportError:
        print("📦 필수 패키지 설치 중...")
        subprocess.run([sys.executable, "-m", "pip", "install", "-r", "requirements.txt"])
    
    # .env 파일 확인
    if not os.path.exists(".env"):
        print("⚠️ .env 파일이 없습니다. 기본 설정으로 실행합니다.")
    
    # 통합 서버 실행
    try:
        from deployment.scripts.start_integrated import main as start_server
        start_server()
    except Exception as e:
        print(f"❌ 서버 시작 실패: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
