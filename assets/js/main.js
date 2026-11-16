// Akses localStorage aman (bisa gagal di mode privat / storage diblokir)
function safeGet(key,fallback){
 try{
  const v=localStorage.getItem(key);
  return v===null?fallback:v;
 }catch(e){return fallback;}
}
function safeSet(key,value){
 try{localStorage.setItem(key,value);}catch(e){}
}

function setTheme(theme){
 document.documentElement.dataset.theme=theme;
 safeSet('mlbbTheme',theme);
 const button=document.getElementById('themeToggle');
 if(button)button.textContent=theme==='light'?'🌙 Mode Gelap':'☀️ Mode Terang';
}
function toggleTheme(){
 setTheme(document.documentElement.dataset.theme==='light'?'dark':'light');
}
setTheme(safeGet('mlbbTheme','dark'));

let heroes=[],items=[],builds=[],meta={},apiHeroes=[],itemDetails=[],heroLanes={},heroSkills=[],heroCombos=[],heroSkillIcons={};
let page='hero';
let heroRoleFilter='';
let heroLaneFilter='';
let itemCategoryFilter='all';
let itemSortOrder='default';
let tierRoleFilter='all';
let favoriteOnly=false;

let favoriteHeroes=[];
try{
 const savedFav=JSON.parse(safeGet('mlbbFavoriteHeroes','[]'));
 if(Array.isArray(savedFav))favoriteHeroes=savedFav;
}catch(e){favoriteHeroes=[];}

function toggleFavorite(name){
 if(favoriteHeroes.includes(name)){
  favoriteHeroes=favoriteHeroes.filter(x=>x!==name);
 }else{
  favoriteHeroes.push(name);
 }
 safeSet('mlbbFavoriteHeroes',JSON.stringify(favoriteHeroes));
 render();
}

function setFavoriteFilter(value){
 favoriteOnly=value;
 render();
}


function setHeroFilter(type,value){
 if(type==='role')heroRoleFilter=value;
 if(type==='lane')heroLaneFilter=value;
 render();
}

function getHeroLane(name){
 const data=heroLanes[name]||{};
 return (data.lanes||[]).join(', ');
}

const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=s=>String(s??'').toLowerCase().trim();

// ID elemen statistik meta (dipakai bersama oleh render dan loadMetaStats)
function metaId(lane,name){
 return 'meta-stats-'+lane+'-'+String(name).replace(/[^a-z0-9]/gi,'-');
}

// Sinkronkan tombol nav aktif dan kotak pencarian dengan halaman saat ini
function syncNav(p){
 const labels={hero:'hero',item:'item',counter:'counter',draft:'draft pick',meta:'meta',compare:'bandingkan'};
 document.querySelectorAll('nav button').forEach(b=>{
  b.classList.toggle('active',b.textContent.trim().toLowerCase()===labels[p]);
 });
 const s=$('search');
 if(s)s.style.display=['hero','item'].includes(p)?'block':'none';
}


let heroPickerTarget='';
let heroPickerType='draft';
let heroPickerItems=[];

function heroSlot(id,type){
 return `<input type="hidden" id="${id}" value="">
 <button type="button" class="hero-slot-button" id="${id}Button" onclick="openHeroPicker('${id}','${type}')">＋ Pilih Hero</button>`;
}

function openHeroPicker(id,type){
 heroPickerTarget=id;
 heroPickerType=type;
 heroPickerItems=type==='counter'
  ?apiHeroes.map(h=>({
    name:h.hero?.data?.name||'',
    img:h.hero?.data?.head||''
   })).filter(h=>h.name&&h.img)
  :heroes.map(h=>({
    name:h.name_hero,
    img:'images-hero/'+h['images-hero']
   })).filter(h=>h.name&&h.img);

 $('heroPickerTitle').textContent='Pilih Hero';
 $('heroPickerSearch').value='';
 $('heroPickerModal').style.display='flex';
 filterHeroPicker();
}

function filterHeroPicker(){
 const q=norm($('heroPickerSearch').value);
 const selected=$(heroPickerTarget)?.value||'';
 const list=heroPickerItems.filter(h=>norm(h.name).includes(q));
 $('heroPickerGrid').innerHTML=list.map(h=>`
  <button type="button" class="hero-pick ${h.name===selected?'selected':''}"
   onclick="chooseHero(this.dataset.hero)" data-hero="${esc(h.name)}">
   <img src="${esc(h.img)}" alt="${esc(h.name)}" loading="lazy">
   <span>${esc(h.name)}</span>
  </button>`).join('')||'<p class="muted">Hero tidak ditemukan.</p>';
}

function chooseHero(name){
 const field=$(heroPickerTarget);
 if(!field)return;
 field.value=name;
 const button=$(heroPickerTarget+'Button');
 if(button){
  const hero=heroPickerItems.find(h=>h.name===name);
  button.innerHTML=hero
   ?`<img src="${esc(hero.img)}" alt="" loading="lazy" style="width:34px;height:34px;object-fit:cover;vertical-align:middle;border-radius:6px"> ${esc(name)}`
   :'＋ Pilih Hero';
 }
 closeHeroPicker();
}

function closeHeroPicker(){
 $('heroPickerModal').style.display='none';
}

async function load(){
 try{
  const files=['heroes.json','items.json','builds.json','meta.json','api-heroes.json','item-details.json','hero-lanes.json','hero-skills.json','hero-combos.json','hero-skill-icons.json'];
  // 4 file pertama wajib; sisanya opsional agar satu file yang hilang tidak mematikan seluruh website
  const data=await Promise.all(files.map(async(f,i)=>{
   try{
    const r=await fetch('aset-mlbb/'+f,{cache:'no-store'});
    if(!r.ok)throw Error('Gagal membaca '+f);
    return JSON.parse((await r.text()).replace(/^\uFEFF/,''));
   }catch(err){
    if(i<4)throw err;
    console.warn('File opsional gagal dimuat:',f,err);
    return null;
   }
  }));
  heroes=data[0];items=data[1];builds=data[2];
  meta=data[3];
  apiHeroes=((data[4]&&data[4].data&&data[4].data.records)||[]).map(r=>r.data);
  itemDetails=data[5]||[];
  heroLanes=data[6]||{};
  heroSkills=data[7]||[];
  heroCombos=data[8]||[];
  heroSkillIcons=data[9]||{};
  $('heroCount').textContent=heroes.length;
  $('itemCount').textContent=items.length;
  $('metaCount').textContent=new Set(
 Object.values(meta.meta_draft_picks||{}).flat().map(x=>x.hero_name)
).size;
  render();
  openHeroFromUrl();
 }catch(e){
  console.error('Database gagal dimuat:',e);
  $('content').innerHTML=`
   <div class="card" style="text-align:center;padding:24px">
    <h2 style="color:#ff647c">⚠ Database Gagal Dimuat</h2>
    <p style="color:#9bbce4">${esc(e.message||'Terjadi kesalahan saat membaca database.')}</p>
    <p class="muted">Periksa koneksi internet dan pastikan semua file JSON tersedia.</p>
    <button type="button" onclick="load()" style="margin-top:12px;padding:11px 18px;border:1px solid #00e5ff;border-radius:9px;background:#071a38;color:#00e5ff;font-weight:bold">↻ Coba Muat Ulang</button>
   </div>`;
 }
}

function show(p,b){
 page=p;
 // Hapus parameter ?hero= agar refresh tidak membuka detail hero lagi
 if(location.search)history.pushState({},'',location.pathname);
 document.querySelectorAll('nav button').forEach(x=>x.classList.remove('active'));
 b.classList.add('active');
 $('search').value='';
 $('search').style.display=['hero','item'].includes(p)?'block':'none';
 render();
}

function card(title,body){
 return `<div class="card ${page==="hero"?"hero-card":page==="item"?"item-card":""}"><h3>${esc(title)}</h3>${body}</div>`;
}

function heroSlug(name){
 return norm(name).replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
}

function openHeroFromUrl(){
 const slug=new URLSearchParams(location.search).get('hero');
 if(!slug)return;
 const h=heroes.find(x=>heroSlug(x.name_hero)===slug.toLowerCase());
 if(h)openHero(h.name_hero,true);
}

function closeHeroDetail(){
 history.pushState({},'',location.pathname);
 page='hero';
 syncNav('hero');
 render();
 window.scrollTo(0,0);
}

window.addEventListener('popstate',()=>{
 const slug=new URLSearchParams(location.search).get('hero');
 if(slug)openHeroFromUrl();
 else{
  page='hero';
  syncNav('hero');
  render();
 }
});


function setTierRole(value){
 tierRoleFilter=value;
 render();
}

async function compareHeroes(){
 const a=$('compareA')?.value;
 const b=$('compareB')?.value;
 const out=$('compareResult');
 if(!a||!b){
  out.innerHTML='<p class="muted">Pilih Hero A dan Hero B terlebih dahulu.</p>';
  return;
 }
 if(norm(a)===norm(b)){
  out.innerHTML='<p class="muted">Pilih dua hero yang berbeda.</p>';
  return;
 }
 out.innerHTML='<p class="muted">Mengambil statistik kedua hero...</p>';
 const rank=$('compareRank').value;
 const days=$('compareDays').value;

 async function getStats(name){
  const url='https://arena.fastapicloud.dev/api/heroes/'+
   encodeURIComponent(name)+'/counters?days='+days+
   '&rank='+rank+'&size=20&index=1&lang=en';
  const response=await fetch(url);
  if(!response.ok)throw Error('HTTP '+response.status);
  const result=await response.json();
  if(result.code!==0)throw Error(result.message||'API gagal');
  const d=result.data?.records?.[0]?.data;
  if(!d)throw Error('Data statistik kosong');
  return {
   wr:Number(d.main_hero_win_rate)*100,
   pick:Number(d.main_hero_appearance_rate)*100,
   ban:Number(d.main_hero_ban_rate)*100
  };
 }

 function getInfo(name){
  const hero=heroes.find(h=>norm(h.name_hero)===norm(name));
  const lane=getHeroLane(name)||'Belum dipetakan';
  const entry=Object.entries(heroLanes||{}).find(([n])=>norm(n)===norm(name));
  const roles=entry?.[1]?.roles||hero?.role||[];
  const metaHero=Object.values(meta.meta_draft_picks||{}).flat()
   .find(h=>norm(h.hero_name)===norm(name));
  return {
   name,
   image:hero?'images-hero/'+hero['images-hero']:'',
   roles:Array.isArray(roles)?roles.join(', '):roles||'-',
   lane,
   tier:metaHero?.priority_tier||'Belum masuk Meta'
  };
 }

 try{
  const [statsA,statsB]=await Promise.all([getStats(a),getStats(b)]);
  const infoA=getInfo(a),infoB=getInfo(b);
  const rows=[['Win Rate','wr'],['Pick Rate','pick'],['Ban Rate','ban']];
  const format=n=>Number.isFinite(n)?n.toFixed(2)+'%':'-';

  function heroPanel(info,stats){
   return `<div class="card" style="min-width:0;text-align:center">
    ${info.image?`<img src="${esc(info.image)}" alt="${esc(info.name)}" loading="lazy" style="width:85px;height:85px;object-fit:contain">`:''}
    <h3>${esc(info.name)}</h3>
    <p>Role: ${esc(info.roles)}</p>
    <p>Lane: ${esc(info.lane)}</p>
    <p>Tier: <b>${esc(info.tier)}</b></p>
    ${rows.map(([label,key])=>`<p>${label}: <b>${format(stats[key])}</b></p>`).join('')}
   </div>`;
  }

  out.innerHTML=`<h3>Hasil Perbandingan</h3>
   <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px">
    ${heroPanel(infoA,statsA)}${heroPanel(infoB,statsB)}
   </div>
   <h3>Selisih Statistik</h3>
   ${rows.map(([label,key])=>{
    const diff=statsA[key]-statsB[key];
    return `<div class="itemrow"><b>${label}</b>
     <span>${key==='ban'?(diff>0?esc(a)+' lebih sering di-ban':diff<0?esc(b)+' lebih sering di-ban':'Sama sering di-ban'):(diff>0?esc(a)+(key==='wr'?' WR lebih tinggi':' lebih populer'):diff<0?esc(b)+(key==='wr'?' WR lebih tinggi':' lebih populer'):'Seimbang')} (${Math.abs(diff).toFixed(2)}%)</span>
    </div>`;
   }).join('')}
   <p class="muted">Sumber: Statistik Ranked API • Rank ${esc(rank)} • ${days} hari</p>`;
 }catch(e){
  out.innerHTML='<p class="muted">Gagal mengambil statistik: '+esc(e.message)+'</p><button onclick="compareHeroes()">Coba Lagi</button>';
 }
}

function renderTierList(data){
 const roles=[
  ['all','Semua Role'],
  ['fighter','Fighter'],
  ['tank','Tank'],
  ['assassin','Assassin'],
  ['mage','Mage'],
  ['marksman','Marksman'],
  ['support','Support']
 ];

 const unique=new Map();
 Object.values(data).flat().forEach(h=>{
  if(!unique.has(norm(h.hero_name)))unique.set(norm(h.hero_name),h);
 });

 const heroes=[...unique.values()].filter(h=>{
  const entry=Object.entries(heroLanes||{}).find(
   ([name])=>norm(name)===norm(h.hero_name)
  );
  const heroRoles=(entry?.[1]?.roles||[]).map(norm);
  return tierRoleFilter==='all'||heroRoles.includes(tierRoleFilter);
 }).filter(h=>!norm($('search').value)||norm(h.hero_name+' '+h.priority_tier).includes(norm($('search').value)));

 let output=`
 <div class="card">
  <h3>🏆 Tier List Hero Berdasarkan Role</h3>
  <label>Pilih Role</label>
  <select onchange="setTierRole(this.value)">
   ${roles.map(([v,n])=>`<option value="${v}" ${tierRoleFilter===v?'selected':''}>${n}</option>`).join('')}
  </select>`;

 ['S','A','B'].forEach(tier=>{
  const list=heroes.filter(h=>String(h.priority_tier).toUpperCase()===tier);
  if(!list.length)return;

  output+=`
   <div class="tier-group">
    <h4><span class="tag tier-${tier.toLowerCase()}">${tier}-Tier</span> ${list.length} Hero</h4>
    <div class="tier-role-grid">
     ${list.map(h=>{
      const head=apiHeroes.find(x=>norm(x.hero?.data?.name)===norm(h.hero_name))?.hero?.data?.head||'';
      return `<div class="tier-hero-card" onclick="openHero(this.dataset.hero)" data-hero="${esc(h.hero_name)}">
       <img src="${esc(head)}" alt="${esc(h.hero_name)}" loading="lazy">
       <b>${esc(h.hero_name)}</b>
      </div>`;
     }).join('')}
    </div>
   </div>`;
 });

 return output+'</div>';
}

function render(){
 const q=norm($('search').value);
 let html='',title='';

 if(page==='hero'){
  title='Daftar Semua Hero';
  const roles=['assassin','fighter','mage','marksman','support','tank'];
  const lanes=[
   ['exp_lane','EXP Lane'],
   ['roamer','Roam'],
   ['mid_lane','Mid Lane'],
   ['gold_lane','Gold Lane'],
   ['jungler','Jungle']
  ];
  const filtered=heroes.filter(h=>{
      if(favoriteOnly&&!favoriteHeroes.includes(h.name_hero))return false;
   const role=(h.role||[]).map(norm);
   const lane=getHeroLane(h.name_hero);
   return (
    (!q||norm(h.name_hero).includes(q)||role.join(' ').includes(q))&&
    (!heroRoleFilter||role.includes(heroRoleFilter))&&
    (!heroLaneFilter||lane.split(',').map(x=>x.trim()).includes(({exp_lane:'EXP Lane',roamer:'Roam',mid_lane:'Mid Lane',gold_lane:'Gold Lane',jungler:'Jungle'})[heroLaneFilter]))
   );
  });
  const roleOptions=roles.map(r=>
   `<option value="${r}" ${heroRoleFilter===r?'selected':''}>${r.charAt(0).toUpperCase()+r.slice(1)}</option>`
  ).join('');
  const laneOptions=lanes.map(([v,label])=>
   `<option value="${v}" ${heroLaneFilter===v?'selected':''}>${label}</option>`
  ).join('');
  html=`
   <div class="hero-filters">
    <button onclick="setFavoriteFilter(false)" ${!favoriteOnly?'class="active"':''}>Semua Hero</button>
    <button onclick="setFavoriteFilter(true)" ${favoriteOnly?'class="active"':''}>⭐ Favorit Saya (${favoriteHeroes.length})</button>
    <select aria-label="Filter role" onchange="setHeroFilter('role',this.value)">
     <option value="">Semua Role</option>${roleOptions}
    </select>
    <select aria-label="Filter lane" onchange="setHeroFilter('lane',this.value)">
     <option value="">Semua Lane</option>${laneOptions}
    </select>
    <p class="muted">${filtered.length} Hero ditemukan</p>
   </div>
   <div class="hero-grid">${filtered.map(h=>{
    let b=builds.find(x=>norm(x.hero_name)===norm(h.name_hero));
    return card(h.name_hero,`<img src="images-hero/${esc(h['images-hero'])}" alt="${esc(h.name_hero)}" loading="lazy"><span class="tag">${esc((h.role||[]).join(', '))}</span><p class="muted">${esc(getHeroLane(h.name_hero))||'Lane belum dipetakan'}</p><button onclick="toggleFavorite(this.dataset.hero)" data-hero="${esc(h.name_hero)}">${favoriteHeroes.includes(h.name_hero)?'⭐ Hapus Favorit':'☆ Tambah Favorit'}</button><button onclick="openHero(this.dataset.hero)" data-hero="${esc(h.name_hero)}">Detail Hero →</button>`);
   }).join('')}</div>`;
 }

 if(page==='item'){
  title='Database Semua Equipment';

  const categories=[
   ['all','Semua Kategori'],
   ['attack','Attack'],
   ['magic','Magic'],
   ['defense','Defense'],
   ['movement','Movement'],
   ['jungling','Jungling'],
   ['roaming','Roaming'],
   ['other','Lainnya']
  ];

  const filteredItems=items
   .filter(i=>norm(i['name-equipment']).includes(q))
   .filter(i=>itemCategoryFilter==='all'||getItemCategory(i)===itemCategoryFilter)
   .sort((a,b)=>{
    if(itemSortOrder==='price-asc')
     return Number(a['prize-gold'])-Number(b['prize-gold']);
    if(itemSortOrder==='price-desc')
     return Number(b['prize-gold'])-Number(a['prize-gold']);
    return Number(a.id_equip)-Number(b.id_equip);
   });

  html=`
   <div class="hero-filters">
    <select aria-label="Filter kategori item" onchange="itemCategoryFilter=this.value;render()">
     ${categories.map(([v,label])=>`<option value="${v}" ${itemCategoryFilter===v?'selected':''}>${label}</option>`).join('')}
    </select>
    <select aria-label="Urutkan harga item" onchange="itemSortOrder=this.value;render()">
     <option value="default" ${itemSortOrder==='default'?'selected':''}>Urutan Awal</option>
     <option value="price-asc" ${itemSortOrder==='price-asc'?'selected':''}>Harga Termurah</option>
     <option value="price-desc" ${itemSortOrder==='price-desc'?'selected':''}>Harga Termahal</option>
    </select>
    <p class="muted">${filteredItems.length} Item ditemukan</p>
   </div>
   <div class="hero-grid">${filteredItems.map(i=>
    card(i['name-equipment'],`<img src="logo-equipment/${esc(i['logo-equipment'])}" alt="${esc(i['name-equipment'])}" style="width:100%;height:110px;object-fit:contain" loading="lazy"><div class="itemrow"><b class="price">${Number(i['prize-gold']).toLocaleString('id-ID')} Gold</b></div><div class="item-stats">${getItemStats(i).map(stat=>`<span class="tag">${esc(stat)}</span>`).join(' ')}</div><button onclick="openItem(${Number(i.id_equip)})">Lihat Detail Item →</button>`)
   ).join('')}</div>`;
 }

 if(page==='build'){
  title='Build Hero';
  html=builds.filter(h=>norm(h.hero_name).includes(q)||norm(h.role).includes(q)).map(h=>
   card(h.hero_name,`<span class="tag">${esc(h.role)}</span><p class="muted">${esc((h.speciality||[]).join(' • '))}</p>`+
   (h.top_builds||[]).map((b,i)=>`<div class="build"><b>Build ${i+1}</b><p>Spell: <img src="images-spell/${esc((b.battle_spell||"").toLowerCase().includes("retribution")?"retribution":(b.battle_spell||"").toLowerCase())}.png" alt="${esc(b.battle_spell||"")}" onerror="this.style.display='none'" style="width:36px;height:36px;object-fit:contain;vertical-align:middle"> <span class="tag">${esc(b.battle_spell)}</span></p><p>Emblem & Talent:</p><p>${(b.emblems||[]).map(x=>`<span class="tag">${esc(x)}</span>`).join('')}</p><p>Urutan item:</p>${(b.items||[]).map((x,j)=>`<p>${j+1}. ${esc(x)}</p>`).join('')}</div>`).join(''))
  ).join('');
 }


 if(page==='counter'){
  title='Counter Hero Ranked';
  const options=apiHeroes.map(h=>{
   const n=h.hero?.data?.name||'';
   return `<option value="${esc(n)}">${esc(n)}</option>`;
  }).join('');
  html=`<div class="card">
   <h3>Counter Hero Ranked</h3>
   <p>Pilih hero lawan:</p>
   ${heroSlot("counterHero","counter")}
   <p>Pilih rank:</p>
   <select id="counterRank">
    <option value="mythic">Mythic</option>
    <option value="honor">Mythical Honor</option>
    <option value="glory">Mythical Glory</option>
    <option value="epic">Epic</option>
    <option value="legend">Legend</option>
    <option value="all">Semua Rank</option>
   </select>
   <p>Periode data:</p>
   <select id="counterDays">
    <option value="7">7 hari</option>
    <option value="15">15 hari</option>
    <option value="30">30 hari</option>
   </select>
   <button onclick="loadCounters()">Cari Counter Hero</button>
   <div id="rankedCounter" class="detail">Pilih hero lalu tekan Cari Counter Hero.</div>
  </div>`;
 }



 if(page==='draft'){
  title='Draft Pick Analyzer';
  const options='<option value="">-- Pilih Hero --</option>'+heroes.map(h=>`<option value="${esc(h.name_hero)}">${esc(h.name_hero)}</option>`).join('');
  html=`<div class="card">
   <h3>Mode Draft Pick</h3>
   <select id="draftMode" onchange="toggleDraftMode()">
    <option value="solo">Solo Rank</option>
    <option value="team">Tim / Mabar</option>
   </select>
   <p class="muted" id="draftModeInfo">Solo Rank: pilih posisi sendiri dan hero lawan yang terlihat.</p>
   <div class="detail">
    <h3>🚫 Ban Hero</h3>
    <p class="muted">Pilih maksimal 5 hero yang dilarang.</p>
    <div class="draft-slots">${[1,2,3,4,5].map(i=>heroSlot("ban"+i,"draft")).join('')}</div>
   </div>
   <h3>Tim Lawan</h3>
   <p class="muted">Pilih maksimal 5 hero lawan.</p>
   <div class="draft-slots">${[1,2,3,4,5].map(i=>heroSlot("enemy"+i,"draft")).join('')}</div>
   <div class="detail" id="allySection"><h3>Tim Sendiri</h3>
   <p class="muted">Pilih hero tim sendiri yang sudah terlihat.</p>
   ${[1,2,3,4,5].map(i=>heroSlot("ally"+i,"draft")).join('')}</div>
   <div class="detail"><h3>Pengaturan Statistik</h3>
   <select id="draftRank">
    <option value="mythic">Mythic</option><option value="honor">Mythical Honor</option>
    <option value="glory">Mythical Glory</option><option value="epic">Epic</option>
    <option value="legend">Legend</option><option value="all">Semua Rank</option>
   </select>
   <select id="draftDays"><option value="7">7 hari</option><option value="15">15 hari</option><option value="30">30 hari</option></select>
   <select id="draftLane">
    <option value="">Semua posisi</option><option value="exp_lane">EXP Lane</option>
    <option value="jungler">Jungler</option><option value="mid_lane">Mid Lane</option>
    <option value="gold_lane">Gold Lane</option><option value="roamer">Roamer</option>
   </select>
   <button onclick="analyzeDraft()">Analisis Draft Pick</button>
   <div id="draftResult" class="detail">Pilih hero lalu tekan Analisis Draft Pick.</div>
  </div></div>`;
 }

 if(page==='compare'){
  title='Perbandingan Hero';
  html=`<div class="card">
   <h3>⚔ Bandingkan Dua Hero</h3>
   <p>Pilih dua hero untuk membandingkan statistiknya.</p>
   <label>Hero A</label>
   ${heroSlot('compareA','compare')}
   <label>Hero B</label>
   ${heroSlot('compareB','compare')}
   <label>Rank Statistik</label>
   <select id="compareRank">
    <option value="mythic">Mythic</option>
    <option value="honor">Mythical Honor</option>
    <option value="glory">Mythical Glory</option>
    <option value="epic">Epic</option>
    <option value="legend">Legend</option>
    <option value="all">Semua Rank</option>
   </select>
   <label>Periode Statistik</label>
   <select id="compareDays">
    <option value="7">7 hari</option>
    <option value="15">15 hari</option>
    <option value="30">30 hari</option>
   </select>
   <button onclick="compareHeroes()">⚔ Bandingkan Hero</button>
   <div id="compareResult" class="detail">Pilih dua hero lalu tekan Bandingkan Hero.</div>
  </div>`;
 }
 if(page==='meta'){
  title='Meta Draft Pick';
  const data=meta.meta_draft_picks||{};
  html=`<div class="card">
   <h3>Statistik Meta</h3>
   <label>Rank</label>
   <select id="metaRank">
    <option value="mythic">Mythic</option>
    <option value="honor">Mythical Honor</option>
    <option value="glory">Mythical Glory</option>
    <option value="epic">Epic</option>
    <option value="legend">Legend</option>
    <option value="all">Semua Rank</option>
   </select>
   <label>Periode</label>
   <select id="metaDays">
    <option value="7">7 hari</option>
    <option value="15">15 hari</option>
    <option value="30">30 hari</option>
   </select>
   <label>Urutkan berdasarkan</label>
   <select id="metaSort" onchange="sortMetaStats()">
    <option value="tier">Tier Meta</option>
    <option value="wr">Win Rate</option>
    <option value="pick">Pick Rate</option>
    <option value="ban">Ban Rate</option>
   </select>
   <button onclick="loadMetaStats()">Muat Statistik Meta</button>
   <p id="metaStatus" class="muted">Pilih rank dan periode, lalu muat statistik.</p>
  </div>`;
  html+=renderTierList(data);
  html+=Object.entries(data).map(([lane,list])=>{
   const rows=list.filter(h=>norm(h.hero_name+' '+h.priority_tier+' '+lane).includes(q));
   return rows.length?card(lane.replace(/_/g,' ').toUpperCase(),
    `<div id="meta-lane-${lane}">`+rows.map(h=>`
     <div class="itemrow meta-row" data-hero="${esc(h.hero_name)}" data-tier="${esc(h.priority_tier)}">
      <div class="meta-hero-info">
       <img src="${esc(apiHeroes.find(x=>x.hero?.data?.name===h.hero_name)?.hero?.data?.head||'')}" alt="${esc(h.hero_name)}" loading="lazy">
       <b>${esc(h.hero_name)}</b>
      </div>
      <span class="tag tier-${String(h.priority_tier).toLowerCase()}">${esc(h.priority_tier)}-Tier</span>
      <div class="meta-stats" id="${esc(metaId(lane,h.hero_name))}">
       <small>WR: - | Pick: - | Ban: -</small>
      </div>
     </div>`).join('')+'</div>'):'';
  }).join('');
 }

 $('content').innerHTML='<h2>'+title+'</h2>'+(html||'<div class="empty">Data tidak ditemukan.</div>');
 if(page==='draft')toggleDraftMode();
}





function toggleDraftMode(){
 const mode=$('draftMode')?.value||'solo';
 const section=$('allySection');
 const info=$('draftModeInfo');

 if(section) section.style.display=mode==='solo'?'none':'block';
 if(info) info.textContent=mode==='solo'
  ?'Solo Rank: pilih posisi sendiri dan hero lawan yang terlihat.'
  :'Tim / Mabar: isi hero lawan dan hero teman yang sudah terlihat.';
}

async function analyzeDraft(){
 const mode=$('draftMode')?.value||'solo';
 const out=$('draftResult');
 const enemy=[1,2,3,4,5].map(i=>$('enemy'+i).value).filter(Boolean);
 const ally=mode==='team'?[1,2,3,4,5].map(i=>$('ally'+i).value).filter(Boolean):[];
 const banned=[1,2,3,4,5].map(i=>$('ban'+i)?.value).filter(Boolean);
 const rank=$('draftRank').value;
 const days=$('draftDays').value;
 const lane=$('draftLane').value;

 if(!enemy.length){
  out.innerHTML='<p>Pilih minimal satu hero lawan.</p>';
  return;
 }
 if(new Set(enemy).size!==enemy.length){
  out.innerHTML='<p>Jangan pilih hero lawan yang sama lebih dari sekali.</p>';
  return;
 }

 out.innerHTML='<p>⏳ Mengambil statistik counter '+enemy.length+' hero lawan...</p>';

 try{
  const results=await Promise.all(enemy.map(async target=>{
   try{
    const url='https://arena.fastapicloud.dev/api/heroes/'+
     encodeURIComponent(target)+'/counters?days='+days+
     '&rank='+rank+'&size=20&index=1&lang=en';
    const response=await fetch(url);
    if(!response.ok)throw Error('HTTP '+response.status);
    const result=await response.json();
    if(result.code!==0)throw Error(result.message||'API gagal');
    const records=result.data?.records||[];
    return {target,data:records[0]?.data||null};
   }catch(e){
    return {target,error:e.message};
   }
  }));

  const scores=new Map();
  let successful=0;

  results.forEach(result=>{
   if(!result.data)return;
   successful++;

   (result.data.sub_hero||[]).forEach(c=>{
    const info=apiHeroes.find(x=>Number(x.hero_id)===Number(c.heroid));
    const name=info?.hero?.data?.name;
    if(!name)return;

    if(!scores.has(name)){
     scores.set(name,{name,sum:0,wr:0,impact:0,count:0,against:[]});
    }

    const item=scores.get(name);
    const wr=Number(c.hero_win_rate||0);
    const impact=Number(c.increase_win_rate||0);

    item.sum+=impact*100+(wr-0.5)*20;
    item.wr+=wr;
    item.impact+=impact;
    item.count++;
    item.against.push(result.target);
   });
  });

  if(!successful){
   out.innerHTML='<p>Gagal mengambil seluruh statistik. Periksa koneksi internet atau coba lagi nanti.</p>';
   return;
  }

  const excluded=new Set([...enemy,...ally,...banned].map(norm));
  const pro=meta.alternative_counter_picks||{};
  const proList=lane?(pro[lane]||[]):Object.values(pro).flat();

  const laneAliases={
   explane:'exp_lane',
   exp:'exp_lane',
   jungle:'jungler',
   jungler:'jungler',
   midlane:'mid_lane',
   mid:'mid_lane',
   goldlane:'gold_lane',
   gold:'gold_lane',
   roam:'roamer',
   roamer:'roamer'
  };

  const getHeroLanes=name=>{
   const entry=Object.entries(heroLanes||{}).find(
    ([n])=>norm(n)===norm(name)
   );
   return (entry?.[1]?.lanes||[])
    .map(v=>laneAliases[norm(v).replace(/\s+/g,'')])
    .filter(Boolean);
  };

  const occupiedLanes=new Set(ally.flatMap(getHeroLanes));
  const allLanes=['exp_lane','jungler','mid_lane','gold_lane','roamer'];
  const missingLanes=allLanes.filter(x=>!occupiedLanes.has(x));

  const recommendations=[...scores.values()]
   .filter(x=>!excluded.has(norm(x.name)))
   .map(x=>{
    const b=builds.find(y=>norm(y.hero_name)===norm(x.name));
    const proData=proList.find(y=>norm(y.hero_name)===norm(x.name));
    let proBonus=0;

    if(proData){
     proBonus=proData.priority_tier==='S'?4:
              proData.priority_tier==='A'?2.5:
              proData.priority_tier==='B'?1:0;
    }

    let roleBonus=0;
    const role=norm(b?.role||'');
    const expected={
     exp_lane:['fighter','tank'],
     jungler:['assassin','fighter'],
     mid_lane:['mage'],
     gold_lane:['marksman'],
     roamer:['tank','support']
    };

    const roleMatch=!!(lane&&expected[lane]?.some(r=>role.includes(r)));
    if(roleMatch)roleBonus=2.5;

    const candidateLanes=getHeroLanes(x.name);
    const fillLane=mode==='team'
     ?candidateLanes.find(k=>missingLanes.includes(k))
     :'';
    const compBonus=fillLane?5:0;

    const avgWR=x.wr/x.count*100;
    const avgImpact=x.impact/x.count*100;
    const coverage=x.count/successful*100;
    const reasons=[
     x.count+' dari '+successful+' matchup lawan',
     'Pengaruh matchup +'+avgImpact.toFixed(2)+'%'
    ];

    if(roleMatch)reasons.push('Role sesuai lane');
    if(fillLane)reasons.push('Mengisi posisi '+fillLane.replace('_',' '));
    if(proData)reasons.push('META '+proData.priority_tier);

    const score=avgImpact*2+(avgWR-50)*0.35+
                (coverage/100)*4+proBonus+roleBonus+compBonus;

    return {
     ...x,build:b,proData,
     avgWR,avgImpact,coverage,reasons,score
    };
   })
   .sort((a,b)=>b.score-a.score)
   .slice(0,5);

  if(!recommendations.length){
   out.innerHTML='<p>Belum ada rekomendasi. Coba pilih hero lawan lain.</p>';
   return;
  }

  let html='<h3>5 Rekomendasi Hero Terbaik</h3>';
  html+='<p class="muted">Berhasil mengambil data '+successful+' dari '+enemy.length+' hero lawan. Rank: '+esc(rank)+' • Periode: '+esc(days)+' hari.</p>';

  recommendations.forEach((x,i)=>{
   const build=x.build?.top_builds?.[0];
   html+=`<div class="card">
    <div class="itemrow"><h3>#${i+1} ${esc(x.name)}</h3><span class="tag">${esc(x.build?.role||'Hero')}</span></div>
    <p>Skor rekomendasi: <b>${x.score.toFixed(2)}</b></p>
    <p>Rata-rata Win Rate Counter: <b>${x.avgWR.toFixed(2)}%</b></p>
    <p>Pengaruh Matchup: <b>+${x.avgImpact.toFixed(2)}%</b></p>
    <p>Cakupan Counter: <b>${x.count}/${successful} hero (${x.coverage.toFixed(0)}%)</b></p>
    <p><b>Alasan rekomendasi:</b> ${x.reasons.map(esc).join(' • ')}</p>
    <p class="muted">Counter terhadap: ${x.against.map(esc).join(', ')}</p>
    ${x.proData?'<span class="tag">Pro: '+esc(x.proData.priority_tier)+'</span>':''}
    ${build?`<div class="detail">
     <b>Rekomendasi Build</b>
     <p>Spell: ${esc(build.battle_spell||'-')}</p>
     <p>Emblem: ${(build.emblems||[]).map(esc).join(' • ')}</p>
     <p>Item:</p>${(build.items||[]).map((it,j)=>`<p>${j+1}. ${esc(it)}</p>`).join('')}
    </div>`:'<p class="muted">Build belum tersedia.</p>'}
   </div>`;
  });

  if(results.some(x=>x.error)){
   html+='<p class="muted">Sebagian data gagal dimuat: '+results.filter(x=>x.error).map(x=>esc(x.target)).join(', ')+'</p>';
  }

  out.innerHTML=html;
 }catch(e){
  out.innerHTML='<p>Analisis gagal: '+esc(e.message)+'</p>';
 }
}


let metaStatsData={};

async function loadMetaStats(){
 const status=$('metaStatus');
 if(!status)return;

 const rank=$('metaRank')?.value||'mythic';
 const days=$('metaDays')?.value||'7';
 const data=meta.meta_draft_picks||{};
 const names=[...new Set(Object.values(data).flat().map(h=>h.hero_name))];

 status.textContent='Mengambil statistik '+names.length+' hero...';
 metaStatsData={};

 let done=0,failed=0;
 for(let i=0;i<names.length;i+=5){
  const batch=names.slice(i,i+5);
  const results=await Promise.all(batch.map(async name=>{
   try{
    const url='https://arena.fastapicloud.dev/api/heroes/'+
     encodeURIComponent(name)+'/counters?days='+days+
     '&rank='+rank+'&size=20&index=1&lang=en';
    const response=await fetch(url);
    if(!response.ok)throw Error('HTTP '+response.status);
    const result=await response.json();
    if(result.code!==0)throw Error(result.message||'API gagal');
    const d=result.data?.records?.[0]?.data;
    if(!d)throw Error('Data kosong');
    return {name,wr:Number(d.main_hero_win_rate)*100,
     pick:Number(d.main_hero_appearance_rate)*100,
     ban:Number(d.main_hero_ban_rate)*100};
   }catch(e){
    failed++;
    return {name,error:true};
   }
  }));

  results.forEach(x=>{
   metaStatsData[x.name]=x;
   done++;
   Object.entries(data).forEach(([lane,list])=>{
    if(!list.some(h=>norm(h.hero_name)===norm(x.name)))return;
    const el=$(metaId(lane,x.name));
    if(el){
     el.innerHTML=x.error
      ?'<small>Statistik tidak tersedia</small>'
      :`<small>WR: ${x.wr.toFixed(2)}% | Pick: ${x.pick.toFixed(2)}% | Ban: ${x.ban.toFixed(2)}%</small>`;
    }
   });
  });
  status.textContent='Memuat statistik: '+done+'/'+names.length+
   (failed?' • Gagal: '+failed:'');
 }
 status.textContent='Selesai: '+done+'/'+names.length+' hero'+
  (failed?' • '+failed+' gagal dimuat':' • Semua statistik berhasil dimuat');
 sortMetaStats();
}


function sortMetaStats(){
 const mode=$('metaSort')?.value||'tier';
 document.querySelectorAll('.meta-row').forEach(row=>{
  const parent=row.parentElement;
  if(!parent)return;
  const rows=[...parent.querySelectorAll('.meta-row')];
  rows.sort((a,b)=>{
   if(mode==='tier'){
    const order={S:0,A:1,B:2};
    return (order[a.dataset.tier]??9)-(order[b.dataset.tier]??9);
   }
   const av=metaStatsData[a.dataset.hero]?.[mode]??-1;
   const bv=metaStatsData[b.dataset.hero]?.[mode]??-1;
   return bv-av;
  });
  rows.forEach(x=>parent.appendChild(x));
 });
}

async function loadCounters(){
 const out=$('rankedCounter');
 const target=$('counterHero')?.value;
 const rank=$('counterRank')?.value||'mythic';
 const days=$('counterDays')?.value||'7';

 if(!out)return;
 if(!target){
  out.innerHTML='<p class="muted">Pilih hero lawan terlebih dahulu.</p>';
  return;
 }

 out.innerHTML='<p>Memuat data counter...</p>';

 try{
  const url='https://arena.fastapicloud.dev/api/heroes/'+
   encodeURIComponent(target)+'/counters?days='+days+
   '&rank='+rank+'&size=20&index=1&lang=en';

  const response=await fetch(url);
  if(!response.ok)throw Error('Server API: '+response.status);

  const result=await response.json();
  if(result.code!==0)throw Error(result.message||'API gagal');

  const records=result.data?.records||[];
  if(!records.length){
   out.innerHTML='<p>Belum ada data counter untuk hero ini pada rank tersebut.</p>';
   return;
  }

  const d=records[0].data;

  const selectedHero=apiHeroes.find(x=>
   norm(x.hero?.data?.name)===norm(target)
  );

  const relation=selectedHero?.relation||{};

  const renderRelations=(type,title,description)=>{
   const ids=relation[type]?.target_hero_id||[];

   if(!ids.length){
    return `<p class="muted">Data ${title} belum tersedia.</p>`;
   }

   return `<h3>${title}</h3>
    <p class="muted">${description}</p>
    <div class="hero-grid">`+
    ids.map(id=>{
     const h=apiHeroes.find(x=>Number(x.hero_id)===Number(id));
     if(!h)return '';
     const name=h.hero?.data?.name||'';
     const img=h.hero?.data?.head||'';

     return `<div class="card">
      ${img?`<img src="${esc(img)}" alt="${esc(name)}" loading="lazy" style="width:58px;height:58px;object-fit:cover;border-radius:10px">`:''}
      <b>${esc(name)}</b>
     </div>`;
    }).join('')+
    '</div>';
   };

  const strongHTML=renderRelations(
   'strong','💪 Strong Against',
   'Hero yang diunggulkan melawan '+target
  );

  const weakHTML=renderRelations(
   'weak','⚠️ Weak Against',
   'Hero yang menjadi ancaman bagi '+target
  );

  const counters=d.sub_hero||[];

  const cards=counters.map(c=>{
   const info=apiHeroes.find(x=>Number(x.hero_id)===Number(c.heroid));
   const name=info?.hero?.data?.name||('Hero ID '+c.heroid);
   const img=info?.hero?.data?.head||c.hero?.data?.head?.url||c.hero?.data?.head||'';
   const wr=Number(c.hero_win_rate||0)*100;
   const impact=Number(c.increase_win_rate||0)*100;

   return `<div class="card">
    <div class="itemrow">
     <div style="display:flex;align-items:center;gap:12px">
      ${img?`<img src="${esc(img)}" alt="${esc(name)}" loading="lazy" style="width:58px;height:58px;object-fit:cover;border-radius:10px">`:''}
      <b>${esc(name)}</b>
     </div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;margin-top:12px">
     <div class="detail"><small>Win Rate</small><br><b>${wr.toFixed(2)}%</b></div>
     <div class="detail"><small>Pengaruh</small><br><b>${impact>=0?'+':''}${impact.toFixed(2)}%</b></div>
     <div class="detail"><small>Pick Rate</small><br><b>${(Number(c.hero_appearance_rate||0)*100).toFixed(2)}%</b></div>
    </div>
   </div>`;
  }).join('');

  const mainWR=Number(d.main_hero_win_rate||0)*100;
  out.innerHTML=
   `<h3>Counter untuk ${esc(target)}</h3>
    <p>Win rate hero: <b>${mainWR.toFixed(2)}%</b></p>
    <p class="muted">Rank: ${esc(rank)} • Periode: ${esc(days)} hari</p>`+
    strongHTML+
    weakHTML+
    '<h3>Statistik Counter Ranked</h3>'+
    (cards||'<p>Belum ada daftar counter.</p>');

 }catch(e){
  out.innerHTML='<p style="color:#ff9b9b">Gagal mengambil data: '+
   esc(e.message)+
   '</p><p class="muted">Periksa koneksi internet. Jika muncul pesan Failed to fetch, browser mungkin memblokir koneksi API.</p>';
 }
}


function renderHeroSkills(name){
 const hero=heroSkills.find(x=>norm(x.hero_name)===norm(name));
 if(!hero||!hero.skills?.length){
  return '<div class="detail"><h3>⚡ Skill Hero</h3><p>Data skill belum tersedia untuk hero ini.</p></div>';
 }
 const labels=['Pasif','Skill 1','Skill 2','Ultimate','Skill tambahan'];
 const aliases={'Bane':{'Ale':'Sea Ink'},'Bruno':{'Flying Tackle':'Slide'},'Masha':{'Ancient Strength':'Primal Pact','Thunderclap':'Savage Maul'}};
 const icons=heroSkillIcons[hero.hero_name]||heroSkillIcons[name]||{};
 return '<div class="detail"><h3>⚡ Skill Hero</h3>'+
  '<div class="hero-skills">'+hero.skills.map((skill,i)=>{
   const iconName=(aliases[hero.hero_name]||{})[skill.name]||skill.name;
   const icon=icons[iconName];
   // Hero dengan lebih dari 5 skill (mis. Beatrix, Sora) tidak lagi menampilkan "undefined"
   const label=labels[i]||('Skill tambahan '+(i-3));
   return '<div class="build">'+
    '<div style="display:flex;align-items:center;gap:12px;margin-bottom:8px">'+
    (icon?'<img src="'+esc(icon)+'" alt="'+esc(skill.name)+'" loading="lazy" style="width:48px;height:48px;object-fit:contain;border-radius:9px;background:#171c2b;flex-shrink:0">':'')+
    '<b>'+esc(label)+' — '+esc(skill.name)+'</b></div>'+
    '<p>'+esc(skill.description)+'</p></div>';
  }).join('')+'</div></div>';
}


function renderHeroCombos(name){
 const hero=heroCombos.find(x=>norm(x.hero_name)===norm(name));
 if(!hero||!hero.combos?.length){
  return '<div class="detail"><h3>🎯 Skill Combo</h3><p>Panduan combo belum tersedia.</p></div>';
 }
 return '<div class="detail"><h3>🎯 Skill Combo</h3>'+
 hero.combos.map(combo=>
  '<div class="build"><h4>'+esc(combo.name)+'</h4>'+
  '<p><b>Situasi:</b> '+esc(combo.situation)+'</p>'+
  '<div class="combo-sequence">'+(combo.sequence||[]).map((step,j)=>
   '<span class="tag">'+esc(step)+'</span>'+
   (j<combo.sequence.length-1?' → ':'')
  ).join('')+'</div>'+
  '<p>'+esc(combo.description)+'</p></div>'
 ).join('')+'</div>';
}

async function openHero(name,fromUrl=false){
 const h=heroes.find(x=>x.name_hero===name);
 const b=builds.find(x=>norm(x.hero_name)===norm(name));
 if(!h)return;
 if(!fromUrl)history.pushState({},'',location.pathname+'?hero='+encodeURIComponent(heroSlug(name)));
 let html=card(h.name_hero,
 '<img src="images-hero/'+esc(h['images-hero'])+'" alt="'+esc(h.name_hero)+'" loading="lazy">'+
 '<span class="tag">'+esc((h.role||[]).join(', '))+'</span>'+
 '<p>ID Hero: '+esc(h.id_hero)+'</p>'+
 '<p>Build tersedia: '+(b?(b.top_builds||[]).length:0)+'</p>'+
 renderHeroSkills(name)+renderHeroCombos(name)+
 '<button onclick="closeHeroDetail()">← Kembali ke hero</button>'+
 (b?(b.top_builds||[]).map((x,i)=>{
  const aliases={
   "athena's shield":"athenas_shield",
   "berserker's fury":"berserkers_fury",
   "demon shoes":"demon_boots",
   "haas' claws":"haass_claws",
   "magic shoes":"magic_boots",
   "queen's wings":"queens_wings"
  };
  const icon=(name,folder)=>{
   const key=String(name||'').trim().toLowerCase();
   const file=aliases[key]||key.replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'');
   return '<img src="'+folder+'/'+file+'.png" onerror="this.style.display=\'none\'" style="width:42px;height:42px;object-fit:contain;background:#172238;border-radius:9px;padding:3px">';
  };
  const spell='<div style="display:flex;align-items:center;gap:10px;margin:8px 0">'+icon(x.battle_spell,'images-spell')+'<span>'+esc(x.battle_spell)+'</span></div>';
  const emblemFiles={
   'basic common emblem':'emblem_basic-common.webp',
   'custom tank emblem':'emblem_tank.webp',
   'custom assassin emblem':'emblem_assassin.webp',
   'custom magic emblem':'emblem_mage.webp',
   'custom mage emblem':'emblem_mage.webp',
   'custom fighter emblem':'emblem_fighter.webp',
   'custom support emblem':'emblem_support.webp',
   'custom marksman emblem':'emblem_marksman.webp'
  };
  const emblems=(x.emblems||[]).map((e,j)=>{
   const key=e.trim().toLowerCase();
   const file=emblemFiles[key]||('talent_'+key.replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')+'.webp');
   return '<div style="display:inline-flex;flex-direction:column;align-items:center;gap:5px;width:82px;margin:5px 3px;text-align:center">'+
    '<img src="images-emblem/'+file+'" onerror="this.style.display=\'none\'" style="width:54px;height:54px;object-fit:contain;background:#1b2942;border-radius:12px;padding:5px">'+
    '<small>'+esc(e)+'</small></div>';
  }).join('');
  const items=(x.items||[]).map((it,j)=>{
   const choices=it.split('/');
   return '<div style="display:inline-flex;flex-direction:column;align-items:center;gap:5px;background:#111c30;color:#edf7ff;border-radius:10px;padding:8px;margin:4px;min-width:76px">'+
    '<div style="display:flex;gap:3px">'+choices.map(n=>icon(n,'logo-equipment')).join('')+'</div>'+
    '<small style="text-align:center;max-width:100px;color:#edf7ff">'+esc(it)+'</small></div>';
  }).join('');
  return '<div class="build"><h3>Build '+(i+1)+'</h3><p><b>Battle Spell</b></p>'+spell+
   '<p><b>Emblem & Talent</b></p><div style="display:flex;flex-wrap:wrap;gap:5px">'+emblems+'</div>'+
   '<p><b>Equipment</b></p><div style="display:flex;flex-wrap:wrap;gap:4px">'+items+'</div></div>';
 }).join(''):'<p>Build belum tersedia.</p>')+
 '<div class="detail" id="heroDetailCounter"><h3>Data counter terkait</h3><p>Memuat data counter...</p></div>');
 $('content').innerHTML='<h2>Detail Hero</h2>'+html;
 window.scrollTo(0,0);
 loadHeroDetailCounters(name);
}

async function loadHeroDetailCounters(name){
 const out=$('heroDetailCounter');
 if(!out)return;

 try{
  const url='https://arena.fastapicloud.dev/api/heroes/'+
   encodeURIComponent(name)+'/counters?days=7&rank=mythic&size=20&index=1&lang=en';

  const response=await fetch(url);
  if(!response.ok)throw Error('Server API: '+response.status);

  const result=await response.json();
  if(result.code!==0)throw Error(result.message||'API gagal');

  const records=result.data?.records||[];
  if(!records.length){
   out.innerHTML='<h3>Data counter terkait</h3><p>Belum ada data counter untuk hero ini.</p>';
   return;
  }

  const d=records[0].data;
  const counters=d.sub_hero||[];

  const cards=counters.map(c=>{
   const info=apiHeroes.find(x=>Number(x.hero_id)===Number(c.heroid));
   const heroName=info?.hero?.data?.name||('Hero ID '+c.heroid);
   const img=info?.hero?.data?.head||c.hero?.data?.head?.url||c.hero?.data?.head||'';
   const wr=Number(c.hero_win_rate||0)*100;
   const impact=Number(c.increase_win_rate||0)*100;

   return `<div class="card">
    <div class="itemrow">
     <div style="display:flex;align-items:center;gap:12px">
      ${img?`<img src="${esc(img)}" alt="${esc(heroName)}" loading="lazy" style="width:58px;height:58px;object-fit:cover;border-radius:10px">`:''}
      <b>${esc(heroName)}</b>
     </div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;margin-top:12px">
     <div class="detail"><small>Win Rate</small><br><b>${wr.toFixed(2)}%</b></div>
     <div class="detail"><small>Pengaruh</small><br><b>${impact>=0?'+':''}${impact.toFixed(2)}%</b></div>
     <div class="detail"><small>Pick Rate</small><br><b>${(Number(c.hero_appearance_rate||0)*100).toFixed(2)}%</b></div>
    </div>
   </div>`;
  }).join('');

  out.innerHTML='<h3>Data counter terkait</h3>'+
   '<p class="muted">Rank Mythic • Periode 7 hari</p>'+
   (cards||'<p>Belum ada daftar counter.</p>');

 }catch(e){
  out.innerHTML='<h3>Data counter terkait</h3><p style="color:#ff9b9b">Gagal mengambil data: '+esc(e.message)+'</p>';
 }
}


function findItemDetail(item){
 const clean=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
 return itemDetails.find(d=>{
  const q=d.faq?.[0]?.question||'';
  const m=q.match(/^What does (.+) do in Mobile Legends\?$/i);
  return m && clean(m[1])===clean(item['name-equipment']);
 });
}

function getItemStats(item){
 const detail=findItemDetail(item);
 const desc=detail?.description||'';
 // Ambil teks setelah "gold." sampai titik akhir kalimat (titik desimal seperti 7.5 tidak memotong)
 const match=desc.match(/gold\.\s*([\s\S]*?)(?:\.(?=\s|$)|$)/i);
 if(!match)return [];
 return match[1].match(/\+\s*[\d.]+%?\s+[A-Za-z][A-Za-z ]*/g)
  ?.map(x=>x.trim())||[];
}

function getItemCategory(item){
 const detail=findItemDetail(item);
 const match=detail?.description?.match(/Tier \d+ ([A-Za-z]+) item/i);
 return match?match[1].toLowerCase():'other';
}

function itemAnswer(detail,start){
 return detail?.faq?.find(f=>f.question.toLowerCase().startsWith(start))?.answer||'Belum tersedia.';
}

function backToItems(){
 page='item';
 syncNav('item');
 render();
 window.scrollTo(0,0);
}

function openItem(id){
 const item=items.find(x=>Number(x.id_equip)===Number(id));
 if(!item)return;

 const detail=findItemDetail(item);
 if(!detail){
  $('content').innerHTML='<h2>Detail Item</h2><p>Data detail item belum tersedia.</p><button onclick="backToItems()">← Kembali ke Item</button>';
  return;
 }

 const desc=detail.description||'';
 const stats=[...desc.matchAll(/([+-]\d+(?:\.\d+)?%?)\s+([^,.]+)/g)]
  .map(m=>({value:m[1],name:m[2].trim()}));

 const recipe=itemAnswer(detail,'how do i build');
 const users=itemAnswer(detail,'who should buy');
 const price=itemAnswer(detail,'how much does');

 const t=desc.toLowerCase();
 let counterNames=[];
 if(/critical|crit chance|critical damage/.test(t))
  counterNames.push('Blade Armor');
 if(/lifesteal|spell vamp|healing|regen/.test(t))
  counterNames.push('Dominance Ice','Sea Halberd');
 if(/physical attack|physical damage|basic attack/.test(t))
  counterNames.push('Antique Cuirass','Blade Armor');
 if(/magic power|magic damage/.test(t))
  counterNames.push("Athena's Shield",'Radiant Armor');
 if(/attack speed/.test(t))
  counterNames.push('Dominance Ice');

 counterNames=[...new Set(counterNames)]
  .filter(n=>n.toLowerCase()!==item['name-equipment'].toLowerCase());

 const counterHtml=counterNames.map(name=>{
  const found=items.find(x=>x['name-equipment'].toLowerCase()===name.toLowerCase());
  return found?`<div class="itemrow">
   <div style="display:flex;align-items:center;gap:10px">
    <img src="logo-equipment/${esc(found['logo-equipment'])}" style="width:48px;height:48px;object-fit:contain" alt="${esc(name)}">
    <b>${esc(name)}</b>
   </div>
   <span class="price">${Number(found['prize-gold']).toLocaleString('id-ID')} Gold</span>
  </div>`:'';
 }).join('');

 const statsHtml=stats.length?stats.map(x=>
  `<div class="itemrow"><b>${esc(x.name)}</b><strong class="price">${esc(x.value)}</strong></div>`
 ).join(''):'<p>Statistik belum tersedia.</p>';

 $('content').innerHTML=`
  <h2>Detail Item</h2>
  <div class="card">
   <div style="display:flex;align-items:center;gap:16px">
    <img src="logo-equipment/${esc(item['logo-equipment'])}" alt="${esc(item['name-equipment'])}" style="width:105px;height:105px;object-fit:contain">
    <div>
     <h3>${esc(item['name-equipment'])}</h3>
     <b class="price">${Number(item['prize-gold']).toLocaleString('id-ID')} Gold</b>
    </div>
   </div>
   <button onclick="backToItems()">← Kembali ke Item</button>
  </div>
  <div class="detail">
   <h3>Statistik Item</h3>
   ${statsHtml}
  </div>
  <div class="detail">
   <h3>Deskripsi & Efek Pasif</h3>
   <p>${esc(desc)}</p>
  </div>
  <div class="detail">
   <h3>Resep Item</h3>
   <p>${esc(recipe)}</p>
  </div>
  <div class="detail">
   <h3>Hero yang Cocok Menggunakan</h3>
   <p>${esc(users)}</p>
  </div>
  <div class="detail">
   <h3>Informasi Harga</h3>
   <p>${esc(price)}</p>
  </div>
  <div class="detail">
   <h3>Counter Item</h3>
   <p class="muted">Pilihan penangkal berdasarkan efek item ini. Sesuaikan dengan situasi pertandingan.</p>
   ${counterHtml||'<p>Belum ada rekomendasi counter otomatis untuk item ini.</p>'}
  </div>
 `;
 window.scrollTo(0,0);
}

function renderTree(v){
 if(v===null||v===undefined)return '';
 if(Array.isArray(v))return v.map(x=>`<div class="detail">${renderTree(x)}</div>`).join('');
 if(typeof v==='object')return Object.entries(v).map(([k,x])=>`<p><b>${esc(k.replace(/_/g,' '))}:</b> ${renderTree(x)}</p>`).join('');
 return esc(v);
}
load();
