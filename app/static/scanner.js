const video = document.getElementById('scannerVideo');
const startBtn = document.getElementById('startScanner');
const stopBtn = document.getElementById('stopScanner');
const torchBtn = document.getElementById('torchScanner');
const message = document.getElementById('scannerMessage');
const successLayer = document.getElementById('scanSuccess');

let controls = null;
let currentStream = null;
let busy = false;
let audioContext = null;
let torchOn = false;

function targetFor(code) {
  const clean = String(code || '').replace(/\D/g, '');
  if (!clean) return;
  if (window.SCANNER_MODE === 'daily') lookupDaily(clean);
  else location.href = '/inventarisatie?barcode=' + encodeURIComponent(clean);
}

async function lookupDaily(code) {
  if (busy) return;
  busy = true;
  message.textContent = 'Product zoeken...';
  try {
    const response = await fetch('/api/barcode/' + encodeURIComponent(code), { cache: 'no-store' });
    const data = await response.json();
    if (data.found) {
      location.href = '/product/' + data.id + '?mode=scan';
      return;
    }
    message.textContent = 'Barcode niet bekend. Voeg het product eerst toe.';
    busy = false;
  } catch (error) {
    message.textContent = 'Zoeken mislukt. Probeer opnieuw.';
    busy = false;
  }
}

function unlockAudio() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    audioContext = audioContext || new AudioCtx();
    if (audioContext.state === 'suspended') audioContext.resume();
  } catch (_) {}
}

function beep() {
  try {
    unlockAudio();
    if (!audioContext) return;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(1050, audioContext.currentTime);
    gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.25, audioContext.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.14);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.15);
  } catch (_) {}
}

function successFeedback() {
  beep();
  if (navigator.vibrate) navigator.vibrate([80, 35, 80]);
  successLayer?.classList.add('show');
}

async function stopScanner() {
  try { controls?.stop(); } catch (_) {}
  controls = null;
  if (currentStream) {
    currentStream.getTracks().forEach(track => track.stop());
    currentStream = null;
  }
  if (video) video.srcObject = null;
  startBtn.hidden = false;
  stopBtn.hidden = true;
  torchBtn.hidden = true;
  torchOn = false;
  torchBtn?.classList.remove('active');
}

async function finishScan(code) {
  if (busy) return;
  busy = true;
  successFeedback();
  message.textContent = 'Barcode gevonden';
  await new Promise(resolve => setTimeout(resolve, 260));
  await stopScanner();
  targetFor(code);
}

function getBackCameraConstraints() {
  return {
    audio: false,
    video: {
      facingMode: { ideal: 'environment' },
      width: { ideal: 1920 },
      height: { ideal: 1080 },
      frameRate: { ideal: 30, max: 60 },
      focusMode: { ideal: 'continuous' }
    }
  };
}

async function startZxingScanner() {
  if (!window.ZXingBrowser?.BrowserMultiFormatReader) {
    throw new Error('ZXing is niet geladen');
  }

  const reader = new ZXingBrowser.BrowserMultiFormatReader({
    delayBetweenScanAttempts: 70,
    delayBetweenScanSuccess: 700
  });

  controls = await reader.decodeFromConstraints(
    getBackCameraConstraints(),
    video,
    (result, error, scanControls) => {
      if (scanControls) controls = scanControls;
      if (result?.getText) finishScan(result.getText());
    }
  );

  currentStream = video.srcObject;
  startBtn.hidden = true;
  stopBtn.hidden = false;
  message.textContent = 'Houd de volledige streepjescode in het kader';

  const track = currentStream?.getVideoTracks?.()[0];
  const capabilities = track?.getCapabilities?.() || {};
  if (capabilities.torch || typeof controls?.switchTorch === 'function') {
    torchBtn.hidden = false;
  }
}

async function startScanner() {
  busy = false;
  unlockAudio();
  successLayer?.classList.remove('show');

  if (!navigator.mediaDevices?.getUserMedia) {
    message.textContent = 'Camera wordt niet ondersteund. Vul de barcode handmatig in.';
    return;
  }

  startBtn.disabled = true;
  message.textContent = 'Camera starten...';

  try {
    await startZxingScanner();
  } catch (error) {
    console.error(error);
    message.textContent = 'Scanner kon niet starten. Controleer cameratoegang en internetverbinding.';
    await stopScanner();
  } finally {
    startBtn.disabled = false;
  }
}

async function toggleTorch() {
  try {
    torchOn = !torchOn;
    if (typeof controls?.switchTorch === 'function') {
      await controls.switchTorch(torchOn);
    } else {
      const track = currentStream?.getVideoTracks?.()[0];
      await track?.applyConstraints?.({ advanced: [{ torch: torchOn }] });
    }
    torchBtn.classList.toggle('active', torchOn);
    torchBtn.textContent = torchOn ? '💡 Zaklamp uit' : '💡 Zaklamp aan';
  } catch (_) {
    torchOn = false;
    torchBtn.hidden = true;
  }
}

startBtn?.addEventListener('click', startScanner);
stopBtn?.addEventListener('click', stopScanner);
torchBtn?.addEventListener('click', toggleTorch);

document.getElementById('manualLookup')?.addEventListener('submit', event => {
  event.preventDefault();
  const code = document.getElementById('manualBarcode').value.trim();
  if (code) {
    unlockAudio();
    targetFor(code);
  }
});

document.getElementById('barcodePhoto')?.addEventListener('change', async event => {
  const file = event.target.files?.[0];
  if (!file) return;
  unlockAudio();
  busy = false;
  message.textContent = 'Barcode op foto zoeken...';

  try {
    if (!window.ZXingBrowser?.BrowserMultiFormatReader) throw new Error('ZXing is niet geladen');
    const imageUrl = URL.createObjectURL(file);
    const reader = new ZXingBrowser.BrowserMultiFormatReader();
    const result = await reader.decodeFromImageUrl(imageUrl);
    URL.revokeObjectURL(imageUrl);
    await finishScan(result.getText());
  } catch (error) {
    message.textContent = 'Geen barcode gevonden. Maak de foto recht, scherp en dichtbij.';
    event.target.value = '';
  }
});

window.addEventListener('pagehide', stopScanner);
