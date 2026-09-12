// DTF-specific machine costing. The printer depreciation rate is derived automatically
// from purchase cost and expected productive lifetime, while electricity stays separate.
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
blankLine=function(){return{...dtfBaseBlankLine(),dtfPrinterMinutes:1}};
const dtfBaseLineExtra=lineExtra;
lineExtra=function(l,i){
  if(l.type!=='dtf')return dtfBaseLineExtra(l,i);
  return`<div class="line-dynamic"><div class="line-grid"><div class="field"><label>Print width (in)</label><input data-k="dtfW" data-i="${i}" type="number" step=".1" value="${l.dtfW}"></div><div class="field"><label>Print height (in)</label><input data-k="dtfH" data-i="${i}" type="number" step=".1" value="${l.dtfH}"></div><div class="field"><label>Transfer source</label><select data-k="dtfSource" data-i="${i}"><option value="printed" ${l.dtfSource==='printed'?'selected':''}>Printed in-house</option><option value="purchased" ${l.dtfSource==='purchased'?'selected':''}>Purchased</option></select></div><div class="field"><label>DTF printer run time (min)</label><input data-k="dtfPrinterMinutes" data-i="${i}" type="number" min="0" step=".1" value="${l.dtfPrinterMinutes??1}"><span class="small">Used only for in-house transfers.</span></div><div class="field"><label>Press / handling min</label><input data-k="pressMinutes" data-i="${i}" type="number" step=".25" value="${l.pressMinutes}"></div></div></div>`;
};
const dtfBaseCalcLine=calcLine;
calcLine=function(l){
  if(l.type!=='dtf')return dtfBaseCalcLine(l);
  migratePricingSettings();migrateDtfSettings();
  const item=cfg.catalog[Number(l.catalogIndex)]||{name:'Custom',price:0};
  const qty=Math.max(1,Math.floor(Number(l.quantity)||1));
  const rawItemCost=l.provided==='shop'?Number(item.price)||0:0;
  const itemCostMultiplier=Math.max(0,Number(cfg.settings.Item_Cost_Multiplier)||0);
  const markedItemCost=rawItemCost*itemCostMultiplier;
  const overallMarkupPercent=Math.max(0,Number(cfg.settings.Overall_Markup_Percent)||0);
  const overallMarkupMultiplier=1+(overallMarkupPercent/100);
  const area=(Number(l.dtfW)||0)*(Number(l.dtfH)||0);
  const pressMins=Math.max(0,Number(l.pressMinutes)||0);
  const printerMins=l.dtfSource==='printed'?Math.max(0,Number(l.dtfPrinterMinutes)||0):0;
  const transferMaterial=area*(l.dtfSource==='purchased'?rate('DTF purchased'):rate('DTF printed'));
  const application=area*rate('Heat press work');
  const pressOverhead=pressMins*s('Press_Rate');
  const printerDepreciation=printerMins*dtfDepreciationPerMinute();
  const process=transferMaterial+application+pressOverhead+printerDepreciation;
  const pressEnergy=powerCost(s('Press_Watts'),pressMins);
  const printerEnergy=l.dtfSource==='printed'?powerCost(s('DTF_Printer_Watts'),printerMins):0;
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
  return{type:l.type,item:item.name,quantity:qty,detail:`DTF ${l.dtfW}×${l.dtfH} in, ${l.dtfSource} transfer${minimumApplied?' • minimum charge applied':''}`,unitPrice,calculatedUnitPrice:calculatedUnit,lineTotal,pricing:{rawItemCost,itemCostMultiplier,markedItemCost,transferMaterial,application,pressOverhead,printerDepreciation,process,pressEnergy,printerEnergy,energy,labor,preOverall,overallMarkupPercent,overallMarkupMultiplier,dtfMinimum:minimum,minimumApplied},inputs:{...l}};
};