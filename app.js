/* 이지현 논문일지 — 프런트엔드 (GitHub Pages) */
(function(){
const API_URL = window.API_URL;
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const today=()=>{const d=new Date();return new Date(d.getTime()-d.getTimezoneOffset()*6e4).toISOString().slice(0,10)};
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,6);
const PUBLIC_TABS=['cv','papers','hot','contests','jobs','guest','diary'];
const PRIVATE_TABS=['schedule','topics','memos'];
const TABS=[...PUBLIC_TABS,...PRIVATE_TABS];
const DOW=['일','월','화','수','목','금','토'];
let state={}, guest=[], owner=false, pw='', selectedPaper=null, guestTimer=null, dirty=false, editingGuest=null;
let replyTo=null;
let myTokens={};try{myTokens=JSON.parse(localStorage.getItem('gtokens')||'{}')}catch(e){}
function saveTokens(){try{localStorage.setItem('gtokens',JSON.stringify(myTokens))}catch(e){}}

function normalize(){
  ['topics','papers','memos','hot','contests','jobs','diary'].forEach(k=>{if(!Array.isArray(state[k]))state[k]=[]});
  if(!state.schedule||typeof state.schedule!=='object')state.schedule={};
  state.topics.forEach(t=>{if(!Array.isArray(t.feedback))t.feedback=[];if(typeof t.stars!=='number')t.stars=0});
  state.hot.forEach(h=>{if(!Array.isArray(h.notes))h.notes=[]});
  if(!state.gradDate)state.gradDate='2028-08-20';
}

/* ---------- API ---------- */
async function apiGet(a){const r=await fetch(API_URL+'?a='+a+'&t='+Date.now(),{cache:'no-store'});return r.json()}
async function apiPost(body){const r=await fetch(API_URL,{method:'POST',body:JSON.stringify(body),headers:{'Content-Type':'text/plain;charset=utf-8'}});return r.json()}

/* ---------- 탭 ---------- */
const tabs=$('#tabs');
let currentTab='home';
function showTab(name){
  if(PRIVATE_TABS.includes(name)&&!owner)name='home';
  currentTab=name;
  tabs.querySelectorAll('button').forEach(b=>b.setAttribute('aria-selected',b.dataset.tab===name));
  TABS.forEach(t=>{$('#tab-'+t).hidden=(t!==name)});
  $('#home').hidden=(name!=='home');
  if(name==='guest')startGuestPoll();else stopGuestPoll();
  if(name==='home')renderHome();
}
function renderTabs(){
  tabs.querySelectorAll('button').forEach(b=>{b.hidden=PRIVATE_TABS.includes(b.dataset.tab)&&!owner});
}
tabs.addEventListener('click',e=>{const b=e.target.closest('button');if(b)showTab(b.dataset.tab)});
$('#homeLink').addEventListener('click',e=>{e.preventDefault();showTab('home')});

/* ---------- D-day ---------- */
function renderDday(){const g=new Date((state.gradDate||'2028-08-20')+'T00:00:00');const now=new Date();now.setHours(0,0,0,0);
  const d=Math.round((g-now)/864e5);$('#ddayNum').textContent=d>0?'D-'+d:d===0?'D-DAY':'D+'+(-d)}

/* ---------- 렌더 ---------- */
function ownerForm(html){return owner?`<div class="owner">${html}</div>`:''}
function tools(kind,id){return owner?`<div class="tools"><button class="btn ghost sm" data-edit="${kind}:${id}">수정</button><button class="btn ghost sm danger" data-del="${kind}:${id}">삭제</button></div>`:''}

function renderTopics(){
  const el=$('[data-render="topics"]');
  const list=state.topics.length?state.topics.map(t=>`
    <article class="card" id="t-${t.id}">
      <div class="topic-head"><span class="meta">등록 ${esc(t.created||t.updated||'')}</span>
        <span class="stars" aria-label="별점 ${t.stars}점">${[1,2,3,4,5].map(n=>`<button type="button" class="${n<=t.stars?'on':''}" data-star="${t.id}:${n}" ${owner?'':'disabled'} title="${n}점">★</button>`).join('')}</span></div>
      <dl style="margin:0">
        <div class="field"><dt>논문주제</dt><dd>${esc(t.topic)||'—'}</dd></div>
        <div class="field"><dt>데이터</dt><dd>${esc(t.data)||'—'}</dd></div>
        <div class="field"><dt>변수명</dt><dd>${esc(t.vars)||'—'}</dd></div>
      </dl>
      <div class="fb">
        <h4>피드백 ${t.feedback.length?`<span class="meta">${t.feedback.length}개</span>`:''}</h4>
        ${t.feedback.map(f=>`<div class="fb-item"><span class="who">${esc(f.who)}</span><p>${esc(f.text)}</p><span class="meta">${esc(f.date)}</span>${owner?`<button class="btn ghost sm danger" data-delfb="${t.id}:${f.id}">삭제</button>`:''}</div>`).join('')}
        ${owner?`<button class="btn mint sm" data-addfb="${t.id}" style="margin-top:6px">＋ 피드백 추가</button>
        <form class="fb-form" data-fbform="${t.id}" hidden><div class="row"><input placeholder="누가 (예: 지도교수)" data-fbwho required><input class="grow" placeholder="날짜 (비우면 오늘)" data-fbdate></div><textarea placeholder="피드백 내용" data-fbtext required></textarea><div class="row"><button class="btn sm" type="submit">달기</button><button class="btn ghost sm" type="button" data-fbcancel="${t.id}">취소</button></div></form>`:''}
      </div>
      ${tools('topic',t.id)}
    </article>`).join(''):`<div class="empty">아직 논문주제가 없어요 ♡</div>`;
  el.innerHTML=`<h2>논문주제</h2>${list}`+ownerForm(`
    <h4 id="topicFormTitle">논문주제 추가</h4>
    <form id="topicForm">
      <input type="hidden" id="topicId">
      <textarea id="topicTopic" placeholder="논문주제 — 연구질문, 핵심 아이디어" required></textarea>
      <textarea id="topicData" placeholder="데이터 — 출처, 기간, 단위"></textarea>
      <textarea id="topicVars" placeholder="변수명 — 종속/독립/통제변수, 코드명"></textarea>
      <div class="row"><button class="btn" type="submit">저장</button><button class="btn ghost" type="button" id="topicCancel">취소</button></div>
    </form>`);
}
function renderPapers(){
  const el=$('[data-render="papers"]');
  const list=state.papers.length?`<ul class="papers">`+state.papers.map(p=>`
    <li id="p-${p.id}" class="${selectedPaper===p.id?'sel':''}"><span class="pill ${p.status==='예정'?'plan':''}">${esc(p.status)}</span>
      <div style="min-width:0;flex:1"><span class="${owner?'pick':''}" data-pick="${p.id}">${esc(p.cite)}</span>${p.link?` <a href="${esc(p.link)}" target="_blank" rel="noopener">↗</a>`:''}</div></li>`).join('')+`</ul>`
    :`<div class="empty">발간 또는 발간 예정 논문이 여기에 차곡차곡 쌓여요.</div>`;
  const p=selectedPaper?state.papers.find(x=>x.id===selectedPaper):null;
  el.innerHTML=`<h2>발간(예정)논문</h2>${owner?'<p class="meta" style="margin:-6px 0 10px">논문을 클릭하면 아래에서 수정·삭제할 수 있어요.</p>':''}${list}`+ownerForm(`
    <h4>${p?'논문 수정':'논문 추가'}</h4>
    <form id="paperForm">
      <input type="hidden" id="paperId" value="${p?esc(p.id):''}">
      <textarea id="paperCite" placeholder="출처 (저자, 연도, 제목, 학술지, 권(호), 쪽)" required>${p?esc(p.cite):''}</textarea>
      <div class="row"><select id="paperStatus" style="width:auto"><option ${p&&p.status==='발간'?'selected':''}>발간</option><option ${p&&p.status==='예정'?'selected':''}>예정</option></select><input class="grow" id="paperLink" placeholder="링크 (선택)" value="${p?esc(p.link||''):''}"></div>
      <div class="row"><button class="btn" type="submit">${p?'수정 저장':'추가'}</button>${p?`<button class="btn ghost danger" type="button" data-del="paper:${esc(p.id)}">삭제</button>`:''}<button class="btn ghost" type="button" id="paperCancel">취소</button></div>
    </form>`);
}
function renderMemos(){
  const el=$('[data-render="memos"]');
  const list=state.memos.length?`<div class="memos">`+state.memos.map(m=>`
    <div class="memo" id="m-${m.id}"><p>${esc(m.text)}</p><div class="meta">${esc(m.date)}</div>${tools('memo',m.id)}</div>`).join('')+`</div>`
    :`<div class="empty">메모가 쌓이면 포스트잇처럼 3개씩 붙어요.</div>`;
  el.innerHTML=`<h2>메모</h2>${list}`+ownerForm(`
    <h4 id="memoFormTitle">메모 추가</h4>
    <form id="memoForm"><input type="hidden" id="memoId"><textarea id="memoText" placeholder="떠오른 생각, 할 일, 읽을 논문…" required></textarea>
    <div class="row"><label class="meta" for="memoDate">날짜</label><input type="date" id="memoDate" value="${today()}" style="width:auto"></div>
    <div class="row"><button class="btn" type="submit">저장</button><button class="btn ghost" type="button" id="memoCancel">취소</button></div></form>`);
}
function renderHot(){
  const el=$('[data-render="hot"]');
  const list=state.hot.length?state.hot.map((h,i)=>`
    <article class="card hot" id="h-${i}">
      <span class="pill mint">${esc(h.tag)}</span>
      <p class="cite">${esc(h.cite)}${h.link?` <a href="${esc(h.link)}" target="_blank" rel="noopener">↗ 원문</a>`:''}</p>
      <p class="why">💡 ${esc(h.why)}</p>
      <details><summary>${esc(h.kind||'초록')} 펼치기</summary><p class="abs">${esc(h.text)}</p>
        ${h.ko?`<details class="tr-btn"><summary class="meta" style="cursor:pointer">한국어 번역 보기</summary><p class="ko">${esc(h.ko)}</p></details>`:''}
      </details>
      ${(h.notes.length||owner)?`<div class="hot-notes"><h5>✎ 내 메모</h5>
        ${h.notes.map((n,j)=>`<div class="n"><p>${esc(n.text)}</p><span class="meta">${esc(n.date)}</span>${owner?`<button class="btn ghost sm danger" data-delhotnote="${i}:${j}">삭제</button>`:''}</div>`).join('')}
        ${owner?`<form data-hotnote="${i}"><textarea placeholder="이 논문에 대한 메모…" required></textarea><button class="btn sm" type="submit">달기</button></form>`:''}
      </div>`:''}
      ${owner?`<div class="tools"><button class="btn ghost sm danger" data-delhot="${i}">삭제</button></div>`:''}
    </article>`).join(''):`<div class="empty">이번 달 Hot 논문을 준비 중이에요.</div>`;
  el.innerHTML=`<h2>Hot!</h2><div class="note">최근 행정학·정책학·지역학 저널에서 지현님 연구(노동시장·지방소멸·인구이동·공무원 인식·악성민원·AI 정책)와 맞닿은 논문 모음 · 매월 말일 갱신 · 마지막 갱신 ${esc(state.hotUpdated||'')}</div>${list}`;
}
function renderContests(){
  const el=$('[data-render="contests"]');
  const t=today();
  const items=state.contests.map((c,i)=>({c,i}));
  const isPast=c=>c.status!=='예상'&&c.deadline&&c.deadline.length===10&&c.deadline<t;
  const dd=c=>{if(!c.deadline||c.deadline.length!==10)return '';const d=Math.round((new Date(c.deadline+'T00:00:00')-new Date(t+'T00:00:00'))/864e5);return d===0?'오늘 마감':d>0?`D-${d}`:`마감 ${-d}일 전`};
  const byAdded=(a,b)=>(b.c.added||'').localeCompare(a.c.added||'')||(a.c.deadline||'9').localeCompare(b.c.deadline||'9');
  const open=items.filter(x=>x.c.status!=='예상'&&!isPast(x.c)).sort(byAdded);
  const exp=items.filter(x=>x.c.status==='예상').sort(byAdded);
  const past=items.filter(x=>isPast(x.c)).sort((a,b)=>(b.c.deadline||'').localeCompare(a.c.deadline||''));
  const isNew=c=>c.added&&Math.round((new Date(t+'T00:00:00')-new Date(c.added+'T00:00:00'))/864e5)<=7;
  const row=({c,i},kind)=>{const d=dd(c);const soon=d&&/^D-(\d+)$/.test(d)&&+d.slice(2)<=14||d==='오늘 마감';
    return `<div class="ct"><div class="when ${kind==='exp'?'exp':soon?'soon':''}">${esc((c.deadline||'미정').replace(/-/g,'.'))}${kind==='exp'?'<small>예상</small>':d?`<small>${esc(d)}</small>`:''}</div>
    <div class="what"><b>${isNew(c)?'<span class="pill" style="margin:0 6px 0 0;vertical-align:middle">NEW</span>':''}${c.link?`<a href="${esc(c.link)}" target="_blank" rel="noopener" style="color:inherit;text-decoration:none">${esc(c.title)}</a>`:esc(c.title)}</b>
    <span class="meta">${esc(c.host)}${c.target?' · '+esc(c.target):''}${c.added?' · 등록 '+esc(c.added):''}</span>
    ${c.prize?`<span class="meta">🏆 ${esc(c.prize)}</span>`:''}${c.when?`<span class="meta">📅 ${esc(c.when)}</span>`:''}${c.note?`<span class="meta">${esc(c.note)}</span>`:''}
    ${owner?`<div class="tools"><button class="btn ghost sm danger" data-delcontest="${i}">삭제</button></div>`:''}</div></div>`};
  el.innerHTML=`<h2>논문경진대회</h2><div class="note">대학원생이 낼 수 있는 논문 공모전·경진대회·정책연구대회 모음 (최근 등록 순, 7일 이내 NEW) · 매일 아침 갱신 · 마지막 갱신 ${esc(state.contestsUpdated||'')}</div>
    ${open.length?open.map(x=>row(x,'open')).join(''):'<div class="empty">지금 접수 중인 공모전이 없어요.</div>'}
    ${exp.length?`<h4 style="margin:22px 0 4px;font-family:var(--display);font-weight:400;color:var(--muted)">다음 회차 예상 (예년 일정 기준)</h4>${exp.map(x=>row(x,'exp')).join('')}`:''}
    ${past.length?`<details style="margin-top:14px"><summary class="meta" style="cursor:pointer">마감된 공모 ${past.length}건</summary>${past.map(x=>row(x,'past')).join('')}</details>`:''}`
    +ownerForm(`<h4>공모전 추가</h4><form id="contestForm">
      <input id="ctTitle" placeholder="공모명" required>
      <div class="row"><label class="meta" for="ctDeadline">마감</label><input type="date" id="ctDeadline" style="width:auto"><select id="ctStatus" style="width:auto"><option>접수중</option><option>예상</option></select></div>
      <div class="row"><input id="ctHost" class="grow" placeholder="주최"><input id="ctTarget" class="grow" placeholder="대상"></div>
      <div class="row"><input id="ctPrize" class="grow" placeholder="상금"><input id="ctWhen" class="grow" placeholder="발표·시상 일정"></div>
      <input id="ctNote" placeholder="메모"><input id="ctLink" placeholder="링크">
      <div class="row"><button class="btn" type="submit">저장</button></div></form>`);
}
function renderJobs(){
  const el=$('[data-render="jobs"]');
  const list=state.jobs.length?`<ul class="jobs">`+state.jobs.map((j,i)=>`
    <li><span class="meta">${esc(j.date)}</span><span>${j.link?`<a href="${esc(j.link)}" target="_blank" rel="noopener">${esc(j.title)}</a>`:esc(j.title)}${owner?` <button class="btn ghost sm danger" data-deljob="${i}">삭제</button>`:''}</span></li>`).join('')+`</ul>`
    :`<div class="empty">채용정보가 아직 없어요.</div>`;
  el.innerHTML=`<h2>채용정보</h2><p class="meta" style="margin:-6px 0 12px">매일 아침 자동 갱신 · 마지막 갱신 ${esc(state.jobsUpdated||'')}</p>${list}`;
}
function fmtDate(d){const t=new Date(d);return isNaN(t)?String(d||'').slice(0,10):t.toLocaleDateString('ko-KR',{year:'numeric',month:'2-digit',day:'2-digit'}).replace(/\s/g,'').replace(/\.$/,'')}
function renderGuest(){
  const el=$('[data-render="guest"]');
  const tops=guest.filter(g=>!g.parent);const kids=id=>guest.filter(g=>g.parent===id).slice().reverse();
  const one=(g,isReply)=>{const mine=!!myTokens[g.id];
    if(editingGuest===g.id&&mine)return `<form class="guest ${isReply?'reply':''}" id="g-${esc(g.id)}" data-geditform="${esc(g.id)}"><div class="row"><input data-genick value="${esc(g.nick)}" maxlength="30" required style="flex:0 1 180px"></div><textarea data-getext maxlength="1000" required>${esc(g.text)}</textarea><div class="row" style="margin-top:6px"><button class="btn sm" type="submit">저장</button><button class="btn ghost sm" type="button" data-gcancel="1">취소</button></div></form>`;
    const acts=[];if(!isReply)acts.push(`<button class="btn ghost sm" data-greply="${esc(g.id)}">답글</button>`);
    if(mine)acts.push(`<button class="btn ghost sm" data-gedit="${esc(g.id)}">수정</button><button class="btn ghost sm danger" data-gdel="${esc(g.id)}">삭제</button>`);else if(owner)acts.push(`<button class="btn ghost sm danger" data-hideguest="${esc(g.id)}">삭제</button>`);
    const replyForm=(!isReply&&replyTo===g.id)?`<form class="gform reply-form" data-greplyform="${esc(g.id)}"><div class="row"><input data-rnick placeholder="닉네임" maxlength="30" required value="${esc(owner?'지현':(()=>{try{return localStorage.getItem('nick')||''}catch(e){return ''}})())}" style="flex:0 1 160px"></div><textarea data-rtext placeholder="답글…" maxlength="1000" required></textarea><div class="row"><button class="btn sm" type="submit">답글 달기</button><button class="btn ghost sm" type="button" data-grcancel="1">취소</button><span class="meta" data-rmsg></span></div></form>`:'';
    return `<div class="guest ${isReply?'reply':''}" id="g-${esc(g.id)}"><b>${esc(g.nick)}</b>${g.byOwner?' <span class="pill" style="font-size:10.5px">주인장</span>':''} <span class="meta">${esc(fmtDate(g.date))}</span>${mine?' <span class="pill mint" style="font-size:10.5px">내 글</span>':''}<p>${esc(g.text)}</p>
      ${acts.length?`<div class="tools">${acts.join('')}</div>`:''}${replyForm}${isReply?'':kids(g.id).map(k=>one(k,true)).join('')}</div>`};
  const list=tops.length?tops.map(g=>one(g,false)).join('')
    :`<div class="empty">첫 방명록을 기다리고 있어요.</div>`;
  el.innerHTML=`<h2>방명록</h2>
    <form class="gform" id="guestLive" autocomplete="off">
      <h4 style="margin:0;font-family:var(--display);font-weight:400;color:var(--pink)">방명록 남기기 ♡</h4>
      <div class="row"><input id="glNick" placeholder="닉네임" required maxlength="30" style="flex:0 1 180px"></div>
      <textarea id="glText" placeholder="한마디 남겨 주세요" required maxlength="1000"></textarea>
      <input class="hp" id="glHp" name="website" tabindex="-1" autocomplete="off">
      <div class="row"><button class="btn" type="submit">남기기</button><span class="meta" id="glMsg"></span></div>
    </form>
    <p class="count meta" id="gCount">방명록 ${tops.length}개 · 실시간</p>${list}`;
  try{const n=localStorage.getItem('nick');if(n&&$('#glNick'))$('#glNick').value=n}catch(e){}
}
/* ---------- 일기장 ---------- */
function renderHome(){
  const el=$('#home');
  const d=state.diary[0];
  el.innerHTML=d?`<article class="diary home"><h2 class="dtitle">${esc(d.title||'')}</h2><p class="dbody">${esc(d.text)}</p><p class="meta" style="text-align:right"><a href="#" data-gotab="diary">일기장 더 보기 →</a></p></article>`
    :`<div class="empty">첫 일기를 기다리고 있어요 ✎</div>`;
}
function renderDiary(){
  const el=$('[data-render="diary"]');
  const list=state.diary.length?state.diary.map(d=>`
    <article class="diary" id="d-${d.id}"><div class="row" style="justify-content:space-between"><h3 class="dtitle" style="margin:0">${esc(d.title||'')}</h3><span class="meta">${esc(d.date)}</span></div><p class="dbody">${esc(d.text)}</p>${tools('diary',d.id)}</article>`).join('')
    :`<div class="empty">첫 일기를 기다리고 있어요 ✎</div>`;
  el.innerHTML=`<h2>일기장</h2>${list}`+ownerForm(`
    <h4 id="diaryFormTitle">일기 쓰기</h4>
    <form id="diaryForm"><input type="hidden" id="diaryId"><input id="diaryTitle" placeholder="제목 (선택)"><textarea id="diaryText" style="min-height:160px" placeholder="오늘의 이야기…" required></textarea>
    <div class="row"><label class="meta" for="diaryDate">날짜</label><input type="date" id="diaryDate" value="${today()}" style="width:auto"></div>
    <div class="row"><button class="btn" type="submit">저장</button><button class="btn ghost" type="button" id="diaryCancel">취소</button></div></form>`);
}
/* ---------- CV ---------- */
async function renderCV(){
  const el=$('[data-render="cv"]');
  const url=state.cvUrl||'cv.pdf';
  el.innerHTML=`<h2>CV</h2><p class="meta" id="cvMsg">불러오는 중…</p>`;
  let ok=false;try{const r=await fetch(url,{method:'HEAD',cache:'no-store'});ok=r.ok}catch(e){}
  el.innerHTML=`<h2>CV</h2>`+(ok?`<p class="meta" style="margin:-6px 0 10px"><a href="${esc(url)}" target="_blank" rel="noopener">새 창에서 열기 / 내려받기 ↗</a>${state.cvUpdated?' · 갱신 '+esc(state.cvUpdated):''}</p><iframe class="cvframe" src="${esc(url)}#view=FitH" title="CV"></iframe>`
    :`<div class="empty">CV를 준비하고 있어요 📄</div>`);
}
/* ---------- 일정표 (주간) ---------- */
let weekOffset=0, schedTimer=null;
function mondayOf(d){const x=new Date(d);x.setHours(0,0,0,0);const dow=(x.getDay()+6)%7;x.setDate(x.getDate()-dow);return x}
function ymd(d){return new Date(d.getTime()-d.getTimezoneOffset()*6e4).toISOString().slice(0,10)}
function renderSchedule(){
  const el=$('[data-render="schedule"]');if(!owner){el.innerHTML='';return}
  const base=mondayOf(new Date());base.setDate(base.getDate()+weekOffset*7);
  const t=today();
  const days=[...Array(7)].map((_,i)=>{const d=new Date(base);d.setDate(base.getDate()+i);return d});
  const cell=(d,half)=>{const k=ymd(d);const dow=d.getDay();const isT=k===t;
    return `<div class="day ${half?'half':''} ${isT?'today':''} ${dow===0?'sun':dow===6?'sat':''}"><div class="dh"><b>${DOW[dow]}</b><span>${d.getMonth()+1}/${d.getDate()}</span></div><textarea data-sched="${k}" placeholder="—">${esc(state.schedule[k]||'')}</textarea></div>`};
  const end=new Date(base);end.setDate(base.getDate()+6);
  el.innerHTML=`<h2>일정표</h2>
    <div class="row" style="justify-content:space-between;margin-bottom:10px"><button class="btn ghost sm" id="wPrev" type="button">‹ 지난주</button><b style="font-family:var(--display);font-weight:400;font-size:17px">${base.getFullYear()}.${base.getMonth()+1}.${base.getDate()} ~ ${end.getMonth()+1}.${end.getDate()}${weekOffset===0?' <span class="pill" style="margin-left:6px">이번 주</span>':''}</b><div class="row"><button class="btn ghost sm" id="wToday" type="button">오늘</button><button class="btn ghost sm" id="wNext" type="button">다음주 ›</button></div></div>
    <div class="week">${days.slice(0,5).map(d=>cell(d,false)).join('')}<div class="weekend">${cell(days[5],true)}${cell(days[6],true)}</div></div>
    <p class="meta" id="schedMsg" style="margin-top:8px">칸에 쓰면 자동으로 저장돼요.</p>`;
}
function renderAll(){renderDday();renderTabs();renderCV();renderPapers();renderHot();renderContests();renderJobs();renderGuest();renderDiary();renderSchedule();renderTopics();renderMemos();renderOwnerBar();if(currentTab==='home')renderHome()}

/* ---------- 주인 모드 ---------- */
function renderOwnerBar(){
  const b=$('#ownerBar');
  b.innerHTML=owner?`<span class="meta">✎ 편집 모드</span><button class="btn ghost sm" id="logout" type="button">잠그기</button>`
    :`<button class="btn ghost sm" id="login" type="button" title="주인만">🔑</button>`;
}
async function login(){
  const box=$('#pwForm');box.hidden=false;$('#pwInput').focus();
}
async function tryLogin(){
  const v=$('#pwInput').value.trim();if(!v)return;
  $('#pwMsg').textContent='확인 중…';
  try{const r=await apiPost({a:'check',pw:v});
    if(r.ok&&r.auth){pw=v;owner=true;try{localStorage.setItem('pw',v)}catch(e){}$('#pwForm').hidden=true;$('#pwInput').value='';await loadFull();renderAll();
      if(!Object.keys(state).some(k=>Array.isArray(state[k])&&state[k].length)&&window.SEED){ if(await seedIfEmpty()) return; }
    } else $('#pwMsg').textContent='비밀번호가 맞지 않아요.';
  }catch(e){$('#pwMsg').textContent='확인 실패: '+e.message}
}
async function seedIfEmpty(){
  status('초기 데이터를 올리는 중…');
  state=JSON.parse(JSON.stringify(window.SEED));normalize();
  const r=await apiPost({a:'save',pw,state});
  status(r.ok?'초기 데이터 저장 완료!':'초기 데이터 저장 실패: '+r.error);renderAll();return r.ok;
}
async function loadFull(){try{const r=await apiPost({a:'full',pw});if(r.ok&&r.state){state=r.state;normalize()}}catch(e){}}
function logout(){owner=false;pw='';try{localStorage.removeItem('pw')}catch(e){}['topics','memos'].forEach(k=>state[k]=[]);state.schedule={};if(PRIVATE_TABS.includes(currentTab))currentTab='home';renderAll();showTab(currentTab)}

function status(msg){let s=$('#status');if(!s){s=document.createElement('div');s.id='status';document.body.appendChild(s)}s.textContent=msg;clearTimeout(status.t);status.t=setTimeout(()=>{s.remove()},4000)}
async function save(){
  if(!owner)return;
  status('저장 중…');
  try{const r=await apiPost({a:'save',pw,state});
    if(r.ok){status('저장 완료 ♡')}else{status('저장 실패: '+(r.error||''));if(r.auth===false)logout()}
  }catch(e){status('저장 실패: '+e.message)}
  renderAll();
}

/* ---------- 방명록 실시간 ---------- */
async function loadGuest(){
  try{const r=await apiGet('guest');if(r.ok){const before=JSON.stringify(guest);guest=r.items||[];if(JSON.stringify(guest)!==before)renderGuest()}}catch(e){}
}
function startGuestPoll(){stopGuestPoll();loadGuest();guestTimer=setInterval(()=>{if(!document.hidden)loadGuest()},20000)}
function stopGuestPoll(){if(guestTimer){clearInterval(guestTimer);guestTimer=null}}
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!$('#tab-guest').hidden)loadGuest()});

/* ---------- 이벤트 ---------- */
document.addEventListener('submit',async e=>{
  const f=e.target;e.preventDefault();
  if(f.id==='pwForm')return tryLogin();
  if(f.id==='guestLive'){const nick=$('#glNick').value.trim(),text=$('#glText').value.trim(),hp=$('#glHp').value;const msg=$('#glMsg');const btn=f.querySelector('button');
    if(!nick||!text)return;btn.disabled=true;msg.textContent='남기는 중…';
    try{const gb={a:'guest',nick,text,hp};if(owner)gb.pw=pw;const r=await apiPost(gb);if(!r.ok)throw new Error(r.error||'실패');$('#glText').value='';try{localStorage.setItem('nick',nick)}catch(_){}
      if(r.token&&r.item){myTokens[r.item.id]=r.token;saveTokens()}
      guest.unshift(r.item);renderGuest();$('#glMsg').textContent='고마워요! 남겨졌어요 ♡';setTimeout(loadGuest,800);}
    catch(err){msg.textContent='저장에 실패했어요: '+err.message}finally{btn.disabled=false}return}
  if(f.dataset.greplyform){const parent=f.dataset.greplyform;const nick=f.querySelector('[data-rnick]').value.trim(),text=f.querySelector('[data-rtext]').value.trim();const msg=f.querySelector('[data-rmsg]');msg.textContent='다는 중…';
    try{const body={a:'guest',nick,text,parent};if(owner)body.pw=pw;const r=await apiPost(body);if(!r.ok)throw new Error(r.error||'실패');if(r.token&&r.item){myTokens[r.item.id]=r.token;saveTokens()}try{localStorage.setItem('nick',nick)}catch(_){}
      replyTo=null;guest.unshift(r.item);renderGuest();setTimeout(loadGuest,800)}catch(err){msg.textContent='실패: '+err.message}return}
  if(f.dataset.geditform){const id=f.dataset.geditform;const nick=f.querySelector('[data-genick]').value.trim(),text=f.querySelector('[data-getext]').value.trim();
    try{const r=await apiPost({a:'guestEdit',id,token:myTokens[id],nick,text});if(!r.ok)throw new Error(r.error||'실패');const g=guest.find(x=>x.id===id);if(g){g.nick=nick;g.text=text}editingGuest=null;renderGuest();status('수정했어요 ♡')}
    catch(err){status('수정 실패: '+err.message)}return}
  if(!owner)return;
  if(f.dataset.fbform){const t=state.topics.find(x=>x.id===f.dataset.fbform);
    t.feedback.push({id:uid(),who:f.querySelector('[data-fbwho]').value.trim(),text:f.querySelector('[data-fbtext]').value.trim(),date:f.querySelector('[data-fbdate]').value.trim()||today()});t.updated=today();return save()}
  if(f.dataset.hotnote){const h=state.hot[+f.dataset.hotnote];h.notes.push({text:f.querySelector('textarea').value.trim(),date:today()});return save()}
  if(f.id==='topicForm'){const id=$('#topicId').value;
    if(id){const t=state.topics.find(x=>x.id===id);Object.assign(t,{topic:$('#topicTopic').value.trim(),data:$('#topicData').value.trim(),vars:$('#topicVars').value.trim(),updated:today()})}
    else state.topics.unshift({id:uid(),topic:$('#topicTopic').value.trim(),data:$('#topicData').value.trim(),vars:$('#topicVars').value.trim(),feedback:[],stars:0,created:today(),updated:today()})}
  if(f.id==='paperForm'){const id=$('#paperId').value||uid();const p={id,cite:$('#paperCite').value.trim(),status:$('#paperStatus').value,link:$('#paperLink').value.trim()};
    const i=state.papers.findIndex(x=>x.id===id);if(i>=0)state.papers[i]=p;else state.papers.unshift(p);selectedPaper=null}
  if(f.id==='memoForm'){const id=$('#memoId').value;const i=state.memos.findIndex(x=>x.id===id);const date=$('#memoDate').value||today();
    if(i>=0){state.memos[i].text=$('#memoText').value.trim();state.memos[i].date=date}else state.memos.unshift({id:uid(),text:$('#memoText').value.trim(),date})}
  if(f.id==='diaryForm'){const id=$('#diaryId').value;const rec={title:$('#diaryTitle').value.trim(),text:$('#diaryText').value.trim(),date:$('#diaryDate').value||today()};
    const i=state.diary.findIndex(x=>x.id===id);if(i>=0)Object.assign(state.diary[i],rec);else state.diary.unshift({id:uid(),...rec});
    state.diary.sort((x,y)=>(y.date||'').localeCompare(x.date||''))}
  if(f.id==='contestForm'){state.contests.unshift({added:today(),deadline:$('#ctDeadline').value,status:$('#ctStatus').value,title:$('#ctTitle').value.trim(),host:$('#ctHost').value.trim(),target:$('#ctTarget').value.trim(),prize:$('#ctPrize').value.trim(),when:$('#ctWhen').value.trim(),note:$('#ctNote').value.trim(),link:$('#ctLink').value.trim()})}
  await save();
});
document.addEventListener('click',async e=>{
  const pick=e.target.closest('[data-pick]');
  if(pick&&owner){selectedPaper=(selectedPaper===pick.dataset.pick)?null:pick.dataset.pick;renderPapers();if(selectedPaper)$('#paperForm').scrollIntoView({behavior:'smooth',block:'center'});return}
  const b=e.target.closest('button');if(!b)return;
  if(b.id==='login')return login();
  if(b.id==='pwCancel'){$('#pwForm').hidden=true;return}
  if(b.id==='logout')return logout();
  if(b.dataset.greply){replyTo=(replyTo===b.dataset.greply)?null:b.dataset.greply;renderGuest();const ta=document.querySelector('[data-rtext]');if(ta)ta.focus();return}
  if(b.dataset.grcancel){replyTo=null;renderGuest();return}
  if(b.dataset.gedit){editingGuest=b.dataset.gedit;renderGuest();return}
  if(b.dataset.gcancel){editingGuest=null;renderGuest();return}
  if(b.dataset.gdel){const id=b.dataset.gdel;if(!b.dataset.armed){b.dataset.armed='1';b.textContent='정말 삭제?';return}
    try{const r=await apiPost({a:'guestDel',id,token:myTokens[id]});if(!r.ok)throw new Error(r.error||'실패');guest=guest.filter(g=>g.id!==id);delete myTokens[id];saveTokens();renderGuest();status('지웠어요')}catch(err){status('삭제 실패: '+err.message)}return}
  if(!owner)return;
  const d=b.dataset;
  if(d.hideguest){if(!d.armed){d.armed='1';b.textContent='정말?';return}
    try{const r=await apiPost({a:'hide',pw,id:d.hideguest});if(r.ok){guest=guest.filter(g=>g.id!==d.hideguest);renderGuest();status('숨겼어요')}else status('실패: '+r.error)}catch(err){status('실패')}return}
  if(d.addfb){const f=document.querySelector(`[data-fbform="${d.addfb}"]`);f.hidden=false;b.hidden=true;f.querySelector('[data-fbwho]').focus();return}
  if(d.fbcancel){const f=document.querySelector(`[data-fbform="${d.fbcancel}"]`);f.hidden=true;document.querySelector(`[data-addfb="${d.fbcancel}"]`).hidden=false;return}
  if(d.delfb){const [tid,fid]=d.delfb.split(':');if(!d.armed){d.armed='1';b.textContent='정말?';return}
    const t=state.topics.find(x=>x.id===tid);t.feedback=t.feedback.filter(x=>x.id!==fid);return save()}
  if(d.star){const [tid,n]=d.star.split(':');const t=state.topics.find(x=>x.id===tid);t.stars=(t.stars===+n)?0:+n;return save()}
  if(d.delhotnote){const [i,j]=d.delhotnote.split(':');state.hot[+i].notes.splice(+j,1);return save()}
  if(d.delcontest){if(!d.armed){d.armed='1';b.textContent='정말?';return}state.contests.splice(+d.delcontest,1);return save()}
  if(d.delhot){if(!d.armed){d.armed='1';b.textContent='정말?';return}state.hot.splice(+d.delhot,1);return save()}
  if(d.deljob){if(!d.armed){d.armed='1';b.textContent='정말?';return}state.jobs.splice(+d.deljob,1);return save()}
  if(d.del){const [k,id]=d.del.split(':');
    if(d.armed){const key={topic:'topics',paper:'papers',memo:'memos',diary:'diary'}[k];state[key]=state[key].filter(x=>x.id!==id);selectedPaper=null;save()}
    else{d.armed='1';b.textContent='정말 삭제?'}return}
  if(d.edit){const [k,id]=d.edit.split(':');
    if(k==='topic'){const t=state.topics.find(x=>x.id===id);$('#topicId').value=id;$('#topicTopic').value=t.topic;$('#topicData').value=t.data;$('#topicVars').value=t.vars;$('#topicFormTitle').textContent='논문주제 수정';$('#topicForm').scrollIntoView({behavior:'smooth'})}
    if(k==='diary'){const m=state.diary.find(x=>x.id===id);$('#diaryId').value=id;$('#diaryTitle').value=m.title||'';$('#diaryText').value=m.text;$('#diaryDate').value=m.date||today();$('#diaryFormTitle').textContent='일기 수정';$('#diaryForm').scrollIntoView({behavior:'smooth'})}
    if(k==='memo'){const m=state.memos.find(x=>x.id===id);$('#memoId').value=id;$('#memoText').value=m.text;$('#memoDate').value=m.date||today();$('#memoFormTitle').textContent='메모 수정';$('#memoForm').scrollIntoView({behavior:'smooth'})}
    return}
  if(b.id==='paperCancel'){selectedPaper=null;renderPapers();return}
  if(b.id==='wPrev'){weekOffset--;renderSchedule();return}
  if(b.id==='wNext'){weekOffset++;renderSchedule();return}
  if(b.id==='wToday'){weekOffset=0;renderSchedule();return}
  if(/Cancel$/.test(b.id)){renderAll()}
});

document.addEventListener('click',e=>{const g=e.target.closest('[data-gotab]');if(g){e.preventDefault();showTab(g.dataset.gotab)}});
document.addEventListener('input',e=>{const ta=e.target.closest('[data-sched]');if(!ta||!owner)return;state.schedule[ta.dataset.sched]=ta.value;
  clearTimeout(schedTimer);const m=$('#schedMsg');if(m)m.textContent='저장 대기…';
  schedTimer=setTimeout(async()=>{try{const r=await apiPost({a:'patch',pw,set:{schedule:state.schedule}});if(m)m.textContent=r.ok?'저장됐어요 ♡':'저장 실패: '+(r.error||'')}catch(err){if(m)m.textContent='저장 실패'}},1200)});

/* ---------- 인트로 (사진 → 종이비행기) ---------- */
function runIntro(){
  const o=$('#intro');if(!o)return;
  let seen=false;try{seen=sessionStorage.getItem('introSeen')==='1'}catch(e){}
  const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(seen||reduce){o.remove();return}
  const end=()=>{o.classList.add('out');setTimeout(()=>o.remove(),700);try{sessionStorage.setItem('introSeen','1')}catch(e){}};
  o.addEventListener('click',end);
  const img=$('#introPhoto');
  const go=()=>{o.classList.add('play');setTimeout(end,5900)};
  if(img.complete)go();else{img.onload=go;img.onerror=()=>{img.remove();o.classList.add('nophoto');go()}}
}
runIntro();

/* ---------- 시작 ---------- */
(async()=>{
  let initial='home';
  try{const h=location.hash.replace('#','');if(TABS.includes(h))initial=h}catch(e){}
  try{const r=await apiGet('all');if(r.ok){state=r.state||{};guest=r.guest||[]}}catch(e){$('#loadMsg').textContent='데이터를 불러오지 못했어요. 새로고침해 주세요.'}
  normalize();
  $('#loadMsg').remove();
  renderAll();showTab(initial);
  try{const saved=localStorage.getItem('pw');if(saved){const r=await apiPost({a:'check',pw:saved});if(r.ok&&r.auth){pw=saved;owner=true;await loadFull();renderAll();showTab(currentTab);
    if(!['topics','papers','memos','hot','contests','jobs'].some(k=>state[k].length)&&window.SEED)await seedIfEmpty()}}}catch(e){}
})();
})();
