#!/usr/bin/env python3
"""
표정 인식 모델 테스트 스크립트
"""

import torch
import mlflow.pytorch
import numpy as np
from PIL import Image
import cv2
import os

def test_expression_model():
    """표정 인식 모델을 로드하고 테스트합니다."""
    
    print("🤖 표정 인식 모델 테스트 시작...")
    
    try:
        # MLflow 모델 로드
        model_path = "models"
        print(f"📁 모델 경로: {os.path.abspath(model_path)}")
        
        # 모델 로드
        print("🔄 모델 로딩 중...")
        model = mlflow.pytorch.load_model(model_path)
        print("✅ 모델 로드 완료!")
        
        # 모델 정보 출력
        print(f"📊 모델 타입: {type(model)}")
        print(f"📊 모델 구조: {model}")
        
        # 모델이 GPU 사용 가능한지 확인
        device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        print(f"🖥️ 사용 디바이스: {device}")
        
        # 모델을 GPU로 이동
        if torch.cuda.is_available():
            model = model.to(device)
            print("✅ 모델을 GPU로 이동 완료")
        
        # 모델을 평가 모드로 설정
        model.eval()
        print("✅ 모델을 평가 모드로 설정")
        
        # 더미 입력으로 모델 테스트
        print("🧪 더미 입력으로 모델 테스트...")
        
        # ViT 모델은 224x224 크기 필요
        height, width = 224, 224
        
        # 더미 이미지 생성 (RGB)
        dummy_input = torch.randn(1, 3, height, width)
        if torch.cuda.is_available():
            dummy_input = dummy_input.to(device)
        
        print(f"📐 입력 크기: {dummy_input.shape}")
        
        # 추론 실행
        with torch.no_grad():
            output = model(dummy_input)
        
        print(f"📤 출력 타입: {type(output)}")
        print(f"📤 출력 내용: {output}")
        
        # ImageClassifierOutput에서 logits 추출
        if hasattr(output, 'logits'):
            logits = output.logits
            print(f"📊 Logits 크기: {logits.shape}")
            print(f"📊 Logits 값 범위: {logits.min().item():.4f} ~ {logits.max().item():.4f}")
            print(f"📊 Logits 평균: {logits.mean().item():.4f}")
            
            # 소프트맥스 적용하여 확률로 변환
            probabilities = torch.softmax(logits, dim=1)
            print(f"📊 확률 합계: {probabilities.sum().item():.4f}")
            print(f"📊 확률 값: {probabilities[0].tolist()}")
            
            # 가장 높은 확률의 클래스
            predicted_class = torch.argmax(probabilities, dim=1)
            confidence = probabilities[0][predicted_class].item()
            print(f"🎯 예측 클래스: {predicted_class.item()}")
            print(f"🎯 신뢰도: {confidence:.4f}")
        
        # 모델의 forward 메서드 시그니처 확인
        print("\n🔍 모델 forward 메서드 분석...")
        if hasattr(model, 'forward'):
            import inspect
            sig = inspect.signature(model.forward)
            print(f"📝 Forward 시그니처: {sig}")
        
        # 모델의 클래스 정보 확인
        print(f"📝 모델 클래스: {model.__class__.__name__}")
        print(f"📝 모델 모듈: {model.__class__.__module__}")
        
        return model, device
        
    except Exception as e:
        print(f"❌ 모델 로드 실패: {e}")
        import traceback
        traceback.print_exc()
        return None, None

def analyze_expression_capabilities(model, device):
    """모델의 표정 인식 기능을 분석합니다."""
    
    print("\n🎭 표정 인식 기능 분석...")
    
    # ViT 모델의 출력 클래스 수 확인
    if hasattr(model, 'classifier'):
        num_classes = model.classifier.out_features
        print(f"📊 출력 클래스 수: {num_classes}")
        
        # 일반적인 표정 카테고리
        expression_categories = {
            7: ['happy', 'sad', 'angry', 'surprised', 'fearful', 'disgusted', 'neutral'],
            8: ['happy', 'sad', 'angry', 'surprised', 'fearful', 'disgusted', 'neutral', 'contempt'],
            6: ['happy', 'sad', 'angry', 'surprised', 'fearful', 'disgusted'],
            2: ['positive', 'negative']
        }
        
        if num_classes in expression_categories:
            print(f"🎯 추정 표정 카테고리: {expression_categories[num_classes]}")
        else:
            print(f"🎯 {num_classes}가지 표정 카테고리 (정확한 매핑 필요)")
    
    # 모델의 입력 전처리 요구사항 확인
    print("\n🔧 모델 입력 요구사항:")
    print("✅ 입력 크기: 224x224 (ViT 표준)")
    print("✅ 입력 채널: RGB (3채널)")
    print("✅ 입력 정규화: 필요 (ImageNet 표준)")
    print("✅ 배치 차원: 지원")

def create_expression_analyzer():
    """표정 분석기를 생성합니다."""
    
    print("\n🔧 표정 분석기 생성...")
    
    # 모델 로드
    model, device = test_expression_model()
    
    if model is None:
        print("❌ 모델 로드 실패")
        return None
    
    # 표정 분석 기능 분석
    analyze_expression_capabilities(model, device)
    
    def analyze_expression(image_tensor):
        """이미지 텐서에서 표정을 분석합니다."""
        try:
            # 입력 전처리
            if image_tensor.shape != (1, 3, 224, 224):
                # 크기 조정 필요
                print(f"⚠️ 입력 크기 조정 필요: {image_tensor.shape} -> (1, 3, 224, 224)")
                return None
            
            # GPU로 이동
            if device.type == 'cuda':
                image_tensor = image_tensor.to(device)
            
            # 추론
            with torch.no_grad():
                output = model(image_tensor)
            
            # 결과 처리
            if hasattr(output, 'logits'):
                logits = output.logits
                probabilities = torch.softmax(logits, dim=1)
                
                # 결과 반환
                return {
                    'logits': logits.cpu().numpy(),
                    'probabilities': probabilities.cpu().numpy(),
                    'predicted_class': torch.argmax(probabilities, dim=1).cpu().numpy(),
                    'confidence': probabilities.max().cpu().numpy()
                }
            
        except Exception as e:
            print(f"❌ 표정 분석 실패: {e}")
            return None
    
    return analyze_expression

if __name__ == "__main__":
    print("🚀 표정 인식 모델 분석 시작")
    print("=" * 50)
    
    # 모델 로드 및 테스트
    model, device = test_expression_model()
    
    if model is not None:
        # 표정 인식 기능 분석
        analyze_expression_capabilities(model, device)
        
        print("\n" + "=" * 50)
        print("✅ 모델 분석 완료!")
        print("\n💡 다음 단계:")
        print("1. MediaPipe와 통합하여 실시간 표정 분석")
        print("2. 웹 인터페이스에서 모델 호출")
        print("3. 표정 점수 시스템 업데이트")
        print("4. 이미지 전처리 파이프라인 구축")
    else:
        print("\n❌ 모델 로드 실패")
