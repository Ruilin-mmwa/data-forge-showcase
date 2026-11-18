/* Public portfolio model. Every template, rate and quantity is invented. */
(() => {
  'use strict';

  // All token volumes are in ten-thousand-token units per generated item.
  const rate = { input: 0.74, read: 0.12, write: 0.22, output: 1.30 };
  const writeShare = 0.25;
  const templates = [
    { id: 'trail', name: '步道观察手册', first: [8.2, 2.6], next: [2.4, 0.85], count: 112, load: 100, edits: 1.5, hit: 48, pay: 78, price: 11.8, coupon: 1.3 },
    { id: 'exhibit', name: '展馆导览脚本', first: [13.5, 4.3], next: [4.1, 1.4], count: 67, load: 100, edits: 1, hit: 36, pay: 72, price: 17.2, coupon: 2.1 },
    { id: 'almanac', name: '社区活动年历', first: [5.6, 1.8], next: [1.5, 0.48], count: 154, load: 100, edits: 0.5, hit: 57, pay: 83, price: 8.6, coupon: 5.0 }
  ];
  const money = value => '¥' + value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const signed = value => (value > 0.000001 ? '+' : value < -0.000001 ? '−' : '') + money(Math.abs(value));
  const decimals = value => Number(value.toFixed(2)).toLocaleString('zh-CN');
  const intFmt = value => value.toLocaleString('zh-CN');
  const state = templates.map(t => ({ ...t }));
  let selected = 2;
  let shockPay = 80;
  let shockMix = 'chosen4';
  const mixes = [
    {id:'current', label:'当前用量', all:1, chosen:1},
    {id:'chosen', label:'所选模板 ×2', all:1, chosen:2},
    {id:'chosen4', label:'所选模板 ×4', all:1, chosen:4},
    {id:'all', label:'全部模板 ×2', all:2, chosen:2}
  ];

  function account(t) {
    const hit = t.hit / 100;
    const pay = t.pay / 100;
    function phase(input, output) {
      return [
        input * (1 - hit) * rate.input,
        input * hit * rate.read,
        input * (1 - hit) * writeShare * rate.write,
        output * rate.output
      ];
    }
    const first = phase(t.first[0] * t.load / 100, t.first[1] * t.load / 100);
    const edit = phase(t.next[0], t.next[1]);
    const sum = values => values.reduce((a, b) => a + b, 0);
    const firstFull = sum(first);
    const editFull = sum(edit) * t.edits;
    const full = firstFull + editFull;
    const cost = full * pay;
    const net = t.price - t.coupon;
    return { first, edit, firstCost: firstFull * pay, editCost: editFull * pay, full, cost,
      net, contribution: net - cost, minPrice: cost + t.coupon, payCap: net / full * 100 };
  }

  function totals(rows) {
    return rows.reduce((agg, row) => {
      const x = account(row);
      agg.count += row.count;
      agg.revenue += row.count * x.net;
      agg.cost += row.count * x.cost;
      agg.contribution += row.count * x.contribution;
      return agg;
    }, { count: 0, revenue: 0, cost: 0, contribution: 0 });
  }

  const fields = [
    { key: 'count', label: '月度付费件数', unit: '件', min: 0, max: 9999, step: 1 },
    { key: 'load', label: '首构用量倍率', unit: '%', min: 20, max: 300, step: 1 },
    { key: 'edits', label: '每件追加编辑', unit: '次', min: 0, max: 12, step: 0.1 },
    { key: 'hit', label: '输入缓存命中率', unit: '%', min: 0, max: 100, step: 1 },
    { key: 'pay', label: '采购实付比例', unit: '%', min: 0, max: 100, step: 1 },
    { key: 'price', label: '单件标价', unit: '元', min: 0, max: 199, step: 0.1 },
    { key: 'coupon', label: '单件商家补贴', unit: '元', min: 0, max: 199, step: 0.1 }
  ];
  const costNames = ['未命中输入', '缓存读取', '缓存写入附加费', '输出'];
  const baseTotal = totals(templates);

  function mount(container) {
    container.classList.add('forge-cost');
    container.innerHTML = `
      <section class="fc-box">
        <div class="fc-heading"><div><h2>给模板定价</h2><p>选一个模板，调整用量和采购条件，查看单件保本价及整个组合的月度变化。</p></div><button type="button" class="fc-link" data-jump>查看压力矩阵 ↓</button></div>
        <div class="fc-tabs" role="group" aria-label="选择定价模板">${templates.map((t, i) => `<button type="button" data-tpl="${i}">${t.name}</button>`).join('')}</div>
        <div class="fc-subhead"><h3>模板参数</h3><button type="button" class="fc-link" data-reset>恢复本模板基准</button></div>
        <div class="fc-fields">${fields.map(f => `<label><span>${f.label}</span><span class="fc-input"><input type="number" data-key="${f.key}" min="${f.min}" max="${f.max}" step="${f.step}" inputmode="${f.step === 1 ? 'numeric' : 'decimal'}"><small>${f.unit}</small></span></label>`).join('')}</div>
        <p class="fc-note">每件含一次首构。追加次数取每件平均值。采购实付 80% 表示按标价的八折结算。补贴上限为单件标价。切换模板会保留当前试算。</p>
        <div data-readout></div>
      </section>
      <section class="fc-box" data-portfolio></section>
      <section class="fc-box" data-matrix tabindex="-1"></section>
      <section class="fc-box"><details class="fc-account"><summary>查看单件成本明细与核算假设</summary><div data-ledger></div></details></section>`;

    const get = q => container.querySelector(q);
    function updateInputs() {
      const t = state[selected];
      container.querySelectorAll('[data-tpl]').forEach((b, i) => b.setAttribute('aria-pressed', String(i === selected)));
      fields.forEach(f => {
        const input = get('[data-key="' + f.key + '"]');
        input.value = t[f.key];
        if (f.key === 'coupon') input.max = t.price;
      });
    }
    function stressCase(pay, mix) {
      const rows = state.map((t, i) => ({...t, pay, count: t.count * (i === selected ? mix.chosen : mix.all)}));
      const sum = totals(rows);
      const full = rows.reduce((total, row) => total + account(row).full * row.count, 0);
      return {
        ...sum,
        margin: sum.revenue > 0 ? sum.contribution / sum.revenue * 100 : null,
        ceiling: full > 0 ? sum.revenue / full * 100 : null,
        rows
      };
    }
    function output() {
      const wasOpen = get('.fc-unit')?.open;
      const distributionOpen = get('[data-readout] details')?.open;
      const evidenceOpen = get('.fdist-proof')?.open;
      const t = state[selected], x = account(t), original = account(templates[selected]);
      const change = x.cost - original.cost;
      const share = x.cost ? x.firstCost / x.cost * 100 : null;
      const pct = Math.min(100, x.payCap);
      const loss = x.contribution < -0.000001;
      const threshold = x.payCap >= 100 ? '按采购原价结算也能覆盖模型费用。'
        : `采购实付需控制在标价的 ${decimals(pct)}% 以内才能覆盖模型费用。`;
      get('[data-readout]').innerHTML = `
        <div class="fc-readout">
        <div><small>单件模型成本</small><strong>${money(x.cost)}</strong><span>较基准 ${signed(change)}</span></div>
        <div><small>含补贴的保本标价</small><strong>${money(x.minPrice)}</strong><span>当前标价 ${money(t.price)}</span></div>
        <div><small>单件贡献余额</small><strong class="${loss ? 'fc-loss' : 'fc-ok'}">${signed(x.contribution)}</strong><span>实收 ${money(x.net)} 扣除模型成本</span></div></div>
        <p class="fc-verdict"><b>${t.name}</b>　${share === null ? '当前假设的模型实付成本为零。' : `首构占模型成本 ${decimals(share)}%，追加编辑合计 ${money(x.editCost)}/件。`} ${threshold}</p>
        ${window.renderForgeDistribution?.(t, x.cost, x.net) || ''}`;
      const distribution = get('[data-readout] details');
      if (distribution && distributionOpen !== undefined) distribution.open = distributionOpen;
      if (evidenceOpen && get('.fdist-proof')) get('.fdist-proof').open = true;

      const scenario = totals(state);
      const totalCard = (name, base, value, format = money) =>
        `<tr><th scope="row">${name}</th><td>${format(base)}</td><td>${format(value)}</td><td>${format === money ? signed(value - base) : (value > base ? '+' : '') + intFmt(value - base)}</td></tr>`;
      get('[data-portfolio]').innerHTML = `
        <h3>三模板月度组合</h3><p>以各模板各自的付费件数加权。修改件数会同步改变月度规模和模板占比。</p>
        <div class="fc-tablebox"><table><caption class="fc-sr">固定基准与当前模拟月度组合</caption><thead><tr><th scope="col">经营指标</th><th scope="col">原始基准</th><th scope="col">当前情景</th><th scope="col">变化额</th></tr></thead><tbody>
        ${totalCard('付费件数', baseTotal.count, scenario.count, intFmt)}
        ${totalCard('销售实收', baseTotal.revenue, scenario.revenue)}
        ${totalCard('模型成本', baseTotal.cost, scenario.cost)}
        ${totalCard('贡献余额', baseTotal.contribution, scenario.contribution)}</tbody></table></div>
        <p class="fc-note">贡献余额 = 标价收入 − 商家补贴 − 模型成本。人工、税费、其他服务费均未计入。金额按未舍入值汇总。</p>`;

      const pays = [50, 65, 80, 100], edits = [0, 1, 2, 4];
      const chosenMix = mixes.find(mix => mix.id === shockMix);
      const stressed = stressCase(shockPay, chosenMix);
      const marginText = m => m === null ? '无销售实收' : decimals(m) + '%';
      const boundary = stressed.ceiling === null ? '当前无付费件数，无需估算临界比例。'
        : stressed.ceiling >= 100 ? '即使按采购原价结算，组合也能覆盖模型成本。'
        : `采购实付超过标价的 ${decimals(stressed.ceiling)}% 时，组合将无法覆盖模型成本。`;
      get('[data-matrix]').innerHTML = `
        <h3>组合压力测试 · 采购条件与模板用量</h3>
        <p>如果采购优惠收窄，同时「${t.name}」销量上升，其他模板的收入还能覆盖成本吗？每格显示组合月贡献余额与贡献率。点击查看各模板如何分摊。</p>
        <div class="fc-tablebox"><table class="fc-heat"><caption class="fc-sr">统一采购实付比例与模板用量组合的交叉压力测试</caption><thead><tr><th scope="col">统一采购实付</th>${mixes.map(m => `<th scope="col">${m.label}</th>`).join('')}</tr></thead><tbody>
        ${pays.map(p => `<tr><th scope="row">${p}%</th>${mixes.map(m => {
          const result = stressCase(p, m);
          return `<td><button type="button" data-shock-pay="${p}" data-shock-mix="${m.id}" aria-pressed="${p === shockPay && m.id === shockMix}" aria-label="查看采购实付 ${p}%、${m.label}的月贡献余额 ${signed(result.contribution)}、贡献率 ${marginText(result.margin)}" class="${result.contribution < -0.000001 ? 'fc-neg' : 'fc-pos'}">${signed(result.contribution)}<small>${marginText(result.margin)}</small></button></td>`;
        }).join('')}</tr>`).join('')}</tbody></table></div>
        <p class="fc-verdict"><b>${shockPay}% 实付 · ${chosenMix.label}</b>　${intFmt(stressed.count)} 件，实收 ${money(stressed.revenue)}，模型成本 ${money(stressed.cost)}，贡献余额 ${signed(stressed.contribution)}。${boundary}</p>
        <div class="fc-tablebox"><table><caption class="fc-sr">所选压力情景按模板贡献</caption><thead><tr><th>模板</th><th>件数</th><th>每件贡献</th><th>月贡献</th></tr></thead><tbody>${stressed.rows.map(r => { const rr=account(r);return `<tr><th scope="row">${r.name}</th><td>${intFmt(r.count)}</td><td>${signed(rr.contribution)}</td><td>${signed(r.count * rr.contribution)}</td></tr>`; }).join('')}</tbody></table></div>
        <p class="fc-note">该矩阵假设所有模板按同一采购比例结算。放量只调整件数，保留各模板的标价、补贴和用量参数。贡献率 = 贡献余额 ÷ 销售实收。</p>
        <details class="fc-account fc-unit"><summary>${t.name} · 追加编辑敏感性</summary><p>同时改变采购实付比例和每件追加次数。每格为单件贡献余额，点击即可采用这组假设。</p>
        <div class="fc-tablebox"><table class="fc-heat"><caption class="fc-sr">采购实付与追加编辑次数对单件贡献余额的影响</caption><thead><tr><th scope="col">采购实付</th>${edits.map(e => `<th scope="col">追加 ${e} 次</th>`).join('')}</tr></thead><tbody>
        ${pays.map(p => `<tr><th scope="row">${p}%</th>${edits.map(e => {
          const c = account({ ...t, pay: p, edits: e }).contribution;
          return `<td><button type="button" data-pay="${p}" data-edits="${e}" aria-pressed="${t.pay === p && t.edits === e}" aria-label="采用采购实付 ${p}%、追加 ${e} 次，每件贡献余额 ${signed(c)}" class="${c < -0.000001 ? 'fc-neg' : 'fc-pos'}">${signed(c)}</button></td>`;
        }).join('')}</tr>`).join('')}</tbody></table></div>
        <p class="fc-note">其余参数沿用所选模板当前值。正值能覆盖模型成本，负值表示每多交付一件就多一笔模型费用缺口。</p></details>`;

      get('.fc-unit').open = Boolean(wasOpen);
      get('[data-ledger]').innerHTML = `
        <p>${t.name} 每次首构输入 / 输出各 ${decimals(t.first[0] * t.load / 100)} / ${decimals(t.first[1] * t.load / 100)} 万 token，每次追加各 ${decimals(t.next[0])} / ${decimals(t.next[1])} 万 token。下表追加列包含每件 ${decimals(t.edits)} 次追加。</p>
        <div class="fc-tablebox"><table><thead><tr><th scope="col">单件成本</th><th scope="col">首构</th><th scope="col">追加合计</th><th scope="col">合计</th></tr></thead><tbody>
        ${costNames.map((name, i) => { const first=x.first[i]*t.pay/100, edit=x.edit[i]*t.edits*t.pay/100; return `<tr><th scope="row">${name}</th><td>${money(first)}</td><td>${money(edit)}</td><td>${money(first + edit)}</td></tr>`; }).join('')}
        <tr><th scope="row">实付小计</th><td>${money(x.firstCost)}</td><td>${money(x.editCost)}</td><td>${money(x.cost)}</td></tr></tbody></table></div>
        <p class="fc-note">虚构标价（元 / 万 token）为未命中输入 ${rate.input}、缓存读取 ${rate.read}、缓存写入附加费 ${rate.write}、输出 ${rate.output.toFixed(2)}。缓存命中按输入 token 量计算。未命中部分的 25% 另付写入费。各项统一乘采购实付比例，合计使用未舍入金额。</p>`;
    }
    function commit(input, normalize) {
      const field = fields.find(f => f.key === input.dataset.key);
      if (!field) return;
      const t = state[selected];
      const ceiling = field.key === 'coupon' ? t.price : field.max;
      let n = input.valueAsNumber;
      if (!Number.isFinite(n)) { if (normalize) input.value = t[field.key]; return; }
      const bounded = Math.min(ceiling, Math.max(field.min, Math.round(n / field.step) * field.step));
      if (!normalize && Math.abs(n - bounded) > 1e-8) return;
      const updated = Number(bounded.toFixed(2));
      if (!normalize && field.key === 'price' && updated < t.coupon) return;
      if (normalize) input.value = updated;
      if (updated === t[field.key]) return;
      t[field.key] = updated;
      if (field.key === 'price') {
        const couponInput = get('[data-key="coupon"]');
        couponInput.max = t.price;
        if (t.coupon > t.price) { t.coupon = t.price; couponInput.value = t.price; }
      }
      output();
    }

    // Assign handlers so remounting one container keeps only its newest bindings.
    container.oninput = event => { if (event.target.matches('[data-key]')) commit(event.target, false); };
    container.onchange = event => { if (event.target.matches('[data-key]')) commit(event.target, true); };
    container.onfocusout = event => { if (event.target.matches('[data-key]')) commit(event.target, true); };
    container.onclick = event => {
      const b = event.target.closest('button');
      if (!b) return;
      if (b.hasAttribute('data-jump')) {
        const matrix = get('[data-matrix]');
        matrix.scrollIntoView({block:'start'});
        matrix.focus({preventScroll:true});
        return;
      }
      if (b.hasAttribute('data-tpl')) selected = Number(b.dataset.tpl);
      else if (b.hasAttribute('data-reset')) state[selected] = { ...templates[selected] };
      else if (b.hasAttribute('data-shock-pay')) {
        shockPay = Number(b.dataset.shockPay);
        shockMix = b.dataset.shockMix;
      }
      else if (b.hasAttribute('data-pay')) Object.assign(state[selected], { pay: Number(b.dataset.pay), edits: Number(b.dataset.edits) });
      else return;
      updateInputs();
      output();
      if (b.hasAttribute('data-shock-pay')) get('[data-shock-pay="' + shockPay + '"][data-shock-mix="' + shockMix + '"]').focus({ preventScroll: true });
      if (b.hasAttribute('data-pay')) get('[data-pay="' + b.dataset.pay + '"][data-edits="' + b.dataset.edits + '"]').focus({ preventScroll: true });
    };
    updateInputs();
    output();
  }

  window.mountForgeCost = mount;
})();
