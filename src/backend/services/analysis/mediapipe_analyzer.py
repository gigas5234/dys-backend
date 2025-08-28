#!/usr/bin/env python3
"""
MediaPipe 기반 얼굴 랜드마크 및 자세 분석 서비스
- 얼굴 랜드마크 468개 + 자세 랜드마크 33개 분석
- 실시간 점수 계산 및 웹소켓 전송
"""

import cv2
import numpy as np
import mediapipe as mp
import time
import json
import logging
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass
import asyncio

# 로깅 설정
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@dataclass
class LandmarkPoint:
    """랜드마크 포인트 데이터 클래스"""
    x: float
    y: float
    z: float
    visibility: float = 1.0

@dataclass
class AnalysisResult:
    """분석 결과 데이터 클래스"""
    timestamp: float
    face_landmarks: List[LandmarkPoint]
    pose_landmarks: List[LandmarkPoint]
    scores: Dict[str, float]
    metrics: Dict[str, Any]

class MediaPipeAnalyzer:
    """MediaPipe 기반 얼굴 및 자세 분석기"""
    
    def __init__(self):
        self.mp_face_mesh = None
        self.mp_pose = None
        self.mp_drawing = None
        self.mp_drawing_styles = None
        
        # 분석 결과 저장
        self.analysis_history: List[AnalysisResult] = []
        self.max_history_size = 100
        
        # 점수 계산을 위한 임계값들
        self.gaze_threshold = 0.1  # 시선 안정성 임계값
        self.posture_threshold = 0.15  # 자세 안정성 임계값
        self.blink_threshold = 0.02  # 깜빡임 감지 임계값
        
        # 초기화 상태
        self.is_initialized = False
        
        logger.info("🎭 MediaPipe 분석기 초기화됨")
    
    def initialize(self):
        """MediaPipe 모듈들을 초기화합니다."""
        try:
            logger.info("🔄 MediaPipe 모듈 초기화 중...")
            
            # MediaPipe 모듈들 초기화
            self.mp_face_mesh = mp.solutions.face_mesh
            self.mp_pose = mp.solutions.pose
            self.mp_drawing = mp.solutions.drawing_utils
            self.mp_drawing_styles = mp.solutions.drawing_styles
            
            # 얼굴 메시 설정
            self.face_mesh = self.mp_face_mesh.FaceMesh(
                max_num_faces=1,
                refine_landmarks=True,
                min_detection_confidence=0.5,
                min_tracking_confidence=0.5
            )
            
            # 자세 감지 설정
            self.pose = self.mp_pose.Pose(
                min_detection_confidence=0.5,
                min_tracking_confidence=0.5,
                model_complexity=1
            )
            
            self.is_initialized = True
            logger.info("✅ MediaPipe 모듈 초기화 완료")
            return True
            
        except Exception as e:
            logger.error(f"❌ MediaPipe 초기화 실패: {e}")
            return False
    
    def analyze_landmarks(self, face_landmarks: List[Dict], pose_landmarks: List[Dict]) -> AnalysisResult:
        """랜드마크 데이터를 분석하여 점수를 계산합니다."""
        try:
            timestamp = time.time()
            
            # 랜드마크 포인트 변환
            face_points = self._convert_landmarks(face_landmarks)
            pose_points = self._convert_landmarks(pose_landmarks)
            
            # 각종 메트릭 계산
            gaze_stability = self._calculate_gaze_stability(face_points)
            posture_stability = self._calculate_posture_stability(pose_points)
            blink_rate = self._calculate_blink_rate(face_points)
            concentration_score = self._calculate_concentration_score(face_points, pose_points)
            initiative_score = self._calculate_initiative_score(face_points, pose_points)
            
            # 종합 점수 계산
            scores = {
                'gaze_stability': gaze_stability,
                'posture_stability': posture_stability,
                'blink_rate': blink_rate,
                'concentration': concentration_score,
                'initiative': initiative_score
            }
            
            # 메트릭 데이터
            metrics = {
                'face_landmark_count': len(face_points),
                'pose_landmark_count': len(pose_points),
                'gaze_center': self._calculate_gaze_center(face_points),
                'posture_center': self._calculate_posture_center(pose_points),
                'head_rotation': self._calculate_head_rotation(face_points),
                'shoulder_alignment': self._calculate_shoulder_alignment(pose_points)
            }
            
            # 분석 결과 생성
            result = AnalysisResult(
                timestamp=timestamp,
                face_landmarks=face_points,
                pose_landmarks=pose_points,
                scores=scores,
                metrics=metrics
            )
            
            # 히스토리에 추가
            self._add_to_history(result)
            
            return result
            
        except Exception as e:
            logger.error(f"❌ 랜드마크 분석 실패: {e}")
            return None
    
    def _convert_landmarks(self, landmarks: List[Dict]) -> List[LandmarkPoint]:
        """랜드마크 딕셔너리를 LandmarkPoint 객체로 변환합니다."""
        points = []
        for landmark in landmarks:
            point = LandmarkPoint(
                x=landmark.get('x', 0.0),
                y=landmark.get('y', 0.0),
                z=landmark.get('z', 0.0),
                visibility=landmark.get('visibility', 1.0)
            )
            points.append(point)
        return points
    
    def _calculate_gaze_stability(self, face_points: List[LandmarkPoint]) -> float:
        """시선 안정성을 계산합니다."""
        try:
            if len(face_points) < 468:
                return 0.0
            
            # 눈동자 중심점 계산 (MediaPipe 얼굴 메시의 눈동자 랜드마크)
            left_eye_center = self._calculate_eye_center(face_points, 'left')
            right_eye_center = self._calculate_eye_center(face_points, 'right')
            
            # 눈동자 간 거리 계산
            eye_distance = np.sqrt(
                (left_eye_center[0] - right_eye_center[0])**2 +
                (left_eye_center[1] - right_eye_center[1])**2
            )
            
            # 시선 안정성 점수 (0-1 범위)
            # 눈동자 간 거리가 일정하면 안정적
            stability_score = min(1.0, max(0.0, 1.0 - abs(eye_distance - 0.1) / 0.1))
            
            return stability_score
            
        except Exception as e:
            logger.error(f"시선 안정성 계산 실패: {e}")
            return 0.0
    
    def _calculate_posture_stability(self, pose_points: List[LandmarkPoint]) -> float:
        """자세 안정성을 계산합니다."""
        try:
            if len(pose_points) < 33:
                return 0.0
            
            # 어깨와 엉덩이 정렬 계산
            left_shoulder = pose_points[11]  # 왼쪽 어깨
            right_shoulder = pose_points[12]  # 오른쪽 어깨
            left_hip = pose_points[23]  # 왼쪽 엉덩이
            right_hip = pose_points[24]  # 오른쪽 엉덩이
            
            # 어깨 수평성 계산
            shoulder_tilt = abs(left_shoulder.y - right_shoulder.y)
            
            # 엉덩이 수평성 계산
            hip_tilt = abs(left_hip.y - right_hip.y)
            
            # 자세 안정성 점수 (0-1 범위)
            posture_score = max(0.0, 1.0 - (shoulder_tilt + hip_tilt) / 2.0)
            
            return posture_score
            
        except Exception as e:
            logger.error(f"자세 안정성 계산 실패: {e}")
            return 0.0
    
    def _calculate_blink_rate(self, face_points: List[LandmarkPoint]) -> float:
        """깜빡임 비율을 계산합니다."""
        try:
            if len(face_points) < 468:
                return 0.0
            
            # 눈꺼풀 거리 계산 (MediaPipe 얼굴 메시의 눈꺼풀 랜드마크)
            left_eye_openness = self._calculate_eye_openness(face_points, 'left')
            right_eye_openness = self._calculate_eye_openness(face_points, 'right')
            
            # 평균 눈 개방도
            avg_eye_openness = (left_eye_openness + right_eye_openness) / 2.0
            
            # 깜빡임 감지 (눈이 감긴 상태)
            blink_detected = avg_eye_openness < self.blink_threshold
            
            # 깜빡임 비율 계산 (히스토리 기반)
            recent_blinks = sum(1 for result in self.analysis_history[-10:] 
                              if result.scores.get('blink_detected', False))
            
            blink_rate = min(1.0, recent_blinks / 10.0)
            
            return blink_rate
            
        except Exception as e:
            logger.error(f"깜빡임 비율 계산 실패: {e}")
            return 0.0
    
    def _calculate_concentration_score(self, face_points: List[LandmarkPoint], 
                                     pose_points: List[LandmarkPoint]) -> float:
        """집중도 점수를 계산합니다."""
        try:
            # 시선 안정성
            gaze_score = self._calculate_gaze_stability(face_points)
            
            # 자세 안정성
            posture_score = self._calculate_posture_stability(pose_points)
            
            # 머리 회전 안정성
            head_rotation = self._calculate_head_rotation(face_points)
            head_stability = max(0.0, 1.0 - abs(head_rotation))
            
            # 종합 집중도 점수
            concentration_score = (gaze_score * 0.4 + 
                                 posture_score * 0.3 + 
                                 head_stability * 0.3)
            
            return concentration_score
            
        except Exception as e:
            logger.error(f"집중도 점수 계산 실패: {e}")
            return 0.0
    
    def _calculate_initiative_score(self, face_points: List[LandmarkPoint], 
                                  pose_points: List[LandmarkPoint]) -> float:
        """대화 주도권 점수를 계산합니다."""
        try:
            # 얼굴 표정 분석 (간단한 버전)
            expression_score = self._analyze_expression(face_points)
            
            # 자세 개방성
            posture_openness = self._calculate_posture_openness(pose_points)
            
            # 시선 접촉
            eye_contact = self._calculate_eye_contact(face_points)
            
            # 종합 주도권 점수
            initiative_score = (expression_score * 0.4 + 
                              posture_openness * 0.3 + 
                              eye_contact * 0.3)
            
            return initiative_score
            
        except Exception as e:
            logger.error(f"주도권 점수 계산 실패: {e}")
            return 0.0
    
    def _calculate_eye_center(self, face_points: List[LandmarkPoint], eye: str) -> Tuple[float, float]:
        """눈동자 중심점을 계산합니다."""
        if eye == 'left':
            # 왼쪽 눈동자 랜드마크 (MediaPipe 얼굴 메시)
            eye_landmarks = [468, 469, 470, 471, 472, 473]
        else:
            # 오른쪽 눈동자 랜드마크
            eye_landmarks = [474, 475, 476, 477, 478, 479]
        
        x_sum = y_sum = 0
        count = 0
        
        for idx in eye_landmarks:
            if idx < len(face_points):
                x_sum += face_points[idx].x
                y_sum += face_points[idx].y
                count += 1
        
        if count > 0:
            return (x_sum / count, y_sum / count)
        else:
            return (0.5, 0.5)
    
    def _calculate_eye_openness(self, face_points: List[LandmarkPoint], eye: str) -> float:
        """눈 개방도를 계산합니다."""
        if eye == 'left':
            # 왼쪽 눈꺼풀 랜드마크
            upper_lid = face_points[159]  # 위 눈꺼풀
            lower_lid = face_points[145]  # 아래 눈꺼풀
        else:
            # 오른쪽 눈꺼풀 랜드마크
            upper_lid = face_points[386]  # 위 눈꺼풀
            lower_lid = face_points[374]  # 아래 눈꺼풀
        
        # 눈꺼풀 간 거리
        eye_openness = abs(upper_lid.y - lower_lid.y)
        return eye_openness
    
    def _calculate_head_rotation(self, face_points: List[LandmarkPoint]) -> float:
        """머리 회전을 계산합니다."""
        if len(face_points) < 468:
            return 0.0
        
        # 코 끝과 양쪽 귀 랜드마크 사용
        nose_tip = face_points[4]
        left_ear = face_points[234]
        right_ear = face_points[454]
        
        # 머리 회전 각도 계산
        head_rotation = (left_ear.x - right_ear.x) / 2.0
        return head_rotation
    
    def _calculate_posture_openness(self, pose_points: List[LandmarkPoint]) -> float:
        """자세 개방성을 계산합니다."""
        if len(pose_points) < 33:
            return 0.0
        
        # 어깨와 팔 위치로 개방성 판단
        left_shoulder = pose_points[11]
        right_shoulder = pose_points[12]
        left_elbow = pose_points[13]
        right_elbow = pose_points[14]
        
        # 팔이 펴져있는 정도
        left_arm_openness = abs(left_elbow.x - left_shoulder.x)
        right_arm_openness = abs(right_elbow.x - right_shoulder.x)
        
        # 평균 개방성
        openness = (left_arm_openness + right_arm_openness) / 2.0
        return min(1.0, openness)
    
    def _calculate_eye_contact(self, face_points: List[LandmarkPoint]) -> float:
        """시선 접촉을 계산합니다."""
        if len(face_points) < 468:
            return 0.0
        
        # 눈동자 중심점
        left_eye_center = self._calculate_eye_center(face_points, 'left')
        right_eye_center = self._calculate_eye_center(face_points, 'right')
        
        # 화면 중앙과의 거리 (시선 접촉 가정)
        screen_center = (0.5, 0.5)
        
        left_distance = np.sqrt((left_eye_center[0] - screen_center[0])**2 + 
                               (left_eye_center[1] - screen_center[1])**2)
        right_distance = np.sqrt((right_eye_center[0] - screen_center[0])**2 + 
                                (right_eye_center[1] - screen_center[1])**2)
        
        # 평균 거리
        avg_distance = (left_distance + right_distance) / 2.0
        
        # 시선 접촉 점수 (거리가 가까울수록 높은 점수)
        eye_contact_score = max(0.0, 1.0 - avg_distance)
        return eye_contact_score
    
    def _analyze_expression(self, face_points: List[LandmarkPoint]) -> float:
        """얼굴 표정을 분석합니다 (간단한 버전)."""
        if len(face_points) < 468:
            return 0.5
        
        # 입꼬리 위치로 표정 판단
        left_mouth_corner = face_points[61]
        right_mouth_corner = face_points[291]
        
        # 입꼬리가 올라가면 긍정적 표정
        mouth_curve = (left_mouth_corner.y + right_mouth_corner.y) / 2.0
        
        # 표정 점수 (0-1 범위)
        expression_score = max(0.0, min(1.0, (0.5 - mouth_curve) * 2))
        return expression_score
    
    def _calculate_gaze_center(self, face_points: List[LandmarkPoint]) -> Tuple[float, float]:
        """시선 중심점을 계산합니다."""
        left_eye_center = self._calculate_eye_center(face_points, 'left')
        right_eye_center = self._calculate_eye_center(face_points, 'right')
        
        gaze_center = ((left_eye_center[0] + right_eye_center[0]) / 2.0,
                      (left_eye_center[1] + right_eye_center[1]) / 2.0)
        return gaze_center
    
    def _calculate_posture_center(self, pose_points: List[LandmarkPoint]) -> Tuple[float, float]:
        """자세 중심점을 계산합니다."""
        if len(pose_points) < 33:
            return (0.5, 0.5)
        
        # 어깨 중심점
        left_shoulder = pose_points[11]
        right_shoulder = pose_points[12]
        
        posture_center = ((left_shoulder.x + right_shoulder.x) / 2.0,
                         (left_shoulder.y + right_shoulder.y) / 2.0)
        return posture_center
    
    def _calculate_shoulder_alignment(self, pose_points: List[LandmarkPoint]) -> float:
        """어깨 정렬을 계산합니다."""
        if len(pose_points) < 33:
            return 0.0
        
        left_shoulder = pose_points[11]
        right_shoulder = pose_points[12]
        
        # 어깨 수평성
        shoulder_tilt = abs(left_shoulder.y - right_shoulder.y)
        alignment_score = max(0.0, 1.0 - shoulder_tilt)
        
        return alignment_score
    
    def _add_to_history(self, result: AnalysisResult):
        """분석 결과를 히스토리에 추가합니다."""
        self.analysis_history.append(result)
        
        # 히스토리 크기 제한
        if len(self.analysis_history) > self.max_history_size:
            self.analysis_history.pop(0)
    
    def get_analysis_summary(self) -> Dict[str, Any]:
        """최근 분석 결과의 요약을 반환합니다."""
        if not self.analysis_history:
            return {
                'gaze_stability': 0.0,
                'posture_stability': 0.0,
                'blink_rate': 0.0,
                'concentration': 0.0,
                'initiative': 0.0
            }
        
        # 최근 10개 결과의 평균
        recent_results = self.analysis_history[-10:]
        
        summary = {}
        for key in ['gaze_stability', 'posture_stability', 'blink_rate', 'concentration', 'initiative']:
            values = [result.scores.get(key, 0.0) for result in recent_results]
            summary[key] = sum(values) / len(values) if values else 0.0
        
        return summary
    
    def cleanup(self):
        """리소스를 정리합니다."""
        try:
            if self.face_mesh:
                self.face_mesh.close()
            if self.pose:
                self.pose.close()
            logger.info("🧹 MediaPipe 분석기 정리 완료")
        except Exception as e:
            logger.error(f"❌ MediaPipe 분석기 정리 실패: {e}")

# 전역 인스턴스
mediapipe_analyzer = MediaPipeAnalyzer()
