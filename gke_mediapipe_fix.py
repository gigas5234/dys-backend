#!/usr/bin/env python3
"""
GKE 환경에서 MediaPipe 문제 해결 스크립트
"""

import os
import sys
import subprocess
import traceback

def set_environment_variables():
    """MediaPipe 관련 환경 변수 설정"""
    print("🔧 MediaPipe 환경 변수 설정...")
    
    # TensorFlow 관련 환경 변수
    os.environ['TF_CPP_MIN_LOG_LEVEL'] = '2'  # TensorFlow 경고 메시지 억제
    os.environ['TF_ENABLE_ONEDNN_OPTS'] = '0'  # oneDNN 최적화 비활성화 (안정성 향상)
    
    # MediaPipe 관련 환경 변수
    os.environ['MEDIAPIPE_DISABLE_GPU'] = '1'  # GPU 비활성화 (CPU만 사용)
    os.environ['MEDIAPIPE_DISABLE_CUDA'] = '1'  # CUDA 비활성화
    
    print("✅ 환경 변수 설정 완료")

def check_and_install_dependencies():
    """필요한 의존성 확인 및 설치"""
    print("📦 의존성 확인 및 설치...")
    
    required_packages = [
        'mediapipe>=0.10.0',
        'opencv-python-headless>=4.8.0',
        'numpy>=1.24.0',
        'tensorflow>=2.12.0'
    ]
    
    for package in required_packages:
        try:
            print(f"🔄 {package} 설치 중...")
            subprocess.check_call([
                sys.executable, '-m', 'pip', 'install', package, '--quiet'
            ])
            print(f"✅ {package} 설치 완료")
        except subprocess.CalledProcessError as e:
            print(f"❌ {package} 설치 실패: {e}")
            return False
    
    return True

def create_mediapipe_test():
    """MediaPipe 테스트 함수 생성"""
    print("🧪 MediaPipe 테스트 함수 생성...")
    
    test_code = '''
import mediapipe as mp
import numpy as np
import cv2

def test_mediapipe_basic():
    """기본 MediaPipe 테스트"""
    try:
        print("🔄 MediaPipe FaceMesh 초기화...")
        face_mesh = mp.solutions.face_mesh.FaceMesh(
            static_image_mode=False,
            max_num_faces=1,
            refine_landmarks=True,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5
        )
        print("✅ FaceMesh 초기화 성공")
        
        # 더미 이미지로 테스트
        dummy_image = np.zeros((480, 640, 3), dtype=np.uint8)
        results = face_mesh.process(dummy_image)
        print("✅ 더미 이미지 처리 성공")
        
        return True
    except Exception as e:
        print(f"❌ MediaPipe 테스트 실패: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    test_mediapipe_basic()
'''
    
    with open('mediapipe_test.py', 'w') as f:
        f.write(test_code)
    
    print("✅ MediaPipe 테스트 파일 생성 완료")

def check_gke_resources():
    """GKE 리소스 확인"""
    print("🔍 GKE 리소스 확인...")
    
    try:
        import psutil
        
        # 메모리 확인
        memory = psutil.virtual_memory()
        print(f"총 메모리: {memory.total / (1024**3):.1f} GB")
        print(f"사용 가능한 메모리: {memory.available / (1024**3):.1f} GB")
        print(f"메모리 사용률: {memory.percent}%")
        
        # CPU 확인
        cpu_count = psutil.cpu_count()
        cpu_percent = psutil.cpu_percent(interval=1)
        print(f"CPU 개수: {cpu_count}")
        print(f"CPU 사용률: {cpu_percent}%")
        
        # 디스크 확인
        disk = psutil.disk_usage('/')
        print(f"디스크 사용률: {disk.percent}%")
        
        # 메모리 부족 경고
        if memory.available < 2 * (1024**3):  # 2GB 미만
            print("⚠️ 경고: 사용 가능한 메모리가 2GB 미만입니다!")
            print("💡 해결방안: GKE 파드의 메모리 리소스를 늘려주세요.")
        
        return True
    except Exception as e:
        print(f"❌ 리소스 확인 실패: {e}")
        return False

def create_mediapipe_fallback():
    """MediaPipe 대체 방안 생성"""
    print("🔄 MediaPipe 대체 방안 생성...")
    
    fallback_code = '''
import cv2
import numpy as np

class SimpleFaceDetector:
    """간단한 얼굴 감지기 (MediaPipe 대체)"""
    
    def __init__(self):
        self.face_cascade = cv2.CascadeClassifier(
            cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
        )
    
    def detect_faces(self, image):
        """얼굴 감지"""
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        faces = self.face_cascade.detectMultiScale(
            gray, 
            scaleFactor=1.1, 
            minNeighbors=5, 
            minSize=(30, 30)
        )
        return faces
    
    def get_face_landmarks(self, image):
        """간단한 얼굴 랜드마크 추정"""
        faces = self.detect_faces(image)
        landmarks = []
        
        for (x, y, w, h) in faces:
            # 간단한 랜드마크 추정 (실제 MediaPipe 대체용)
            center_x, center_y = x + w//2, y + h//2
            
            # 기본 랜드마크 포인트들
            landmarks.extend([
                [center_x, y],           # 이마
                [center_x, center_y],    # 코
                [x, center_y],           # 왼쪽 뺨
                [x + w, center_y],       # 오른쪽 뺨
                [center_x, y + h]        # 턱
            ])
        
        return np.array(landmarks)

# 사용 예시
if __name__ == "__main__":
    detector = SimpleFaceDetector()
    print("✅ 간단한 얼굴 감지기 초기화 완료")
'''
    
    with open('simple_face_detector.py', 'w') as f:
        f.write(fallback_code)
    
    print("✅ MediaPipe 대체 방안 생성 완료")

def main():
    """메인 해결 함수"""
    print("🔧 GKE MediaPipe 문제 해결 시작...")
    print("=" * 50)
    
    # 1. 환경 변수 설정
    set_environment_variables()
    
    # 2. GKE 리소스 확인
    check_gke_resources()
    
    # 3. 의존성 설치
    if check_and_install_dependencies():
        # 4. MediaPipe 테스트 생성
        create_mediapipe_test()
        
        # 5. 대체 방안 생성
        create_mediapipe_fallback()
        
        print("=" * 50)
        print("✅ 해결 방안 준비 완료!")
        print("📋 다음 단계:")
        print("1. python mediapipe_test.py 실행하여 MediaPipe 테스트")
        print("2. 테스트 실패 시 simple_face_detector.py 사용")
        print("3. GKE 파드 리소스 증가 고려")
    else:
        print("❌ 의존성 설치 실패")
    
    print("=" * 50)

if __name__ == "__main__":
    main()
