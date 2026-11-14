"""Documented ETL, forecasting, inventory, and monitoring REST endpoints."""
from __future__ import annotations
from datetime import date
from pathlib import Path
from uuid import uuid4
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel,Field
from sqlalchemy import select,func
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.analytics.models import SaleTransaction, DataQualityIssue, DemandModelRun
from app.analytics.pipeline import BatchInput,ingest,daily_series,quality_summary
from app.analytics.forecasting import fit_model,predict_days,load_model,metrics
from app.analytics.inventory import recommend
from app import models as domain_models

router=APIRouter(prefix="/analytics",tags=["transaction analytics"])
def get_db():
    db=SessionLocal()
    try:yield db
    finally:db.close()

class ReorderRequest(BaseModel):
    on_hand:int=Field(ge=0)
    on_order:int=Field(default=0,ge=0)
    lead_time_days:int=Field(ge=1,le=365)
    daily_forecast:list[float]=Field(min_length=1,max_length=365)
    service_z:float=Field(default=1.65,ge=0,le=4)

class DriftRequest(BaseModel):
    actual:list[float]=Field(min_length=1,max_length=365)
    predicted:list[float]=Field(min_length=1,max_length=365)
    baseline_mae:float=Field(gt=0)
    threshold:float=Field(default=1.25,ge=1,le=10)

@router.post("/transactions/ingest",status_code=201)
def ingest_transactions(payload:BatchInput,db:Session=Depends(get_db)):
    return ingest(db,payload.transactions,uuid4().hex)

@router.get("/transactions")
def transactions(sku:str|None=None,limit:int=Query(100,ge=1,le=1000),offset:int=Query(0,ge=0),db:Session=Depends(get_db)):
    query=select(SaleTransaction).order_by(SaleTransaction.sold_on.desc(),SaleTransaction.id.desc())
    if sku:query=query.where(SaleTransaction.sku==sku)
    values=db.scalars(query.offset(offset).limit(limit)).all()
    return [{"external_id":r.external_id,"sku":r.sku,"sold_on":r.sold_on,"quantity":r.quantity,"unit_price":r.unit_price} for r in values]

@router.get("/quality")
def quality(db:Session=Depends(get_db)):
    return quality_summary(db)

@router.get("/daily-demand/{sku}")
def daily_demand(sku:str,db:Session=Depends(get_db)):
    return daily_series(db,sku)

@router.post("/models/train/{sku}")
def train(sku:str,db:Session=Depends(get_db)):
    try:output=fit_model(daily_series(db,sku),sku)
    except ValueError as exc:raise HTTPException(422,str(exc)) from exc
    run=DemandModelRun(sku=sku,version=output["version"],artifact_path=output["artifact_path"],train_rows=output["train_rows"],test_rows=output["test_rows"],mae=output["mae"],mape=output["mape"])
    db.add(run);db.commit()
    return {k:v for k,v in output.items() if k!="model"}

@router.get("/models/{sku}/forecast")
def forecast(sku:str,horizon:int=Query(7,ge=1,le=30),db:Session=Depends(get_db)):
    run=db.scalar(select(DemandModelRun).where(DemandModelRun.sku==sku).order_by(DemandModelRun.id.desc()))
    if run is None:raise HTTPException(404,"Train a model for this SKU first")
    try:values=predict_days(daily_series(db,sku),load_model(run.version),horizon)
    except (ValueError,FileNotFoundError) as exc:raise HTTPException(409,str(exc)) from exc
    return {"sku":sku,"version":run.version,"horizon_days":horizon,"forecast":values,"evaluation_mape":run.mape,"evaluation_mae":run.mae}

@router.post("/inventory/recommend")
def inventory_recommendation(payload:ReorderRequest):
    return recommend(**payload.model_dump())

@router.get("/inventory/sku/{sku}/recommend")
def recommend_for_sku(sku:str,db:Session=Depends(get_db)):
    product=db.scalar(select(domain_models.Product).where(domain_models.Product.sku==sku))
    if product is None:raise HTTPException(404,"Product SKU not in catalog")
    run=db.scalar(select(DemandModelRun).where(DemandModelRun.sku==sku).order_by(DemandModelRun.id.desc()))
    if run is None:raise HTTPException(404,"Train a demand model for this SKU first")
    on_hand=db.scalar(select(func.coalesce(func.sum(domain_models.InventoryLog.qty_change),0)).where(domain_models.InventoryLog.product_id==product.id)) or 0
    ordered=db.scalar(select(func.coalesce(func.sum(domain_models.OrderItem.qty),0)).join(domain_models.Order,domain_models.Order.id==domain_models.OrderItem.order_id).where(domain_models.OrderItem.product_id==product.id,domain_models.Order.status.in_(["placed","approved","in_transit"]))) or 0
    lead=product.supplier.lead_time_days if product.supplier else 7
    try:
        fc=predict_days(daily_series(db,sku),load_model(run.version),max(7,min(int(lead),30)))
        planning=recommend(max(0,int(on_hand)),int(ordered),max(1,int(lead)),[v["forecast_qty"] for v in fc])
    except (ValueError,FileNotFoundError) as exc:raise HTTPException(409,str(exc)) from exc
    return {"sku":sku,"product_id":product.id,"model_version":run.version,"observed_on_hand":int(on_hand),"incoming_order_quantity":int(ordered),"lead_time_days":int(lead),**planning}

class DraftOrderRequest(BaseModel):
    unit_cost:float=Field(gt=0)

@router.post("/inventory/sku/{sku}/draft-order",status_code=201)
def create_draft_order(sku:str,payload:DraftOrderRequest,db:Session=Depends(get_db)):
    plan=recommend_for_sku(sku,db)
    if plan["suggested_order_quantity"]<=0:raise HTTPException(409,"Inventory covers forecast: no reorder indicated")
    product=db.get(domain_models.Product,plan["product_id"])
    if not product or not product.supplier_id:raise HTTPException(422,"Product requires assigned supplier")
    # Draft only; procurement must review and approve before placing.
    order=domain_models.Order(supplier_id=product.supplier_id,status="draft")
    order.items.append(domain_models.OrderItem(product_id=product.id,qty=plan["suggested_order_quantity"],unit_cost=payload.unit_cost))
    db.add(order);db.commit();db.refresh(order)
    return {"order_id":order.id,"status":"draft","sku":sku,"quantity":plan["suggested_order_quantity"],"supplier_id":order.supplier_id}

@router.post("/models/drift")
def model_drift(payload:DriftRequest):
    if len(payload.actual)!=len(payload.predicted):raise HTTPException(422,"actual and predicted must have equal length")
    values=metrics(payload.actual,payload.predicted)
    ratio=values["mae"]/payload.baseline_mae
    return {**values,"baseline_mae":payload.baseline_mae,"drift_ratio":round(ratio,4),"drift_detected":ratio>payload.threshold,"retrain_recommended":ratio>payload.threshold}

@router.get("/models/runs/{sku}")
def model_runs(sku:str,db:Session=Depends(get_db)):
    rows=db.scalars(select(DemandModelRun).where(DemandModelRun.sku==sku).order_by(DemandModelRun.id.desc()).limit(25)).all()
    return [{"version":r.version,"trained_at":r.trained_at,"train_rows":r.train_rows,"test_rows":r.test_rows,"mape":r.mape,"mae":r.mae} for r in rows]
