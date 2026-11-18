/* Standalone deterministic product-operation examples. All accounts and receipts are synthetic. */
(() => {
  'use strict';
  const NUM_DAYS = 153;
  const DAY_MS = 86400000;
  const firstDay = Date.UTC(2026, 5, 1);
  const dates = Array.from({length: NUM_DAYS}, (_, i) => new Date(firstDay + i * DAY_MS).toISOString().slice(0, 10));
  const labels = {
    register: '注册成功', visit: '浏览工作台', upload: '上传文档', parse: '解析完成', read: '查看知识', download: '下载知识',
    buildStart: '发起构建', build: '首次构建成功', edit: '追加编辑', rebuild: '全新重建', audience: '新建应用收到首次访问'
  };
  const activeKinds = ['upload', 'build', 'edit', 'rebuild'];
  const paths = {
    activation: {title: '新注册用户当日激活', keys: ['register','upload','build','audience']},
    creation: {title: '应用创作', keys: ['upload','parse','buildStart','build']},
    knowledge: {title: '知识获取', keys: ['upload','parse','read','download']}
  };
  let seed = 981257;
  function rand() {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  }
  const trial = chance => rand() < chance;
  const int = (min,max) => min + Math.floor(rand() * (max-min+1));
  const accounts = [];
  const byDay = dates.map(() => []);
  let seq = 0;
  function event(person, day, minutes, kind, asset = null) {
    const incident = day >= NUM_DAYS - 5;
    const missRate = kind === 'register' ? 0 : kind === 'buildStart' && incident ? .36
      : kind === 'read' && incident ? .29 : kind === 'upload' && incident ? .12
      : kind === 'audience' ? .14 : .025;
    const row = {id: 'EV'+(++seq).toString(36).toUpperCase().padStart(5,'0'), user:person.id, account:person,
      day, minutes, kind, asset, lost:trial(missRate), repeat:false};
    row.repeat = !row.lost && trial(.062);
    byDay[day].push(row);
  }

  function journey(person, day, minute) {
    event(person,day,minute,'visit');
    if (trial(.52)) {
      const asset = 'S' + seq.toString(36);
      event(person,day,minute+1,'upload',asset);
      if (trial(.86)) {
        event(person,day,minute+3,'parse',asset);
        if (trial(.68)) {
          event(person,day,minute+5,'read',asset);
          if (trial(.47)) event(person,day,minute+8,'download',asset);
        }
        if (trial(.60)) {
          event(person,day,minute+10,'buildStart',asset);
          if (trial(.76)) {
            event(person,day,minute+16,'build',asset);
            person.hasApp = true;
            if (trial(.56)) event(person,day,minute+23,'audience',asset);
          }
        }
      }
    }
    if (person.hasApp && trial(.48)) event(person,day,minute+32,'edit');
    if (person.hasApp && trial(.17)) event(person,day,minute+37,'rebuild');
  }

  for (let day = 0; day < NUM_DAYS; day++) {
    const signups = int(5,10) + (day > 98 ? int(1,4) : 0);
    for (let i=0; i<signups; i++) {
      const id = 'U'+String(accounts.length+1).padStart(4,'0');
      const person = {id, day, internal:trial(.075), engaged:.6+1.35*rand(), hasApp:false};
      accounts.push(person);
      event(person,day,6*60+int(0,55),'register');
    }
    for (const person of accounts) {
      const age = day-person.day;
      const chance = age===0 ? .83 : (.135*Math.exp(-age/24)+.021)*person.engaged;
      if (!trial(chance)) continue;
      journey(person,day,int(8*60,12*60));
      if (trial(.15)) journey(person,day,int(14*60,19*60));
    }
    byDay[day].sort((a,b)=>a.minutes-b.minutes || a.id.localeCompare(b.id));
  }

  const cache = new Map();
  function prepare(internal, repair) {
    const key=Number(internal)*2+Number(repair);
    if (cache.has(key)) return cache.get(key);
    const dayRows = byDay.map(list=>list.filter(r=>internal || !r.account.internal));
    const firstActive = new Map();
    const active = dayRows.map((list, d)=>{
      const seen = new Map();
      for (const r of list) {
        if ((!repair && r.lost) || !activeKinds.includes(r.kind)) continue;
        if (!seen.has(r.user)) seen.set(r.user,new Set());
        seen.get(r.user).add(r.kind);
        if (!firstActive.has(r.user)) firstActive.set(r.user,d);
      }
      return seen;
    });
    const registrations=dates.map(()=>[]);
    for (const p of accounts) if (internal || !p.internal) registrations[p.day].push(p.id);
    const result={dayRows,firstActive,active,registrations};
    cache.set(key,result);
    return result;
  }
  const ratio=(a,b)=>b ? a/b : null;
  const indexAt=date=>{const i=dates.indexOf(date); return i===-1?NUM_DAYS-1:i;};
  function rangeAccounts(data,end,days) {
    const accumulated=new Map();
    for(let d=Math.max(0,end-days+1);d<=end;d++) for(const [user, actions] of data.active[d]){
      if(!accumulated.has(user)) accumulated.set(user,new Set());
      for(const kind of actions) accumulated.get(user).add(kind);
    }
    return accumulated;
  }
  function dayPoint(data,d) {
    const map=data.active[d];
    let newActive=0;
    for (const id of map.keys()) if(data.firstActive.get(id)===d) newActive++;
    return {date:dates[d],dau:map.size,newActive,returning:map.size-newActive,registered:data.registrations[d].length};
  }
  function retention(data,start,end,offset) {
    const samples=[];
    let users=0;
    const cohortStart = Math.max(0,start-offset), cohortEnd = end-offset;
    for(let d=cohortStart;d<=cohortEnd;d++) for(const user of data.registrations[d]){
      const returned=data.active[d+offset].has(user);
      if(returned) users++;
      samples.push({user,registered:dates[d],due:dates[d+offset],returned});
    }
    return {users,eligible:samples.length,rate:ratio(users,samples.length),samples,
      cohortStart:samples.length?dates[cohortStart]:null,cohortEnd:samples.length?dates[cohortEnd]:null};
  }
  function formatTime(row) {
    const hour=String(Math.floor(row.minutes/60)).padStart(2,'0');
    const minute=String(row.minutes%60).padStart(2,'0');
    return dates[row.day]+' '+hour+':'+minute;
  }
  function getFunnel(code,rows,repair) {
    const path=paths[code], states=new Map(), qualified=path.keys.map(()=>new Set());
    const all=path.keys.map(()=>[]);
    // Upload through first visit are matched to the same synthetic item. A new
    // upload creates another opportunity without erasing a user's prior success.
    for (const row of rows) {
      const level=path.keys.indexOf(row.kind);
      if (level<0 || (code==='activation' && row.account.day!==row.day)) continue;
      all[level].push(row);
      if (row.lost && !repair) continue;
      let state=states.get(row.user);
      if(!state){state={registered:false,items:new Map()};states.set(row.user,state);}
      if(code==='activation' && level===0){state.registered=true;qualified[0].add(row.user);continue;}
      if(code==='activation' && !state.registered) continue;
      if(!row.asset) continue;
      const offset=code==='activation'?1:0;
      const progress=state.items.get(row.asset) || 0;
      if (level-offset !== progress) continue;
      state.items.set(row.asset,progress+1);
      qualified[level].add(row.user);
    }
    const steps=all.map((events,i)=>{
      const count=qualified[i].size, previous=i ? qualified[i-1].size:null;
      const samples=[], selectedStatuses=new Set();
      let lost=0, duplicates=0;
      const toSample=row=>({id:row.id,user:row.user,time:formatTime(row),status:row.lost ? (repair?'模拟补回':'未入库') : row.repeat?'重复已去重':'已入库'});
      for(const r of events) {
        if(r.lost) lost++;
        if(r.repeat) duplicates++;
        const status=r.lost?'missing':r.repeat?'dupe':'ok';
        if(!selectedStatuses.has(status)){selectedStatuses.add(status);samples.push(toSample(r));}
      }
      const ids=new Set(samples.map(s=>s.id));
      for(const r of events){if(samples.length>=8) break;if(!ids.has(r.id)) samples.push(toSample(r));}
      const missing=repair?0:lost, received=events.length-missing;
      return {key:path.keys[i],label:labels[path.keys[i]],event:path.keys[i],count,previous,
        rate:i ? ratio(count,previous):null,overall:ratio(count,qualified[0].size),expected:events.length,
        received,duplicates,missing,deliveryCount:received+duplicates,recovered:repair?lost:0,samples};
    });
    return {title:path.title,steps};
  }

  function report(options={}) {
    const end=indexAt(options.end),days=options.days===30?30:7,start=Math.max(0,end-days+1);
    const internal=Boolean(options.internal),repair=Boolean(options.repair);
    const data=prepare(internal,repair);
    const trend=Array.from({length:end-start+1},(_,i)=>dayPoint(data,start+i));
    const point=trend.at(-1), dayActive=data.active[end];
    const breakdown=activeKinds.map(kind=>({key:kind,label:labels[kind],count:[...dayActive.values()].filter(k=>k.has(kind)).length}));
    const active={...point,wau:rangeAccounts(data,end,7).size,mau:rangeAccounts(data,end,30).size,breakdown,
      activatedToday:data.registrations[end].filter(id=>dayActive.has(id)).length,
      overlapCount:[...dayActive.values()].filter(k=>k.size>1).length};
    const rows=data.dayRows.slice(start,end+1).flat();
    const funnels=Object.fromEntries(Object.keys(paths).map(code=>[code,getFunnel(code,rows,repair)]));
    return {start:dates[start],end:dates[end],days:end-start+1,active,trend,
      retention:{d1:retention(data,start,end,1),d7:retention(data,start,end,7)},funnels};
  }
  function activeSamples(date,internal=false,repair=false,days=1) {
    const end=indexAt(date), data=prepare(internal,repair);
    const period=[1,7,30].includes(days)?days:1;
    return [...rangeAccounts(data,end,period)].map(([user,kinds])=>({
      user,actions:activeKinds.filter(k=>kinds.has(k)).map(k=>labels[k]),isNew:data.firstActive.get(user)>=end-period+1
    }));
  }
  // Earlier days warm up rolling metrics. Only dates with full WAU/MAU history are selectable.
  window.ForgeOps={dates:dates.slice(30),report,activeSamples};
})();
