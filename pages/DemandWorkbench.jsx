import { useEffect,useState } from "react";
import { Link } from "react-router-dom";
const base=(import.meta.env.VITE_API_URL||"http://127.0.0.1:8000").replace(/\/$/,"");
async function request(path,options={}) {
 const r=await fetch(base+"/api/v1/analytics"+path,{headers:{"Content-Type":"application/json"},...options});
 const result=await r.json();if(!r.ok) throw new Error(typeof result.detail==="string"?result.detail:JSON.stringify(result.detail||result));return result;
}
const money=n=>new Intl.NumberFormat("en-US",{maximumFractionDigits:0}).format(n);
export default function DemandWorkbench() {
 const [sku,setSku]=useState("DEMO-001");const [quality,setQuality]=useState(null);
 const [forecast,setForecast]=useState(null);const [training,setTraining]=useState(null);
 const [inventory,setInventory]=useState(null);const [message,setMessage]=useState("");
 const [busy,setBusy]=useState(false);const [stock,setStock]=useState(40);const [incoming,setIncoming]=useState(0);const [lead,setLead]=useState(7);
 async function execute(task){setBusy(true);setMessage("");try{await task();}catch(e){setMessage(e.message)}finally{setBusy(false)}}
 const refresh=()=>execute(async()=>setQuality(await request("/quality")));
 useEffect(()=>{request("/quality").then(setQuality).catch(()=>{});},[]);
 const train=()=>execute(async()=>{const r=await request("/models/train/"+encodeURIComponent(sku),{method:"POST"});setTraining(r);setMessage("XGBoost model trained and evaluated on a chronological holdout.");});
 const forecastNow=()=>execute(async()=>{const r=await request("/models/"+encodeURIComponent(sku)+"/forecast?horizon=7");setForecast(r);});
 const plan=()=>execute(async()=>{
  if(!forecast?.forecast?.length)throw new Error("Get a forecast first.");
  const d=await request("/inventory/recommend",{method:"POST",body:JSON.stringify({on_hand:Number(stock),on_order:Number(incoming),lead_time_days:Number(lead),daily_forecast:forecast.forecast.map(p=>p.forecast_qty)})});
  setInventory(d);
 });
 const loadDemo=()=>execute(async()=>{
   // Upload only a small SAMPLE; the bulk generator/CLI handles 150k rows.
   const start=new Date("2025-01-01T00:00:00Z");
   const transactions=Array.from({length:120},(_,i)=>({external_id:"ui-demo-"+sku+"-"+i,sku,sold_on:new Date(start.getTime()+i*86400000).toISOString().slice(0,10),quantity:8+(i%7),unit_price:5+(i%3),source:"synthetic-ui"}));
   const r=await request("/transactions/ingest",{method:"POST",body:JSON.stringify({transactions})});setMessage("Demo import: "+r.accepted+" accepted, "+r.duplicates+" duplicates, "+r.rejected+" rejected.");setQuality(await request("/quality"));
 });
 return <div className="min-h-screen bg-slate-950 px-4 py-10 text-white"><div className="mx-auto max-w-6xl space-y-7">
   <header><Link to="/" className="text-violet-300 hover:underline">← Dashboard</Link><p className="mt-5 text-xs uppercase tracking-widest text-violet-300">DemandSync · Analytics workbench</p><h1 className="text-4xl font-bold">Demand forecasting → inventory decisions</h1><p className="mt-2 text-slate-300">Real API-driven ingestion, XGBoost model runs and procurement calculations. UI sample rows are synthetic.</p></header>
   <section className="grid gap-4 md:grid-cols-3">
     <div className="rounded-xl bg-slate-900 p-5"><p className="text-sm text-slate-400">Accepted transactions</p><p className="text-3xl font-bold">{quality?money(quality.valid_transactions):"—"}</p></div>
     <div className="rounded-xl bg-slate-900 p-5"><p className="text-sm text-slate-400">Rejected transaction rows</p><p className="text-3xl font-bold">{quality?money(quality.rejected_rows):"—"}</p></div>
     <div className="rounded-xl bg-slate-900 p-5"><p className="text-sm text-slate-400">Rejected fraction</p><p className="text-3xl font-bold">{quality?(quality.rejection_rate*100).toFixed(2)+"%":"—"}</p></div>
   </section>
   <section className="rounded-xl bg-slate-900 p-6"><h2 className="text-xl font-semibold">1. Load and inspect demand</h2><div className="mt-4 flex flex-wrap gap-3">
     <label className="text-sm">SKU<input aria-label="SKU" className="mt-1 block rounded bg-slate-800 p-3" value={sku} onChange={e=>setSku(e.target.value)}/></label>
     <button disabled={busy||!sku} onClick={loadDemo} className="self-end rounded bg-violet-600 px-5 py-3 disabled:opacity-50">Load 120 synthetic daily transactions</button>
     <button disabled={busy} onClick={refresh} className="self-end rounded border border-violet-400 px-5 py-3 disabled:opacity-50">Refresh data quality</button>
   </div></section>
   <section className="rounded-xl bg-slate-900 p-6"><h2 className="text-xl font-semibold">2. Train and forecast demand</h2><div className="my-4 flex gap-3"><button disabled={busy||!sku} onClick={train} className="rounded bg-violet-600 px-5 py-3 disabled:opacity-50">Train XGBoost</button><button disabled={busy||!sku} onClick={forecastNow} className="rounded border border-violet-400 px-5 py-3 disabled:opacity-50">Predict next 7 days</button></div>
   {training&&<p className="mb-4 text-sm text-slate-300">Latest model · MAE {training.mae?.toFixed(2)} · MAPE {training.mape===null?"N/A":training.mape?.toFixed(2)+"%"} · Holdout {training.test_rows} days</p>}
   {forecast&&<div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th className="p-2">Date</th><th className="p-2">Predicted units</th></tr></thead><tbody>{forecast.forecast.map(r=><tr key={r.date} className="border-t border-slate-700"><td className="p-2">{r.date}</td><td className="p-2">{r.forecast_qty}</td></tr>)}</tbody></table></div>}
   </section>
   <section className="rounded-xl bg-slate-900 p-6"><h2 className="text-xl font-semibold">3. Generate purchasing recommendation</h2><div className="my-4 grid gap-3 sm:grid-cols-3">
     {[[stock,setStock,"On-hand stock"],[incoming,setIncoming,"Incoming units"],[lead,setLead,"Supplier lead time (days)"]].map(([value,change,label])=><label className="text-sm" key={label}>{label}<input type="number" min={0} value={value} onChange={e=>change(Math.max(0,Number(e.target.value)))} className="mt-1 block w-full rounded bg-slate-800 p-3"/></label>)}
   </div><button disabled={busy||!forecast} onClick={plan} className="rounded bg-violet-600 px-5 py-3 disabled:opacity-50">Calculate reorder quantity</button>
   {inventory&&<div className="mt-5 grid gap-3 sm:grid-cols-3">{[["Suggested order",inventory.suggested_order_quantity],["Reorder point",inventory.reorder_point],["Safety stock",inventory.safety_stock]].map(([label,value])=><div key={label} className="rounded bg-slate-800 p-4"><p className="text-slate-300">{label}</p><strong className="text-2xl">{value}</strong></div>)}</div>}
   </section>
   {message&&<p role="status" className="rounded border border-violet-400 p-3">{message}</p>}
   <p className="text-sm text-slate-400">Demonstration only. Procurement recommendations use a simplified model and are not purchase orders. For model drift checks, dbt models, and bulk ingestion see API docs and the README.</p>
 </div></div>;
}