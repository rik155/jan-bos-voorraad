const video=document.getElementById('scannerVideo');
const startBtn=document.getElementById('startScanner');
const stopBtn=document.getElementById('stopScanner');
const message=document.getElementById('scannerMessage');
let stream=null, timer=null, detector=null, busy=false;

function targetFor(code){return window.SCANNER_MODE==='daily'?lookupDaily(code):location.href='/inventarisatie?barcode='+encodeURIComponent(code)}
async function lookupDaily(code){
  if(busy)return; busy=true; message.textContent='Product zoeken...';
  try{const r=await fetch('/api/barcode/'+encodeURIComponent(code));const d=await r.json();
    if(d.found){location.href='/product/'+d.id}else{message.textContent='Barcode niet bekend. Start eerst inventarisatie.';busy=false}}
  catch(e){message.textContent='Zoeken mislukt. Probeer opnieuw.';busy=false}
}
async function stopScanner(){if(timer)clearInterval(timer);timer=null;if(stream){stream.getTracks().forEach(t=>t.stop());stream=null}video.srcObject=null;startBtn.hidden=false;stopBtn.hidden=true}
async function startScanner(){
  if(!navigator.mediaDevices?.getUserMedia){message.textContent='Camera wordt niet ondersteund. Vul de barcode handmatig in.';return}
  try{
    stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:720}},audio:false});
    video.srcObject=stream;await video.play();startBtn.hidden=true;stopBtn.hidden=false;message.textContent='Houd de barcode recht in beeld';
    if('BarcodeDetector' in window){detector=new BarcodeDetector({formats:['ean_13','ean_8','code_128','code_39','upc_a','upc_e','itf']});timer=setInterval(async()=>{if(busy||video.readyState<2)return;try{const codes=await detector.detect(video);if(codes.length){busy=true;await stopScanner();targetFor(codes[0].rawValue)}}catch(e){}},250)}
    else{message.textContent='Automatisch scannen werkt niet in deze browser. Vul de barcode hieronder in.'}
  }catch(e){message.textContent='Camera kon niet worden geopend. Geef cameratoegang of vul de barcode handmatig in.'}
}
startBtn?.addEventListener('click',startScanner);stopBtn?.addEventListener('click',stopScanner);
document.getElementById('manualLookup')?.addEventListener('submit',e=>{e.preventDefault();const code=document.getElementById('manualBarcode').value.trim();if(code)targetFor(code)});
window.addEventListener('pagehide',stopScanner);
