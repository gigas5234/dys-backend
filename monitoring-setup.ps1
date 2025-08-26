# Prometheus & Grafana 설치 및 설정 스크립트 (PowerShell)
# GKE 클러스터용 모니터링 스택 + 노드 추적

Write-Host "🚀 GKE 모니터링 스택 설치 시작..." -ForegroundColor Green

# 1. 사전 확인
Write-Host "🔍 사전 환경 확인..." -ForegroundColor Yellow
try {
    $helmVersion = helm version
    Write-Host "Helm 확인 완료" -ForegroundColor Green
} catch {
    Write-Host "Helm이 설치되지 않았습니다." -ForegroundColor Red
    exit 1
}

try {
    $clusterInfo = kubectl cluster-info
    Write-Host "ubernetes 클러스터 연결 확인 완료" -ForegroundColor Green
} catch {
    Write-Host "Kubernetes 클러스터에 연결할 수 없습니다." -ForegroundColor Red
    exit 1
}

Write-Host "환경 확인 완료" -ForegroundColor Green

# 2. Helm 리포지토리 추가
Write-Host "📦 Helm 리포지토리 설정..." -ForegroundColor Yellow
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo add grafana https://grafana.github.io/helm-charts
helm repo update

# 3. monitoring 네임스페이스 생성
Write-Host "모니터링 네임스페이스 생성..." -ForegroundColor Yellow
kubectl create namespace monitoring --dry-run=client -o yaml | kubectl apply -f -

# 4. 커스텀 Values로 Prometheus + Grafana 설치
Write-Host "Prometheus + Grafana 스택 설치 (노드 추적 포함)..." -ForegroundColor Yellow
helm upgrade --install monitoring prometheus-community/kube-prometheus-stack `
  --namespace monitoring `
  --values prometheus-values.yaml `
  --wait `
  --timeout 10m

Write-Host "모니터링 스택 설치 완료!" -ForegroundColor Green

# 5. DYS 백엔드 모니터링 설정 적용
Write-Host "DYS 백엔드 모니터링 설정 적용..." -ForegroundColor Yellow
kubectl apply -f dys-servicemonitor.yaml

# 6. 서비스 상태 확인
Write-Host "서비스 상태 확인..." -ForegroundColor Yellow
kubectl get pods -n monitoring -l "release=monitoring"
kubectl get svc -n monitoring

# 7. ServiceMonitor 및 PodMonitor 확인
Write-Host "모니터링 설정 확인..." -ForegroundColor Yellow
kubectl get servicemonitor -n monitoring
kubectl get podmonitor -n monitoring

# 8. 외부 IP 대기 및 확인
Write-Host "LoadBalancer IP 할당 대기..." -ForegroundColor Yellow
kubectl wait --for=condition=Ready pod -l "app.kubernetes.io/name=grafana" -n monitoring --timeout=300s

Write-Host "외부 접속 정보:" -ForegroundColor Cyan

# PowerShell에서 IP 추출
try {
    $grafanaSvc = kubectl get svc -n monitoring monitoring-grafana -o json | ConvertFrom-Json
    $grafanaIP = $grafanaSvc.status.loadBalancer.ingress[0].ip
    
    $alertmanagerSvc = kubectl get svc -n monitoring monitoring-kube-prometheus-alertmanager -o json | ConvertFrom-Json
    $alertmanagerIP = $alertmanagerSvc.status.loadBalancer.ingress[0].ip
    
    Write-Host ""
    Write-Host "Grafana Dashboard:" -ForegroundColor Green
    Write-Host "   URL: http://${grafanaIP}:3000" -ForegroundColor White
    Write-Host "   Username: admin" -ForegroundColor White
    Write-Host "   Password: dys-monitoring-2024" -ForegroundColor White
    Write-Host ""
    Write-Host "Prometheus:" -ForegroundColor Green
    Write-Host "   URL: http://${alertmanagerIP}:9090" -ForegroundColor White
    Write-Host ""
    Write-Host "AlertManager:" -ForegroundColor Green
    Write-Host "   URL: http://${alertmanagerIP}:9093" -ForegroundColor White
    Write-Host ""
} catch {
    Write-Host "IP 정보 추출 실패, 수동으로 확인하세요:" -ForegroundColor Yellow
    Write-Host "kubectl get svc -n monitoring" -ForegroundColor White
}

# 9. DYS 백엔드 타겟 확인
Write-Host "DYS 백엔드 모니터링 타겟 확인..." -ForegroundColor Yellow
Write-Host "Prometheus에서 다음 타겟들을 확인하세요:" -ForegroundColor White
Write-Host "- dys-backend-monitor/0 (http://<pod-ip>:8000/metrics)" -ForegroundColor White
Write-Host "- dys-backend-pods/0 (WebSocket 포트)" -ForegroundColor White
Write-Host "- kubernetes-pods (동적 Pod 감지)" -ForegroundColor White

# 10. 유용한 PromQL 쿼리 예시
Write-Host ""
Write-Host "유용한 모니터링 쿼리:" -ForegroundColor Cyan
Write-Host "노드 변경 추적: changes(dys_node_info[1h])" -ForegroundColor White
Write-Host "빌드 정보: dys_build_info" -ForegroundColor White
Write-Host "Active Pods: up{job=`"dys-backend-tracking`"}" -ForegroundColor White
Write-Host "HTTP 요청수: rate(dys_http_requests_total[5m])" -ForegroundColor White
Write-Host "표정 분석 성공률: rate(dys_expression_analysis_total{status=`"success`"}[5m])" -ForegroundColor White

Write-Host ""
Write-Host "설치 완료! 모든 서비스가 준비되었습니다." -ForegroundColor Green
Write-Host "노드 변경 시 자동으로 새로운 Pod가 감지되고 추적됩니다." -ForegroundColor Cyan
