/**
 * Design-only stub: MediaPipe/Camera logic removed.
 */

let analyzerClient = null;
let analyzerStarted = false;

class CameraAnalyzer {
  constructor() {}
  async start() { console.log('[ANALYZER] (noop) start'); }
  stop() { console.log('[ANALYZER] (noop) stop'); }
  cleanup() { console.log('[ANALYZER] (noop) cleanup'); }
  ingestRealtimeScores() {}
}

function scheduleAnalyzerStart() {
  console.log('[ANALYZER] (noop) scheduleAnalyzerStart');
}

window.CameraAnalyzer = CameraAnalyzer;
window.analyzerClient = analyzerClient;
window.analyzerStarted = analyzerStarted;
window.scheduleAnalyzerStart = scheduleAnalyzerStart;
