"""Data quality, inventory and forecast tests; run with python -m pytest."""
from datetime import date,timedelta
import math
import numpy as np
import pandas as pd
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.database import Base
from app.analytics.models import SaleTransaction,DataQualityIssue
from app.analytics.pipeline import ingest,daily_series,quality_summary,TransactionInput
from app.analytics.inventory import recommend
from app.analytics.forecasting import daily_frame,build_features,metrics,build_prediction_features,fit_model,predict_days,load_model

@pytest.fixture
def db():
    engine=create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine,tables=[SaleTransaction.__table__,DataQualityIssue.__table__])
    with sessionmaker(bind=engine)() as session:yield session
    engine.dispose()

def row(i=1,**patch):
    d={"external_id":f"t-{i}","sku":"SKU-1","sold_on":"2025-01-01","quantity":3,"unit_price":4.25,"source":"test"}
    d.update(patch);return d

def test_good_row(db):assert ingest(db,[row()], "batch")["accepted"]==1
def test_duplicate_within_batch(db):assert ingest(db,[row(),row()],"batch")["duplicates"]==1
def test_duplicate_across_batches(db):
    ingest(db,[row()],"a");assert ingest(db,[row()],"b")["duplicates"]==1
def test_reject_zero_qty(db):assert ingest(db,[row(quantity=0)],"b")["rejected"]==1
def test_reject_negative_qty(db):assert ingest(db,[row(quantity=-3)],"b")["rejected"]==1
def test_reject_negative_price(db):assert ingest(db,[row(unit_price=-1)],"b")["rejected"]==1
def test_reject_missing_sku(db):assert ingest(db,[row(sku="")],"b")["rejected"]==1
def test_reject_long_id(db):assert ingest(db,[row(external_id="x"*101)],"b")["rejected"]==1
def test_reject_invalid_date(db):assert ingest(db,[row(sold_on="not-a-date")],"b")["rejected"]==1
def test_reject_extra_fields(db):assert ingest(db,[row(secret="x")],"b")["rejected"]==1
def test_reject_nonfinite_price(db):assert ingest(db,[row(unit_price=float("inf"))],"b")["rejected"]==1
def test_quality_counts(db):
    ingest(db,[row(),row(2,quantity=0)],"batch");assert quality_summary(db)["rejected_rows"]==1
def test_daily_aggregation(db):
    ingest(db,[row(),row(2,quantity=5)],"batch");assert daily_series(db,"SKU-1")[0]["quantity"]==8
def test_daily_other_sku(db):
    ingest(db,[row(),row(2,sku="SKU-2")],"batch");assert len(daily_series(db,"SKU-1"))==1
def test_reorder_no_stock():assert recommend(0,0,2,[10,10])["suggested_order_quantity"]==20
def test_reorder_covered():assert recommend(100,0,2,[10,10])["decision"]=="hold"
def test_reorder_inbound():assert recommend(5,50,2,[10,10])["decision"]=="hold"
def test_reorder_safety_stock():assert recommend(0,0,2,[0,20])["safety_stock"]>0
def test_reorder_negative():
    with pytest.raises(ValueError):recommend(-1,0,2,[10])
def test_reorder_bad_forecast():
    with pytest.raises(ValueError):recommend(0,0,2,[-1])
def test_reorder_empty_forecast():
    with pytest.raises(ValueError):recommend(0,0,2,[])
def test_metrics_exact():assert metrics([10,20],[10,20])["mae"]==0
def test_metrics_mape():assert metrics([10,20],[9,22])["mape"]==10
def test_metrics_zero_actual():assert metrics([0,10],[2,9])["excluded_zero_actuals"]==1
def test_metrics_only_zero():assert metrics([0,0],[1,2])["mape"] is None
def test_metrics_empty():
    with pytest.raises(ValueError):metrics([],[])
def test_no_history():
    with pytest.raises(ValueError):daily_frame([])
def test_missing_day_filled():
    frame=daily_frame([{"date":"2025-01-01","quantity":3},{"date":"2025-01-03","quantity":4}]);assert frame.iloc[1]["quantity"]==0
def test_features_lags():
    frame=daily_frame([{"date":(date(2025,1,1)+timedelta(days=i)).isoformat(),"quantity":i+1} for i in range(40)])
    out=build_features(frame);assert out.iloc[0]["lag_1"]==28
def test_prediction_features_use_previous_only():
    frame=pd.DataFrame({"date":pd.date_range("2025-01-01",periods=30),"quantity":[1]*29+[np.nan]})
    assert build_prediction_features(frame)["lag_1"]==1
def test_training_needs_history(tmp_path):
    with pytest.raises(ValueError):fit_model([{"date":"2025-01-01","quantity":10}],"SKU",str(tmp_path))
def test_training_artifact_and_forecast(tmp_path):
    rows=[{"date":(date(2025,1,1)+timedelta(days=i)).isoformat(),"quantity":max(1,10+i%7)} for i in range(90)]
    result=fit_model(rows,"SKU",str(tmp_path));assert result["test_rows"]>=7
    loaded=load_model(result["version"],str(tmp_path));forecast=predict_days(rows,loaded,7)
    assert len(forecast)==7 and all(p["forecast_qty"]>=0 for p in forecast)
def test_reject_version_path_traversal():
    with pytest.raises(ValueError):load_model("../etc/passwd")
