# Pod 수 줄이기 명령어

## 테스트 완료 후 2개로 다시 줄이기

### 1. deployment.yaml 수정
```yaml
# replicas: 10 → replicas: 2로 변경
replicas: 2
```

### 2. Git 커밋 & 푸시
```bash
git add deployment/k8s/deployment.yaml
git commit -m "Scale back to 2 pods after testing"
git push
```

### 3. GKE에 적용
```bash
kubectl apply -f deployment/k8s/deployment.yaml
```

### 4. 확인
```bash
# Pod 수 확인
kubectl get pods -l app=dys-backend

# 리소스 사용량 확인
kubectl top pods
```

## 또는 kubectl 명령어로 즉시 변경

```bash
# 즉시 2개로 줄이기
kubectl scale deployment dys-deployment --replicas=2

# 즉시 1개로 줄이기 (원래대로)
kubectl scale deployment dys-deployment --replicas=1
```
