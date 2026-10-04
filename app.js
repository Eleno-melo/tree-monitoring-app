const STORAGE_KEY='tree-monitoring-v1';
let state={trees:[],selectedTreeId:null,range:'all'};
let map, markersLayer, chart;

function pad(n){return String(n).padStart(3,'0')}
function today(){return new Date().toISOString().slice(0,10)}
function currentYear(){return new Date().getFullYear()}

function makeInitialTrees(){
  const trees=[];
  for(let i=1;i<=164;i++){
    let heightRange='', planted='';
    if(i<=77){heightRange='11–14 ft';planted='Não informada'}
    else if(i<=131){heightRange='8–9 ft';planted='Abril 2025'}
    else if(i<=141){heightRange='4–6 ft';planted='Abril 2026'}
    else {heightRange='4–6 ft';planted='Setembro 2026'}
    trees.push({id:i,number:pad(i),heightRange,planted,condition:'Pending',notes:'',lat:null,lng:null,history:[],photo:null});
  }
  return trees;
}

function loadState(){
  const raw=localStorage.getItem(STORAGE_KEY);
  if(raw){try{state={...state,...JSON.parse(raw)}}catch(e){}}
  if(!state.trees||state.trees.length!==164)state.trees=makeInitialTrees();
  saveState();
}
function saveState(){localStorage.setItem(STORAGE_KEY,JSON.stringify(state))}

function showView(id){
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.toggle('active',b.dataset.view===id));
  if(id==='mapView')setTimeout(initMap,100);
}

document.querySelectorAll('.nav-btn').forEach(b=>b.addEventListener('click',()=>showView(b.dataset.view)));

document.getElementById('startInspectionBtn').addEventListener('click',()=>{showView('treesView');document.getElementById('statusFilter').value='pending';renderTreeList()});
document.getElementById('backToList').addEventListener('click',()=>showView('treesView'));

function latestInspection(tree){return [...tree.history].sort((a,b)=>b.date.localeCompare(a.date))[0]||null}
function inspectedThisYear(tree){return tree.history.some(h=>h.date.startsWith(String(currentYear())))}
function conditionFromTree(tree){const l=latestInspection(tree);return l?l.condition:'Pending'}

function renderDashboard(){
  const year=currentYear();
  const inspected=state.trees.filter(inspectedThisYear).length;
  const attention=state.trees.filter(t=>['Attention','Replace'].includes(conditionFromTree(t))).length;
  const pct=Math.round(inspected/state.trees.length*100);
  document.getElementById('yearTitle').textContent=`Inspeção ${year}`;
  document.getElementById('measurementYear').textContent=year;
  document.getElementById('inspectedCount').textContent=inspected;
  document.getElementById('pendingCount').textContent=state.trees.length-inspected;
  document.getElementById('attentionCount').textContent=attention;
  document.getElementById('progressText').textContent=`${inspected} de ${state.trees.length} conferidas`;
  document.getElementById('progressPct').textContent=`${pct}%`;
  document.getElementById('progressRing').style.background=`conic-gradient(#fff ${pct*3.6}deg,#ffffff35 0)`;
}

function passesRange(t){
  if(state.range==='all')return true;
  const [a,b]=state.range.split('-').map(Number); return t.id>=a&&t.id<=b;
}
function renderTreeList(){
  const q=document.getElementById('searchInput').value.trim();
  const status=document.getElementById('statusFilter').value;
  const list=document.getElementById('treeList');
  list.innerHTML='';
  let trees=state.trees.filter(passesRange).filter(t=>!q||t.number.includes(q)||String(t.id).includes(q));
  trees=trees.filter(t=>{
    if(status==='all')return true;
    if(status==='pending')return !inspectedThisYear(t);
    if(status==='inspected')return inspectedThisYear(t);
    if(status==='attention')return ['Attention','Replace'].includes(conditionFromTree(t));
    return true;
  });
  trees.forEach(t=>{
    const latest=latestInspection(t); const cond=conditionFromTree(t);
    const div=document.createElement('div'); div.className='tree-item';
    const cls=!inspectedThisYear(t)?'pending':(['Attention','Replace'].includes(cond)?'attention':'');
    div.innerHTML=`<div class="tree-id ${cls}">${t.number}</div><div class="tree-main"><b>${latest?.height?latest.height+' ft':t.heightRange}</b><small>${t.planted} · ${latest?`Última: ${formatDate(latest.date)}`:'Sem medição anual'}</small></div><div class="tree-chevron">›</div>`;
    div.addEventListener('click',()=>openTree(t.id)); list.appendChild(div);
  });
  if(!trees.length)list.innerHTML='<div class="section-card muted">Nenhuma árvore encontrada.</div>';
}

document.getElementById('searchInput').addEventListener('input',renderTreeList);
document.getElementById('statusFilter').addEventListener('change',renderTreeList);
document.querySelectorAll('.chip').forEach(c=>c.addEventListener('click',()=>{document.querySelectorAll('.chip').forEach(x=>x.classList.remove('active'));c.classList.add('active');state.range=c.dataset.range;renderTreeList()}));

function formatDate(s){if(!s)return '—';const [y,m,d]=s.split('-');return `${m}/${d}/${y}`}
function openTree(id){
  state.selectedTreeId=id;saveState();
  const t=state.trees.find(x=>x.id===id); const latest=latestInspection(t);
  document.getElementById('detailTitle').textContent=`#${t.number}`;
  document.getElementById('inspectionDate').value=today();
  document.getElementById('heightInput').value='';
  document.getElementById('conditionInput').value=latest?.condition||'Good';
  document.getElementById('notesInput').value='';
  document.getElementById('gpsStatus').textContent=t.lat?`${t.lat.toFixed(5)}, ${t.lng.toFixed(5)}`:'Sem localização';
  const pill=document.getElementById('conditionPill');
  const cond=conditionFromTree(t); pill.className='condition-pill';
  if(cond==='Good'){pill.textContent='Boa';pill.classList.add('good')}
  else if(cond==='Attention'){pill.textContent='Atenção';pill.classList.add('attention')}
  else if(cond==='Replace'){pill.textContent='Substituir';pill.classList.add('replace')}
  else pill.textContent='Pendente';
  const meta=[['Plantio',t.planted],['Faixa inicial',t.heightRange],['Altura atual',latest?.height?`${latest.height} ft`:'—'],['Última conferência',latest?formatDate(latest.date):'—'],['GPS',t.lat?'Salvo':'Não salvo']];
  document.getElementById('treeMeta').innerHTML=meta.map(([a,b])=>`<div class="info-row"><span>${a}</span><b>${b}</b></div>`).join('');
  const img=document.getElementById('treePhoto'), ph=document.getElementById('photoPlaceholder');
  if(t.photo){img.src=t.photo;img.style.display='block';ph.style.display='none'}else{img.style.display='none';ph.style.display='grid'}
  renderHistory(t); showView('detailView');
}

function renderHistory(t){
  const list=document.getElementById('historyList'); const hist=[...t.history].sort((a,b)=>b.date.localeCompare(a.date));
  list.innerHTML=hist.length?hist.map(h=>`<div class="history-row"><span>${formatDate(h.date)}</span><b>${h.height} ft</b><span>${h.condition==='Good'?'Boa':h.condition==='Attention'?'Atenção':'Substituir'}</span></div>`).join(''):'<p class="muted">Ainda não há medições.</p>';
  const ctx=document.getElementById('growthChart');
  const ordered=[...t.history].sort((a,b)=>a.date.localeCompare(b.date));
  if(chart)chart.destroy();
  chart=new Chart(ctx,{type:'line',data:{labels:ordered.map(h=>h.date.slice(0,4)),datasets:[{label:'Altura (ft)',data:ordered.map(h=>Number(h.height)),tension:.25}]},options:{responsive:true,plugins:{legend:{display:false}},scales:{y:{beginAtZero:false}}}});
}

document.getElementById('saveMeasurementBtn').addEventListener('click',()=>{
  const t=state.trees.find(x=>x.id===state.selectedTreeId); if(!t)return;
  const date=document.getElementById('inspectionDate').value; const height=Number(document.getElementById('heightInput').value);
  if(!date||!height){alert('Preencha a data e a altura.');return}
  const entry={date,height:height.toFixed(1),condition:document.getElementById('conditionInput').value,notes:document.getElementById('notesInput').value.trim()};
  const idx=t.history.findIndex(h=>h.date===date); if(idx>=0)t.history[idx]=entry; else t.history.push(entry);
  saveState(); renderDashboard(); renderTreeList();
  const next=Math.min(164,t.id+1); openTree(next);
});

document.getElementById('gpsBtn').addEventListener('click',()=>{
  const t=state.trees.find(x=>x.id===state.selectedTreeId); if(!t)return;
  if(!navigator.geolocation){alert('GPS não disponível neste aparelho.');return}
  document.getElementById('gpsStatus').textContent='Obtendo localização...';
  navigator.geolocation.getCurrentPosition(pos=>{t.lat=pos.coords.latitude;t.lng=pos.coords.longitude;saveState();document.getElementById('gpsStatus').textContent=`${t.lat.toFixed(5)}, ${t.lng.toFixed(5)}`;renderMapMarkers();},err=>{document.getElementById('gpsStatus').textContent='Não foi possível obter GPS';alert('Permita acesso à localização no navegador.')},{enableHighAccuracy:true,timeout:12000});
});

document.getElementById('photoInput').addEventListener('change',e=>{
  const file=e.target.files[0]; if(!file)return; const reader=new FileReader();
  reader.onload=()=>{const t=state.trees.find(x=>x.id===state.selectedTreeId);t.photo=reader.result;saveState();openTree(t.id)}; reader.readAsDataURL(file);
});

function initMap(){
  if(!window.L)return;
  if(!map){map=L.map('map').setView([41.9,-71.1],13);L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:20,attribution:'© OpenStreetMap'}).addTo(map);markersLayer=L.layerGroup().addTo(map)}
  map.invalidateSize();renderMapMarkers();
}
function renderMapMarkers(){
  if(!markersLayer)return;markersLayer.clearLayers();
  const located=state.trees.filter(t=>t.lat&&t.lng);
  located.forEach(t=>{const cond=conditionFromTree(t);const color=cond==='Good'?'#0b7a3e':cond==='Pending'?'#d89a00':'#d74444';const icon=L.divIcon({className:'',html:`<div style="width:34px;height:34px;border-radius:50%;display:grid;place-items:center;background:${color};color:#fff;font-weight:800;border:3px solid #fff;box-shadow:0 2px 6px #0005">${t.number}</div>`,iconSize:[34,34]});L.marker([t.lat,t.lng],{icon}).bindPopup(`Árvore #${t.number}<br>${latestInspection(t)?.height||t.heightRange} ft`).addTo(markersLayer)});
  if(located.length){const group=L.featureGroup(markersLayer.getLayers());map.fitBounds(group.getBounds().pad(.2))}
}

function exportBackup(){
  const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});downloadBlob(blob,`tree-monitor-backup-${today()}.json`)
}
function exportCsv(){
  const rows=[['Tree','Planted','Initial range','Last date','Last height ft','Condition','Latitude','Longitude','Notes']];
  state.trees.forEach(t=>{const l=latestInspection(t)||{};rows.push([t.number,t.planted,t.heightRange,l.date||'',l.height||'',l.condition||'',t.lat||'',t.lng||'',(l.notes||'').replace(/\n/g,' ')])});
  const csv=rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');downloadBlob(new Blob([csv],{type:'text/csv'}),`tree-monitor-${today()}.csv`)
}
function downloadBlob(blob,name){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
document.getElementById('downloadBackupBtn').addEventListener('click',exportBackup);document.getElementById('downloadCsvBtn').addEventListener('click',exportCsv);document.getElementById('exportBtn').addEventListener('click',exportCsv);
document.getElementById('importBackupInput').addEventListener('change',e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{const obj=JSON.parse(r.result);if(!obj.trees||obj.trees.length!==164)throw new Error();state=obj;saveState();renderAll();alert('Backup importado com sucesso.')}catch{alert('Arquivo de backup inválido.')}};r.readAsText(f)});

function renderAll(){renderDashboard();renderTreeList();if(state.selectedTreeId)openTree(state.selectedTreeId)}

loadState();renderDashboard();renderTreeList();
if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('service-worker.js'));
