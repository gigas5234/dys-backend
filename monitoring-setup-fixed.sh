#!/bin/bash

# Prometheus & Grafana 설치 및 설정 스크립트 (Windows PowerShell 호환)
# GKE 클러스터용 모니터링 스택 + 노드 추적

echo "GKE 모니터링 스택 설치 시작..."

# 1. 사전 확인
echo "사전 환경 확인..."
if ! command -v helm &> /dev/null; then
    echo "❌ Helm이 설치되지 않았습니다."
    exit 1
fi

if ! kubectl cluster-info &> /dev/null; then
    echo "Kubernetes 클러스터에 연결할 수 없습니다."
    exit 1
fi

echo "환경 확인 완료"

# 2. Helm 리포지토리 추가
echo "Helm 리포지토리 설정..."
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo add grafana https://grafana.github.io/helm-charts
helm repo update

# 3. monitoring 네임스페이스 생성
echo "모니터링 네임스페이스 생성..."
kubectl create namespace monitoring --dry-run=client -o yaml | kubectl apply -f -

# 4. 커스텀 Values로 Prometheus + Grafana 설치
echo "Prometheus + Grafana 스택 설치 (노드 추적 포함)..."
helm upgrade --install monitoring prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  --values prometheus-values.yaml \
  --wait \
  --timeout 10m

echo "모니터링 스택 설치 완료!"

# 5. DYS 백엔드 모니터링 설정 적용
echo "DYS 백엔드 모니터링 설정 적용..."
kubectl apply -f dys-servicemonitor.yaml

# 6. 서비스 상태 확인
echo "서비스 상태 확인..."
kubectl get pods -n monitoring -l "release=monitoring"
kubectl get svc -n monitoring

# 7. ServiceMonitor 및 PodMonitor 확인
echo "모니터링 설정 확인..."
kubectl get servicemonitor -n monitoring
kubectl get podmonitor -n monitoring

# 8. 외부 IP 대기 및 확인
echo "LoadBalancer IP 할당 대기..."
kubectl wait --for=condition=Ready pod -l "app.kubernetes.io/name=grafana" -n monitoring --timeout=300s

echo "외부 접속 정보:"

# Windows PowerShell 호환을 위한 IP 추출 방식
echo "Grafana Dashboard:"
echo "   URL: http://34.22.72.8:3000"
echo "   Username: admin"
echo "   Password: dys-monitoring-2024"
echo ""
echo "Prometheus:"
echo "   URL: http://34.22.78.32:9090"
echo ""
echo "AlertManager:"
echo "   URL: http://34.22.78.32:9093"
echo ""

# 9. DYS 백엔드 타겟 확인
echo "DYS 백엔드 모니터링 타겟 확인..."
echo "Prometheus에서 다음 타겟들을 확인하세요:"
echo "- dys-backend-monitor/0 (http://<pod-ip>:8000/metrics)"
echo "- dys-backend-pods/0 (WebSocket 포트)"
echo "- kubernetes-pods (동적 Pod 감지)"

# 10. 유용한 PromQL 쿼리 예시
echo ""
echo "유용한 모니터링 쿼리:"
echo "노드 변경 추적: changes(dys_node_info[1h])"
echo "빌드 정보: dys_build_info"
echo "Active Pods: up{job=\"dys-backend-tracking\"}"
echo "HTTP 요청수: rate(dys_http_requests_total[5m])"
echo "표정 분석 성공률: rate(dys_expression_analysis_total{status=\"success\"}[5m])"

echo ""
echo "설치 완료! 모든 서비스가 준비되었습니다."
echo "노드 변경 시 자동으로 새로운 Pod가 감지되고 추적됩니다."
