// Configure this to your deployed secure backend. Keep GitHub tokens out of this file.
const API_BASE = "";
const $ = id => document.getElementById(id);
let selectedFile = null, currentBuild = null, apkUrl = null;
const stateKey = "apk-builder-history-v1";
const fmtSize = n => n < 1024*1024 ? `${(n/1024).toFixed(0)} KB` : `${(n/1024/1024).toFixed(1)} MB`;
function setFile(file){
  if(!file)return;
  if(!file.name.toLowerCase().endsWith(".zip")){alert("Please select a ZIP file.");return;}
  selectedFile=file;
  $("fileInfo").classList.remove("hidden");
  $("fileInfo").innerHTML=`<span>📦 <b>${escapeHtml(file.name)}</b><br><small>${fmtSize(file.size)}</small></span><button id="removeFile" aria-label="Remove file">Remove</button>`;
  $("removeFile").onclick=()=>{selectedFile=null;$("fileInfo").classList.add("hidden");$("buildBtn").disabled=true;};
  $("projectName").value=$("projectName").value||file.name.replace(/\.zip$/i,"");
  $("buildBtn").disabled=false;
}
function escapeHtml(s){return s.replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));}
const dz=$("dropzone");
["dragenter","dragover"].forEach(e=>dz.addEventListener(e,ev=>{ev.preventDefault();dz.classList.add("dragover");}));
["dragleave","drop"].forEach(e=>dz.addEventListener(e,ev=>{ev.preventDefault();dz.classList.remove("dragover");}));
dz.addEventListener("drop",e=>setFile(e.dataTransfer.files[0]));
dz.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();$("fileInput").click();}});
$("fileInput").addEventListener("change",e=>setFile(e.target.files[0]));
function updateStatus(status,message,progress=0){$("statusText").textContent=status;$("buildDetails").textContent=message;$("progressBar").style.width=progress+"%";}
$("buildBtn").onclick=async()=>{
 if(!selectedFile)return;
 if(!API_BASE){updateStatus("Backend not connected","The upload interface is ready. Connect the secure build backend to start cloud builds.");$("logs").textContent="Setup required: configure API_BASE and deploy the backend. No file was uploaded."; $("logs").classList.remove("hidden");$("logsBtn").disabled=false;return;}
 const name=$("projectName").value.trim()||selectedFile.name;
 const form=new FormData();form.append("project",selectedFile);form.append("name",name);
 $("buildBtn").disabled=true;updateStatus("Uploading…","Sending project ZIP to secure backend.",10);
 try{
  const r=await fetch(`${API_BASE}/builds`,{method:"POST",body:form});
  if(!r.ok)throw new Error(await r.text());
  currentBuild=await r.json();updateStatus("Queued","Build submitted. Checking status…",15);
  addHistory({name,status:"Queued",id:currentBuild.id,time:new Date().toISOString()});
  pollBuild();
 }catch(e){updateStatus("Build request failed",e.message);$("logs").textContent=e.message;$("logs").classList.remove("hidden");}
 finally{$("buildBtn").disabled=!selectedFile;}
};
async function pollBuild(){
 if(!currentBuild?.id)return;
 try{
  const r=await fetch(`${API_BASE}/builds/${encodeURIComponent(currentBuild.id)}`);
  if(!r.ok)throw new Error("Could not retrieve build status");
  const b=await r.json();updateStatus(b.status,b.message||"",b.progress||20);
  if(b.logs){$("logs").textContent=b.logs;$("logsBtn").disabled=false;}
  if(b.status==="success"){apkUrl=b.downloadUrl;$("downloadBtn").disabled=!apkUrl;$("installBtn").disabled=!apkUrl;updateHistory(currentBuild.id,"Success");return;}
  if(b.status==="failed"){updateHistory(currentBuild.id,"Failed");return;}
  setTimeout(pollBuild,5000);
 }catch(e){updateStatus("Status unavailable",e.message);setTimeout(pollBuild,10000);}
}
$("logsBtn").onclick=()=>$("logs").classList.toggle("hidden");
$("downloadBtn").onclick=()=>{if(apkUrl)location.href=apkUrl;};
$("installBtn").onclick=()=>{if(apkUrl)location.href=apkUrl;};
function getHistory(){try{return JSON.parse(localStorage.getItem(stateKey)||"[]")}catch{return[]}}
function saveHistory(h){localStorage.setItem(stateKey,JSON.stringify(h.slice(0,20)));renderHistory();}
function addHistory(item){saveHistory([item,...getHistory()]);}
function updateHistory(id,status){saveHistory(getHistory().map(x=>x.id===id?{...x,status}:x));}
function renderHistory(){const h=getHistory();$("history").innerHTML=h.length?h.map(x=>`<div class="history-item"><div><b>${escapeHtml(x.name)}</b><small>${new Date(x.time).toLocaleString()}</small></div><span>${escapeHtml(x.status)}</span></div>`).join(""):'<div class="history-empty">Your builds will appear here.</div>';}
$("clearHistory").onclick=()=>{localStorage.removeItem(stateKey);renderHistory();};renderHistory();
if("serviceWorker" in navigator && location.protocol.startsWith("http"))navigator.serviceWorker.register("./sw.js").catch(()=>{});
