(function () {
  'use strict';

  const { lt, ltn, LT } = window.RoUtilityI18n;
  const SCRIPTS = new Set(['Script', 'LocalScript', 'ModuleScript']);
  const RANK = { high: 3, medium: 2, low: 1 };
  const RULES = [
    { level: 'high', label: LT('Requires a module by asset id'), re: /\brequire\s*\(\s*(?:tonumber\s*\(\s*)?["']?\s*\d{5,}/ },
    { level: 'high', label: LT('Runs code from text (loadstring)'), re: /\bloadstring\s*\(/ },
    { level: 'medium', label: LT('Changes script environments (getfenv / setfenv)'), re: /\b[gs]etfenv\b/ },
    { level: 'high', label: LT('Loads assets while the game runs (InsertService)'), re: /InsertService\b[\s\S]{0,40}?LoadAsset|:LoadAsset(?:Version)?\s*\(/ },
    { level: 'high', label: LT('Hidden text (escaped bytes)'), re: /(?:\\\d{1,3}){10,}|(?:\\x[0-9a-fA-F]{2}){10,}/ },
    { level: 'medium', label: LT('Builds text from character codes'), re: /string\.char\s*\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,/ },
    { level: 'medium', label: LT('Sends web requests (HttpService)'), re: /:(?:PostAsync|GetAsync|RequestAsync)\s*\(/ },
    { level: 'low', label: LT('Prompts purchases'), re: /:Prompt(?:Product|GamePass|Purchase|Bundle|Premium|Subscription)Purchase\s*\(/ },
    { level: 'low', label: LT('Teleports players'), re: /:Teleport(?:ToPlaceInstance|ToPrivateServer|Async|PartyAsync)?\s*\(/ },
    { level: 'low', label: LT('Very long line (often hides code)'), test: line => line.length > 1500 },
  ];
  const NAMES = /\b(vaccine|virus|infect(?:ed|ion)?|spread(?:er)?|backdoor|anti[\s_-]?lag\s*script|fire\s*spread)\b/i;

  function sourceOf(inst) {
    const p = inst.props.find(x => x.name === 'Source');
    if (!p) return '';
    if (p.kind === 'string') return p.value || '';
    return p.text || '';
  }

  function check(inst) {
    const source = sourceOf(inst);
    const lines = source.split(/\r?\n/);
    const found = new Map();
    lines.forEach((line, i) => {
      for (const rule of RULES) {
        const hit = rule.test ? rule.test(line) : rule.re.test(line);
        if (!hit) continue;
        const f = found.get(rule.label) || { level: rule.level, label: rule.label, lines: [] };
        if (f.lines.length < 50) f.lines.push(i + 1);
        found.set(rule.label, f);
      }
    });
    if (NAMES.test(inst.name)) found.set('name', { level: 'high', label: lt('Named like a known virus (“{name}”)', { name: inst.name }), lines: [] });
    const findings = [...found.values()].sort((a, b) => RANK[b.level] - RANK[a.level]);
    const level = findings.length ? findings[0].level : null;
    return { inst, source, lines: source ? lines.length : 0, findings, level };
  }

  function scan(model) {
    const scripts = [];
    const walk = (inst) => {
      if (SCRIPTS.has(inst.className)) scripts.push(check(inst));
      for (const c of inst.children) walk(c);
    };
    for (const r of model.roots) walk(r);
    const flagged = scripts.filter(s => s.level === 'high' || s.level === 'medium');
    const byInst = new Map(scripts.map(s => [s.inst, s]));
    const high = scripts.filter(s => s.level === 'high').length;
    return { scripts, flagged, byInst, high, medium: flagged.length - high };
  }

  window.RoUtilityScan = { scan, SCRIPTS };
})();
