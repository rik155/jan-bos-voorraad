const video = document.getElementById('scannerVideo');
const scannerBox = document.getElementById('scannerBox');
const html5Reader = document.getElementById('html5Reader');
const startBtn = document.getElementById('startScanner');
const stopBtn = document.getElementById('stopScanner');
const torchBtn = document.getElementById('torchScanner');
const message = document.getElementById('scannerMessage');
const successLayer = document.getElementById('scanSuccess');

let scanner = null;
let busy = false;
let audioContext = null;
let torchOn = false;
let cameraTrack = null;

function cleanBarcode(value) {
  return String(value || '').trim().replace(/\s+/g, '');
}

function targetFor(code) {
  const clean = cleanBarcode(code);
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
  } catch (_) {
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
    oscillator.frequency.setValueAtTime(1150, audioContext.currentTime);
    gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.28, audioContext.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.18);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.19);
  } catch (_) {}
}

function successFeedback() {
  beep();
  if (navigator.vibrate) navigator.vibrate([90, 40, 90]);
  successLayer?.classList.add('show');
}

async function stopScanner() {
  if (scanner) {
    try {
      const state = scanner.getState?.();
      if (state === 2 || state === 3) await scanner.stop();
    } catch (_) {}
    try { await scanner.clear(); } catch (_) {}
    scanner = null;
  }
  cameraTrack = null;
  torchOn = false;
  torchBtn.hidden = true;
  torchBtn.classList.remove('active');
  torchBtn.textContent = '💡 Zaklamp aan';
  html5Reader.innerHTML = '';
  scannerBox.classList.remove('scanner-running');
  startBtn.hidden = false;
  stopBtn.hidden = true;
}

async function finishScan(code) {
  if (busy) return;
  busy = true;
  successFeedback();
  message.textContent = 'Barcode gevonden';
  await new Promise(resolve => setTimeout(resolve, 320));
  await stopScanner();
  targetFor(code);
}

function getFormats() {
  if (!window.Html5QrcodeSupportedFormats) return undefined;
  return [
    Html5QrcodeSupportedFormats.EAN_13,
    Html5QrcodeSupportedFormats.EAN_8,
    Html5QrcodeSupportedFormats.CODE_128,
    Html5QrcodeSupportedFormats.CODE_39,
    Html5QrcodeSupportedFormats.UPC_A,
    Html5QrcodeSupportedFormats.UPC_E,
    Html5QrcodeSupportedFormats.ITF
  ];
}

function scannerConfig() {
  return {
    fps: 12,
    qrbox: (viewWidth, viewHeight) => ({
      width: Math.floor(Math.min(viewWidth * 0.94, 520)),
      height: Math.floor(Math.min(viewHeight * 0.42, 210))
    }),
    aspectRatio: 1.333333,
    disableFlip: true,
    experimentalFeatures: { useBarCodeDetectorIfSupported: true }
  };
}

async function startScanner() {
  busy = false;
  unlockAudio();
  successLayer?.classList.remove('show');

  if (!navigator.mediaDevices?.getUserMedia) {
    message.textContent = 'Camera wordt op dit toestel niet ondersteund.';
    return;
  }
  if (typeof Html5Qrcode === 'undefined') {
    message.textContent = 'Scannerbestand kon niet laden. Open de app opnieuw met internetverbinding.';
    return;
  }

  startBtn.disabled = true;
  message.textContent = 'Achtercamera starten...';

  try {
    scannerBox.classList.add('scanner-running');
    scanner = new Html5Qrcode('html5Reader', {
      formatsToSupport: getFormats(),
      verbose: false
    });

    await scanner.start(
      { facingMode: { exact: 'environment' } },
      scannerConfig(),
      decodedText => finishScan(decodedText),
      () => {}
    );

    startBtn.hidden = true;
    stopBtn.hidden = false;
    message.textContent = 'Houd de hele streepjescode recht en dichtbij in het kader';

    const videoElement = html5Reader.querySelector('video');
    cameraTrack = videoElement?.srcObject?.getVideoTracks?.()[0] || null;
    const capabilities = cameraTrack?.getCapabilities?.() || {};
    if (capabilities.torch) torchBtn.hidden = false;

    // iPhone 11: vraag na het starten de best haalbare camera-instellingen aan.
    if (cameraTrack?.applyConstraints) {
      const advanced = [];
      if (capabilities.focusMode?.includes?.('continuous')) advanced.push({ focusMode: 'continuous' });
      if (capabilities.zoom) advanced.push({ zoom: Math.min(1.4, capabilities.zoom.max || 1.4) });
      if (advanced.length) {
        try { await cameraTrack.applyConstraints({ advanced }); } catch (_) {}
      }
    }
  } catch (error) {
    console.error('Scanner startfout:', error);
    try {
      // Safari accepteert op sommige iPhones alleen de eenvoudigere camera-aanvraag.
      await stopScanner();
      scannerBox.classList.add('scanner-running');
      scanner = new Html5Qrcode('html5Reader', { formatsToSupport: getFormats(), verbose: false });
      await scanner.start(
        { facingMode: 'environment' },
        scannerConfig(),
        decodedText => finishScan(decodedText),
        () => {}
      );
      startBtn.hidden = true;
      stopBtn.hidden = false;
      message.textContent = 'Houd de hele streepjescode recht en dichtbij in het kader';
    } catch (fallbackError) {
      console.error('Scanner fallbackfout:', fallbackError);
      await stopScanner();
      if (fallbackError?.name === 'NotAllowedError') {
        message.textContent = 'Cameratoegang is geweigerd. Sta camera toe bij de instellingen van Safari.';
      } else if (fallbackError?.name === 'NotFoundError') {
        message.textContent = 'Geen achtercamera gevonden.';
      } else {
        message.textContent = 'Camera kon niet starten. Sluit de app volledig en open hem opnieuw.';
      }
    }
  } finally {
    startBtn.disabled = false;
  }
}

async function toggleTorch() {
  if (!cameraTrack?.applyConstraints) return;
  try {
    torchOn = !torchOn;
    await cameraTrack.applyConstraints({ advanced: [{ torch: torchOn }] });
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
  if (code) targetFor(code);
});

document.getElementById('barcodePhoto')?.addEventListener('change', async event => {
  const file = event.target.files?.[0];
  if (!file) return;
  unlockAudio();
  busy = false;
  message.textContent = 'Barcode op foto zoeken...';
  try {
    if (typeof Html5Qrcode === 'undefined') throw new Error('Scannerbestand niet geladen');
    const photoScanner = new Html5Qrcode('html5Reader', { formatsToSupport: getFormats(), verbose: false });
    const code = await photoScanner.scanFile(file, true);
    try { await photoScanner.clear(); } catch (_) {}
    await finishScan(code);
  } catch (_) {
    message.textContent = 'Geen barcode gevonden. Maak de foto recht, scherp en dichtbij.';
    event.target.value = '';
  }
});

window.addEventListener('pagehide', stopScanner);
