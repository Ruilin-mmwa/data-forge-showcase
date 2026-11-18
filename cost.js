(() => {
  'use strict';

  // All quantities and prices are invented. Each billed input token belongs to one category.
  const items = [
    { name:'普通输入', rate:100 },
    { name:'缓存读取', rate:20 },
    { name:'缓存写入', rate:120 },
    { name:'输出', rate:200 }
  ];
  const paidPercent = 75;
  const catalog = [
    { code:'A', count:12, scale:2, price:22, coupon:1 },
    { code:'B', count:10, scale:3, price:29, coupon:2 },
    { code:'C', count:16, scale:1, price:7, coupon:2.5 }
  ];
  const phases = ['首次构建','追加编辑'];
  const yuan = cents => '¥' + (cents / 100).toLocaleString('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2});
  const num = (value,digits=1) => value.toLocaleString('zh-CN',{maximumFractionDigits:digits});
  const signed = cents => (cents < -0.000001 ? '−' : cents > 0.000001 ? '+' : '') + yuan(Math.abs(cents));
  const sum = values => values.reduce((acc,n)=>acc+n,0);
  const pct = value => (100*value).toFixed(1)+'%';
  const charge = quantities => sum(quantities.map((q,i)=>q * items[i].rate / 10000));
  const emptyQuantities = () => items.map(()=>0);

  function syntheticApps(t, index) {
    return Array.from({length:t.count},(_,i)=>{
      const id = t.code + '-' + String(i+1).padStart(3,'0');
      const firstCount = 1 + (i % 3 === 0 ? 1 : 0);
      const editCount = (i + 1 + index) % 4;
      const calls = Array.from({length:firstCount+editCount},(_,j)=>{
        const build = j < firstCount;
        const scale = t.scale * (build ? 2 : 1);
        const quantities = [
          2000 * (2 + (i*3+j+index)%7) * scale,
          2000 * ((i+j+1)%5) * scale,
          2000 * ((i+2*j)%4) * scale,
          2000 * (1 + (i+j)%3) * scale
        ];
        if (i === 0 && index === 0 && j === 0) quantities.splice(0,4,20000,10000,0,5000);
        const list = Math.round(charge(quantities));
        return { id:id+'/'+String(j+1).padStart(2,'0'),phase:build?0:1,quantities,
          date:'10/'+String(1 + (i*2+index)%24 + j).padStart(2,'0'),list,cents:Math.round(list*paidPercent/100) };
      });
      return { id, calls, first:sum(calls.filter(c=>!c.phase).map(c=>c.cents)), edit:sum(calls.filter(c=>c.phase).map(c=>c.cents)) };
    });
  }

  const books = catalog.map((t,i)=>{
    const apps=syntheticApps(t,i);
    const byPhase=[emptyQuantities(),emptyQuantities()];
    const calls=apps.flatMap(a=>a.calls);
    calls.forEach(c=>c.quantities.forEach((q,k)=>byPhase[c.phase][k]+=q));
    const first=sum(apps.map(a=>a.first)),edit=sum(apps.map(a=>a.edit));
    return {...t,apps,calls,byPhase,first,edit,total:first+edit};
  });
  const totalApps=sum(books.map(t=>t.apps.length));
  const totalFirst=sum(books.map(t=>t.first));
  const totalEdit=sum(books.map(t=>t.edit));
  const cellHeaders = headers => '<tr>'+headers.map(s=>'<th scope="col">'+s+'</th>').join('')+'</tr>';
  const rowsTable = (headers,rows,foot='') =>
    '<div class="fc-tablebox"><table><thead>'+cellHeaders(headers)+'</thead><tbody>'+rows+'</tbody>'+foot+'</table></div>';
  const templateName = t => t.code+' 模板';
  const specs = [
    ['price','单个 App 售价','元',0,999,.01],
    ['coupon','单个 App 补贴','元',0,999,.01],
    ['count','预计付费 App 数','个',0,9999,1],
    ['pay','采购实付比例','%',0,100,1],
    ['build','首构用量系数','%',0,300,1],
    ['edit','追加编辑用量系数','%',0,300,1],
    ['cache','普通输入转为缓存读取','%',0,100,1]
  ];
  function defaults(t) {
    return {price:t.price,coupon:t.coupon,count:t.apps.length,pay:paidPercent,build:100,edit:100,cache:0};
  }
  function projected(t,p) {
    const phaseCost = t.byPhase.map((units,stage)=>{
      const q=units.map(v=>v*(stage===0?p.build:p.edit)/100/t.apps.length);
      const shift=q[0]*p.cache/100;
      q[0]-=shift; q[1]+=shift;
      return charge(q)*p.pay/100;
    });
    const cost=sum(phaseCost),net=Math.round((p.price-p.coupon)*100);
    return {first:phaseCost[0],edit:phaseCost[1],cost,net,profit:net-cost,floor:Math.ceil(cost-1e-9)+Math.round(p.coupon*100)};
  }

  window.mountForgeCost = function mount(container) {
    container.classList.add('forge-cost');
    const state={mode:'book',template:0,app:0,call:0,scenario:2,
      params:books.map(defaults),matrixPay:75,matrixMix:0};
    container.innerHTML='<div class="fc-mode" role="group" aria-label="成本核算视图"><button type="button" data-mode="book">账期成本</button><button type="button" data-mode="plan">定价与压力测试</button></div><div class="fc-area"></div>';
    const area=container.querySelector('.fc-area');
    const get=selector=>area.querySelector(selector);

    function summary() {
      const example=books[0].calls[0];
      const charges=example.quantities.flatMap((q,i)=>q ? [items[i].name+' '+yuan(q*items[i].rate/10000)] : []);
      const row=(name,n,first,edit)=>'<tr><th scope="row">'+name+'</th><td>'+n+'</td><td>'+yuan(first)+'</td><td>'+yuan(edit)+'</td><td><b>'+yuan(first+edit)+'</b></td><td>'+yuan((first+edit)/n)+'</td></tr>';
      const rows=books.map((t,i)=>row('<button type="button" class="fc-link" data-book="'+i+'" aria-pressed="'+(i===state.template)+'">'+templateName(t)+'</button>',t.apps.length,t.first,t.edit)).join('');
      return '<section class="fc-box fc-period-ledger"><div class="fc-heading"><h2>按模板核算模型费用</h2><span class="fc-period">2026 年 10 月 · 合成账单</span></div><p>本期 '+totalApps+' 个已完成 App。按调用归集首次构建和追加编辑的模型费用，金额单位为人民币。</p>'+
        rowsTable(['模板','已完成 App','首次构建','追加编辑','费用合计','单个 App 均摊'],rows,'<tfoot>'+row('全体',totalApps,totalFirst,totalEdit)+'</tfoot>')+
        '<p class="fc-note">单个 App 均摊 = 模板费用合计 ÷ 该模板已完成 App 数。</p>'+
        '<p class="fc-example">例如 A-001 的第一笔调用，'+charges.join('、')+'。合计 '+yuan(example.list)+'，按 '+paidPercent+'% 结算为 <b>'+yuan(example.cents)+'</b>。 <button type="button" class="fc-link" data-example>查看这笔账 ↓</button></p></section>';
    }

    function detail() {
      const t=books[state.template], app=t.apps[state.app], call=app.calls[state.call];
      const idOptions=t.apps.map((a,i)=>'<option value="'+i+'"'+(i===state.app?' selected':'')+'>'+a.id+'　'+yuan(a.first+a.edit)+'</option>').join('');
      const lines=app.calls.map((c,j)=>'<tr><th scope="row"><button type="button" class="fc-link" data-call="'+j+'" aria-pressed="'+(j===state.call)+'">'+c.id+'</button></th><td>'+c.date+'</td><td>'+phases[c.phase]+'</td><td>'+yuan(c.list)+'</td><td>'+paidPercent+'%</td><td>'+yuan(c.cents)+'</td></tr>').join('');
      const qtyRows=items.map((entry,j)=>'<tr><th scope="row">'+entry.name+'</th><td>'+num(call.quantities[j],0)+'</td><td>'+yuan(entry.rate)+'</td><td>'+yuan(call.quantities[j]*entry.rate/10000)+'</td></tr>').join('');
      const equation=items.map((item,i)=>yuan(call.quantities[i]*item.rate/10000)).join(' + ');
      return '<section class="fc-box"><div class="fc-heading"><h2>'+templateName(t)+' · 应用费用明细</h2><label class="fc-picker">查看 App <select data-app>'+idOptions+'</select></label></div>'+
        '<p>本模板 '+t.apps.length+' 个 App，累计 '+yuan(t.total)+'，平均每个 '+yuan(t.total/t.apps.length)+'。</p>'+
        '<div class="fc-invoice"><strong>'+app.id+'</strong><span>首次构建 '+yuan(app.first)+'　＋　追加编辑 '+yuan(app.edit)+'　＝　<b>'+yuan(app.first+app.edit)+'</b></span></div>'+
        rowsTable(['调用编号','日期','用途','标价小计','实付比例','结算费用'],lines)+
        '<div class="fc-bill-detail"><h3>复算调用 '+call.id+'</h3><p>各项用量分别按每万 token 的单价计费，再乘采购实付比例。</p>'+
        rowsTable(['计费项','用量（token）','单价（元／万 token）','标价金额'],qtyRows)+
        '<p class="fc-calculation">（'+equation+'）× '+paidPercent+'% = <strong>'+yuan(call.cents)+'</strong></p>'+
        '<p class="fc-note">普通输入、缓存读取和缓存写入按互斥计费项计量。输出单独计价，每次调用结算至分后汇总。</p></div>'+
        (window.renderForgeDistribution?.(t.apps.map(a=>a.first+a.edit))||'')+'</section>';
    }

    function bookView(){area.innerHTML=summary()+detail();}

    function pricingView() {
      area.innerHTML='<section class="fc-box"><div class="fc-heading"><h2>分模板定价</h2><button class="fc-link" type="button" data-reset>恢复本模板参数</button></div><p>以 10 月账单的单个 App 平均用量为基准，测算售价、补贴和采购条件变化后的结果。</p>'+
        '<div class="fc-tabs" role="group" aria-label="选择定价模板">'+books.map((t,i)=>'<button type="button" data-plan="'+i+'" aria-pressed="'+(i===state.scenario)+'">'+templateName(t)+'</button>').join('')+'</div>'+
        '<div class="fc-fields">'+specs.map(([key,label,unit,min,max,step])=>'<label><span>'+label+'</span><span class="fc-input"><input type="number" data-key="'+key+'" value="'+state.params[state.scenario][key]+'" min="'+min+'" max="'+max+'" step="'+step+'"><small>'+unit+'</small></span></label>').join('')+'</div>'+
        '<p class="fc-note">用量系数 100% 沿用账期平均用量。普通输入转缓存比例 20% 表示将原本按普通输入计价的五分之一改按缓存读取计价。</p><div data-unit></div></section>'+
        '<section class="fc-box"><h2>模板组合压力测试</h2><p>对三种模板统一改变采购比例，比较当前销量、单个模板放量和所有模板同比例放量的结果。</p><div data-matrix></div></section>';
      drawProjection();
    }

    function drawProjection() {
      const idx=state.scenario,t=books[idx],p=state.params[idx],x=projected(t,p);
      get('[data-key="coupon"]').max=p.price;
      get('[data-unit]').innerHTML='<div class="fc-readout"><div><small>单个 App 预计模型成本</small><strong>'+yuan(x.cost)+'</strong><span>首构 '+yuan(x.first)+' · 编辑 '+yuan(x.edit)+'</span></div><div><small>含补贴的最低保本价</small><strong>'+yuan(x.floor)+'</strong><span>成本加补贴，向上取整至分</span></div><div><small>单个 App 贡献余额</small><strong class="'+(x.profit<0?'fc-loss':'fc-ok')+'">'+signed(x.profit)+'</strong><span>实收 '+yuan(x.net)+' 减去模型成本</span></div></div>';
      const mixes=['当前销量',t.code+' 模板 ×2',t.code+' 模板 ×4','全体 ×2'];
      function stress(pay,mix) {
        const rows=books.map((book,i)=>{
          const pp=state.params[i], r=projected(book,{...pp,pay});
          const n=pp.count*(mix===3?2:i===idx&&mix===1?2:i===idx&&mix===2?4:1);
          return {name:templateName(book),n,net:r.net*n,cost:r.cost*n,profit:r.profit*n};
        });
        const net=sum(rows.map(r=>r.net)),cost=sum(rows.map(r=>r.cost)),profit=net-cost;
        return {rows,net,cost,profit,margin:net>0?pct(profit/net):'—'};
      }
      const matrix=[50,65,75,85,100].map(pay=>'<tr><th scope="row">'+pay+'%</th>'+mixes.map((mix,i)=>{
        const r=stress(pay,i);
        return '<td><button type="button" data-pay="'+pay+'" data-mix="'+i+'" aria-label="实付 '+pay+'%，'+mix+'" aria-pressed="'+(pay===state.matrixPay&&i===state.matrixMix)+'" class="'+(r.profit<0?'fc-neg':'fc-pos')+'">'+signed(r.profit)+'<small>'+r.margin+'</small></button></td>';
      }).join('')+'</tr>').join('');
      const r=stress(state.matrixPay,state.matrixMix);
      const monthly=books.map((b,i)=>{
        const pp=state.params[i],a=projected(b,pp);
        return '<tr><th scope="row">'+templateName(b)+'</th><td>'+pp.count+'</td><td>'+yuan(a.net*pp.count)+'</td><td>'+yuan(a.cost*pp.count)+'</td><td>'+signed(a.profit*pp.count)+'</td></tr>';
      }).join('');
      get('[data-matrix]').innerHTML='<h3 class="fc-summary-heading">按各模板当前参数</h3>'+rowsTable(['模板','付费 App','销售实收','模型成本','贡献余额'],monthly)+
        '<h3 class="fc-summary-heading">统一采购比例后的月贡献余额与贡献率</h3><div class="fc-tablebox"><table class="fc-heat"><thead>'+cellHeaders(['采购实付',...mixes])+'</thead><tbody>'+matrix+'</tbody></table></div>'+
        '<p class="fc-calculation"><b>'+state.matrixPay+'% 实付 · '+mixes[state.matrixMix]+'</b>　销售实收 '+yuan(r.net)+' − 模型成本 '+yuan(r.cost)+' = 贡献余额 '+signed(r.profit)+'。</p>'+
        '<p class="fc-note">贡献率 = 贡献余额 ÷ 销售实收。此处仅扣除模型费用。压力测试按平均用量推演，按未舍入金额加总。</p>';
    }

    function renderMode() {
      container.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(state.mode===b.dataset.mode)));
      if(state.mode==='book') bookView(); else pricingView();
    }
    function commit(input,normalize) {
      const field=specs.find(f=>f[0]===input.dataset.key);
      if(!field) return;
      const [key,,,min,max,step]=field, p=state.params[state.scenario];
      const ceiling=key==='coupon'?p.price:max;
      const value=input.valueAsNumber;
      if(!Number.isFinite(value)) { if(normalize) input.value=p[key]; return; }
      const rounded=Number((Math.round(value/step)*step).toFixed(2));
      const next=Math.max(min,Math.min(rounded,ceiling));
      if(!normalize && (next!==rounded || Math.abs(next-value)>1e-7 || key==='price'&&next<p.coupon)) return;
      if(normalize) input.value=next;
      if(next===p[key]) return;
      p[key]=next;
      if(key==='price'&&p.coupon>p.price) {p.coupon=p.price;get('[data-key="coupon"]').value=p.coupon;}
      drawProjection();
    }
    container.addEventListener('input',e=>{if(e.target.matches('[data-key]')) commit(e.target,false);});
    container.addEventListener('change',e=>{
      if(e.target.matches('[data-app]')) {state.app=Number(e.target.value);state.call=0;bookView();get('[data-app]').focus({preventScroll:true});}
      else if(e.target.matches('[data-key]')) commit(e.target,true);
    });
    container.addEventListener('focusout',e=>{if(e.target.matches('[data-key]')) commit(e.target,true);});
    container.addEventListener('click',e=>{
      const b=e.target.closest('button');
      if(!b||!container.contains(b)) return;
      if(b.dataset.mode){state.mode=b.dataset.mode;renderMode();return;}
      if(b.hasAttribute('data-example')){
        state.template=0;state.app=0;state.call=0;bookView();
        const heading=get('.fc-bill-detail h3');heading.tabIndex=-1;heading.focus({preventScroll:true});heading.scrollIntoView({block:'start'});return;
      }
      if(b.dataset.book!==undefined){
        state.template=Number(b.dataset.book);state.app=0;state.call=0;bookView();
        const select=get('[data-app]');select.focus({preventScroll:true});get('.fc-invoice').closest('section').scrollIntoView({block:'start'});return;
      }
      if(b.dataset.call!==undefined){state.call=Number(b.dataset.call);bookView();const selectedCall=get('[data-call="'+state.call+'"]');selectedCall.focus({preventScroll:true});get('.fc-bill-detail').scrollIntoView({block:'nearest'});return;}
      if(b.dataset.plan!==undefined){state.scenario=Number(b.dataset.plan);pricingView();get('[data-plan="'+state.scenario+'"]').focus({preventScroll:true});return;}
      if(b.hasAttribute('data-reset')){state.params[state.scenario]=defaults(books[state.scenario]);pricingView();get('[data-reset]').focus({preventScroll:true});return;}
      if(b.dataset.pay!==undefined){state.matrixPay=Number(b.dataset.pay);state.matrixMix=Number(b.dataset.mix);drawProjection();get('[data-pay="'+state.matrixPay+'"][data-mix="'+state.matrixMix+'"]').focus({preventScroll:true});}
    });
    renderMode();
  };
})();
