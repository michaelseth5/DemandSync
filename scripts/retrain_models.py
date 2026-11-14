"""On-demand or cron-driven XGBoost retraining of all SKUs with enough history."""
import argparse,json
from sqlalchemy import select,distinct
from app.database import SessionLocal,init_db
from app.analytics.models import SaleTransaction,DemandModelRun
from app.analytics.pipeline import daily_series
from app.analytics.forecasting import fit_model

def retrain_all():
    init_db()
    successes=[];skipped=[]
    with SessionLocal() as db:
        skus=db.scalars(select(distinct(SaleTransaction.sku))).all()
        for sku in skus:
            try:
                result=fit_model(daily_series(db,sku),sku)
                run=DemandModelRun(sku=sku,version=result["version"],artifact_path=result["artifact_path"],train_rows=result["train_rows"],test_rows=result["test_rows"],mae=result["mae"],mape=result["mape"])
                db.add(run);db.commit()
                successes.append({"sku":sku,"version":result["version"],"mae":result["mae"],"mape":result["mape"]})
            except ValueError as exc:
                skipped.append({"sku":sku,"reason":str(exc)})
    return {"trained":successes,"skipped":skipped}
if __name__=="__main__":
    print(json.dumps(retrain_all(),indent=2))
