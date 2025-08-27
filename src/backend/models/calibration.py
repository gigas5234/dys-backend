"""
캘리브레이션 데이터 모델
"""

from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from datetime import datetime
import uuid

class CalibrationData(BaseModel):
    """캘리브레이션 데이터 모델"""
    
    # 기본 정보
    id: Optional[str] = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    device_id: Optional[str] = None
    profile_name: Optional[str] = "default"
    
    # 중심점 설정
    center_h: Optional[float] = 0.5  # 수평 중심점 (0.0 ~ 1.0)
    center_v: Optional[float] = 0.5  # 수직 중심점 (0.0 ~ 1.0)
    center_ear: Optional[float] = 0.2  # 귀 중심점
    
    # 밴드 설정
    band_center_half: Optional[float] = 0.1  # 밴드 중심 절반
    band_mid_half: Optional[float] = 0.15    # 밴드 중간 절반
    
    # 깜빡임 설정
    blink_ear_threshold: Optional[float] = 0.21  # 눈 깜빡임 EAR 임계값
    blink_closed_threshold: Optional[float] = 0.19  # 눈 닫힘 임계값
    
    # 시선 설정
    saccade_threshold: Optional[float] = 50.0  # 급격한 시선 이동 임계값
    focus_drift_seconds: Optional[float] = 2.0  # 초점 이탈 시간
    
    # 자세 기준선
    neck_length_baseline: Optional[float] = 0.15  # 목 길이 기준선
    neck_angle_baseline: Optional[float] = 0.0    # 목 각도 기준선
    chin_forward_baseline: Optional[float] = 0.0  # 턱 전방 위치 기준선
    neck_tilt_baseline: Optional[float] = 0.0     # 목 기울기 기준선
    shoulder_width_baseline: Optional[float] = 0.4  # 어깨 너비 기준선
    torso_height_baseline: Optional[float] = 0.6    # 몸통 높이 기준선
    back_curve_baseline: Optional[float] = 0.0      # 등 곡선 기준선
    shoulder_blade_position_baseline: Optional[float] = 0.0  # 어깨뼈 위치 기준선
    
    # 품질 및 메타데이터
    quality_score: Optional[float] = 0.0  # 캘리브레이션 품질 점수
    description: Optional[str] = None
    statistics: Optional[Dict[str, Any]] = None
    version: Optional[int] = 1
    
    # 타임스탬프
    created_at: Optional[datetime] = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = Field(default_factory=datetime.utcnow)

class CalibrationRequest(BaseModel):
    """캘리브레이션 요청 모델"""
    user_id: str
    device_id: Optional[str] = None
    profile_name: Optional[str] = "default"

class CalibrationResponse(BaseModel):
    """캘리브레이션 응답 모델"""
    success: bool
    message: str
    calibration_data: Optional[CalibrationData] = None
    quality_score: Optional[float] = None
    missing_fields: Optional[list] = None

class CalibrationStatus(BaseModel):
    """캘리브레이션 상태 모델"""
    has_calibration: bool
    user_id: str
    profile_name: Optional[str] = None
    quality_score: Optional[float] = None
    last_updated: Optional[datetime] = None
    message: Optional[str] = None

# 기본 캘리브레이션 값들
DEFAULT_CALIBRATION = {
    "center_h": 0.5,
    "center_v": 0.5,
    "center_ear": 0.2,
    "band_center_half": 0.1,
    "band_mid_half": 0.15,
    "blink_ear_threshold": 0.21,
    "blink_closed_threshold": 0.19,
    "saccade_threshold": 50.0,
    "focus_drift_seconds": 2.0,
    "neck_length_baseline": 0.15,
    "neck_angle_baseline": 0.0,
    "chin_forward_baseline": 0.0,
    "neck_tilt_baseline": 0.0,
    "shoulder_width_baseline": 0.4,
    "torso_height_baseline": 0.6,
    "back_curve_baseline": 0.0,
    "shoulder_blade_position_baseline": 0.0,
    "quality_score": 0.8
}

def get_default_calibration(user_id: str) -> CalibrationData:
    """기본 캘리브레이션 데이터 생성"""
    return CalibrationData(
        user_id=user_id,
        profile_name="default",
        **DEFAULT_CALIBRATION
    )

def validate_calibration_data(data: CalibrationData) -> tuple[bool, list, float]:
    """
    캘리브레이션 데이터 유효성 검사
    
    Returns:
        (is_valid, missing_fields, quality_score)
    """
    required_fields = [
        'center_h', 'center_v', 'center_ear',
        'blink_ear_threshold', 'blink_closed_threshold',
        'neck_length_baseline', 'shoulder_width_baseline'
    ]
    
    missing_fields = []
    for field in required_fields:
        if getattr(data, field) is None:
            missing_fields.append(field)
    
    # 품질 점수 계산 (누락된 필드가 적을수록 높은 점수)
    total_fields = len(required_fields)
    missing_count = len(missing_fields)
    quality_score = max(0.0, (total_fields - missing_count) / total_fields)
    
    is_valid = len(missing_fields) <= 2  # 2개 이하 필드가 누락되면 유효
    
    return is_valid, missing_fields, quality_score

def fill_missing_calibration_data(data: CalibrationData) -> CalibrationData:
    """누락된 캘리브레이션 데이터를 기본값으로 채움"""
    default_data = get_default_calibration(data.user_id)
    
    for field, default_value in DEFAULT_CALIBRATION.items():
        if getattr(data, field) is None:
            setattr(data, field, default_value)
    
    return data
