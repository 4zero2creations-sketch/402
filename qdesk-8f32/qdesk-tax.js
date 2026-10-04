function taxPctDisplay(n){return Number(n||0).toFixed(3).replace(/\.?0+$/,'')}

const originalRenderAll=renderAll;
renderAll=function(){
  originalRenderAll();
  if(!editingQuoteId&&typeof taxRatePct!=='undefined'&&taxRatePct){
    taxRatePct.value=taxPctDisplay(s('Tax_Rate')*100);
  }
};

calculate=async function(){
  pullLineInputs();
  if(!validateAdjustment())return;
  const quoteLines=lines.map(calcLine);
  const fees=selectedFees();
  const itemSubtotal=quoteLines.reduce((a,l)=>a+l.lineTotal,0);
  const feesTotal=fees.reduce((a,f)=>a+(Number(f.price)||0),0);
  const subtotal=itemSubtotal+feesTotal;
  const pct=Math.max(0,Number(bulkDiscountPct.value)||0);
  const bulkDiscountAmount=subtotal*(pct/100);
  const adjustment=Number(priceAdjustment.value)||0;
  const adjustedSubtotal=subtotal-bulkDiscountAmount+adjustment;
  const enteredTaxRaw=String(taxRatePct.value||'').trim();
  const chosenTaxPct=enteredTaxRaw===''?s('Tax_Rate')*100:Math.max(0,Number(enteredTaxRaw)||0);
  const tax=includeTax.checked?Math.max(0,adjustedSubtotal)*(chosenTaxPct/100):0;
  const total=adjustedSubtotal+tax;
  const quote={customer:{name:custName.value,email:custEmail.value,phone:custPhone.value,address:custAddress.value},lines:quoteLines,fees,notes:quoteNotes.value,bulkDiscount:{percent:pct,amount:bulkDiscountAmount},adjustment:{amount:adjustment,reason:adjustmentReason.value.trim()},tax:{enabled:includeTax.checked,ratePercent:chosenTaxPct,amount:tax},pricing:{itemSubtotal,feesTotal,subtotal,adjustedSubtotal,tax,taxRatePercent:chosenTaxPct,total},configVersion:cfg.meta?.version||null};
  try{
    let d;
    if(editingQuoteId)d=await api(API_QUOTES,{method:'PUT',body:JSON.stringify({id:editingQuoteId,quote})});
    else d=await api(API_QUOTES,{method:'POST',body:JSON.stringify(quote)});
    currentQuote=d.quote;
    editingQuoteId=currentQuote.id;
    editingRevision=currentQuote.revision||1;
    showQuote(currentQuote);
    await loadQuotes();
  }catch(e){alert('Quote could not be saved: '+e.message)}
};

showQuote=function(q){
  quoteId.textContent=`${q.id} • Rev ${q.revision||1}`;
  quoteDate.textContent=new Date(q.updatedAt||q.createdAt).toLocaleString();
  outName.textContent=q.customer?.name||'Customer';
  quoteItemRows.innerHTML=(q.lines||[]).map(l=>`<tr><td>${esc(l.item)}</td><td>${esc(l.detail||'')}</td><td>${l.quantity}</td><td class="money">$${money(l.unitPrice)}</td><td class="money">$${money(l.lineTotal)}</td></tr>`).join('');
  let extras='';
  (q.fees||[]).forEach(f=>extras+=`<tr><td colspan="4">Fee: ${esc(f.name)}</td><td class="money">$${money(f.price)}</td></tr>`);
  quoteExtraRows.innerHTML=extras;
  sumSubtotal.textContent='$'+money(q.pricing?.subtotal);
  sumDiscount.textContent='-$'+money(q.bulkDiscount?.amount);
  sumDiscountLabel.textContent=`Bulk discount (${Number(q.bulkDiscount?.percent)||0}%)`;
  sumAdjustment.textContent=(Number(q.adjustment?.amount)||0)>=0?'+$'+money(q.adjustment?.amount):'-$'+money(Math.abs(q.adjustment?.amount||0));
  sumAdjustmentReason.textContent=q.adjustment?.reason?` — ${q.adjustment.reason}`:'';
  const shownTaxPct=Number(q.pricing?.taxRatePercent??q.tax?.ratePercent??(s('Tax_Rate')*100));
  sumTaxLabel.textContent=`Sales tax (${taxPctDisplay(shownTaxPct)}%)`;
  sumTax.textContent='$'+money(q.pricing?.tax);
  outTotal.textContent=money(q.pricing?.total);
  quoteNotesOut.textContent=q.notes||'';
  resultBox.classList.add('show');
  resultBox.scrollIntoView({behavior:'smooth',block:'start'});
};

const originalNewQuote=newQuote;
newQuote=function(){
  originalNewQuote();
  taxRatePct.value=taxPctDisplay(s('Tax_Rate')*100);
};

const originalLoadQuoteForEdit=loadQuoteForEdit;
loadQuoteForEdit=function(q){
  originalLoadQuoteForEdit(q);
  includeTax.checked=Boolean(q.tax?.enabled)||Number(q.pricing?.tax)>0;
  taxRatePct.value=taxPctDisplay(Number(q.pricing?.taxRatePercent??q.tax?.ratePercent??(s('Tax_Rate')*100)));
};

summary=function(){
  if(!currentQuote)return'';
  let t=`4Zero2 Creations Quote ${currentQuote.id} Rev ${currentQuote.revision||1}\nCustomer: ${currentQuote.customer?.name||''}\n`;
  currentQuote.lines?.forEach(l=>t+=`${l.quantity} × ${l.item} @ $${money(l.unitPrice)} = $${money(l.lineTotal)}\n`);
  const shownTaxPct=currentQuote.pricing?.taxRatePercent??currentQuote.tax?.ratePercent??(s('Tax_Rate')*100);
  t+=`Subtotal: $${money(currentQuote.pricing?.subtotal)}\nBulk discount: ${currentQuote.bulkDiscount?.percent||0}% (-$${money(currentQuote.bulkDiscount?.amount)})\nAdjustment: ${currentQuote.adjustment?.amount||0} ${currentQuote.adjustment?.reason||''}\nSales tax (${taxPctDisplay(shownTaxPct)}%): $${money(currentQuote.pricing?.tax)}\nTotal: $${money(currentQuote.pricing?.total)}`;
  return t;
};
