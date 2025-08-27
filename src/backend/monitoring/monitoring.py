#!/usr/bin/env python3
"""
DYS 백엔드 모니터링 모듈
Prometheus 메트릭 수집 및 노드 추적
"""

from prometheus_client import Counter, Histogram, Gauge, Info, generate_latest, CONTENT_TYPE_LATEST
from fastapi import Response
import time
import psutil
import os
import socket
import platform

# === Prometheus 메트릭 정의 ===

# 기본 애플리케이션 메트릭
REQUEST_COUNT = Counter(
    'dys_http_requests_total',
    'Total HTTP requests',
    ['method', 'endpoint', 'status_code']
)

REQUEST_DURATION = Histogram(
    'dys_http_request_duration_seconds',
    'HTTP request duration in seconds',
    ['method', 'endpoint']
)

# AI 모델 메트릭
EXPRESSION_ANALYSIS_COUNT = Counter(
    'dys_expression_analysis_total',
    'Total expression analysis requests',
    ['status']
)

EXPRESSION_ANALYSIS_DURATION = Histogram(
    'dys_expression_analysis_duration_seconds',
    'Expression analysis duration in seconds'
)

VOICE_ANALYSIS_COUNT = Counter(
    'dys_voice_analysis_total',
    'Total voice analysis requests',
    ['status']
)

VOICE_ANALYSIS_DURATION = Histogram(
    'dys_voice_analysis_duration_seconds',
    'Voice analysis duration in seconds'
)

# 시스템 리소스 메트릭
SYSTEM_CPU_USAGE = Gauge('dys_system_cpu_percent', 'System CPU usage percentage')
SYSTEM_MEMORY_USAGE = Gauge('dys_system_memory_percent', 'System memory usage percentage')
SYSTEM_DISK_USAGE = Gauge('dys_system_disk_percent', 'System disk usage percentage')

# WebSocket 연결 메트릭
WEBSOCKET_CONNECTIONS = Gauge('dys_websocket_connections_active', 'Active WebSocket connections')
WEBSOCKET_MESSAGES = Counter(
    'dys_websocket_messages_total',
    'Total WebSocket messages',
    ['direction', 'type']
)

# 노드 및 배포 추적 메트릭
NODE_INFO = Info('dys_node_info', 'Node information for deployment tracking')
DEPLOYMENT_INFO = Info('dys_deployment_info', 'Deployment information')
BUILD_INFO = Info('dys_build_info', 'Build information')

# 데이터베이스 메트릭
DATABASE_CONNECTIONS = Gauge('dys_database_connections_active', 'Active database connections')
DATABASE_QUERIES = Counter(
    'dys_database_queries_total',
    'Total database queries',
    ['operation', 'collection', 'status']
)

DATABASE_QUERY_DURATION = Histogram(
    'dys_database_query_duration_seconds',
    'Database query duration in seconds',
    ['operation', 'collection']
)

class MonitoringManager:
    """모니터링 관리자 - 메트릭 수집 및 노드 추적"""
    
    def __init__(self):
        self.start_time = time.time()
        self._update_node_info()
        self._update_deployment_info()
        self._update_build_info()
    
    def _update_node_info(self):
        """노드 정보 업데이트 (빌드시 변경되는 정보 추적)"""
        try:
            NODE_INFO.info({
                'hostname': socket.gethostname(),
                'ip_address': socket.gethostbyname(socket.gethostname()),
                'platform': platform.platform(),
                'python_version': platform.python_version(),
                'cpu_count': str(os.cpu_count()),
                'architecture': platform.architecture()[0],
                'machine': platform.machine(),
                'processor': platform.processor() or 'unknown',
                'pod_name': os.getenv('HOSTNAME', 'unknown'),
                'node_name': os.getenv('NODE_NAME', 'unknown'),
                'namespace': os.getenv('NAMESPACE', 'default')
            })
        except Exception as e:
            print(f"⚠️ 노드 정보 업데이트 실패: {e}")
    
    def _update_deployment_info(self):
        """배포 정보 업데이트"""
        try:
            DEPLOYMENT_INFO.info({
                'app_name': 'dys-backend',
                'version': os.getenv('APP_VERSION', 'unknown'),
                'environment': os.getenv('ENVIRONMENT', 'production'),
                'replica_name': os.getenv('HOSTNAME', 'unknown'),
                'cluster_name': os.getenv('CLUSTER_NAME', 'unknown'),
                'zone': os.getenv('CLUSTER_ZONE', 'unknown'),
                'start_time': str(int(self.start_time))
            })
        except Exception as e:
            print(f"⚠️ 배포 정보 업데이트 실패: {e}")
    
    def _update_build_info(self):
        """빌드 정보 업데이트 (CI/CD 추적)"""
        try:
            BUILD_INFO.info({
                'build_time': os.getenv('BUILD_TIME', 'unknown'),
                'commit_hash': os.getenv('COMMIT_HASH', 'unknown'),
                'branch': os.getenv('BRANCH', 'unknown'),
                'build_number': os.getenv('BUILD_NUMBER', 'unknown'),
                'image_tag': os.getenv('IMAGE_TAG', 'unknown'),
                'docker_image': os.getenv('DOCKER_IMAGE', 'unknown')
            })
        except Exception as e:
            print(f"⚠️ 빌드 정보 업데이트 실패: {e}")
    
    def update_system_metrics(self):
        """시스템 메트릭 업데이트"""
        try:
            # CPU 사용률
            cpu_percent = psutil.cpu_percent(interval=1)
            SYSTEM_CPU_USAGE.set(cpu_percent)
            
            # 메모리 사용률
            memory = psutil.virtual_memory()
            SYSTEM_MEMORY_USAGE.set(memory.percent)
            
            # 디스크 사용률
            disk = psutil.disk_usage('/')
            disk_percent = (disk.used / disk.total) * 100
            SYSTEM_DISK_USAGE.set(disk_percent)
            
        except Exception as e:
            print(f"⚠️ 시스템 메트릭 업데이트 실패: {e}")
    
    def record_http_request(self, method: str, endpoint: str, status_code: int, duration: float):
        """HTTP 요청 메트릭 기록"""
        REQUEST_COUNT.labels(method=method, endpoint=endpoint, status_code=status_code).inc()
        REQUEST_DURATION.labels(method=method, endpoint=endpoint).observe(duration)
    
    def record_expression_analysis(self, status: str, duration: float):
        """표정 분석 메트릭 기록"""
        EXPRESSION_ANALYSIS_COUNT.labels(status=status).inc()
        EXPRESSION_ANALYSIS_DURATION.observe(duration)
    
    def record_voice_analysis(self, status: str, duration: float):
        """음성 분석 메트릭 기록"""
        VOICE_ANALYSIS_COUNT.labels(status=status).inc()
        VOICE_ANALYSIS_DURATION.observe(duration)
    
    def update_websocket_connections(self, count: int):
        """WebSocket 연결 수 업데이트"""
        WEBSOCKET_CONNECTIONS.set(count)
    
    def record_websocket_message(self, direction: str, message_type: str):
        """WebSocket 메시지 기록"""
        WEBSOCKET_MESSAGES.labels(direction=direction, type=message_type).inc()
    
    def update_database_connections(self, count: int):
        """데이터베이스 연결 수 업데이트"""
        DATABASE_CONNECTIONS.set(count)
    
    def record_database_query(self, operation: str, collection: str, status: str, duration: float):
        """데이터베이스 쿼리 메트릭 기록"""
        DATABASE_QUERIES.labels(operation=operation, collection=collection, status=status).inc()
        DATABASE_QUERY_DURATION.labels(operation=operation, collection=collection).observe(duration)

# 전역 모니터링 매니저 인스턴스
monitoring = MonitoringManager()

def get_metrics():
    """Prometheus 메트릭 반환"""
    # 시스템 메트릭 업데이트
    monitoring.update_system_metrics()
    
    # 메트릭 생성
    return Response(
        content=generate_latest(),
        media_type=CONTENT_TYPE_LATEST
    )

# 미들웨어용 함수들
def start_timer():
    """요청 시작 시간 기록"""
    return time.time()

def record_request_metrics(method: str, endpoint: str, status_code: int, start_time: float):
    """요청 완료 시 메트릭 기록"""
    duration = time.time() - start_time
    monitoring.record_http_request(method, endpoint, status_code, duration)

# 컨텍스트 매니저
class MetricsTimer:
    """메트릭 타이머 컨텍스트 매니저"""
    
    def __init__(self, metric_func, *args):
        self.metric_func = metric_func
        self.args = args
        self.start_time = None
    
    def __enter__(self):
        self.start_time = time.time()
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        duration = time.time() - self.start_time
        status = 'success' if exc_type is None else 'error'
        self.metric_func(status, duration, *self.args)

# 데코레이터
def monitor_expression_analysis(func):
    """표정 분석 함수 모니터링 데코레이터"""
    def wrapper(*args, **kwargs):
        with MetricsTimer(monitoring.record_expression_analysis):
            return func(*args, **kwargs)
    return wrapper

def monitor_voice_analysis(func):
    """음성 분석 함수 모니터링 데코레이터"""
    def wrapper(*args, **kwargs):
        with MetricsTimer(monitoring.record_voice_analysis):
            return func(*args, **kwargs)
    return wrapper
