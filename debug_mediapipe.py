#!/usr/bin/env python3
"""
GKE 환경에서 MediaPipe 문제 진단 스크립트
"""

import sys
import os
import traceback
import platform
import psutil

def check_system_info():
    """시스템 정보 확인"""
    print("=== 시스템 정보 ===")
    print(f"Python 버전: {sys.version}")
    print(f"플랫폼: {platform.platform()}")
    print(f"아키텍처: {platform.architecture()}")
    print(f"CPU 개수: {psutil.cpu_count()}")
    print(f"메모리: {psutil.virtual_memory().total / (1024**3):.1f} GB")
    print(f"사용 가능한 메모리: {psutil.virtual_memory().available / (1024**3):.1f} GB")
    print()

def check_mediapipe_import():
    """MediaPipe import 테스트"""
    print("=== MediaPipe Import 테스트 ===")
    try:
        import mediapipe as mp
        print(f"✅ MediaPipe import 성공")
        print(f"MediaPipe 버전: {mp.__version__}")
        print(f"MediaPipe 경로: {mp.__file__}")
        return True
    except ImportError as e:
        print(f"❌ MediaPipe import 실패: {e}")
        return False
    except Exception as e:
        print(f"❌ MediaPipe import 중 예외 발생: {e}")
        traceback.print_exc()
        return False
    print()

def check_mediapipe_facemesh():
    """MediaPipe FaceMesh 초기화 테스트"""
    print("=== MediaPipe FaceMesh 초기화 테스트 ===")
    try:
        import mediapipe as mp
        
        print("🔄 FaceMesh 객체 생성 중...")
        face_mesh = mp.solutions.face_mesh.FaceMesh(
            static_image_mode=False,
            max_num_faces=1,
            refine_landmarks=True,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5
        )
        print("✅ FaceMesh 객체 생성 성공")
        
        print("🔄 Drawing 유틸리티 확인...")
        mp_drawing = mp.solutions.drawing_utils
        mp_drawing_styles = mp.solutions.drawing_styles
        print("✅ Drawing 유틸리티 로드 성공")
        
        return True
    except Exception as e:
        print(f"❌ FaceMesh 초기화 실패: {e}")
        traceback.print_exc()
        return False
    print()

def check_dependencies():
    """의존성 라이브러리 확인"""
    print("=== 의존성 라이브러리 확인 ===")
    
    dependencies = [
        'numpy', 'opencv-python', 'tensorflow', 'torch', 'PIL'
    ]
    
    for dep in dependencies:
        try:
            if dep == 'PIL':
                from PIL import Image
                print(f"✅ {dep} (Pillow) 로드 성공")
            else:
                module = __import__(dep)
                print(f"✅ {dep} 로드 성공")
        except ImportError as e:
            print(f"❌ {dep} 로드 실패: {e}")
        except Exception as e:
            print(f"⚠️ {dep} 로드 중 예외: {e}")
    print()

def check_environment_variables():
    """환경 변수 확인"""
    print("=== 환경 변수 확인 ===")
    
    env_vars = [
        'TF_ENABLE_ONEDNN_OPTS',
        'CUDA_VISIBLE_DEVICES',
        'TF_CPP_MIN_LOG_LEVEL',
        'KUBERNETES_SERVICE_HOST',
        'KUBERNETES_SERVICE_PORT'
    ]
    
    for var in env_vars:
        value = os.getenv(var)
        print(f"{var}: {value}")
    print()

def check_file_permissions():
    """파일 권한 확인"""
    print("=== 파일 권한 확인 ===")
    
    try:
        import mediapipe as mp
        mp_path = os.path.dirname(mp.__file__)
        print(f"MediaPipe 경로: {mp_path}")
        
        if os.access(mp_path, os.R_OK):
            print("✅ MediaPipe 디렉토리 읽기 권한 있음")
        else:
            print("❌ MediaPipe 디렉토리 읽기 권한 없음")
            
        if os.access(mp_path, os.W_OK):
            print("✅ MediaPipe 디렉토리 쓰기 권한 있음")
        else:
            print("⚠️ MediaPipe 디렉토리 쓰기 권한 없음")
            
    except Exception as e:
        print(f"❌ 파일 권한 확인 실패: {e}")
    print()

def main():
    """메인 진단 함수"""
    print("🔍 GKE MediaPipe 진단 시작...")
    print("=" * 50)
    
    check_system_info()
    check_environment_variables()
    check_dependencies()
    
    if check_mediapipe_import():
        check_mediapipe_facemesh()
        check_file_permissions()
    
    print("=" * 50)
    print("🔍 진단 완료")

if __name__ == "__main__":
    main()
