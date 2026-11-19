const $ = id => document.getElementById(id);
const state = {files:[],duplicateGroups:[],lastScan:null,folderName:"",folderHandle:null};
const LARGE_FILE=250*1024*1024, views=["overview","storage","duplicates","reports","cleaner"];
const names={overview:"Overview",storage:"Storage analyzer",duplicates:"Duplicate finder",reports:"Reports",cleaner:"Browser cleaner"};
let toastTimer;
function formatBytes(bytes){if(!Number.isFinite(bytes)||bytes<0)return "—";if(!bytes)return "0 B";const units=["B","KB","MB","GB","TB"],i=Math.min(Math.floor(Math.log(bytes)/Math.log(1024)),4);return (bytes/Math.pow(1024,i)).toFixed(i===0?0:1)+" "+units[i]}
function showToast(message){const el=$("toast");el.textContent=message;el.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove("show"),3000)}
function navigate(view){if(!views.includes(view))return;document.querySelectorAll(".view").forEach(el=>el.classList.toggle("active",el.id==="view-"+view));document.querySelectorAll(".nav-link").forEach(el=>el.classList.toggle("active",el.dataset.view===view));$("pageName").textContent=names[view];$("sidebar").classList.remove("open");window.scrollTo({top:0,behavior:"smooth"})}
document.querySelectorAll(".nav-link").forEach(btn=>btn.addEventListener("click",()=>navigate(btn.dataset.view)));
document.querySelectorAll("[data-action]").forEach(btn=>btn.addEventListener("click",()=>navigate(btn.dataset.action)));
$("menuToggle").addEventListener("click",()=>$("sidebar").classList.toggle("open"));
$("startScanTop").addEventListener("click",()=>{navigate("storage");chooseFolder()});
$("startScanBanner").addEventListener("click",()=>{navigate("storage");chooseFolder()});
$("chooseFolder").addEventListener("click",chooseFolder);
$("fileInput").addEventListener("change",e=>{if(e.target.files&&e.target.files.length)processFiles(Array.from(e.target.files),"Selected files");e.target.value=""});
const duplicateInput=document.createElement("input");duplicateInput.type="file";duplicateInput.multiple=true;duplicateInput.hidden=true;document.body.appendChild(duplicateInput);
$("chooseDuplicateFiles").addEventListener("click",()=>duplicateInput.click());
duplicateInput.addEventListener("change",e=>{if(e.target.files&&e.target.files.length)analyzeDuplicates(Array.from(e.target.files));duplicateInput.value=""});
$("exportReport").addEventListener("click",exportReport);$("year").textContent=new Date().getFullYear();
async function chooseFolder(){if("showDirectoryPicker" in window){try{const handle=await window.showDirectoryPicker({mode:"read"});state.folderHandle=handle;const files=[];await walkDirectory(handle,"",files);processFiles(files,handle.name||"Selected folder",true)}catch(error){if(error.name!=="AbortError")showToast("Folder access unavailable. Try choosing individual files.");}}else{$("fileInput").click();showToast("This browser supports file selection, but not folder-level access.")}}
async function walkDirectory(directoryHandle,relativePath,output){for await(const entry of directoryHandle.values()){const path=relativePath?relativePath+"/"+entry.name:entry.name;if(entry.kind==="file"){try{const file=await entry.getFile();output.push({file,name:file.name,path,size:file.size,type:file.type,handle:entry,parentHandle:directoryHandle})}catch{}}else if(entry.kind==="directory")await walkDirectory(entry,path,output)}}
function normalizeFiles(files){return files.map(item=>{if(item.file&&typeof item.size==="number")return item;const file=item;return {file,name:file.name,path:file.webkitRelativePath||file.name,size:file.size,type:file.type,handle:null,parentHandle:null}})}
async function processFiles(rawFiles,folderName,fromFolder=false){const files=normalizeFiles(rawFiles);if(!files.length){showToast("No readable files were found.");return}state.files=files;state.folderName=folderName;state.lastScan=new Date();const total=files.reduce((sum,item)=>sum+item.size,0),large=files.filter(item=>item.size>=LARGE_FILE).sort((a,b)=>b.size-a.size);renderStorage(files);$("filesMetric").textContent=files.length.toLocaleString();$("sizeMetric").textContent=formatBytes(total);$("largeMetric").textContent=large.length.toLocaleString();$("filesCaption").textContent=folderName;$("lastScanLabel").textContent="Scanned "+state.lastScan.toLocaleTimeString([],{hour:"numeric",minute:"2-digit"});$("storageFiles").textContent=files.length.toLocaleString();$("storageSize").textContent=formatBytes(total);$("storageLarge").textContent=large.length.toLocaleString();$("reportTitle").textContent="Latest scan: "+folderName;$("reportDescription").textContent=state.lastScan.toLocaleString()+" · "+files.length.toLocaleString()+" files analyzed";renderReport(files,total,large);showToast("Analyzed "+files.length.toLocaleString()+" files locally.");if(fromFolder)$("folderSupport").textContent="Folder access granted for this session. Original files are not changed by scanning."}
function renderStorage(files){$("storageResultCount").textContent=files.length.toLocaleString()+" files";const list=files.slice().sort((a,b)=>b.size-a.size).slice(0,30);$("largeFilesBody").innerHTML=list.length?list.map(item=>"<tr><td>"+escapeHtml(item.name)+"</td><td>"+formatBytes(item.size)+"</td><td>"+escapeHtml(extension(item.name))+"</td><td title='"+escapeHtml(item.path)+"'>"+escapeHtml(shortPath(item.path))+"</td></tr>").join(""):'<tr><td colspan="4" class="empty-cell">No files found.</td></tr>'}
function extension(name){const index=name.lastIndexOf(".");return index>0?name.slice(index+1).toUpperCase():"FILE"}
function shortPath(path){return !path?"—":path.length>34?"…"+path.slice(-31):path}
function escapeHtml(value){return String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]))}
function progress(value,label){$("duplicateProgressWrap").classList.remove("hidden");$("duplicateProgressText").textContent=label;$("duplicateProgressPercent").textContent=value+"%";$("duplicateProgressBar").style.width=value+"%"}
async function analyzeDuplicates(rawFiles){if(!window.crypto||!crypto.subtle){showToast("Secure file fingerprinting requires HTTPS and a modern browser.");return}const files=normalizeFiles(rawFiles),bySize=new Map();files.forEach(item=>{if(item.size>0){if(!bySize.has(item.size))bySize.set(item.size,[]);bySize.get(item.size).push(item)}});const candidates=[...bySize.values()].filter(group=>group.length>1).flat();if(!candidates.length){state.duplicateGroups=[];renderDuplicates();$("duplicateCaption").textContent="No matching file sizes";showToast("No possible duplicates were found.");return}const hashes=new Map();let done=0;progress(0,"Fingerprinting candidate files…");for(const item of candidates){try{const digest=await crypto.subtle.digest("SHA-256",await item.file.arrayBuffer()),hash=Array.from(new Uint8Array(digest)).map(byte=>byte.toString(16).padStart(2,"0")).join("");if(!hashes.has(hash))hashes.set(hash,[]);hashes.get(hash).push(item)}catch{}done++;progress(Math.round(done/candidates.length*100),"Comparing "+done+" of "+candidates.length+" files…")}state.duplicateGroups=[...hashes.values()].filter(group=>group.length>1);renderDuplicates();$("duplicateProgressWrap").classList.add("hidden");$("duplicateCaption").textContent=state.duplicateGroups.length+" duplicate groups";showToast("Duplicate comparison complete.")}
function renderDuplicates(){const groups=state.duplicateGroups,copies=groups.reduce((sum,g)=>sum+g.length-1,0),bytes=groups.reduce((sum,g)=>sum+(g.length-1)*g[0].size,0);$("duplicateGroups").textContent=groups.length.toLocaleString();$("duplicateCopies").textContent=copies.toLocaleString();$("duplicateSpace").textContent=formatBytes(bytes);$("duplicateMetric").textContent=copies.toLocaleString();if(!groups.length){$("duplicateResults").innerHTML='<div class="empty-state"><div>⧉</div><strong>No exact duplicates found</strong><p>Files with identical content will appear here.</p></div>';return}$("duplicateResults").innerHTML=groups.map((group,index)=>'<div class="duplicate-group"><h4>Group '+(index+1)+' · '+group.length+' identical files · '+formatBytes(group[0].size)+' each</h4>'+group.map(item=>'<div class="duplicate-file"><span title="'+escapeHtml(item.path)+'">'+escapeHtml(item.path)+'</span><strong>'+formatBytes(item.size)+'</strong></div>').join("")+'<p class="muted">Review these files in your file manager before deleting any copy.</p></div>').join("")}
function renderReport(files,total,large){const rows=[["Folder or selection",state.folderName],["Scan date",state.lastScan.toLocaleString()],["Files analyzed",files.length.toLocaleString()],["Combined file size",formatBytes(total)],["Files over 250 MB",large.length.toLocaleString()],["Original files modified","No"]];$("reportDetails").innerHTML=rows.map(row=>'<div class="detail-row"><span>'+escapeHtml(row[0])+'</span><strong>'+escapeHtml(row[1])+'</strong></div>').join("")}
function exportReport(){if(!state.lastScan){showToast("Run a scan before exporting a report.");return}const total=state.files.reduce((sum,item)=>sum+item.size,0),rows=[["Dial-In Device Care report"],["Scan date",state.lastScan.toISOString()],["Selection",state.folderName],["Files analyzed",state.files.length],["Total size (bytes)",total],["Large files (250 MB+)",state.files.filter(item=>item.size>=LARGE_FILE).length],[],["Largest files"],["Name","Path","Size (bytes)"],...state.files.slice().sort((a,b)=>b.size-a.size).slice(0,100).map(item=>[item.name,item.path,item.size])],csv=rows.map(row=>row.map(value=>'"'+String(value??"").replace(/"/g,'""')+'"').join(",")).join("\r\n"),blob=new Blob([csv],{type:"text/csv;charset=utf-8"}),url=URL.createObjectURL(blob),link=document.createElement("a");link.href=url;link.download="device-care-report.csv";link.click();URL.revokeObjectURL(url);showToast("Your report has been exported.")}

const APP_CACHE_PREFIX="dial-in-device-care-";
const APP_DB_NAME="dial-in-device-care";
$("clearAppCache").addEventListener("click",clearDeviceCareCache);
async function clearDeviceCareCache(){
 const button=$("clearAppCache"),clearData=$("clearAppData").checked;
 button.disabled=true;button.textContent="Cleaning…";
 const messages=[];
 try{
  if("serviceWorker" in navigator){
   const registrations=await navigator.serviceWorker.getRegistrations();
   const appPath=new URL("./",location.href).pathname;
   const ownRegistrations=registrations.filter(reg=>{try{return new URL(reg.scope).origin===location.origin&&new URL(reg.scope).pathname===appPath}catch{return false}});
   const workers=[navigator.serviceWorker.controller,...ownRegistrations.flatMap(reg=>[reg.active,reg.waiting,reg.installing])].filter(Boolean);
   for(const worker of workers){
    await new Promise(resolve=>{const channel=new MessageChannel(),timer=setTimeout(resolve,500);channel.port1.onmessage=()=>{clearTimeout(timer);channel.port1.close();resolve();};worker.postMessage({type:"DEVICE_CARE_DISABLE_CACHE"},[channel.port2]);});
   }
   let unregistered=0;
   for(const reg of ownRegistrations){if(await reg.unregister())unregistered++;}
   if(unregistered)messages.push("offline worker disabled");
  }
  if("caches" in window){
   const cacheNames=await caches.keys();
   const ownCaches=cacheNames.filter(name=>name.startsWith(APP_CACHE_PREFIX));
   let removed=0;
   for(const name of ownCaches){if(await caches.delete(name))removed++;}
   messages.push(removed+" app cache"+(removed===1?"":"s")+" cleared");
  }else messages.push("Cache Storage is unavailable in this browser");
  if(clearData){
   try{
    for(const key of Object.keys(localStorage)){if(key.startsWith("device-care:"))localStorage.removeItem(key);}
    for(const key of Object.keys(sessionStorage)){if(key.startsWith("device-care:"))sessionStorage.removeItem(key);}
   }catch{}
   if("indexedDB" in window){
    try{indexedDB.deleteDatabase(APP_DB_NAME);messages.push("app database removal requested");}catch{}
   }
   messages.push("app-specific saved preferences cleared");
  }
  $("cleanerResultTitle").textContent="Cleanup request completed";
  $("cleanerResultText").textContent=messages.join(" · ")+". Reload the page to fetch fresh app files. Your browser may retain other cached website data.";
  $("cleanerResult").classList.remove("hidden");
  showToast("Device Care cleanup completed.");
 }catch(error){
  $("cleanerResultTitle").textContent="Some cleanup steps could not finish";
  $("cleanerResultText").textContent="Your browser may restrict cache controls. Try the browser's site settings for broader cleanup.";
  $("cleanerResult").classList.remove("hidden");
  showToast("The browser restricted part of the cleanup.");
 }finally{button.disabled=false;button.innerHTML="<span>⌁</span> Clear cache";}
}



function detectBrowser(){
 const ua=navigator.userAgent||"",mobile=navigator.userAgentData?.mobile??/Android|iPhone|iPad|iPod|Mobile/i.test(ua);
 const ios=/iPhone|iPad|iPod/i.test(ua),android=/Android/i.test(ua),mac=/Macintosh|Mac OS X/i.test(ua),windows=/Windows/i.test(ua);
 let browser="unknown";
 if(/EdgA\//.test(ua)||/EdgiOS\//.test(ua)||/Edg\//.test(ua))browser="edge";
 else if(/SamsungBrowser\//.test(ua))browser="samsung";
 else if(/OPR\//.test(ua)||/Opera/i.test(ua))browser="opera";
 else if(/FxiOS\//.test(ua)||/Firefox\//.test(ua))browser="firefox";
 else if(/CriOS\//.test(ua)||/Chrome\//.test(ua))browser="chrome";
 else if(/Safari\//.test(ua))browser="safari";
 return {browser,mobile,ios,android,mac,windows};
}
const guideData={
 chrome:{name:"Google Chrome",url:"https://support.google.com/chrome/answer/2392709",steps:os=>os.android?["Open Chrome and tap the ⋮ menu.","Tap Delete browsing data.","Choose All time for the time range.","Open More options and select only Cached images and files. Leave other categories unchecked.","Tap Delete data."]:["Open Chrome and select ⋮ > Delete browsing data (or press Ctrl+Shift+Delete on Windows/Linux, ⌘+Shift+Delete on Mac).","Set Time range to All time.","Select only Cached images and files. Leave browsing history, cookies, passwords, and other categories unchecked.","Select Delete data."]},
 edge:{name:"Microsoft Edge",url:"https://support.microsoft.com/en-us/microsoft-edge",steps:os=>os.android||os.ios?["Open Edge and tap the menu button.","Open Settings > Privacy and security > Clear browsing data.","Choose All time if offered.","Select only Cached images and files, then clear the data."]:["Open Edge and select Settings and more (…) > Settings > Privacy, search, and services.","Under Clear browsing data, choose Choose what to clear.","Set Time range to All time.","Select only Cached images and files, then select Clear now."]},
 firefox:{name:"Mozilla Firefox",url:"https://support.mozilla.org/en-US/kb/how-clear-firefox-cache",steps:os=>os.android||os.ios?["Open Firefox and open the menu (⋮ or ☰).","Open Settings > Delete browsing data (wording may vary by version).","Choose Cached images and files only; leave history, cookies, and other items unchecked.","Tap Delete browsing data / Delete."]:["Open Firefox Settings > Privacy & Security.","Under Cookies and Site Data, select Clear Data (or Clear browsing data).","Set When to Everything / All time.","Select only Temporary cached files and pages (or Cached web content). Leave cookies and site data unchecked, then clear."]},
 safari:{name:"Apple Safari",url:"https://support.apple.com/en-us/105082",steps:os=>os.ios?["Safari on iPhone/iPad does not provide a cache-only, all-time clear control in Settings.","For a broader reset: Settings > Apps > Safari > Advanced > Website Data > Remove All Website Data. This can remove sign-ins and website data; it is not cache-only.","Alternatively, Settings > Apps > Safari > Clear History and Website Data also clears history and other website data."]:["For cache only on Mac: enable the Develop menu in Safari > Settings > Advanced (Show features for web developers).","Then choose Develop > Empty Caches from the menu bar.","This empties Safari's cache without using the Clear History control."]},
 samsung:{name:"Samsung Internet",url:"https://www.samsung.com/us/support/",steps:os=>["Open Samsung Internet and tap the ☰ menu.","Open Settings > Personal browsing data > Delete browsing data.","Choose the time range All time, if shown.","Select only Cached images and files. Leave cookies, site data, and browsing history unchecked.","Tap Delete data."]},
 opera:{name:"Opera",url:"https://help.opera.com/en/latest/web-preferences/",steps:os=>["Open Opera's menu and choose Settings.","Go to Privacy & security > Delete browsing data (or Clear browsing data).","Set the time range to All time.","Select only Cached images and files; leave cookies and browsing history unchecked.","Confirm Clear data."]}
};
function guideSelection(){
 const detected=detectBrowser(),chosen=$("guideBrowserSelect")?.value||"auto";
 return {detected,browser:chosen==="auto"?detected.browser:chosen};
}
function renderBrowserGuide(){
 const {detected,browser}=guideSelection(),data=guideData[browser]||null;
 const title=$("guideBrowserTitle"),platform=$("guidePlatform"),steps=$("browserGuideSteps"),link=$("guideHelpLink"),badge=$("guideDetected"),caution=$("guideCaution");
 const os={android:detected.android,ios:detected.ios,mac:detected.mac,windows:detected.windows};
 const platformName=detected.ios?"iPhone / iPad":detected.android?"Android":detected.mac?"macOS":detected.windows?"Windows":"Desktop / other";
 if(title)title.textContent=data?data.name+" cache settings":"Browser not recognized";
 if(platform)platform.textContent=platformName+(detected.mobile?" · Mobile":" · Desktop");
 if(badge)badge.textContent=browser===detected.browser?"Detected":"Selected manually";
 if(steps)steps.innerHTML=(data?data.steps(os):["Open your browser's Settings.","Find Privacy, History, or Browsing data.","Choose the cache-only option if available and set the time range to All time."]).map(item=>"<li>"+escapeHtml(item)+"</li>").join("");
 if(link){link.href=data?data.url:"https://support.google.com/chrome/answer/2392709";link.textContent="Official support instructions ↗";}
 if(caution)caution.textContent=browser==="safari"&&detected.ios?"Safari on iPhone/iPad does not offer a cache-only all-time option. Removing all website data is broader and may sign you out.": "Important: select only cached images/files if you want to keep browsing history, cookies, and saved passwords. Browser labels can vary by version.";
}

if($("refreshCompatibility"))$("refreshCompatibility").addEventListener("click",()=>{renderCompatibility();renderBrowserGuide();showToast("Browser capabilities refreshed.");});
if($("guideBrowserSelect"))$("guideBrowserSelect").addEventListener("change",renderBrowserGuide);
renderCompatibility();
const detectedGuide=detectBrowser();
if($("guideBrowserSelect"))$("guideBrowserSelect").value=guideData[detectedGuide.browser]?"auto":"chrome";
renderBrowserGuide();

if("serviceWorker" in navigator&&location.protocol!=="file:")window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}));
$("folderSupport").textContent="Folder access works in supported Chromium browsers over HTTPS or localhost. Other browsers can select individual files.";
