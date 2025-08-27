#!/usr/bin/env python3
"""
DYS Backend - 메인 진입점
통합 서버 시작 스크립트
"""

import os
import sys
from pathlib import Path

# 프로젝트 루트를 Python 경로에 추가
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

# deployment/scripts/start_integrated.py 실행
if __name__ == "__main__":
    try:
        # start_integrated.py의 main 함수 실행
        from deployment.scripts.start_integrated import main
        main()
    except ImportError as e:
        print(f"❌ 모듈 import 실패: {e}")
        print("💡 해결 방법:")
        print("   1. requirements.txt 설치: pip install -r requirements.txt")
        print("   2. .env 파일 생성 및 설정")
        print("   3. Python 3.8+ 버전 확인")
        sys.exit(1)
    except Exception as e:
        print(f"❌ 서버 시작 실패: {e}")
        sys.exit(1)
