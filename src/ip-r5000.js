// IP-R5000 第14版 p10,19を基礎にしたOCR操作練習。内部回路・継電器曲線は教材近似。
export const OCR_RANGES = [[.5,50,20],[1,35,14],[2,25,10],[5,20,6],[10,11,4.5],[15,8,3.5],[20,6,3]];
export function createIPState() { return {power:false, connected:false, isolated:false, earth:false, path:'SET', contact:'TRIP', resistance:2, knob:0, started:false, current:0, elapsed:0, operated:false, result:null, burden:.5, meter:25, exposure:0}; }
export function ipTick(s, dt, relay) {
  if (!Number.isFinite(dt) || dt<=0) return;
  const range=OCR_RANGES.find(r=>r[0]===s.resistance);
  const source=s.power && s.started ? s.knob/100*25 : 0;
  s.current=s.path==='SET' ? source/(s.resistance+.25) : s.connected ? source/(s.resistance+s.burden) : 0;
  if(s.current>range[2]) s.exposure+=dt; else s.exposure=0;
  if(s.current>range[1] || s.exposure>30) { s.started=false;s.current=0;s.notice='定格範囲を超えたため教材が停止しました（実機の自動保護を示すものではありません）。';return; }
  if(!s.started || s.path!=='TEST') return;
  s.elapsed+=dt;
  if(s.current<relay.Is) {s.operated=false;s.acc=0;return;}
  // 架空の反限時曲線。3倍電流で既存教材のT300になる。
  s.acc=(s.acc||0)+dt;
  const delay=relay.T300*8/(Math.pow(s.current/relay.Is,2)-1 || .0001);
  if(!s.operated && s.acc>=delay) {
    s.operated=true;s.result={current:s.current,seconds:s.elapsed,mode:s.contact};
    if(s.contact==='TRIP') {s.started=false;s.current=0;}
  }
}
export function mountIP(host, relays) {
  const s=createIPState(), entries=Object.entries(relays).filter(([,r])=>r.type==='ocr');
  let target=entries[0][0], records=[];
  host.innerHTML=`<style>
  .ipcase{background:linear-gradient(115deg,#c9cccb,#ecece7 42%,#b5bab8);color:#172225;border:8px solid #53605f;border-radius:14px;padding:18px;box-shadow:inset 0 0 0 2px #e4e5df,0 8px 20px #0008;margin:16px 0}.ipcase h3{color:#22312e!important}.ipgrid{display:grid;grid-template-columns:1fr 1fr;gap:15px}.ipmeter{background:#faf7e9;border:8px solid #222c2c;border-radius:10px;padding:15px;text-align:center;color:#152622;font:28px monospace}.ipcase label{display:block;margin:8px 0}.ipcase input[type=range]{width:100%}.ipcase button{min-height:38px}.ipread{font-family:monospace;background:#253d36;color:#b9ffb5;padding:10px;border-radius:5px}.ipcase select{max-width:100%}#ipNotice{min-height:2em}@media(max-width:450px){.ipgrid{grid-template-columns:1fr}.ipcase{padding:10px}}
  </style><h3>IP-R5000 · 個人の試験器</h3><p>OCRの動作電流・時間の操作練習。継電器の整定と動作曲線は既存教材の架空モデルです。実機の合否判定には使えません。</p>
  <label>試験対象 <select id=ipTarget>${entries.map(([k,r])=>`<option value="${k}">${r.name}</option>`).join('')}</select></label>
  <div class=info>この版はOCR単体練習に対応。電圧・地絡・CB連動・耐電圧は未実装です。3D外形・配置は公式図面からの近似です。既存の全継電器はPRT側で引き続き選べます。</div>
  <h3>準備</h3><label><input type=checkbox id=ipIsolated> 停電・CT二次側の安全な切離し・トリップ回路の隔離を確認（教材）</label><label><input type=checkbox id=ipEarth> 接地・電源条件を確認</label><label><input type=checkbox id=ipConnected> 電流回路と無電圧検出接点を接続（教材の仮接続）</label>
  <section class=ipcase><h3>計器操作部 · METER OPERATING UNIT</h3><div class=ipgrid><div class=ipmeter><output id=ipCurrent>0.000</output> A</div><div class=ipread>COUNTER<br><output id=ipCounter>0.000</output> s<br><span id=ipTrip>待機</span></div></div>
  <div class=ipgrid><label>電流出力<select id=ipPath><option>SET</option><option>TEST</option></select></label><label>接点構造<select id=ipContact><option value=TRIP>TRIP · a/b(AUTO)</option><option value=CHECK>C.CHECK · a/b</option></select></label><label>電流計レンジ<select id=ipMeter>${[.25,.5,1,2.5,5,10,25,50].map(x=>`<option ${x===25?'selected':''}>${x}</option>`).join('')}</select> A</label><label>実負荷抵抗（教材設定）<select id=ipBurden><option value=.25>0.25Ω</option><option value=.5 selected>0.50Ω</option><option value=1>1.00Ω</option></select></label></div><p>SETは内蔵0.25Ω疑似負荷。TESTでは接続負荷によって電流が変わります。</p></section>
  <section class=ipcase><h3>電源抵抗部 · POWER RESISTANCE UNIT</h3><label><input id=ipPower type=checkbox> 主電源</label><label>OCR 出力電流切換<select id=ipResistance>${OCR_RANGES.map(([r])=>`<option ${r===2?'selected':''}>${r}</option>`).join('')}</select> Ω</label><label>電圧・電流調整器 <output id=ipKnobValue>0</output>%<input id=ipKnob type=range min=0 max=100 step=.1 value=0></label><button id=ipStart>START</button><button id=ipStop>STOP</button><button id=ipZero>調整器を0へ</button><button id=ipReset>カウンタRESET</button></section>
  <div id=ipNotice role=status></div><button id=ipRecord>動作結果を記録</button><h3>記録（架空モデル・合否判定なし）</h3><div id=ipRecords></div><details><summary>出典・再現範囲</summary><p>メーカー説明書第14版 p10・19。出力は25Vの可変電圧源と抵抗による近似。実機の内部回路を測定したモデルではありません。表示は読取補助のデジタル値です。通電中の機種変更や配線変更は教材で禁止します。</p><a href="https://www.musashi-in.co.jp/manual/IP-R5000_4108-000ST015_J14.pdf" target=_blank rel=noopener>公式説明書</a></details>`;
  const el=id=>host.querySelector('#'+id), say=t=>{s.notice=t;el('ipNotice').textContent=t;};
  function render(){el('ipCurrent').value=s.current.toFixed(3);el('ipCounter').value=s.elapsed.toFixed(3);el('ipTrip').textContent=s.operated?'TRIP / 動作':s.started?'試験中':'待機';el('ipKnobValue').value=s.knob;el('ipNotice').textContent=s.current>s.meter?'電流計のレンジを超えています。STOP後に切り換えてください。':s.notice||'';}
  for(const [id,key,number] of [['ipPath','path'],['ipContact','contact'],['ipResistance','resistance',true],['ipMeter','meter',true],['ipBurden','burden',true]]) el(id).onchange=e=>{if(s.started){e.target.value=s[key];say('STOP後に切り換えてください。');return;}s[key]=number?+e.target.value:e.target.value;s.result=null;render();};
  for(const [id,key] of [['ipIsolated','isolated'],['ipEarth','earth'],['ipConnected','connected']]) el(id).onchange=e=>{if(s.power||s.started){e.target.checked=s[key];say('主電源を切ってから接続・準備状態を変更してください。');return;}s[key]=e.target.checked;};
  el('ipPower').onchange=e=>{if(e.target.checked&&(!s.isolated||!s.earth||s.knob!==0)){e.target.checked=false;say('準備確認と調整器0を確認してください。');return;}s.power=e.target.checked;if(!s.power){s.started=false;s.current=0;}render();};
  el('ipTarget').onchange=e=>{if(s.power){e.target.value=target;say('主電源を切ってから対象を変更してください。');return;}target=e.target.value;s.result=null;s.operated=false;s.acc=0;s.elapsed=0;render();};
  el('ipKnob').oninput=e=>{s.knob=+e.target.value;render();};
  el('ipStart').onclick=()=>{if(!s.power||!s.isolated||!s.earth||(s.path==='TEST'&&!s.connected)){say('主電源・準備・TEST時の接続を確認してください。');return;}s.started=true;s.result=null;s.operated=false;s.acc=0;s.elapsed=0;s.exposure=0;say(s.path==='SET'?'疑似負荷で電流を設定しています。':'継電器へ印加しています。');render();};
  el('ipStop').onclick=()=>{s.started=false;s.current=0;render();};el('ipZero').onclick=()=>{s.knob=0;el('ipKnob').value=0;render();};el('ipReset').onclick=()=>{if(s.started){say('STOP後にRESETしてください。');return;}s.elapsed=0;s.result=null;s.operated=false;render();};
  el('ipRecord').onclick=()=>{if(!s.result){say('TESTで動作を検出してから記録してください。');return;}records.push({...s.result,target});el('ipRecords').innerHTML=records.map((r,i)=>`<p>${i+1}. ${relays[r.target].name} · ${r.current.toFixed(3)} A · ${r.seconds.toFixed(3)} s · ${r.mode}（架空）</p>`).join('');s.result=null;say('記録しました。合否基準は未登録です。');};
  return {state:s,target:()=>target, action(id,dir=1,value=null){
    if(id.startsWith('unsupported')||id==='mode'){say('この操作はOCR練習版では未対応です。');return;}
    const node=el(id);if(!node)return;
    if(node.tagName==='SELECT'){node.selectedIndex=(node.selectedIndex+dir+node.options.length)%node.options.length;node.dispatchEvent(new Event('change'));}
    else if(node.type==='checkbox'){node.click();}
    else if(node.type==='range'){node.value=value===null?Math.max(0,Math.min(100,+node.value+dir)):Math.max(0,Math.min(100,value));node.dispatchEvent(new Event('input'));}
    else node.click();render();
  },canLeave:()=>!s.power&&!s.started&&s.knob===0&&!s.connected&&!s.isolated, tick(dt){ipTick(s,dt,relays[target]);render();},render};
}
