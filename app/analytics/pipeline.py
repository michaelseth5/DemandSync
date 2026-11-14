"""Validated, idempotent transaction ingestion and daily aggregation."""
from collections import defaultdict
from datetime import date
from decimal import Decimal
from math import isfinite
from sqlalchemy import select, func
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field, ConfigDict
from .models import SaleTransaction, DataQualityIssue

class TransactionInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    external_id: str = Field(min_length=1,max_length=100)
    sku: str = Field(min_length=1,max_length=64)
    sold_on: date
    quantity: int = Field(gt=0,le=1000000)
    unit_price: float = Field(ge=0,le=100000000)
    source: str = Field(default="api",min_length=1,max_length=60)

class BatchInput(BaseModel):
    transactions: list[dict] = Field(min_length=1,max_length=10000)

def ingest(db:Session,raw_rows:list[dict],batch_id:str):
    from pydantic import ValidationError
    accepted=0;duplicates=0;rejected=0;issues=[]
    seen=set()
    ids=[raw.get('external_id') for raw in raw_rows if isinstance(raw,dict) and isinstance(raw.get('external_id'),str)]
    existing=set()
    # Query known identifiers in chunks rather than performing one SELECT per row.
    for start in range(0,len(ids),500):
        existing.update(db.scalars(select(SaleTransaction.external_id).where(SaleTransaction.external_id.in_(ids[start:start+500]))).all())
    pending=[]
    for raw in raw_rows:
        try:
            row=TransactionInput.model_validate(raw)
            if not isfinite(row.unit_price): raise ValueError("non-finite price")
            if row.external_id in seen:
                duplicates+=1;continue
            seen.add(row.external_id)
            if row.external_id in existing:
                duplicates+=1;continue
            pending.append(SaleTransaction(**row.model_dump()))
            accepted+=1
        except (ValidationError,ValueError,TypeError) as exc:
            rejected+=1
            reason=str(exc)[:120]
            external_id=raw.get("external_id") if isinstance(raw,dict) else None
            db.add(DataQualityIssue(batch_id=batch_id,external_id=str(external_id)[:100] if external_id else None,reason=reason))
            issues.append({"row":accepted+duplicates+rejected,"reason":reason})
    db.add_all(pending)
    db.commit()
    return {"batch_id":batch_id,"accepted":accepted,"duplicates":duplicates,"rejected":rejected,"issues":issues[:100]}

def daily_series(db:Session,sku:str):
    stmt=(select(SaleTransaction.sold_on,func.sum(SaleTransaction.quantity))
          .where(SaleTransaction.sku==sku).group_by(SaleTransaction.sold_on).order_by(SaleTransaction.sold_on))
    return [{"date":day,"quantity":int(qty)} for day,qty in db.execute(stmt).all()]

def quality_summary(db:Session):
    total=db.scalar(select(func.count()).select_from(SaleTransaction)) or 0
    rejected=db.scalar(select(func.count()).select_from(DataQualityIssue)) or 0
    return {"valid_transactions":total,"rejected_rows":rejected,"rejection_rate":rejected/(total+rejected) if total+rejected else 0}
