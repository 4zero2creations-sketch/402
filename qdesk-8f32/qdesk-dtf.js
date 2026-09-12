// DTF-specific machine costing and service modes.
function migrateDtfSettings(){
  if(!cfg?.settings)return;
  const d={DTF_Printer_Cost:9000,DTF_Printer_Life_Hours:5000,DTF_Printer_Watts:600,DTF_Minimum_Charge:5};
  Object.entries(d).forEach(([k,v])=>{if(!Number.isFinite(Number(cfg.settings[k])))cfg.settings[k]=v});
}
function dtfDepreciationPerMinute(){
  migrateDtfSettings();
  const cost=Math.max(0,Number(cfg.settings.DTF_Printer_Cost)||0);
  const hours=Math.max(1,Number(cfg.settings.DTF_Printer_Life_Hours)||1);
  return (cost/hours)/60;
}
settingLabels.DTF_Printer_Cost='DTF printer purchase cost ($)';
settingLabels.DTF_Printer_Life_Hours='DTF expected life (productive hours)';
settingLabels.DTF_Printer_Watts='DTF printer power (watts)';
settingLabels.DTF_Minimum_Charge='DTF minimum line charge ($)';
const dtfBaseRenderAll=renderAll;
renderAll=function(){migrateDtfSettings();dtfBaseRenderAll()};
const dtfBaseRenderEditors=renderEditors;
renderEditors=function(){
  dtfBaseRenderEditors();
  if(!settingsEditor)return;
  settingsEditor.insertAdjacentHTML('beforeend',`<div class="setting"><label>DTF depreciation rate (auto)</label><input type="text" readonly value="$${money(dtfDepreciationPerMinute())}/min"><span class="small">Calculated from printer cost ÷ lifetime hours ÷ 60.</span></div>`);
};
const dtfBaseBlankLine=blankLine;
blankLine=function(){return{...dtfBaseBlankLine(),dtfService:'complete',dtfPrinterMinutes:1}};
function setDtfService(i,v){pullLineInputs();if(!lines[i])return;lines[i].dtfService=v;if(v==='press_only')lines[i].dtfSource='customer';else if(lines[i].dtfSource==='customer')lines[i].dtfSource='printed';renderQuoteLines()}
function setDtfSource(i,v){pullLineInputs();if(!lines[i])return;lines[i].dtfSource=v;renderQuoteLines()}
const dtfBaseLineExtra=lineExtra;
lineExtra=function(l,i){
  if(l.type!=='dtf')return dtfBaseLineExtra(l,i);
  const service=l.dtfService||'complete';
  const source=service==='press_only'?'customer':(l.dtfSource||'printed');
  const needsTransfer=service!=='press_only';
  const needsPress=service!=='transfer_only';
  const sourceOptions=service==='complete'
    ?`<option value="printed" ${source==='printed'?'selected':''}>Printed in-house</option><option value="purchased" ${source==='purchased'?'selected':''}>Purchased by us</option><option value="customer" ${source==='customer'?'selected':''}>Customer supplied</option>`
    :service==='transfer_only'
      ?`<option value="printed" ${source==='printed'?'selected':''}>Printed in-house</option><option value="purchased" ${source==='purchased'?'selected':''}>Purchased by us</option>`
      :`<option value="customer" selected>Customer supplied</option>`;
  return`<div class="line-dynamic"><div class="line-grid"><div class="field full"><label>DTF service</label><select data-k="dtfService" data-i="${i}" onchange="setDtfService(${i},this.value)"><option value="complete" ${service==='complete'?'selected':''}>Complete DTF — Transfer + Press</option><option value="transfer_only" ${service==='transfer_only'?'selected':''}>Transfer Only — Customer applies it</option><option value="press_only" ${service==='press_only'?'selected':''}>Press Only — Customer supplies transfer/item</option></select></div><div class="field"><label>Print width (in)</label><input data-k="dtfW" data-i="${i}" type="number" step=".1" value="${l.dtfW}"></div><div class="field"><label>Print height (in)</label><input data-k="dtfH" data-i="${i}" type="number" step=".1" value="${l.dtfH}"></div><div class="field"><label>Transfer source</label><select data-k="dtfSource" data-i="${i}" onchange="setDtfSource(${i},this.value)">${sourceOptions}</select></div>${needsTransfer&&source==='printed'?`<div class="field"><label>DTF printer run time (min)</label><input data-k="dtfPrinterMinutes" data-i="${i}" type="number" min="0" step=".1" value="${l.dtfPrinterMinutes??1}"></div>`:''}${needsPress?`<div class="field"><label>Press / handling min</label><input data-k="pressMinutes" data-i="${i}" type="number" min="0" step=".25" value="${l.pressMinutes}"></div>`:''}</div><span class="small">$${money(s('DTF_Minimum_Charge'))} minimum applies to every DTF service line.</span></div>`;
};
const dtfBaseCalcLine=calcLine;
calcLine=function(l){
  if(l.type!=='dtf')return dtfBaseCalcLine(l);
  migratePricingSettings();migrateDtfSettings();
  const service=l.dtfService||'complete';
  const source=service==='press_only'?'customer':(l.dtfSource||'printed');
  const doesTransfer=service!=='press_only';
  const doesPress=service!=='transfer_only';
  const item=cfg.catalog[Number(l.catalogIndex)]||{name:'Custom',price:0};
  const qty=Math.max(1,Math.floor(Number(l.quantity)||1));
  const includeBlank=service==='complete'&&l.provided==='shop';
  const rawItemCost=includeBlank?(Number(item.price)||0):0;
  const itemCostMultiplier=Math.max(0,Number(cfg.settings.Item_Cost_Multiplier)||0);
  const markedItemCost=rawItemCost*itemCostMultiplier;
  const overallMarkupPercent=Math.max(0,Number(cfg.settings.Overall_Markup_Percent)||0);
  const overallMarkupMultiplier=1+(overallMarkupPercent/100);
  const area=(Number(l.dtfW)||0)*(Number(l.dtfH)||0);
  const pressMins=doesPress?Math.max(0,Number(l.pressMinutes)||0):0;
  const printerMins=doesTransfer&&source==='printed'?Math.max(0,Number(l.dtfPrinterMinutes)||0):0;
  const rawTransferCost=doesTransfer&&source!=='customer'?area*(source==='purchased'?rate('DTF purchased'):rate('DTF printed')):0;
  const markedTransferCost=rawTransferCost*itemCostMultiplier;
  const application=doesPress?area*rate('Heat press work'):0;
  const pressOverhead=doesPress?pressMins*s('Press_Rate'):0;
  const printerDepreciation=printerMins*dtfDepreciationPerMinute();
  const process=markedTransferCost+application+pressOverhead+printerDepreciation;
  const pressEnergy=doesPress?powerCost(s('Press_Watts'),pressMins):0;
  const printerEnergy=printerMins?powerCost(s('DTF_Printer_Watts'),printerMins):0;
  const energy=pressEnergy+printerEnergy;
  const labor=(Number(l.extraLaborMinutes)||0)*(s('Labor_Rate')/60);
  const preOverall=markedItemCost+process+energy+labor;
  const calculatedUnit=preOverall*overallMarkupMultiplier;
  const override=l.unitPriceOverride!==''&&!isNaN(Number(l.unitPriceOverride));
  let unitPrice=override?Number(l.unitPriceOverride):calculatedUnit;
  let lineTotal=unitPrice*qty;
  const minimum=Math.max(0,s('DTF_Minimum_Charge'));
  const minimumApplied=!override&&lineTotal<minimum;
  if(minimumApplied){lineTotal=minimum;unitPrice=lineTotal/qty}
  const serviceLabel=service==='transfer_only'?'Transfer only':service==='press_only'?'Press only':'Complete DTF';
  const sourceLabel=source==='printed'?'in-house transfer':source==='purchased'?'purchased transfer':'customer-supplied transfer';
  return{type:l.type,item:service==='transfer_only'?'DTF Transfer Only':service==='press_only'?'DTF Press Only':item.name,quantity:qty,detail:`${serviceLabel}, ${l.dtfW}×${l.dtfH} in, ${sourceLabel}${minimumApplied?' • $'+money(minimum)+' minimum applied':''}`,unitPrice,calculatedUnitPrice:calculatedUnit,lineTotal,pricing:{service,source,rawItemCost,itemCostMultiplier,markedItemCost,rawTransferCost,markedTransferCost,application,pressOverhead,printerDepreciation,process,pressEnergy,printerEnergy,energy,labor,preOverall,overallMarkupPercent,overallMarkupMultiplier,dtfMinimum:minimum,minimumApplied},inputs:{...l,dtfService:service,dtfSource:source}};
};