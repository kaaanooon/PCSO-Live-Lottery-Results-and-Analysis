from __future__ import annotations

import json
from pathlib import Path
from typing import Any


def _report_payload(analysis: dict[str, Any]) -> dict[str, Any]:
    return {
        "metadata": analysis["metadata"],
        "rules": [
            {**game["rule"], "rule_text": game["summary"].get("rule", "")}
            for game in analysis["games"]
        ],
        "raw_draws": analysis["raw_draws"],
    }


HTML_TEMPLATE = r"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="theme-color" content="#123c56">
  <title>Philippine Lottery Analysis</title>
  <style>
    :root {
      --navy:#123c56; --navy2:#0c2d43; --blue:#177eaa; --teal:#159a9c;
      --gold:#f2b84b; --coral:#e76f51; --purple:#7357c7; --ink:#243b53;
      --muted:#627d98; --line:#d9e2ec; --wash:#f2f7fa; --paper:#fff;
      --hot:#d94f4f; --cold:#3984c6; --middle:#90a4ae; --ok:#237a57;
    }
    * { box-sizing:border-box; }
    html { scroll-behavior:smooth; }
    body { margin:0; background:var(--wash); color:var(--ink); font:14px/1.5 "Segoe UI",Arial,sans-serif; }
    header { padding:26px max(18px,env(safe-area-inset-left)) 22px; color:#fff; background:linear-gradient(125deg,var(--navy2),#087f8c); }
    header h1 { margin:0 0 5px; font-size:clamp(24px,4vw,34px); }
    header p { margin:5px 0; max-width:1050px; color:#dcf3f4; }
    .warning { margin-top:13px; padding:10px 12px; border-left:4px solid var(--gold); background:rgba(255,255,255,.12); border-radius:4px; }
    main { max-width:1480px; margin:auto; padding:18px; }
    .panel,.card,.story,.candidate-card { background:var(--paper); border:1px solid var(--line); border-radius:12px; box-shadow:0 2px 9px rgba(16,42,67,.055); }
    .controls { position:sticky; top:0; z-index:5; padding:14px; margin-bottom:14px; }
    .control-grid { display:grid; grid-template-columns:minmax(180px,1.2fr) minmax(230px,1.6fr) minmax(180px,1fr) auto; gap:12px; align-items:end; }
    label,.control-label { display:block; margin-bottom:5px; color:var(--navy); font-size:12px; font-weight:700; text-transform:uppercase; letter-spacing:.35px; }
    select,input,button { min-height:44px; border-radius:9px; border:1px solid #bcccdc; font:inherit; }
    select,input { width:100%; padding:9px 11px; background:#fff; color:var(--ink); }
    button { padding:9px 16px; cursor:pointer; font-weight:700; }
    .primary { color:#fff; border-color:var(--blue); background:var(--blue); }
    .secondary { color:var(--navy); background:#fff; }
    .mode-switch { display:flex; padding:3px; background:#edf2f7; border-radius:10px; }
    .mode-switch label { flex:1; margin:0; text-align:center; text-transform:none; letter-spacing:0; }
    .mode-switch input { position:absolute; opacity:0; width:1px; height:1px; }
    .mode-switch span { display:block; min-height:38px; padding:9px 7px; border-radius:8px; cursor:pointer; }
    .mode-switch input:checked+span { color:#fff; background:var(--navy); }
    .date-fields { display:grid; grid-template-columns:1fr 1fr; gap:7px; }
    .game-chips { display:flex; gap:6px; overflow-x:auto; margin-top:11px; padding-bottom:2px; }
    .game-chips button { min-height:36px; padding:6px 11px; white-space:nowrap; border-radius:18px; color:var(--navy); background:#fff; }
    .game-chips button.active { color:#fff; background:var(--teal); border-color:var(--teal); }
    .scope { margin:10px 0 0; color:var(--muted); font-size:13px; }
    h2 { margin:0 0 8px; color:var(--navy); font-size:clamp(20px,3vw,26px); }
    h3 { margin:0 0 10px; color:var(--navy); font-size:17px; }
    h4 { margin:0 0 6px; color:var(--navy); }
    .subtle { color:var(--muted); }
    .all-picks { padding:16px; margin-bottom:14px; }
    .pick-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:9px; margin-top:12px; }
    .mini-pick { padding:11px; border:1px solid var(--line); border-radius:10px; background:#f8fbfd; }
    .mini-pick strong { display:block; color:var(--navy); margin-bottom:6px; }
    .balls { display:flex; flex-wrap:wrap; gap:6px; align-items:center; }
    .ball { display:inline-flex; justify-content:center; align-items:center; min-width:34px; height:34px; padding:0 7px; border-radius:18px; color:#fff; background:var(--blue); font-weight:800; box-shadow:inset 0 -2px 0 rgba(0,0,0,.13); }
    .ordered .ball { border-radius:8px; background:var(--purple); }
    .pick-meta { margin-top:7px; color:var(--muted); font-size:11px; }
    .game-heading { display:flex; justify-content:space-between; align-items:end; gap:12px; margin:18px 1px 10px; }
    .cards { display:grid; grid-template-columns:repeat(6,minmax(120px,1fr)); gap:9px; margin-bottom:13px; }
    .card { padding:12px; }
    .card .label { color:var(--muted); font-size:11px; text-transform:uppercase; letter-spacing:.4px; }
    .card .value { margin-top:3px; color:var(--navy); font-size:20px; font-weight:800; }
    .story { padding:16px; margin-bottom:14px; border-left:5px solid var(--teal); }
    .story ul { margin:8px 0 0; padding-left:20px; }
    .story li { margin:6px 0; }
    .badge-row { display:flex; flex-wrap:wrap; gap:6px; margin-top:10px; }
    .badge { padding:4px 8px; border-radius:13px; font-size:12px; font-weight:700; }
    .badge.hot { color:#8b1f1f; background:#fde4e4; }
    .badge.cold { color:#155a91; background:#e2f0fb; }
    .badge.middle { color:#52616b; background:#eceff1; }
    .candidate-card { padding:16px; margin-bottom:14px; background:linear-gradient(120deg,#fff,#f5fbfb); border:2px solid #9bd3d3; }
    .candidate-top { display:flex; align-items:center; justify-content:space-between; gap:12px; }
    .candidate-card .balls { margin:12px 0; }
    .candidate-card .ball { min-width:43px; height:43px; border-radius:23px; font-size:16px; }
    .candidate-card.ordered .ball { border-radius:10px; }
    .candidate-facts { display:flex; flex-wrap:wrap; gap:8px 16px; color:var(--muted); font-size:12px; }
    .equal-odds { color:#982f2f; font-weight:700; }
    .grid-2 { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:13px; margin-bottom:13px; }
    .panel { padding:15px; overflow:hidden; }
    .chart { width:100%; min-height:250px; }
    svg { display:block; width:100%; height:auto; overflow:visible; }
    .legend { display:flex; flex-wrap:wrap; gap:10px; margin:2px 0 7px; color:var(--muted); font-size:11px; }
    .legend i { display:inline-block; width:9px; height:9px; border-radius:50%; margin-right:4px; }
    .table-wrap { width:100%; overflow:auto; border:1px solid var(--line); border-radius:8px; }
    table { width:100%; border-collapse:collapse; font-size:12px; background:#fff; }
    th,td { padding:7px 9px; border-bottom:1px solid #edf2f7; white-space:nowrap; text-align:left; }
    th { color:var(--navy); background:#e8f1f7; }
    tbody tr:nth-child(even) { background:#f8fbfd; }
    details { margin-bottom:12px; background:#fff; border:1px solid var(--line); border-radius:10px; }
    summary { min-height:46px; padding:13px 15px; cursor:pointer; color:var(--navy); font-weight:800; }
    details .details-body { padding:0 14px 14px; }
    .heat td { text-align:center; min-width:42px; }
    .empty { padding:35px 20px; text-align:center; color:var(--muted); }
    .sources { margin:18px 0; padding:14px 16px; color:var(--muted); }
    .sources a { color:var(--blue); }
    footer { padding:20px; color:var(--muted); text-align:center; }
    @media(max-width:1050px) { .control-grid { grid-template-columns:1fr 1fr; } .cards { grid-template-columns:repeat(3,1fr); } .pick-grid { grid-template-columns:repeat(2,1fr); } }
    @media(max-width:720px) {
      main { padding:10px; }
      header { padding:20px 15px; }
      .controls { position:relative; padding:12px; }
      .control-grid { grid-template-columns:1fr; }
      .game-chips { display:none; }
      .cards { grid-template-columns:repeat(2,minmax(0,1fr)); }
      .pick-grid,.grid-2 { grid-template-columns:1fr; }
      .game-heading,.candidate-top { align-items:flex-start; flex-direction:column; }
      .chart { min-height:210px; }
      .hide-mobile { display:none; }
      th,td { padding:7px; }
    }
    @media(max-width:380px) { .cards { grid-template-columns:1fr; } .date-fields { grid-template-columns:1fr; } }
    @media print { .controls button,.game-chips,.secondary { display:none; } .controls { position:relative; } body { background:#fff; } .panel,.card,.story,.candidate-card { box-shadow:none; break-inside:avoid; } }
  </style>
</head>
<body>
  <header>
    <h1>Philippine Lottery Analysis</h1>
    <p>Plain-language statistics and data-shaped number combinations—without machine learning.</p>
    <div class="warning">Every valid combination has the same mathematical chance in a fair draw. “Hot,” “cold,” and “best historical-profile fit” describe only the selected sample; they are not predictions.</div>
  </header>
  <main>
    <section class="panel controls" aria-label="Analysis controls">
      <div class="control-grid">
        <div><label for="game-select">Game</label><select id="game-select"></select></div>
        <div>
          <span class="control-label">Choose sample</span>
          <div class="mode-switch">
            <label><input type="radio" name="mode" value="latest" checked><span>Latest draws</span></label>
            <label><input type="radio" name="mode" value="date"><span>Date range</span></label>
          </div>
        </div>
        <div id="latest-controls"><label for="latest-count">Number of draws</label><select id="latest-count"><option>1</option><option>2</option><option>3</option><option>4</option><option selected>5</option></select></div>
        <div id="date-controls" hidden><label>Date range</label><div class="date-fields"><input id="date-from" type="date"><input id="date-to" type="date"></div></div>
        <button class="primary" id="analyze-button">Analyze</button>
      </div>
      <div class="game-chips" id="game-chips"></div>
      <div class="scope" id="scope-line"></div>
    </section>

    <section class="panel all-picks">
      <h2>Generated combination for every game</h2>
      <p class="subtle">One best historical-profile fit for each game using the selected sample settings. These are data-shaped suggestions, not probability forecasts.</p>
      <div class="pick-grid" id="all-picks"></div>
    </section>

    <div id="report"></div>

    <section class="panel sources">
      <h3>Method and sources</h3>
      <p>The page recalculates locally from the embedded LottoMatik archive. Nothing is uploaded. Latest-draw mode is limited to 1–5 draws for this fast prototype; date mode can use any inclusive period in the archive.</p>
      <div id="source-links"></div>
    </section>
  </main>
  <footer>For entertainment and descriptive analysis only. Play responsibly.</footer>

<script>
const DATA = __REPORT_PAYLOAD__;
const RULES = DATA.rules;
const META = DATA.metadata;
const BASE_SEED = Number(META.candidate_seed || 20260806);
const RAW = DATA.raw_draws.map(row => ({logical:row[0], gameCode:row[1], date:row[2], time:row[3], numbers:row[4].map(Number), jackpot:row[5], winners:Number(row[6]||0)}));
const COLORS = ["#177eaa","#159a9c","#f2b84b","#7357c7","#e76f51","#2a9d8f"];
const peso = new Intl.NumberFormat("en-PH",{style:"currency",currency:"PHP",maximumFractionDigits:2});
const integer = new Intl.NumberFormat("en-PH");
let currentAnalysis = null;
let currentCandidateIndex = 0;

const esc = value => String(value ?? "").replace(/[&<>\"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const round = (value,digits=2) => Number(Number(value).toFixed(digits));
const percent = value => `${round(value,1)}%`;
const ruleFor = code => RULES.find(rule=>rule.code===code);
const domain = rule => Array.from({length:rule.maximum-rule.minimum+1},(_,i)=>rule.minimum+i);
const numberText = (number,rule) => String(number).padStart(rule.display_width,"0");
const comboText = (numbers,rule) => {
  const values = rule.ordered ? [...numbers] : [...numbers].sort((a,b)=>a-b);
  const separator = rule.code==="2DL" || !rule.ordered ? "-" : "";
  return values.map(number=>numberText(number,rule)).join(separator);
};
const choose = (n,k) => { if(k<0||k>n)return 0; k=Math.min(k,n-k); let r=1; for(let i=1;i<=k;i++)r=r*(n-k+i)/i; return r; };
const theoreticalOutcomes = rule => rule.ordered ? Math.pow(rule.maximum-rule.minimum+1,rule.pick_count) : choose(rule.maximum-rule.minimum+1,rule.pick_count);
const sum = values => values.reduce((a,b)=>a+b,0);
const average = values => values.length ? sum(values)/values.length : 0;
const median = values => { if(!values.length)return 0; const a=[...values].sort((x,y)=>x-y),m=Math.floor(a.length/2); return a.length%2?a[m]:(a[m-1]+a[m])/2; };
const percentileValue = (values,fraction) => { if(!values.length)return 0; const a=[...values].sort((x,y)=>x-y),p=(a.length-1)*fraction,l=Math.floor(p),u=Math.ceil(p); return l===u?a[l]:a[l]*(u-p)+a[u]*(p-l); };
const countMap = values => { const m=new Map(); values.forEach(value=>m.set(value,(m.get(value)||0)+1)); return m; };
const keyOf = values => values.join("|");
const arraysFromKey = key => key.split("|").map(Number);
const factorial = n => { let r=1; for(let i=2;i<=n;i++)r*=i; return r; };
const permutationCount = numbers => { let r=factorial(numbers.length); for(const count of countMap(numbers).values())r/=factorial(count); return r; };

function theoreticalParity(rule,evenCount){
  const values=domain(rule), evens=values.filter(v=>v%2===0).length, odds=values.length-evens, k=rule.pick_count;
  if(rule.ordered){ const p=evens/values.length; return choose(k,evenCount)*Math.pow(p,evenCount)*Math.pow(1-p,k-evenCount); }
  if(evenCount>evens||k-evenCount>odds)return 0;
  return choose(evens,evenCount)*choose(odds,k-evenCount)/choose(values.length,k);
}

function multisetOverlap(left,right){
  const a=countMap(left),b=countMap(right); let total=0;
  new Set([...a.keys(),...b.keys()]).forEach(value=>total+=Math.min(a.get(value)||0,b.get(value)||0));
  return total;
}

function selectedDraws(code){
  const mode=document.querySelector('input[name="mode"]:checked').value;
  const all=RAW.filter(draw=>draw.logical===code);
  if(mode==="latest"){
    const requested=Number(document.getElementById("latest-count").value);
    const count=Number.isInteger(requested)&&requested>=1&&requested<=5?requested:5;
    return all.slice(-count);
  }
  const from=document.getElementById("date-from").value||META.available_start_date;
  const to=document.getElementById("date-to").value||META.available_end_date;
  if(from>to)return[];
  return all.filter(draw=>draw.date>=from&&draw.date<=to);
}

function analyze(code,draws){
  const rule=ruleFor(code); if(!draws.length)return null;
  const values=domain(rule), n=draws.length, k=rule.pick_count, totalSlots=n*k, midpoint=Math.floor((rule.minimum+rule.maximum)/2);
  const occurrences=countMap(draws.flatMap(draw=>draw.numbers));
  const hitIndices=new Map(values.map(value=>[value,[]]));
  draws.forEach((draw,index)=>new Set(draw.numbers).forEach(value=>hitIndices.get(value).push(index)));
  const expected=totalSlots/values.length;
  const frequency=values.map(value=>{
    const indices=hitIndices.get(value), count=occurrences.get(value)||0, gaps=[];
    for(let i=1;i<indices.length;i++)gaps.push(indices[i]-indices[i-1]-1);
    const variance=rule.ordered ? totalSlots*(1/values.length)*(1-1/values.length) : n*(k/values.length)*(1-k/values.length);
    return {value,label:numberText(value,rule),count,share:count/totalSlots*100,hitCount:indices.length,hitRate:indices.length/n*100,expected,z:variance?(count-expected)/Math.sqrt(variance):0,seen:indices.length>0,since:indices.length?n-indices.at(-1)-1:null,meanGap:gaps.length?average(gaps):null,maxGap:gaps.length?Math.max(...gaps):null,lastSeen:indices.length?draws[indices.at(-1)].date:null};
  });
  const ranked=[...frequency].sort((a,b)=>b.count-a.count||a.value-b.value); ranked.forEach((row,index)=>row.rank=index+1);
  const maxFrequency=ranked[0].count,minFrequency=ranked.at(-1).count;
  frequency.forEach(row=>row.temperature=maxFrequency===minFrequency?"Tied":row.count===maxFrequency?"Sample hot":row.count===minFrequency?"Sample cold":"Middle");

  const positionFrequency=rule.ordered ? Array.from({length:k},(_,position)=>{
    const counts=countMap(draws.map(draw=>draw.numbers[position]));
    return values.map(value=>({position:position+1,value,label:numberText(value,rule),count:counts.get(value)||0,rate:(counts.get(value)||0)/n*100}));
  }) : [];

  const parityCounts=new Map(), lowHighCounts=new Map(), features=[], scatter=[];
  let previous=null;
  draws.forEach((draw,index)=>{
    const featureValues=rule.ordered?[...draw.numbers]:[...draw.numbers].sort((a,b)=>a-b);
    const even=featureValues.filter(v=>v%2===0).length,low=featureValues.filter(v=>v<=midpoint).length;
    parityCounts.set(even,(parityCounts.get(even)||0)+1);
    lowHighCounts.set(`${low}|${k-low}`,(lowHighCounts.get(`${low}|${k-low}`)||0)+1);
    const consecutive=featureValues.slice(1).filter((v,i)=>Math.abs(v-featureValues[i])===1).length;
    const shared=previous?multisetOverlap(featureValues,previous):null;
    const exact=previous&&rule.ordered?featureValues.filter((v,i)=>v===previous[i]).length:null;
    features.push({index:index+1,date:draw.date,time:draw.time,gameCode:draw.gameCode,combination:comboText(featureValues,rule),sum:sum(featureValues),even,odd:k-even,low,high:k-low,consecutive,shared,exact,jackpot:Number(String(draw.jackpot).replace(/[,₱]/g,""))||0,winners:draw.winners});
    draw.numbers.forEach((value,position)=>scatter.push({index:index+1,date:draw.date,time:draw.time,position:position+1,value}));
    previous=featureValues;
  });
  const parity=Array.from({length:k+1},(_,even)=>({pattern:`${even}E-${k-even}O`,even,odd:k-even,count:parityCounts.get(even)||0,observed:(parityCounts.get(even)||0)/n*100,theoretical:theoreticalParity(rule,even)*100}));
  const lowHigh=[...lowHighCounts].map(([key,count])=>{const [low,high]=arraysFromKey(key);return {pattern:`${low}L-${high}H`,low,high,count,observed:count/n*100};}).sort((a,b)=>b.count-a.count||a.low-b.low);

  const pairOccurrences=new Map(),pairSupport=new Map(),tripleOccurrences=new Map(),tripleSupport=new Map();
  draws.forEach(draw=>{
    const nums=rule.ordered?[...draw.numbers]:[...draw.numbers].sort((a,b)=>a-b),pairs=[],triples=[];
    if(rule.ordered){ for(let i=0;i<k-1;i++)pairs.push(nums.slice(i,i+2)); for(let i=0;i<k-2;i++)triples.push(nums.slice(i,i+3)); }
    else { for(let i=0;i<k;i++)for(let j=i+1;j<k;j++){pairs.push([nums[i],nums[j]]);for(let l=j+1;l<k;l++)triples.push([nums[i],nums[j],nums[l]]);} }
    pairs.forEach(pattern=>pairOccurrences.set(keyOf(pattern),(pairOccurrences.get(keyOf(pattern))||0)+1));
    new Set(pairs.map(keyOf)).forEach(key=>pairSupport.set(key,(pairSupport.get(key)||0)+1));
    triples.forEach(pattern=>tripleOccurrences.set(keyOf(pattern),(tripleOccurrences.get(keyOf(pattern))||0)+1));
    new Set(triples.map(keyOf)).forEach(key=>tripleSupport.set(key,(tripleSupport.get(key)||0)+1));
  });
  const patternRows=(occurrencesMap,supportMap,isTriple)=>[...occurrencesMap].map(([key,count])=>({key,label:arraysFromKey(key).map(v=>numberText(v,rule)).join(rule.ordered?">":"-"),count,support:supportMap.get(key)||0,supportPct:(supportMap.get(key)||0)/n*100})).sort((a,b)=>b.count-a.count||b.support-a.support||a.key.localeCompare(b.key));
  const pairs=patternRows(pairOccurrences,pairSupport,false),triples=patternRows(tripleOccurrences,tripleSupport,true);

  const requestedRolling=Number(META.rolling_window)||3,rollingWindow=Math.min(Math.max(1,Math.floor(requestedRolling)),n),rolling=[],topValues=ranked.slice(0,Math.min(5,ranked.length)).map(row=>row.value);
  for(let end=rollingWindow-1;end<n;end++){
    const window=draws.slice(end-rollingWindow+1,end+1),counts=countMap(window.flatMap(draw=>draw.numbers));
    topValues.forEach(value=>rolling.push({endIndex:end+1,date:draws[end].date,value,label:numberText(value,rule),count:counts.get(value)||0,share:(counts.get(value)||0)/(rollingWindow*k)*100}));
  }
  const sumCounts=countMap(features.map(row=>row.sum));
  const sumDistribution=[...sumCounts].map(([drawSum,count])=>({drawSum:Number(drawSum),count,observed:count/n*100})).sort((a,b)=>a.drawSum-b.drawSum);
  const consecutiveCounts=countMap(features.map(row=>row.consecutive));
  const consecutiveDistribution=[...consecutiveCounts].map(([count,drawCount])=>({count:Number(count),drawCount,observed:drawCount/n*100})).sort((a,b)=>a.count-b.count);
  const positiveJackpots=features.map(row=>row.jackpot).filter(value=>value>0),winnerValues=features.map(row=>row.winners);
  const jackpot={available:positiveJackpots.length,missing:n-positiveJackpots.length,average:average(positiveJackpots),median:median(positiveJackpots),minimum:positiveJackpots.length?Math.min(...positiveJackpots):null,maximum:positiveJackpots.length?Math.max(...positiveJackpots):null};
  const winners={total:sum(winnerValues),average:average(winnerValues),positiveDraws:winnerValues.filter(v=>v>0).length,maximum:Math.max(...winnerValues),zeroDraws:winnerValues.filter(v=>v===0).length};

  const candidatePoolResult=buildCandidatePool(draws,rule,12);
  const top=ranked.filter(row=>row.count===maxFrequency).map(row=>row.label),cold=ranked.filter(row=>row.count===minFrequency).map(row=>row.label);
  const parityPeak=Math.max(...parity.map(row=>row.count)),modalParities=parity.filter(row=>row.count===parityPeak),modalParity=modalParities[0];
  const comparisons=features.slice(1),repeatedComparisons=comparisons.filter(row=>row.shared>0).length,withConsecutive=features.filter(row=>row.consecutive>0).length;
  const pairNarrative=pairs[0]&&pairs[0].count>1?`The leading ${rule.ordered?"ordered transition":"pair"} was ${pairs[0].label}, appearing ${pairs[0].count} times.`:"No pair or ordered transition repeated in this sample.";
  const tripleNarrative=k<3?"Triple analysis does not apply to 2D Lotto.":triples[0]&&triples[0].count>1?`The leading ${rule.ordered?"adjacent ordered triple":"unordered triple"} was ${triples[0].label}, appearing ${triples[0].count} times.`:"No triple repeated in this sample.";
  const frequencyNarrative=maxFrequency===minFrequency
    ? `Every value in the game domain was tied at ${maxFrequency} appearance${maxFrequency===1?"":"s"} in this sample.`
    : `${top.slice(0,5).join(", ")}${top.length>5?" and others":""} appeared most often (${maxFrequency} time${maxFrequency===1?"":"s"}). The least-seen values appeared ${minFrequency} time${minFrequency===1?"":"s"}: ${cold.slice(0,6).join(", ")}${cold.length>6?" and others":""}.`;
  const parityNarrative=modalParities.length===1
    ? `The most common even/odd shape was ${modalParity.even} even and ${modalParity.odd} odd, seen in ${modalParity.count} of ${n} draws.`
    : `The leading even/odd shapes were tied: ${modalParities.map(row=>row.pattern).join(", ")}, each seen in ${parityPeak} of ${n} draws.`;
  const comparisonNarrative=comparisons.length
    ? `${withConsecutive} of ${n} draws contained an adjacent consecutive pair. ${repeatedComparisons} of ${comparisons.length} comparable draws shared at least one value with the previous draw.`
    : `${withConsecutive} of ${n} draws contained an adjacent consecutive pair. At least two draws are needed to compare values with a previous draw.`;
  const narratives=[
    `This analysis uses ${n} observed draw${n===1?"":"s"} from ${draws[0].date} through ${draws.at(-1).date}.`,
    frequencyNarrative,
    parityNarrative,
    `Draw sums averaged ${round(average(features.map(row=>row.sum)),1)}, ranging from ${Math.min(...features.map(row=>row.sum))} to ${Math.max(...features.map(row=>row.sum))}.`,
    comparisonNarrative,
    `${pairNarrative} ${tripleNarrative}`,
    `The source reported ${integer.format(winners.total)} winners. Positive prize/jackpot amounts were available for ${jackpot.available} of ${n} draws; zero placeholders are treated as unavailable.`,
    `The rolling view uses trailing ${rollingWindow}-draw windows. Gaps are selected-game draw records, not calendar days.`
  ];
  if(n<30)narratives.push("This is a very small sample. Hot/cold labels, gaps, pairs, triples, and profile scores can change sharply after one new draw.");
  narratives.push("The generated combination is a best historical-profile fit, not a prediction. It has the same theoretical chance as every other valid combination.");

  return {rule,draws,n,totalSlots,frequency,ranked,positionFrequency,parity,modalParities,lowHigh,features,scatter,pairs,triples,rolling,rollingWindow,sumDistribution,consecutiveDistribution,jackpot,winners,candidates:candidatePoolResult,narratives,maxFrequency,minFrequency,withConsecutive,repeatedComparisons,comparisons:comparisons.length,midpoint};
}

function hashSeed(text){ let h=2166136261>>>0; for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619);} return h>>>0; }
function mulberry32(seed){ return function(){let t=seed+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;}; }
function weightedChoice(values,weights,rng){ const total=sum(weights),target=rng()*total; let running=0; for(let i=0;i<values.length;i++){running+=weights[i];if(target<=running)return values[i];} return values.at(-1); }
function weightedWithoutReplacement(values,weights,count,rng){ const remaining=[...values],w=[...weights],picked=[]; for(let i=0;i<count;i++){const value=weightedChoice(remaining,w,rng),index=remaining.indexOf(value);picked.push(value);remaining.splice(index,1);w.splice(index,1);} return picked; }

function buildCandidateContext(draws,rule){
  const values=domain(rule),n=draws.length,k=rule.pick_count,overall=countMap(draws.flatMap(draw=>draw.numbers));
  const positions=Array.from({length:k},(_,p)=>countMap(draws.map(draw=>draw.numbers[p]))),midpoint=Math.floor((rule.minimum+rule.maximum)/2);
  const parity=countMap(draws.map(draw=>draw.numbers.filter(v=>v%2===0).length)),low=countMap(draws.map(draw=>draw.numbers.filter(v=>v<=midpoint).length)),unique=countMap(draws.map(draw=>new Set(draw.numbers).size));
  const blend=Math.min(.35,n/(n+20)),domainSize=values.length,fairMean=k*(rule.minimum+rule.maximum)/2;
  let fairVariance=k*(domainSize*domainSize-1)/12;if(!rule.ordered&&domainSize>1)fairVariance*=((domainSize-k)/(domainSize-1));
  const sampleMean=average(draws.map(draw=>sum(draw.numbers)));
  return {values,n,k,overall,positions,midpoint,parity,low,unique,blend,sumMean:(1-blend)*fairMean+blend*sampleMean,sumStd:Math.sqrt(fairVariance)};
}

function candidateScore(numbers,rule,context){
  const d=context.values.length,n=context.n,k=context.k;
  const relative=rule.ordered?numbers.map((value,p)=>((context.positions[p].get(value)||0)+1)/(n+d)/(1/d)):numbers.map(value=>((context.overall.get(value)||0)+1)/(n*k+d)/(1/d));
  const frequencyFit=average(relative.map(rate=>Math.min(2,rate)/2)),even=numbers.filter(v=>v%2===0).length,low=numbers.filter(v=>v<=context.midpoint).length;
  const parityPeak=Math.max(...context.parity.values()),lowPeak=Math.max(...context.low.values());
  const parityFit=(context.parity.get(even)||0)/parityPeak,lowFit=(context.low.get(low)||0)/lowPeak,z=(sum(numbers)-context.sumMean)/context.sumStd,sumFit=Math.exp(-.5*z*z);
  const uniqueFit=rule.ordered?(context.unique.get(new Set(numbers).size)||0)/Math.max(...context.unique.values()):1;
  return round((.35*frequencyFit+.2*parityFit+.15*lowFit+.2*sumFit+.1*uniqueFit)*100,2);
}

function generateCandidate(rule,context,rng){
  const d=context.values.length,n=context.n,k=context.k,blend=context.blend;
  if(rule.ordered)return Array.from({length:k},(_,p)=>{const weights=context.values.map(value=>(1-blend)*(1/d)+blend*((context.positions[p].get(value)||0)+1)/(n+d));return weightedChoice(context.values,weights,rng);});
  const weights=context.values.map(value=>(1-blend)*(1/d)+blend*((context.overall.get(value)||0)+1)/(n*k+d));
  return weightedWithoutReplacement(context.values,weights,k,rng).sort((a,b)=>a-b);
}

function buildCandidatePool(draws,rule,limit=12,offset=0){
  if(!draws.length)return[];const context=buildCandidateContext(draws,rule),signature=draws.map(draw=>`${draw.gameCode}:${draw.date}:${draw.time}:${draw.numbers.join(",")}`).join("|"),rng=mulberry32(hashSeed(`${BASE_SEED}:${rule.code}:${offset}:${signature}`));
  const history=countMap(draws.map(draw=>keyOf(rule.ordered?draw.numbers:[...draw.numbers].sort((a,b)=>a-b)))),pool=new Map();
  for(let i=0;i<4000;i++){const numbers=generateCandidate(rule,context,rng),key=keyOf(numbers),score=candidateScore(numbers,rule,context);if(!pool.has(key)||pool.get(key).score<score)pool.set(key,{numbers,score,key});}
  return [...pool.values()].sort((a,b)=>b.score-a.score||a.key.localeCompare(b.key)).slice(0,limit).map((row,index)=>{const even=row.numbers.filter(v=>v%2===0).length,canonical=[...row.numbers].sort((a,b)=>a-b);return {...row,rank:index+1,combination:comboText(row.numbers,rule),even,odd:rule.pick_count-even,low:row.numbers.filter(v=>v<=context.midpoint).length,high:row.numbers.filter(v=>v>context.midpoint).length,sum:sum(row.numbers),seen:history.get(keyOf(rule.ordered?row.numbers:canonical))||0,rambolito:rule.rambolito_name?comboText(canonical,rule):"",permutations:rule.rambolito_name?permutationCount(row.numbers):null,odds:theoreticalOutcomes(rule)};});
}

function ballsHtml(numbers,rule){ return `<div class="balls ${rule.ordered?"ordered":""}">${numbers.map((number,index)=>`<span class="ball" title="${rule.ordered?`Position ${index+1}`:"Selected number"}">${esc(numberText(number,rule))}</span>`).join("")}</div>`; }

function dataTable(rows,columns){
  if(!rows.length)return'<p class="subtle">No applicable records in this sample.</p>';
  return `<div class="table-wrap"><table><thead><tr>${columns.map(column=>`<th class="${column.mobile===false?"hide-mobile":""}">${esc(column.label)}</th>`).join("")}</tr></thead><tbody>${rows.map(row=>`<tr>${columns.map(column=>`<td class="${column.mobile===false?"hide-mobile":""}">${esc(column.format?column.format(row[column.key],row):row[column.key])}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}

function barChart(rows,labelKey,valueKey,colorFn){
  if(!rows.length)return"";const compact=window.matchMedia("(max-width:720px)").matches,W=compact?420:760,H=285,L=42,R=12,T=18,B=42,max=Math.max(...rows.map(row=>Number(row[valueKey])),1),step=(W-L-R)/rows.length;
  const bars=rows.map((row,index)=>{const value=Number(row[valueKey]),height=value/max*(H-T-B),x=L+index*step+1,width=Math.max(1.5,step-2),y=H-B-height,show=rows.length<=(compact?10:16)||index%Math.ceil(rows.length/(compact?8:12))===0||index===rows.length-1;return `<g><rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${colorFn?colorFn(row,index):"#177eaa"}"><title>${row[labelKey]}: ${value}</title></rect>${show?`<text x="${x+width/2}" y="${H-B+14}" text-anchor="middle" font-size="${compact?11:9}" fill="#627d98">${esc(row[labelKey])}</text>`:""}</g>`;}).join("");
  return `<svg viewBox="0 0 ${W} ${H}" role="img"><line x1="${L}" y1="${H-B}" x2="${W-R}" y2="${H-B}" stroke="#9fb3c8"/>${bars}</svg>`;
}

function parityChart(rows){
  const compact=window.matchMedia("(max-width:720px)").matches,W=compact?420:760,H=285,L=42,R=12,T=18,B=45,max=Math.max(...rows.flatMap(row=>[row.observed,row.theoretical]),1),group=(W-L-R)/rows.length;
  const bars=rows.map((row,index)=>{const bw=Math.max(8,group*.25),x=L+index*group+group*.18,oh=row.observed/max*(H-T-B),th=row.theoretical/max*(H-T-B);return `<g><rect x="${x}" y="${H-B-oh}" width="${bw}" height="${oh}" fill="#159a9c"><title>Observed ${percent(row.observed)}</title></rect><rect x="${x+bw+3}" y="${H-B-th}" width="${bw}" height="${th}" fill="#f2b84b"><title>Theoretical ${percent(row.theoretical)}</title></rect><text x="${x+bw}" y="${H-B+15}" text-anchor="middle" font-size="9" fill="#627d98">${row.pattern}</text></g>`;}).join("");
  return `<div class="legend"><span><i style="background:#159a9c"></i>Observed</span><span><i style="background:#f2b84b"></i>Fair-draw model</span></div><svg viewBox="0 0 ${W} ${H}"><line x1="${L}" y1="${H-B}" x2="${W-R}" y2="${H-B}" stroke="#9fb3c8"/>${bars}</svg>`;
}

function scatterChart(analysis){
  const rows=analysis.scatter,rule=analysis.rule,compact=window.matchMedia("(max-width:720px)").matches,W=compact?440:800,H=300,L=44,R=12,T=18,B=38,maxX=analysis.n,minY=rule.minimum,maxY=rule.maximum,x=value=>L+(value-1)/Math.max(maxX-1,1)*(W-L-R),y=value=>H-B-(value-minY)/Math.max(maxY-minY,1)*(H-T-B);
  const points=rows.map(row=>`<circle cx="${x(row.index)}" cy="${y(row.value)}" r="4" fill="${COLORS[(row.position-1)%COLORS.length]}" fill-opacity=".72"><title>${row.date} ${row.time} · ${row.value}</title></circle>`).join("");
  return `<div class="legend">${Array.from({length:rule.pick_count},(_,i)=>`<span><i style="background:${COLORS[i%COLORS.length]}"></i>${rule.ordered?`Position ${i+1}`:`Draw value ${i+1}`}</span>`).join("")}</div><svg viewBox="0 0 ${W} ${H}"><line x1="${L}" y1="${H-B}" x2="${W-R}" y2="${H-B}" stroke="#9fb3c8"/><line x1="${L}" y1="${T}" x2="${L}" y2="${H-B}" stroke="#9fb3c8"/>${points}<text x="${W/2}" y="${H-7}" text-anchor="middle" font-size="10" fill="#627d98">Chronological draw index</text></svg>`;
}

function rollingChart(analysis){
  const rows=analysis.rolling;if(!rows.length)return"";const labels=[...new Set(rows.map(row=>row.label))],endpoints=[...new Set(rows.map(row=>row.endIndex))],compact=window.matchMedia("(max-width:720px)").matches,W=compact?440:800,H=285,L=44,R=16,T=22,B=40,max=Math.max(...rows.map(row=>row.count),1),x=value=>L+(endpoints.indexOf(value))/Math.max(endpoints.length-1,1)*(W-L-R),y=value=>H-B-value/max*(H-T-B);
  const series=labels.map((label,index)=>{const points=rows.filter(row=>row.label===label).map(row=>`${x(row.endIndex)},${y(row.count)}`).join(" ");return `<polyline points="${points}" fill="none" stroke="${COLORS[index%COLORS.length]}" stroke-width="3"/><g>${rows.filter(row=>row.label===label).map(row=>`<circle cx="${x(row.endIndex)}" cy="${y(row.count)}" r="4" fill="${COLORS[index%COLORS.length]}"><title>${label}: ${row.count} in trailing window</title></circle>`).join("")}</g>`;}).join("");
  return `<div class="legend">${labels.map((label,index)=>`<span><i style="background:${COLORS[index%COLORS.length]}"></i>${label}</span>`).join("")}</div><svg viewBox="0 0 ${W} ${H}"><line x1="${L}" y1="${H-B}" x2="${W-R}" y2="${H-B}" stroke="#9fb3c8"/>${series}<text x="${W/2}" y="${H-7}" text-anchor="middle" font-size="10" fill="#627d98">Trailing ${analysis.rollingWindow}-draw windows</text></svg>`;
}

function renderCandidate(candidate,analysis){
  const rule=analysis.rule;if(!candidate)return"";
  const oddsLabel=rule.rambolito_name?"Straight-play odds":"Same mathematical odds";
  return `<section class="candidate-card ${rule.ordered?"ordered":""}"><div class="candidate-top"><div><h3>Best historical-profile fit</h3><p class="subtle">Closest match found to this sample’s smoothed number/position frequency, parity, low/high shape, and sum range.</p></div><button class="secondary" id="another-candidate">Show another</button></div>${ballsHtml(candidate.numbers,rule)}<div class="candidate-facts"><span>Sample-fit score: <strong>${candidate.score}/100</strong></span><span>${candidate.even} even + ${candidate.odd} odd</span><span>${candidate.low} low + ${candidate.high} high</span><span>Sum: ${candidate.sum}</span><span>Seen before in sample: ${candidate.seen}</span>${rule.rambolito_name?`<span>${esc(rule.rambolito_name)} key: ${esc(candidate.rambolito)} (${candidate.permutations} straight permutations)</span>`:""}<span class="equal-odds">${oddsLabel}: 1 in ${integer.format(candidate.odds)}</span></div></section>`;
}

function heatmapHtml(analysis){
  if(!analysis.rule.ordered)return"";const max=Math.max(...analysis.positionFrequency.flatMap(row=>row.map(cell=>cell.count)),1);
  return `<div class="table-wrap"><table class="heat"><thead><tr><th>Position</th>${domain(analysis.rule).map(value=>`<th>${numberText(value,analysis.rule)}</th>`).join("")}</tr></thead><tbody>${analysis.positionFrequency.map((row,index)=>`<tr><th>Position ${index+1}</th>${row.map(cell=>{const alpha=.1+.8*cell.count/max;return `<td style="background:rgba(23,126,170,${alpha});color:${alpha>.55?"#fff":"#243b53"}" title="${percent(cell.rate)}">${cell.count}</td>`;}).join("")}</tr>`).join("")}</tbody></table></div>`;
}

function rambolitoRows(analysis){
  if(!analysis.rule.rambolito_name)return[];const groups=new Map();analysis.draws.forEach(draw=>{const sorted=[...draw.numbers].sort((a,b)=>a-b),key=keyOf(sorted),existing=groups.get(key)||{numbers:sorted,count:0,first:draw.date,last:draw.date};existing.count++;existing.last=draw.date;groups.set(key,existing);});
  return [...groups.values()].map(row=>({key:comboText(row.numbers,analysis.rule),permutations:permutationCount(row.numbers),count:row.count,first:row.first,last:row.last})).sort((a,b)=>b.count-a.count||a.key.localeCompare(b.key));
}

function renderReport(analysis){
  const target=document.getElementById("report");if(!analysis){target.innerHTML='<section class="panel empty"><h2>No draws found</h2><p>Choose another date range or game.</p></section>';return;}
  currentAnalysis=analysis;currentCandidateIndex=0;const rule=analysis.rule,features=analysis.features,sums=features.map(row=>row.sum),evenTotal=sum(features.map(row=>row.even)),oddTotal=analysis.totalSlots-evenTotal,top=analysis.ranked.filter(row=>row.count===analysis.maxFrequency),cold=analysis.ranked.filter(row=>row.count===analysis.minFrequency),modalParity=[...analysis.parity].sort((a,b)=>b.count-a.count||a.even-b.even)[0];
  const temperatureBadges=analysis.maxFrequency===analysis.minFrequency
    ? `<span class="badge middle">All values are tied at ${analysis.maxFrequency} appearance${analysis.maxFrequency===1?"":"s"}</span>`
    : `${top.slice(0,8).map(row=>`<span class="badge hot">Sample hot: ${row.label} (${row.count})</span>`).join("")}${cold.slice(0,8).map(row=>`<span class="badge cold">Sample cold: ${row.label} (${row.count})</span>`).join("")}`;
  const frequencyColumns=[{key:"label",label:"Number"},{key:"count",label:"Appearances"},{key:"temperature",label:"Sample label"},{key:"hitRate",label:"Draw hit rate",format:percent},{key:"expected",label:"Expected",format:v=>round(v,2),mobile:false},{key:"z",label:"Z-score",format:v=>round(v,2),mobile:false},{key:"since",label:"Draws since last",format:(v,row)=>row.seen?v:"Not seen"},{key:"meanGap",label:"Mean gap",format:v=>v===null?"—":round(v,2)},{key:"lastSeen",label:"Last seen",format:v=>v||"Not in sample"}];
  const pairColumns=[{key:"label",label:rule.ordered?"Ordered transition":"Unordered pair"},{key:"count",label:"Occurrences"},{key:"support",label:"Draw support"},{key:"supportPct",label:"Support rate",format:percent}];
  const tripleColumns=[{key:"label",label:rule.ordered?"Adjacent ordered triple":"Unordered triple"},{key:"count",label:"Occurrences"},{key:"support",label:"Draw support"},{key:"supportPct",label:"Support rate",format:percent}];
  const featureColumns=[{key:"date",label:"Date"},{key:"time",label:"Time"},{key:"combination",label:"Combination"},{key:"sum",label:"Sum"},{key:"even",label:"Even"},{key:"odd",label:"Odd"},{key:"low",label:"Low"},{key:"high",label:"High"},{key:"consecutive",label:"Consecutive pairs"},{key:"shared",label:"Shared with previous",format:v=>v===null?"—":v},{key:"exact",label:"Same position",format:v=>v===null?"—":v,mobile:false},{key:"jackpot",label:"Reported amount",format:v=>v>0?peso.format(v):"Unavailable",mobile:false},{key:"winners",label:"Reported winners"}];
  const tempColor=row=>row.temperature==="Sample hot"?"#d94f4f":row.temperature==="Sample cold"?"#3984c6":"#90a4ae";
  const parityBadge=analysis.modalParities.length===1?`Most common mix: ${analysis.modalParities[0].pattern}`:`Leading mixes tied: ${analysis.modalParities.map(row=>row.pattern).join(", ")}`;
  const detailRows=features.length>250?features.slice(-250):features,detailNote=features.length>250?`Showing the latest 250 of ${features.length} draw rows here; every selected draw is still included in the calculations.`:"";
  target.innerHTML=`
    <div class="game-heading"><div><h2>${esc(rule.name)}</h2><div class="subtle">${esc(rule.rule_text||"")}</div></div><div class="subtle">Observed times: ${[...new Set(analysis.draws.map(draw=>draw.time))].join(", ")}</div></div>
    <div class="cards">
      <div class="card"><div class="label">Draws analyzed</div><div class="value">${analysis.n}</div></div>
      <div class="card"><div class="label">Even observations</div><div class="value">${percent(evenTotal/analysis.totalSlots*100)}</div></div>
      <div class="card"><div class="label">Odd observations</div><div class="value">${percent(oddTotal/analysis.totalSlots*100)}</div></div>
      <div class="card"><div class="label">Average sum</div><div class="value">${round(average(sums),1)}</div></div>
      <div class="card"><div class="label">Draws with consecutive pair</div><div class="value">${analysis.withConsecutive}/${analysis.n}</div></div>
      <div class="card"><div class="label">Shared ≥1 value with previous</div><div class="value">${analysis.comparisons?`${analysis.repeatedComparisons}/${analysis.comparisons}`:"N/A"}</div></div>
    </div>
    <section class="story"><h3>What this sample says—in plain language</h3><ul>${analysis.narratives.map(text=>`<li>${esc(text)}</li>`).join("")}</ul><div class="badge-row">${temperatureBadges}<span class="badge middle">${esc(parityBadge)}</span></div></section>
    <div id="featured-candidate">${renderCandidate(analysis.candidates[currentCandidateIndex],analysis)}</div>
    <div class="grid-2">
      <section class="panel"><h3>Frequency and sample hot/cold</h3><p class="subtle">Red is the highest count in this sample; blue is the lowest. Ties are kept together.</p><div class="chart">${barChart(analysis.frequency,"label","count",tempColor)}</div></section>
      <section class="panel"><h3>Even/odd composition per draw</h3><div class="chart">${parityChart(analysis.parity)}</div></section>
      <section class="panel"><h3>Draw-value scatter</h3><p class="subtle">For jackpot games, color shows draw sequence only; ticket order does not matter.</p><div class="chart">${scatterChart(analysis)}</div></section>
      <section class="panel"><h3>Rolling frequency over time</h3><p class="subtle">Top five sample values across trailing ${analysis.rollingWindow}-draw windows.</p><div class="chart">${rollingChart(analysis)}</div></section>
      <section class="panel"><h3>Draw-sum distribution</h3><p class="subtle">Exact sums are clearer than broad bins for a small sample.</p><div class="chart">${barChart(analysis.sumDistribution,"drawSum","count",()=>"#7357c7")}</div></section>
      <section class="panel"><h3>Low/high and consecutive patterns</h3><p class="subtle">Low = ${rule.minimum}–${analysis.midpoint}; high = ${analysis.midpoint+1}–${rule.maximum}.</p>${dataTable(analysis.lowHigh,[{key:"pattern",label:"Low/high shape"},{key:"count",label:"Draws"},{key:"observed",label:"Rate",format:percent}])}<br>${dataTable(analysis.consecutiveDistribution,[{key:"count",label:"Consecutive pairs"},{key:"drawCount",label:"Draws"},{key:"observed",label:"Rate",format:percent}])}</section>
    </div>
    <div class="grid-2">
      <section class="panel"><h3>${rule.ordered?"Adjacent ordered pairs":"Unordered pair frequency"}</h3>${dataTable(analysis.pairs.slice(0,15),pairColumns)}</section>
      <section class="panel"><h3>${rule.pick_count<3?"Triple frequency—not applicable":rule.ordered?"Adjacent ordered triples":"Unordered triple frequency"}</h3>${dataTable(analysis.triples.slice(0,15),tripleColumns)}</section>
    </div>
    <div class="grid-2">
      <section class="panel"><h3>Source-reported prize/jackpot amount</h3><div class="cards" style="grid-template-columns:repeat(2,1fr);margin:0"><div class="card"><div class="label">Available records</div><div class="value">${analysis.jackpot.available}/${analysis.n}</div></div><div class="card"><div class="label">Average positive amount</div><div class="value" style="font-size:15px">${analysis.jackpot.available?peso.format(analysis.jackpot.average):"Unavailable"}</div></div><div class="card"><div class="label">Minimum</div><div class="value" style="font-size:15px">${analysis.jackpot.minimum!==null?peso.format(analysis.jackpot.minimum):"—"}</div></div><div class="card"><div class="label">Maximum</div><div class="value" style="font-size:15px">${analysis.jackpot.maximum!==null?peso.format(analysis.jackpot.maximum):"—"}</div></div></div><p class="subtle">Zero values are treated as unavailable placeholders.</p></section>
      <section class="panel"><h3>Source-reported winner statistics</h3><div class="cards" style="grid-template-columns:repeat(2,1fr);margin:0"><div class="card"><div class="label">Reported total</div><div class="value">${integer.format(analysis.winners.total)}</div></div><div class="card"><div class="label">Average per draw</div><div class="value">${round(analysis.winners.average,1)}</div></div><div class="card"><div class="label">Draws with winners</div><div class="value">${analysis.winners.positiveDraws}/${analysis.n}</div></div><div class="card"><div class="label">Largest reported count</div><div class="value">${integer.format(analysis.winners.maximum)}</div></div></div><p class="subtle">Winner-field meaning can differ between digit and jackpot games; figures are not compared across games.</p></section>
    </div>
    <details><summary>Advanced number frequency and gaps</summary><div class="details-body"><p class="subtle">“Not seen” means not seen inside this selected sample. Gap units are selected-game draw records, not days.</p>${dataTable(analysis.frequency,frequencyColumns)}</div></details>
    ${rule.ordered?`<details><summary>Position × value frequency</summary><div class="details-body">${heatmapHtml(analysis)}</div></details>`:""}
    ${rule.rambolito_name?`<details><summary>${esc(rule.rambolito_name)} group frequency</summary><div class="details-body"><p class="subtle">Canonical unordered grouping is separate from Standard exact-order analysis.</p>${dataTable(rambolitoRows(analysis),[{key:"key",label:"Canonical key"},{key:"permutations",label:"Straight permutations"},{key:"count",label:"Observed draws"},{key:"first",label:"First seen"},{key:"last",label:"Last seen"}])}</div></details>`:""}
    <details><summary>Selected draw details</summary><div class="details-body">${detailNote?`<p class="subtle">${esc(detailNote)}</p>`:""}${dataTable(detailRows,featureColumns)}</div></details>`;
  const another=document.getElementById("another-candidate");if(another)another.onclick=()=>{currentCandidateIndex=(currentCandidateIndex+1)%analysis.candidates.length;document.getElementById("featured-candidate").innerHTML=renderCandidate(analysis.candidates[currentCandidateIndex],analysis);document.getElementById("another-candidate").onclick=another.onclick;};
}

function miniPickHtml(analysis){
  if(!analysis)return'<div class="mini-pick"><strong>No records</strong><span class="subtle">Try another range.</span></div>';const candidate=analysis.candidates[0],rule=analysis.rule;
  return `<div class="mini-pick"><strong>${esc(rule.name)}</strong>${ballsHtml(candidate.numbers,rule)}<div class="pick-meta">Fit ${candidate.score}/100 · ${rule.rambolito_name?"straight-play odds":"same odds"} 1 in ${integer.format(candidate.odds)}</div></div>`;
}

function renderAllPicks(){
  document.getElementById("all-picks").innerHTML=RULES.map(rule=>miniPickHtml(analyze(rule.code,selectedDraws(rule.code)))).join("");
}

function syncQuery(){
  const params=new URLSearchParams(),game=document.getElementById("game-select").value,mode=document.querySelector('input[name="mode"]:checked').value;params.set("game",game);params.set("mode",mode);
  if(mode==="latest")params.set("count",document.getElementById("latest-count").value);else{params.set("from",document.getElementById("date-from").value);params.set("to",document.getElementById("date-to").value);}
  try{history.replaceState(null,"",`${location.pathname}?${params}`);}catch(_error){}
}

function applyAnalysis(){
  const code=document.getElementById("game-select").value,draws=selectedDraws(code),mode=document.querySelector('input[name="mode"]:checked').value;
  document.querySelectorAll("#game-chips button").forEach(button=>button.classList.toggle("active",button.dataset.code===code));
  const from=document.getElementById("date-from").value,to=document.getElementById("date-to").value,invalidDates=mode==="date"&&from&&to&&from>to;
  document.getElementById("scope-line").textContent=invalidDates?"Start date must be on or before end date.":draws.length?`Showing ${draws.length} ${ruleFor(code).name} draw${draws.length===1?"":"s"}, ${draws[0].date} to ${draws.at(-1).date} (${mode==="latest"?"latest-draw mode":"inclusive date mode"}).`:"No records match this selection.";
  renderReport(analyze(code,draws));renderAllPicks();syncQuery();
}

function updateMode(){
  const latest=document.querySelector('input[name="mode"]:checked').value==="latest";document.getElementById("latest-controls").hidden=!latest;document.getElementById("date-controls").hidden=latest;
}

function bootstrap(){
  const params=new URLSearchParams(location.search),select=document.getElementById("game-select"),chips=document.getElementById("game-chips");
  RULES.forEach(rule=>{select.insertAdjacentHTML("beforeend",`<option value="${rule.code}">${esc(rule.name)}</option>`);const button=document.createElement("button");button.dataset.code=rule.code;button.textContent=rule.name;button.onclick=()=>{select.value=rule.code;applyAnalysis();};chips.appendChild(button);});
  const requestedGame=params.get("game");if(RULES.some(rule=>rule.code===requestedGame))select.value=requestedGame;
  const mode=params.get("mode");if(mode==="date")document.querySelector('input[name="mode"][value="date"]').checked=true;
  const count=Number(params.get("count")),defaultCount=Math.min(5,Math.max(1,Number(META.latest_per_game)||5));document.getElementById("latest-count").value=String(Number.isInteger(count)&&count>=1&&count<=5?count:defaultCount);
  document.getElementById("date-from").min=META.available_start_date;document.getElementById("date-from").max=META.available_end_date;document.getElementById("date-to").min=META.available_start_date;document.getElementById("date-to").max=META.available_end_date;
  document.getElementById("date-from").value=params.get("from")||META.available_start_date;document.getElementById("date-to").value=params.get("to")||META.available_end_date;
  document.querySelectorAll('input[name="mode"]').forEach(input=>input.onchange=updateMode);document.getElementById("analyze-button").onclick=applyAnalysis;select.onchange=applyAnalysis;updateMode();
  document.getElementById("source-links").innerHTML=META.sources.map(source=>`<p><a href="${esc(source.url)}" target="_blank" rel="noreferrer">${esc(source.name)}</a></p>`).join("");
  applyAnalysis();
}
bootstrap();
</script>
</body>
</html>
"""


def render_html_report(analysis: dict[str, Any]) -> str:
    payload = json.dumps(_report_payload(analysis), ensure_ascii=False, separators=(",", ":"))
    return HTML_TEMPLATE.replace("__REPORT_PAYLOAD__", payload.replace("</", "<\\/"))


def write_html_report(analysis: dict[str, Any], destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(render_html_report(analysis), encoding="utf-8")
