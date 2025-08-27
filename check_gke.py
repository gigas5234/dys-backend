#!/usr/bin/env python3
"""
GKE 환경 호환성 체크 스크립트
배포 전에 모든 필요한 요소들이 제대로 설정되어 있는지 확인
"""

import os
import sys
from pathlib import Path

def check_python_version():
    """Python 버전 확인"""
    print("🐍 Python 버전 확인...")
    version = sys.version_info
    if version.major == 3 and version.minor >= 8:
        print(f"✅ Python {version.major}.{version.minor}.{version.micro} - OK")
        return True
    else:
        print(f"❌ Python {version.major}.{version.minor}.{version.micro} - Python 3.8+ 필요")
        return False

def check_required_files():
    """필수 파일 확인"""
    print("\n📁 필수 파일 확인...")
    required_files = [
        "start.py",
        "main.py",
        "requirements.txt",
        "src/backend/core/main_server.py",
        "src/backend/core/websocket_server.py",
        "src/backend/core/server_manager.py",
        "src/frontend/pages/studio_calibration.html"
    ]
    
    all_exist = True
    for file_path in required_files:
        if os.path.exists(file_path):
            print(f"✅ {file_path}")
        else:
            print(f"❌ {file_path} - 없음")
            all_exist = False
    
    return all_exist

def check_required_directories():
    """필수 디렉토리 확인"""
    print("\n📂 필수 디렉토리 확인...")
    required_dirs = [
        "src/backend",
        "src/frontend",
        "src/backend/core",
        "src/backend/services",
        "src/backend/models",
        "src/frontend/pages",
        "src/frontend/assets",
        "deployment/k8s",
        "deployment/docker",
        "logs"
    ]
    
    all_exist = True
    for dir_path in required_dirs:
        if os.path.exists(dir_path):
            print(f"✅ {dir_path}")
        else:
            print(f"❌ {dir_path} - 없음")
            all_exist = False
    
    return all_exist

def check_imports():
    """Import 경로 확인"""
    print("\n🔗 Import 경로 확인...")
    try:
        # src를 Python 경로에 추가
        sys.path.insert(0, str(Path(__file__).parent / "src"))
        
        # 주요 모듈 import 테스트
        from backend.core.main_server import app
        print("✅ main_server.py import 성공")
        
        from backend.core.websocket_server import ConnectionManager
        print("✅ websocket_server.py import 성공")
        
        from backend.core.server_manager import IntegratedServerManager
        print("✅ server_manager.py import 성공")
        
        return True
    except ImportError as e:
        print(f"❌ Import 실패: {e}")
        return False

def check_environment_variables():
    """환경변수 확인"""
    print("\n🌍 환경변수 확인...")
    required_envs = [
        "MONGODB_URI",
        "DATABASE_NAME",
        "OPENAI_API_KEY",
        "SUPABASE_URL",
        "SUPABASE_ANON_KEY"
    ]
    
    optional_envs = [
        "WEBSOCKET_HOST",
        "WEBSOCKET_PORT",
        "CORS_ORIGINS"
    ]
    
    print("필수 환경변수:")
    all_required = True
    for env in required_envs:
        if os.getenv(env):
            print(f"✅ {env}")
        else:
            print(f"❌ {env} - 설정되지 않음")
            all_required = False
    
    print("\n선택적 환경변수:")
    for env in optional_envs:
        if os.getenv(env):
            print(f"✅ {env}")
        else:
            print(f"⚠️ {env} - 설정되지 않음 (기본값 사용)")
    
    return all_required

def check_docker_files():
    """Docker 관련 파일 확인"""
    print("\n🐳 Docker 파일 확인...")
    docker_files = [
        "deployment/docker/Dockerfile",
        "deployment/k8s/deployment.yaml",
        "deployment/k8s/service.yaml"
    ]
    
    all_exist = True
    for file_path in docker_files:
        if os.path.exists(file_path):
            print(f"✅ {file_path}")
        else:
            print(f"❌ {file_path} - 없음")
            all_exist = False
    
    return all_exist

def main():
    """메인 체크 함수"""
    print("🔍 GKE 환경 호환성 체크 시작...\n")
    
    checks = [
        ("Python 버전", check_python_version),
        ("필수 파일", check_required_files),
        ("필수 디렉토리", check_required_directories),
        ("Import 경로", check_imports),
        ("환경변수", check_environment_variables),
        ("Docker 파일", check_docker_files)
    ]
    
    results = []
    for name, check_func in checks:
        try:
            result = check_func()
            results.append((name, result))
        except Exception as e:
            print(f"❌ {name} 체크 중 오류: {e}")
            results.append((name, False))
    
    print("\n" + "="*50)
    print("📊 체크 결과 요약:")
    print("="*50)
    
    all_passed = True
    for name, result in results:
        status = "✅ 통과" if result else "❌ 실패"
        print(f"{name}: {status}")
        if not result:
            all_passed = False
    
    print("\n" + "="*50)
    if all_passed:
        print("🎉 모든 체크 통과! GKE 배포 준비 완료")
        print("💡 다음 단계:")
        print("   1. docker build -f deployment/docker/Dockerfile -t dys-backend .")
        print("   2. docker push <your-registry>/dys-backend")
        print("   3. kubectl apply -f deployment/k8s/")
    else:
        print("⚠️ 일부 체크 실패. GKE 배포 전 문제 해결 필요")
        print("💡 해결 방법:")
        print("   1. 누락된 파일/디렉토리 생성")
        print("   2. 환경변수 설정")
        print("   3. Import 경로 수정")
    
    return all_passed

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
