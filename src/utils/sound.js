// Web Audio API 기반 8비트 아케이드 효과음 합성기 모듈

let sharedAudioContext = null;

// 브라우저 AudioContext 지연 초기화 및 일시정지 상태 해제 목적
function getAudioContext() {
  if (typeof window === 'undefined') {
    return null;
  }
  const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextConstructor) {
    return null;
  }
  if (!sharedAudioContext) {
    sharedAudioContext = new AudioContextConstructor();
  }
  if (
    sharedAudioContext.state === 'suspended' &&
    typeof sharedAudioContext.resume === 'function'
  ) {
    sharedAudioContext.resume().catch(() => {});
  }
  return sharedAudioContext;
}

// 8비트 오실레이터 톤 시퀀스 스케줄링 목적
function playToneSequence(audioContext, toneSteps) {
  const baseTime = audioContext.currentTime;
  for (let stepIndex = 0; stepIndex < toneSteps.length; stepIndex += 1) {
    const toneStep = toneSteps[stepIndex];
    const startTime = baseTime + (toneStep.delay || 0);
    const stopTime = startTime + toneStep.duration;

    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.type = toneStep.waveform || 'square';
    oscillator.frequency.setValueAtTime(toneStep.frequency, startTime);
    if (toneStep.endFrequency) {
      oscillator.frequency.exponentialRampToValueAtTime(
        Math.max(20, toneStep.endFrequency),
        stopTime
      );
    }

    const peakGain = toneStep.gain || 0.08;
    gainNode.gain.setValueAtTime(0.0001, startTime);
    gainNode.gain.linearRampToValueAtTime(peakGain, startTime + 0.008);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, stopTime);

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.start(startTime);
    oscillator.stop(stopTime + 0.02);
  }
}

const SOUND_PRESETS = {
  star: [
    { waveform: 'square', frequency: 587.33, duration: 0.06, delay: 0, gain: 0.07 },
    { waveform: 'square', frequency: 880, duration: 0.09, delay: 0.05, gain: 0.08 }
  ],
  place: [
    { waveform: 'triangle', frequency: 261.63, endFrequency: 329.63, duration: 0.07, delay: 0, gain: 0.1 }
  ],
  perfect: [
    { waveform: 'square', frequency: 523.25, duration: 0.06, delay: 0, gain: 0.07 },
    { waveform: 'square', frequency: 659.25, duration: 0.06, delay: 0.055, gain: 0.075 },
    { waveform: 'square', frequency: 1046.5, duration: 0.12, delay: 0.11, gain: 0.085 }
  ],
  powerup: [
    { waveform: 'square', frequency: 392, duration: 0.055, delay: 0, gain: 0.07 },
    { waveform: 'square', frequency: 523.25, duration: 0.055, delay: 0.05, gain: 0.075 },
    { waveform: 'square', frequency: 659.25, duration: 0.055, delay: 0.1, gain: 0.08 },
    { waveform: 'square', frequency: 783.99, duration: 0.1, delay: 0.15, gain: 0.085 }
  ],
  fever: [
    { waveform: 'square', frequency: 523.25, duration: 0.05, delay: 0, gain: 0.075 },
    { waveform: 'square', frequency: 659.25, duration: 0.05, delay: 0.05, gain: 0.075 },
    { waveform: 'square', frequency: 783.99, duration: 0.05, delay: 0.1, gain: 0.08 },
    { waveform: 'square', frequency: 1046.5, duration: 0.06, delay: 0.15, gain: 0.085 },
    { waveform: 'square', frequency: 1318.51, duration: 0.14, delay: 0.21, gain: 0.09 }
  ],
  shieldBreak: [
    { waveform: 'sawtooth', frequency: 440, endFrequency: 220, duration: 0.09, delay: 0, gain: 0.07 },
    { waveform: 'sawtooth', frequency: 240, endFrequency: 130, duration: 0.11, delay: 0.07, gain: 0.065 }
  ],
  gameover: [
    { waveform: 'square', frequency: 392, duration: 0.11, delay: 0, gain: 0.08 },
    { waveform: 'square', frequency: 329.63, duration: 0.11, delay: 0.11, gain: 0.075 },
    { waveform: 'square', frequency: 261.63, duration: 0.12, delay: 0.22, gain: 0.075 },
    { waveform: 'triangle', frequency: 196, endFrequency: 146.83, duration: 0.22, delay: 0.34, gain: 0.09 }
  ]
};

// 게임 이벤트 이름에 대응하는 8비트 효과음 재생 목적
export function playSoundEffect(eventName, muted = false) {
  if (muted) {
    return;
  }
  const presetSteps = SOUND_PRESETS[eventName];
  if (!presetSteps) {
    return;
  }
  try {
    const audioContext = getAudioContext();
    if (!audioContext) {
      return;
    }
    playToneSequence(audioContext, presetSteps);
  } catch (audioError) {
    // 오디오 정책 제한 환경에서 게임 진행 중단 방지 목적
  }
}
