const video=document.getElementById('scannerVideo');
const nativeBox=document.getElementById('scannerBox');
const fallbackBox=document.getElementById('html5Reader');
const startBtn=document.getElementById('startScanner');
const stopBtn=document.getElementById('stopScanner');
const message=document.getElementById('scannerMessage');
let stream=null,timer=null,detector=null,busy=false,html5Scanner=null;

function targetFor(code){return window.SCANNER_MODE==='daily'?lookupDaily(code):location.href='/inventarisatie?barcode='+encodeURIComponent(code)}
async function lookupDaily(code){
  if(busy)return;busy=true;message.textContent='Product zoeken...';
  try{const r=await fetch('/api/barcode/'+encodeURIComponent(code));const d=await r.json();
    if(d.found){location.href='/product/'+d.id+'?mode=scan'}else{message.textContent='Barcode niet bekend. Start eerst inventarisatie.';busy=false}}
  catch(e){message.textContent='Zoeken mislukt. Probeer opnieuw.';busy=false}
}
async function stopScanner(){
  if(timer)clearInterval(timer);timer=null;
  if(stream){stream.getTracks().forEach(t=>t.stop());stream=null}
  if(video)video.srcObject=null;
  if(html5Scanner){try{await html5Scanner.stop()}catch(e){}try{await html5Scanner.clear()}catch(e){}html5Scanner=null}
  nativeBox?.classList.remove('hidden-scanner');fallbackBox?.classList.add('hidden-scanner');
  startBtn.hidden=false;stopBtn.hidden=true;
}
async function finishScan(code){
  if(busy)return;busy=true;await stopScanner();targetFor(String(code||'').trim());
}
async function startFallbackScanner(){
  if(typeof Html5Qrcode==='undefined')throw new Error('Scannerbibliotheek niet geladen');
  nativeBox?.classList.add('hidden-scanner');fallbackBox?.classList.remove('hidden-scanner');
  html5Scanner=new Html5Qrcode('html5Reader',false);
  const formats=[
    Html5QrcodeSupportedFormats.EAN_13,Html5QrcodeSupportedFormats.EAN_8,
    Html5QrcodeSupportedFormats.CODE_128,Html5QrcodeSupportedFormats.CODE_39,
    Html5QrcodeSupportedFormats.UPC_A,Html5QrcodeSupportedFormats.UPC_E,
    Html5QrcodeSupportedFormats.ITF
  ];
  await html5Scanner.start(
    {facingMode:'environment'},
    {fps:12,qrbox:(w,h)=>({width:Math.min(w*0.88,430),height:Math.min(h*0.34,170)}),aspectRatio:1.333333,formatsToSupport:formats},
    decodedText=>finishScan(decodedText),
    ()=>{}
  );
  startBtn.hidden=true;stopBtn.hidden=false;message.textContent='Houd de streepjescode rustig en scherp in het vak';
}
async function startScanner(){
  busy=false;
  if(!navigator.mediaDevices?.getUserMedia){message.textContent='Camera wordt niet ondersteund. Vul de barcode handmatig in.';return}
  try{
    if('BarcodeDetector' in window){
      stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1920},height:{ideal:1080}},audio:false});
      video.srcObject=stream;await video.play();startBtn.hidden=true;stopBtn.hidden=false;message.textContent='Houd de streepjescode rustig en scherp in het vak';
      detector=new BarcodeDetector({formats:['ean_13','ean_8','code_128','code_39','upc_a','upc_e','itf']});
      timer=setInterval(async()=>{if(busy||video.readyState<2)return;try{const codes=await detector.detect(video);if(codes.length)await finishScan(codes[0].rawValue)}catch(e){}},220);
    }else{
      await startFallbackScanner();
    }
  }catch(e){
    try{await startFallbackScanner()}catch(fallbackError){message.textContent='Camera kon niet worden geopend. Controleer cameratoegang of vul de barcode handmatig in.';startBtn.hidden=false;stopBtn.hidden=true}
  }
}
startBtn?.addEventListener('click',startScanner);stopBtn?.addEventListener('click',stopScanner);
document.getElementById('manualLookup')?.addEventListener('submit',e=>{e.preventDefault();const code=document.getElementById('manualBarcode').value.trim();if(code)targetFor(code)});
window.addEventListener('pagehide',stopScanner);
