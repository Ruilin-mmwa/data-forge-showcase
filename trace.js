(() => {
  "use strict";

  // A standalone fictional audit sample. Delivery receipts may be retried or delayed.
  const days = ["2031-04-08", "2031-04-09", "2031-04-10"];
  const specs = [
    ["访客甲", "轻量", true, false, 12], ["访客乙", "标准", true, true, 43],
    ["访客甲", "轻量", false, false, 0], ["访客丙", "标准", true, false, 54],
    ["访客丁", "轻量", true, true, 17], ["访客戊", "标准", false, false, 31],
    ["试用员甲", "轻量", true, true, 9], ["试用员乙", "标准", true, false, 35],
    ["访客己", "标准", true, true, 28], ["访客乙", "轻量", false, false, 11]
  ];
  const terms = { opened: "提交", delivered: "交付", changed: "再编辑", usage: "计量" };
  const seed = days.map((day, dayIndex) => {
    const packets = [];
    const late = [];
    specs.slice(0, 8 + dayIndex).forEach(([user, band, ok, edit, units], i) => {
      const task = "S" + (dayIndex + 1) + "-" + String(i + 1).padStart(2, "0");
      const number = units === 0 ? 0 : units + (i % 3 + 1) * dayIndex;
      const info = { task, user, band, internal: user.startsWith("试用员") };
      const receipt = (kind, suffix, value = null) => ({
        ...info, key: task + suffix, kind, value, time: String(i + 8).padStart(2, "0") + ":" + suffix.slice(1)
      });
      packets.push(receipt("opened", "a05"));
      if (ok) packets.push(receipt("delivered", "b18"));
      if (edit) packets.push(receipt("changed", "c24"));
      const meter = receipt("usage", "d36", number);
      if (i === 3 || i === 7) late.push(meter);
      else packets.push(meter);
      if (i === 1) packets.push({ ...meter, time: "09:39" });
    });
    return { day, packets, late };
  });
  const metrics = [
    { key: "usage", name: "已记录用量", group: "计量质量", grain: "计量回执", ask: "当前账本中，有记录可复核的消耗有多少？", rule: "按回执编号去重后，加总计量值。零值照计，缺失单列。", unit: "单位" },
    { key: "coverage", name: "计量覆盖率", group: "计量质量", grain: "任务", ask: "有多少任务已经收到计量回执？", rule: "收到至少一条计量回执的任务数 ÷ 提交任务数。数值为零的回执仍计入分子。", unit: "%" },
    { key: "people", name: "提交人数", group: "使用", grain: "账号 / 自然日", ask: "有多少不同的账号发起了任务？", rule: "按提交记录中的账号去重。同一账号同日多次提交只计一人。", unit: "人" },
    { key: "tasks", name: "提交任务数", group: "使用", grain: "任务", ask: "业务侧实际发起了多少个任务？", rule: "按提交记录中的任务编号去重，每个任务计一次。", unit: "项" },
    { key: "delivery", name: "任务交付率", group: "交付", grain: "任务", ask: "这批提交的任务有多少在当天交付？", rule: "当日提交且当日有交付回执的任务数 ÷ 当日提交任务数。", unit: "%" },
    { key: "edit", name: "交付后再编辑率", group: "交付", grain: "已交付任务", ask: "已交付的任务中，有多少在当天被再次编辑？", rule: "当日交付后有编辑记录的任务数 ÷ 当日已交付任务数。", unit: "%" }
  ];
  const sessions = new WeakMap();
  const money = value => Number.isInteger(value) ? String(value) : value.toFixed(1);
  const ratio = (a, b) => b ? (100 * a / b).toFixed(1).replace(/\.0$/, "") + "%" : "—";
  const median = values => {
    const sorted = values.slice().sort((a,b) => a-b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  };

  function examine(source, includeInternal, restored) {
    const use = row => includeInternal || !row.internal;
    const incoming = source.packets.filter(use);
    const recovered = source.late.filter(use);
    const packets = restored ? incoming.concat(recovered) : incoming;
    const receipts = new Map();
    const rows = new Map();
    for (const record of packets) {
      if (!rows.has(record.task)) rows.set(record.task, { ...record, packets: [], meter: null, delivered: false, edit: false });
      const row = rows.get(record.task);
      const duplicate = receipts.has(record.key);
      row.packets.push({ ...record, duplicate, backfilled: restored && recovered.includes(record) });
      if (duplicate) continue;
      receipts.set(record.key, record);
      if (record.kind === "usage") row.meter = record.value;
      if (record.kind === "delivered") row.delivered = true;
      if (record.kind === "changed") row.edit = true;
    }
    const tasks = [...rows.values()];
    const measured = tasks.filter(row => row.meter !== null);
    const people = new Set(tasks.map(row => row.user)).size;
    const delivered = tasks.filter(row => row.delivered).length;
    const edits = tasks.filter(row => row.delivered && row.edit).length;
    const units = measured.reduce((sum,row) => sum + row.meter, 0);
    const estimates = tasks.filter(row => row.meter === null).map(row => {
      const peers = measured.filter(peer => peer.band === row.band);
      return { task: row.task, band: row.band, values: peers.map(peer => peer.meter), guess: peers.length ? median(peers.map(peer => peer.meter)) : null };
    });
    return { tasks, measured, estimates, units, people, delivered, edits, packets, unique: receipts.size, recovered };
  }

  function getValue(key, batch) {
    const n = batch.tasks.length;
    switch (key) {
      case "usage": return { value: money(batch.units), equation: batch.measured.map(row => row.meter).join(" + ") + " = " + money(batch.units) };
      case "coverage": return { value: ratio(batch.measured.length,n), equation: batch.measured.length + " 项有回执 ÷ " + n + " 项提交" };
      case "people": return { value: String(batch.people), equation: n + " 项提交 → 按账号去重 → " + batch.people + " 人" };
      case "tasks": return { value: String(n), equation: n + " 个唯一提交编号 = " + n + " 项" };
      case "delivery": return { value: ratio(batch.delivered,n), equation: batch.delivered + " 项已交付 ÷ " + n + " 项提交" };
      case "edit": return { value: ratio(batch.edits,batch.delivered), equation: batch.edits + " 项再编辑 ÷ " + batch.delivered + " 项已交付" };
    }
  }

  function contribution(key, row, seen) {
    if (key === "usage") return row.meter === null ? "缺回执" : row.meter + " 单位";
    if (key === "people") {
      const first = !seen.has(row.user);
      seen.add(row.user);
      return first ? "计 1 人" : "同账号已计";
    }
    if (key === "tasks") return "计 1 项";
    if (key === "edit") return row.delivered ? (row.edit ? "1 / 1" : "0 / 1") : "0 / 0";
    if (key === "coverage") return row.meter !== null ? "1 / 1" : "0 / 1";
    return row.delivered ? "1 / 1" : "0 / 1";
  }

  function ledger(metricsKey, batch) {
    const seen = new Set();
    const labels = ["coverage","delivery","edit"].includes(metricsKey) ? "分子 / 分母" : "本项贡献";
    const lines = batch.tasks.map(row => {
      const signals = [row.delivered ? "已交付" : "仅提交"];
      if (row.edit) signals.push("再编辑");
      signals.push(row.meter === null ? "缺计量" : "计量 " + row.meter);
      return '<tr><th scope="row">'+row.task+'</th><td>'+row.user+'</td><td>'+signals.join(" · ")+'</td><td>'+contribution(metricsKey,row,seen)+'</td></tr>';
    }).join("");
    const raw = batch.tasks.flatMap(row => row.packets.map(packet => {
      const kind = terms[packet.kind] + (packet.kind === "usage" ? " " + packet.value : "");
      const note = packet.duplicate ? "重发 · 已去重" : packet.backfilled ? "后补入账" : "已入账";
      return '<tr><th scope="row">'+packet.key+'</th><td>'+packet.time+'</td><td>'+kind+'</td><td>'+note+'</td></tr>';
    })).join("");
    return '<div class="ft-ledger"><h3>逐项核对</h3><div class="ft-scroll"><table><thead><tr><th>任务</th><th>账号</th><th>已收事件</th><th>'+labels+'</th></tr></thead><tbody>'+lines+'</tbody></table></div>'+
      '<details class="ft-raw"><summary>展开原始事件 · '+batch.packets.length+' 次送达 / '+batch.unique+' 个唯一编号</summary><div class="ft-scroll"><table><thead><tr><th>事件编号</th><th>时间</th><th>类型与值</th><th>处理</th></tr></thead><tbody>'+raw+'</tbody></table></div></details></div>';
  }

  function audit(state, before, after) {
    const working = state.repaired ? after : before;
    const zero = working.measured.filter(row => row.meter === 0).map(row => row.task).join("、");
    const prediction = before.estimates.reduce((sum,item) => sum + (item.guess || 0),0);
    const actual = after.units - before.units;
    const missing = before.estimates.length;
    const explanation = before.estimates.map(item => item.task+" 按"+item.band+"档估算。参照用量 "+item.values.join("、")+"，中位数 "+(item.guess === null ? "不可得" : money(item.guess))).join("。");
    const note = state.repaired
      ? "已找回 "+missing+" 条模拟回执，实测新增 "+actual+" 单位，与补录前估算相差 "+money(actual-prediction)+" 单位。"
      : zero+" 回执明确记为 0；另有 "+missing+" 项缺回执。先单列估算，拿到迟到回执后再核账。";
    return '<section class="ft-audit"><div class="ft-audithead"><h3>为什么会出现零用量？</h3><button type="button" data-ft-act="repair">'+(state.repaired ? "还原缺报状态" : "模拟回补回执")+'</button></div>'+
      '<p>'+note+'</p><div class="ft-trio"><div><span>当前已记录用量</span><b>'+working.units+'</b></div><div><span>补录前缺失项估算</span><b>'+money(prediction)+'</b></div><div><span>当前回执覆盖</span><b>'+working.measured.length+' / '+working.tasks.length+'</b></div></div>'+
      '<details><summary>查看分档估算依据</summary><p>'+explanation+'。估算只作对照，已记录用量仅汇总收到的回执。</p></details></section>';
  }

  window.mountForgeTrace = function mountForgeTrace(container) {
    const state = sessions.get(container) || { key: "usage", dayIndex: 0, internal: false, repaired: false, query: "", group: "全部" };
    sessions.set(container,state);
    container.innerHTML = '<div class="ft-shell"><div class="ft-toolbar"><label>样本日期<select data-ft="day" aria-label="样本日期">'+days.map((d,i)=>'<option value="'+i+'">'+d+'</option>').join("")+'</select></label><label class="ft-check"><input type="checkbox" data-ft="internal">计入内部测试账号</label><small>合成抽样账本 · 北京时间自然日</small></div><div class="ft-layout"><aside class="ft-catalog"><h3>指标目录</h3><label><span>查找指标</span><input type="search" placeholder="名称、口径或粒度" data-ft="query"></label><label><span>业务分类</span><select data-ft="group">'+["全部","使用","交付","计量质量"].map(s=>'<option>'+s+'</option>').join("")+'</select></label><div data-ft="menu"></div></aside><div data-ft="body" class="ft-body"></div></div></div>';
    const elem = key => container.querySelector('[data-ft="'+key+'"]');
    elem("day").value=String(state.dayIndex); elem("internal").checked=state.internal;
    elem("query").value=state.query; elem("group").value=state.group;
    const matching = () => metrics.filter(m => (state.group === "全部" || state.group === m.group) && [m.name,m.group,m.ask,m.rule,m.grain].join(" ").includes(state.query.trim()));
    function drawMenu() {
      const valid = matching();
      if (!valid.some(m=>m.key===state.key) && valid.length) state.key=valid[0].key;
      elem("menu").innerHTML = valid.map(m=>'<button type="button" data-ft-key="'+m.key+'" aria-pressed="'+(m.key===state.key)+'">'+m.name+'</button>').join("") || '<p class="ft-muted">没有匹配指标。可更换关键词或分类。</p>';
      return valid.length;
    }
    function render() {
      if (!drawMenu()) { elem("body").innerHTML = '<div class="ft-empty">当前筛选无匹配指标。<button type="button" data-ft-act="clear">清除筛选</button></div>'; return; }
      const m = metrics.find(item=>item.key===state.key);
      const source = seed[state.dayIndex];
      const before = examine(source,state.internal,false);
      const after = examine(source,state.internal,true);
      const working = state.repaired ? after : before;
      const result = getValue(m.key,working);
      const where = state.internal ? "含内部测试账号" : "仅外部账号";
      const excluded = state.internal ? "" : " · 已剔除 "+new Set(seed[state.dayIndex].packets.filter(r=>r.internal).map(r=>r.task)).size+" 个测试任务";
      elem("body").innerHTML = '<section class="ft-definition"><div class="ft-meta">'+m.group+' / '+where+excluded+'</div><div class="ft-heading"><div><h3>'+m.name+'</h3><p>'+m.ask+'</p></div><div class="ft-value">'+result.value+(m.unit==="%" ? "" : '<small>'+m.unit+'</small>')+'</div></div>'+
        '<div class="ft-formula">'+result.equation+'</div><p class="ft-rule">'+m.rule+' 统计粒度为'+m.grain+'。</p></section>'+
        (m.group === "计量质量" ? audit(state,before,after) : "") +ledger(m.key,working);
    }
    elem("query").addEventListener("input",e=>{state.query=e.target.value;render();});
    elem("group").addEventListener("change",e=>{state.group=e.target.value;render();});
    elem("day").addEventListener("change",e=>{state.dayIndex=Number(e.target.value);state.repaired=false;render();});
    elem("internal").addEventListener("change",e=>{state.internal=e.target.checked;render();});
    const shell = container.querySelector(".ft-shell");
    shell.addEventListener("click",e=>{
      const btn=e.target.closest("button");
      if (!btn) return;
      if (btn.dataset.ftKey) { state.key=btn.dataset.ftKey;render();elem("menu").querySelector('[aria-pressed="true"]').focus(); }
      if (btn.dataset.ftAct==="repair") {state.repaired=!state.repaired;render();container.querySelector('[data-ft-act="repair"]').focus();}
      if (btn.dataset.ftAct==="clear") {state.group="全部";state.query="";elem("group").value=state.group;elem("query").value="";render();elem("query").focus();}
    });
    render();
  };
})();
