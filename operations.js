(() => {
  'use strict';
  const panels = new Map();
  const number = value => (value ?? 0).toLocaleString('zh-CN');
  const percent = value => value == null ? '—' : (value * 100).toFixed(1) + '%';
  const share = (a,b) => b ? a / b : null;
  const short = date => date.slice(5).replace('-', '/');
  const selected = (a,b) => a === b ? ' selected' : '';
  const paths = {activation:'注册至作品首访', knowledge:'知识获取', creation:'应用创作'};
  let state;
  let cachedKey = '';
  let cachedReport;
  let originalKey = '';
  let originalReport;
  const f = () => window.ForgeOps;
  function init() {
    state ??= {end:f().dates.at(-1), days:7, internal:false, repair:false,
      path:'activation', step:1, metric:'', chartDay:''};
  }
  function report() {
    const {end,days,internal,repair} = state;
    const key = [end,days,internal,repair].join('/');
    if (cachedKey !== key) {
      cachedReport = f().report({end,days,internal,repair});
      cachedKey = key;
    }
    return cachedReport;
  }
  function controls() {
    return '<div class="ops-params"><label>截至日<select data-op-filter="end">' +
      f().dates.slice().reverse().map(d => '<option value="'+d+'"'+selected(state.end,d)+'>'+d+'</option>').join('') +
      '</select></label><label>分析区间<select data-op-filter="days">'+[7,30].map(n => '<option value="'+n+'"'+selected(state.days,n)+'>近 '+n+' 天</option>').join('')+
      '</select></label><label>账号范围<select data-op-filter="internal"><option value="out"'+selected(state.internal,false)+'>外部用户</option><option value="all"'+selected(state.internal,true)+'>含内部测试账号</option></select></label>' +
      (state.repair?'<span class="ops-fixed">已使用模拟补录数据</span>':'')+'</div>';
  }
  const kpis = {dau:['日活跃用户 DAU',1],wau:['周活跃用户 WAU',7],mau:['月活跃用户 MAU',30],newActive:['当日首次活跃',1]};
  function cards(r) {
    const decks = {dau:'当日有创作行为',wau:'滚动 7 天去重',mau:'滚动 30 天去重',newActive:'首次发生创作行为'};
    return '<div class="ops-kpis">'+Object.entries(kpis).map(([key,[name]]) =>
      '<button type="button" class="ops-kpi" data-op-metric="'+key+'" aria-expanded="'+(state.metric===key)+'" title="查看'+name+'的统计口径与账号样本"><span class="ops-kl">'+name+'</span><strong class="ops-major">'+number(r.active[key])+'<small>人</small></strong><span class="ops-deck">'+decks[key]+'</span><span class="ops-info" aria-hidden="true">ⓘ</span></button>').join('')+'</div>';
  }
  function metricDetail(r) {
    if (!state.metric) return '';
    const [name,windowDays]=kpis[state.metric];
    let users=f().activeSamples(r.end,state.internal,state.repair,windowDays);
    const isNew = state.metric==='newActive';
    if (isNew) users=users.filter(u=>u.isNew);
    const rows=users.slice(0,8).map(u=>'<tr><td>'+u.user+'</td><td>'+u.actions.join('、')+'</td></tr>').join('');
    return '<section class="ops-proof"><h3>'+name+'怎么算</h3><p>'+(isNew?'先取当日有创作行为的账号，再保留账本中首次创作日等于截至日的账号。':'以北京时间 '+r.end+' 为止，取最近 '+windowDays+' 个自然日发生上传文档、首次构建成功、追加编辑或全新重建的账号，合并后按账号去重。')+'</p><p class="ops-expression">符合条件的唯一账号共 '+number(users.length)+' 人</p><details><summary>查看账号与触发行为样本</summary>'+table(['账号','已发生的创作行为'],rows)+'<p class="ops-note">列出前 '+Math.min(8,users.length)+' 个合成账号。</p></details></section>';
  }
  function table(head,body) {
    return '<div class="ops-scroll"><table class="ops-table"><thead><tr>'+head.map(t=>'<th scope="col">'+t+'</th>').join('')+'</tr></thead><tbody>'+body+'</tbody></table></div>';
  }
  function trend(r) {
    const sel=r.trend.find(d=>d.date===state.chartDay)||r.trend.at(-1);
    const top=Math.max(2,Math.ceil(Math.max(...r.trend.map(d=>d.dau))/2)*2);
    const rows=r.trend.map(d=>'<tr><td>'+d.date+'</td><td>'+d.dau+'</td><td>'+d.newActive+'</td><td>'+d.returning+'</td><td>'+d.registered+'</td></tr>').join('');
    return '<section class="ops-card"><header><h2>日活跃用户趋势</h2><div class="ops-chart-key"><span><i class="ops-swatch"></i>首次活跃</span><span><i class="ops-swatch old"></i>回访活跃</span></div></header><p class="ops-note">按创作账号去重 · 人</p><div class="ops-plotgrid"><div class="ops-y" aria-hidden="true"><span>'+top+'</span><span>'+top/2+'</span><span>0</span></div><div class="ops-bars" role="group" aria-label="选择日期查看日活明细">'+r.trend.map(d=>{
      const title=d.date+' 活跃 '+d.dau+' 人，首次 '+d.newActive+'，回访 '+d.returning;
      return '<button class="ops-bar" type="button" data-op-day="'+d.date+'" title="'+title+'" aria-label="'+title+'" aria-pressed="'+(d===sel)+'"><i class="ret" style="height:'+100*d.returning/top+'%"></i><i class="new" style="height:'+100*d.newActive/top+'%"></i></button>';}).join('')+'</div></div><div class="ops-axis"><span>'+short(r.trend[0].date)+'</span><span>'+short(r.trend[Math.floor(r.trend.length/2)].date)+'</span><span>'+short(r.trend.at(-1).date)+'</span></div><p class="ops-chart-read" aria-live="polite">'+short(sel.date)+'　日活 '+number(sel.dau)+' 人 = 首次活跃 '+number(sel.newActive)+' + 回访活跃 '+number(sel.returning)+'</p><details><summary>查看逐日人数</summary>'+table(['日期','日活','首次活跃','回访活跃','注册'],rows)+'</details></section>';
  }
  function pathCards(r) {
    return '<section class="ops-card"><header><h2>关键转化</h2><span class="ops-note">'+short(r.start)+' – '+short(r.end)+'</span></header>'+Object.keys(paths).map(key=>{
      const {steps}=r.funnels[key], first=steps[0], last=steps.at(-1);
      return '<a class="ops-path" data-op-jump="'+key+'" href="#funnel"><span class="ops-path-title">'+paths[key]+' <b class="ops-pct">'+percent(last.overall)+'</b></span><small>'+first.label+' '+number(first.count)+' 人 → '+last.label+' '+number(last.count)+' 人</small><span class="ops-track"><i style="width:'+100*(last.overall||0)+'%"></i></span></a>';
    }).join('')+'</section>';
  }
  function retain(r){
    const make=(obj,days)=>{
      const preview=(obj.samples||[]).slice(0,6).map(u=>'<tr><td>'+u.user+'</td><td>'+u.registered+'</td><td>'+u.due+'</td><td>'+(u.returned?'有创作':'未创作')+'</td></tr>').join('');
      return '<div class="ops-ret-item"><span>第 '+days+' 天创作留存率</span><b>'+percent(obj.rate)+'</b><span>'+number(obj.users)+' 人回访 / '+number(obj.eligible)+' 人可观察</span><details><summary>口径与样本</summary><p class="ops-note">本期观察注册于 '+(obj.cohortStart||'—')+' 至 '+(obj.cohortEnd||'—')+' 的账号。分母为该批注册账号数，分子在注册后第 '+days+' 个自然日有创作行为。</p>'+table(['账号','注册日','观察日','行为'],preview)+'</details></div>';
    };
    return '<section class="ops-card"><header><h2>新用户激活与留存</h2></header><p class="ops-hilite">'+short(r.end)+' 注册 '+number(r.active.registered)+' 人，其中 '+number(r.active.activatedToday)+' 人当天创作，<strong>当日创作激活率 '+percent(share(r.active.activatedToday,r.active.registered))+'</strong>。</p><div class="ops-retention" style="margin-top:13px">'+make(r.retention.d1,1)+make(r.retention.d7,7)+'</div></section>';
  }
  function activeMix(r) {
    return '<section class="ops-card"><header><h2>哪些行为计入日活</h2><span class="ops-note">'+short(r.end)+'</span></header><div class="ops-breakdown">'+r.active.breakdown.map(item=>'<div class="ops-behavior"><em>'+item.label+'</em><span class="ops-track"><i style="width:'+100*(share(item.count,r.active.dau)||0)+'%"></i></span><b>'+number(item.count)+' 人</b></div>').join('')+'</div><p class="ops-note ops-break-info">'+number(r.active.overlapCount)+' 人发生多类行为，四类账号合并去重后为 '+number(r.active.dau)+' 位日活用户。</p></section>';
  }
  function dashboard(r){
    return controls()+'<div class="ops-section-title"><h2>创作活跃用户</h2><p>上传文档、首次构建成功、追加编辑、全新重建的账号合并去重。</p></div>'+cards(r)+metricDetail(r)+'<div class="ops-grid">'+trend(r)+pathCards(r)+'</div><div class="ops-grid">'+retain(r)+activeMix(r)+'</div>';
  }
  function funnel(r) {
    const fdata = r.funnels[state.path], steps = fdata.steps;
    const choice = Math.min(state.step,steps.length-1), step=steps[choice], first=steps[0], last=steps.at(-1);
    const def = state.path==='activation'?'从区间内全部新注册账号开始，按人统计注册当天上传、构建，以及自己新建的应用获得首次访问。':'同一账号在区间内对同一份材料依次完成各步。多次完成的账号在每一步只计一人。';
    const repairCaption = state.repair ? '恢复原始埋点' : '模拟补回缺报';
    let changes = '';
    if (state.repair) {
      const currentKey = [state.end,state.days,state.internal].join('/');
      if (originalKey !== currentKey) {
        originalReport = f().report({end:state.end,days:state.days,internal:state.internal,repair:false});
        originalKey = currentKey;
      }
      const before = originalReport.funnels[state.path].steps[choice];
      changes = '<p class="ops-muted-panel">本步补回 '+number(step.recovered)+' 条模拟事件。符合顺序的用户由 '+number(before.count)+' 人变为 '+number(step.count)+' 人'+(choice?'，上步转化率由 '+percent(before.rate)+' 变为 '+percent(step.rate):'')+'。</p>';
    }

    return controls()+'<div class="ops-tabs" role="group" aria-label="转化路径">'+Object.entries(paths).map(([k,n])=>'<button type="button" data-op-path="'+k+'" aria-pressed="'+(state.path===k)+'">'+n+'</button>').join('')+'</div>'+
      '<section class="ops-card"><div class="ops-funnel-head"><div><h2>'+paths[state.path]+'漏斗</h2><p class="ops-note">'+def+'</p></div><div><strong class="ops-pct">'+percent(last.overall)+'</strong><span class="ops-note">　全程转化率</span></div></div><div class="ops-funnel-groups"><div class="ops-step ops-cols"><span>转化步骤 · 查看埋点</span><span>人数</span><span>上步转化</span><span>累计转化</span></div>'+steps.map((s,i)=>'<button type="button" class="ops-step" data-op-step="'+i+'" aria-pressed="'+(choice===i)+'"><b>'+s.label+'</b><span class="ops-scorebar">'+number(s.count)+'<i style="width:'+(50*(s.overall||0))+'%"></i></span><span>'+(i===0?'—':percent(s.rate))+'</span><span>'+percent(s.overall)+'</span></button>').join('')+'</div></section>'+
      '<section class="ops-card ops-event"><div class="ops-detail-heading"><h2>'+step.label+' · 转化与埋点</h2><button class="ops-repair" type="button" data-op-repair>'+repairCaption+'</button></div><p class="ops-hilite">'+(choice===0?'漏斗起点共 '+number(step.count)+' 个去重账号。':number(step.count)+' 人到达本步 ÷ '+number(step.previous)+' 人到达上一步 = '+percent(step.rate))+'　全程起点 '+number(first.count)+' 人。</p>'+changes+'<p class="ops-note">对应埋点：'+step.event+'。下表按事件条数核对，漏斗按符合步骤顺序的账号去重。</p><div class="ops-counts">'+[['业务应报',step.expected],['已收唯一事件',step.received],['重复上报',step.duplicates],['仍缺报',step.missing]].map(([label,n])=>'<div><span>'+label+' · 条</span><strong>'+number(n)+'</strong></div>').join('')+'</div><details open><summary>查看本步埋点样本</summary>'+table(['模拟事件编号','账号','北京时间','采集状态'],(step.samples||[]).map(row=>'<tr><td>'+row.id+'</td><td>'+row.user+'</td><td>'+row.time+'</td><td>'+row.status+'</td></tr>').join(''))+'</details><p class="ops-note" style="margin-top:9px">'+(state.repair?'本页与看板均已按模拟补录后的同一批事件重算。':'补回模拟底账中的缺报事件，可对照同一批账号的转化率变化。')+'</p></section>';
  }
  function refresh(){
    const r=report();
    for (const [key,node] of panels) node.innerHTML=key==='dashboard'?dashboard(r):funnel(r);
  }
  function mount(container,kind) {
    init();
    container.classList.add('ops-ui');
    panels.set(kind,container);
    container.addEventListener('change',ev=>{
      const el=ev.target.closest('[data-op-filter]'); if(!el) return;
      const key=el.dataset.opFilter;
      state[key]= key==='days'?Number(el.value):key==='internal'?el.value==='all':el.value;
      if(key==='end') state.chartDay='';
      refresh();
      container.querySelector('[data-op-filter="'+key+'"]').focus({preventScroll:true});
    });
    container.addEventListener('click',ev=>{
      const item=ev.target.closest('[data-op-jump],[data-op-metric],[data-op-day],[data-op-path],[data-op-step],[data-op-repair]');
      if (!item) return;
      const data=item.dataset;
      if(Object.hasOwn(data,'opJump')){state.path=data.opJump;state.step=1;refresh(); location.hash='funnel'; return;}
      let sel;
      if(Object.hasOwn(data,'opMetric')){state.metric=state.metric===data.opMetric?'':data.opMetric;sel='[data-op-metric="'+data.opMetric+'"]';}
      if(Object.hasOwn(data,'opDay')){state.chartDay=data.opDay;sel='[data-op-day="'+data.opDay+'"]';}
      if(Object.hasOwn(data,'opPath')){state.path=data.opPath;state.step=1;sel='[data-op-path="'+data.opPath+'"]';}
      if(Object.hasOwn(data,'opStep')){state.step=Number(data.opStep);sel='[data-op-step="'+data.opStep+'"]';}
      if(Object.hasOwn(data,'opRepair')){state.repair=!state.repair;sel='[data-op-repair]';}
      refresh();
      if(sel) container.querySelector(sel)?.focus({preventScroll:true});
    });
    refresh();
  }
  window.mountOpsDashboard = container => mount(container,'dashboard');
  window.mountOpsFunnel = container => mount(container,'funnel');
})();
