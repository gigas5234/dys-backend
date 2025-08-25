/**
 * 성능 모니터링 유틸리티
 * 파일 분리 후 성능 영향을 측정
 */

const PerformanceMonitor = {
    startTime: performance.now(),
    metrics: {},

    /**
     * 메트릭 기록
     */
    mark(name) {
        const now = performance.now();
        this.metrics[name] = {
            timestamp: now,
            elapsed: now - this.startTime
        };
        console.log(`[PERF] ${name}: ${(now - this.startTime).toFixed(2)}ms`);
    },

    /**
     * 모듈 로딩 시간 측정
     */
    measureModuleLoading() {
        // HTML 파싱 완료
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.mark('DOM_READY');
            });
        } else {
            this.mark('DOM_READY');
        }

        // 캘리브레이션 모듈 로딩 완료 (사용자 정보 초기화 후)
        const checkCalibrationModule = () => {
            if (typeof window.CalibrationModule !== 'undefined' && 
                typeof window.CalibrationModule.initializeCalibration === 'function' &&
                window.userId && window.email && window.token) {
                this.mark('CALIBRATION_MODULE_READY');
                this.calculateLoadingImpact();
            } else {
                setTimeout(checkCalibrationModule, 10); // 사용자 정보도 체크하므로 조금 더 긴 간격
            }
        };
        checkCalibrationModule();

        // 페이지 완전 로딩 완료
        window.addEventListener('load', () => {
            this.mark('WINDOW_LOAD');
        });
    },

    /**
     * 로딩 영향도 계산
     */
    calculateLoadingImpact() {
        const domReady = this.metrics['DOM_READY']?.elapsed || 0;
        const moduleReady = this.metrics['CALIBRATION_MODULE_READY']?.elapsed || 0;
        const moduleDelay = moduleReady - domReady;

        console.group('[PERF] 모듈 분리 성능 영향');
        console.log(`DOM 준비: ${domReady.toFixed(2)}ms`);
        console.log(`캘리브레이션 모듈 준비: ${moduleReady.toFixed(2)}ms`);
        console.log(`모듈 로딩 지연: ${moduleDelay.toFixed(2)}ms`);
        
        // 모듈이 이미 로드된 경우 (순차적 로딩)
        if (moduleDelay < 10) {
            console.log('✅ 순차적 로딩 - 성능 영향 없음');
        } else if (moduleDelay < 50) {
            console.log('✅ 성능 영향 미미 (50ms 미만)');
        } else if (moduleDelay < 100) {
            console.warn('⚠️ 경미한 성능 영향 (50-100ms)');
        } else {
            console.error('❌ 성능 영향 상당 (100ms 이상)');
        }
        console.groupEnd();
    },

    /**
     * 메모리 사용량 측정
     */
    measureMemoryUsage() {
        if (performance.memory) {
            const memory = performance.memory;
            console.group('[PERF] 메모리 사용량');
            console.log(`사용 중: ${(memory.usedJSHeapSize / 1024 / 1024).toFixed(2)}MB`);
            console.log(`할당됨: ${(memory.totalJSHeapSize / 1024 / 1024).toFixed(2)}MB`);
            console.log(`한계: ${(memory.jsHeapSizeLimit / 1024 / 1024).toFixed(2)}MB`);
            console.groupEnd();
        }
    },

    /**
     * 네트워크 요청 분석
     */
    analyzeNetworkRequests() {
        if (performance.getEntriesByType) {
            const resources = performance.getEntriesByType('resource');
            const jsFiles = resources.filter(r => r.name.endsWith('.js'));
            
            console.group('[PERF] JavaScript 파일 로딩');
            jsFiles.forEach(file => {
                const filename = file.name.split('/').pop();
                console.log(`${filename}: ${file.duration.toFixed(2)}ms (크기: ${file.transferSize || 'N/A'} bytes)`);
            });
            console.groupEnd();
        }
    },

    /**
     * 종합 성능 리포트
     */
    generateReport() {
        setTimeout(() => {
            console.group('🚀 [PERF] 종합 성능 리포트');
            this.measureMemoryUsage();
            this.analyzeNetworkRequests();
            
            // 모듈 로딩 지연 계산
            const domReady = this.metrics['DOM_READY']?.elapsed || 0;
            const moduleReady = this.metrics['CALIBRATION_MODULE_READY']?.elapsed || 0;
            const moduleDelay = moduleReady - domReady;
            
            // 권장 사항
            console.group('💡 최적화 권장 사항');
            if (moduleDelay > 100) {
                console.log('1. 모듈 로딩 지연이 높음 - 순차적 로딩으로 변경 권장');
            } else {
                console.log('1. ✅ 모듈 로딩 성능 양호');
            }
            console.log('2. 사용하지 않는 코드 제거 (Tree shaking)');
            console.log('3. 모듈 압축 (Minification) 적용');
            console.log('4. 브라우저 캐싱 전략 최적화');
            console.log('5. WebSocket 연결 실패 시 HTTP 폴백 모드 활성화');
            console.groupEnd();
            
            console.groupEnd();
        }, 2000);
    }
};

// 성능 모니터링 시작
PerformanceMonitor.measureModuleLoading();

// 전역 접근 가능하도록 설정
window.PerformanceMonitor = PerformanceMonitor;
