// Pricing model override: raw item cost is marked up first, then production costs are added,
// then an optional overall multiplier is applied to the finished calculated unit price.

function migratePricingSettings(){
  if(!cfg?.settings)return;
  const legacy=Number(cfg.settings.Markup);
  if(!Number.isFinite(Number(cfg.settings.Item_Cost_Multiplier))){
    cfg.settings.Item_Cost_Multiplier=Number.isFinite(legacy)&&legacy>0?legacy:2;
  }
  if(!Number.isFinite(Number(cfg.settings.Overall_Markup))){
    cfg.settings.Overall_Markup=1;
  }
}

delete settingLabels.Markup;
settingLabels.Item_Cost_Multiplier='Item cost multiplier';
settingLabels.Overall_Markup='Overall markup multiplier';

const pricingBaseRenderAll=renderAll;
renderAll=function(){
  migratePricingSettings();
  pricingBaseRenderAll();
};

itemOptions=function(selected){
  return cfg.catalog.map((x,i)=>`<option value="${i}" ${i===Number(selected)?'selected':''}>${esc(x.name)} (raw cost $${money(x.price)})</option>`).join('');
};

calcLine=function(l){
  migratePricingSettings();
  const item=cfg.catalog[Number(l.catalogIndex)]||{name:'Custom',price:0};
  const qty=Math.max(1,Math.floor(Number(l.quantity)||1));
  const rawItemCost=l.provided==='shop'?Number(item.price)||0:0;
  const itemCostMultiplier=Math.max(0,Number(cfg.settings.Item_Cost_Multiplier)||0);
  const overallMarkup=Math.max(0,Number(cfg.settings.Overall_Markup)||0);
  const markedItemCost=rawItemCost*itemCostMultiplier;
  let process=0,energy=0,detail='';

  if(l.type==='dtf'){
    const area=(Number(l.dtfW)||0)*(Number(l.dtfH)||0);
    const mins=Number(l.pressMinutes)||0;
    process=area*(l.dtfSource==='purchased'?rate('DTF purchased'):rate('DTF printed'))+area*rate('Heat press work')+mins*s('Press_Rate');
    energy=powerCost(s('Press_Watts'),mins);
    detail=`DTF ${l.dtfW}×${l.dtfH} in, ${l.dtfSource} transfer`;
  }else if(l.type==='laser'){
    const mins=Number(l.laserMinutes)||0;
    process=mins*(l.laserType==='ir'?s('IR_Rate'):s('Diode_Rate'))+(Number(l.laserSetup)||0)+(Number(l.laserExtra)||0);
    energy=powerCost(l.laserType==='ir'?s('IR_Watts'):s('Diode_Watts'),mins);
    detail=`${l.laserType==='ir'?'2W IR':'40W Diode'} laser, ${mins} min`;
  }else{
    const mins=Number(l.printerMinutes)||0;
    const laborMins=Number(l.printLaborMinutes)||0;
    process=mins*s('Printer_Rate')+laborMins*s('Print_Labor_Rate')+(Number(l.materialCost)||0)+(Number(l.printSetup)||0);
    energy=powerCost(s('Printer_Watts'),mins);
    detail=`3D print, ${mins} printer min, ${laborMins} labor min`;
  }

  const labor=(Number(l.extraLaborMinutes)||0)*(s('Labor_Rate')/60);
  const preOverall=markedItemCost+process+energy+labor;
  const calculated=preOverall*overallMarkup;
  const unitPrice=l.unitPriceOverride!==''&&!isNaN(Number(l.unitPriceOverride))?Number(l.unitPriceOverride):calculated;

  return{
    type:l.type,item:item.name,quantity:qty,detail,unitPrice,calculatedUnitPrice:calculated,
    lineTotal:unitPrice*qty,
    pricing:{
      rawItemCost,itemCostMultiplier,markedItemCost,process,energy,labor,
      preOverall,overallMarkup
    },
    inputs:{...l}
  };
};
