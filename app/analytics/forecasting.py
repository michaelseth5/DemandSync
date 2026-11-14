"""XGBoost daily demand forecasts with chronological holdout and model artifacts."""
from __future__ import annotations
from datetime import date,timedelta
from pathlib import Path
import json,os,uuid
import numpy as np
import pandas as pd
from xgboost import XGBRegressor

FEATURES=["dow","month","is_weekend","lag_1","lag_7","rolling_7","rolling_28"]

def daily_frame(rows:list[dict])->pd.DataFrame:
    if not rows: raise ValueError("No transactions for this SKU")
    data=pd.DataFrame(rows)
    data["date"]=pd.to_datetime(data["date"])
    data=data.groupby("date",as_index=False)["quantity"].sum().sort_values("date")
    dates=pd.date_range(data["date"].min(),data["date"].max(),freq="D")
    # Missing dates represent zero sales in this demonstration. Production should validate source coverage.
    return data.set_index("date").reindex(dates,fill_value=0).rename_axis("date").reset_index()

def build_features(df:pd.DataFrame)->pd.DataFrame:
    out=df.copy().sort_values("date")
    out["dow"]=out["date"].dt.dayofweek
    out["month"]=out["date"].dt.month
    out["is_weekend"]=(out["dow"]>=5).astype(int)
    out["lag_1"]=out["quantity"].shift(1)
    out["lag_7"]=out["quantity"].shift(7)
    out["rolling_7"]=out["quantity"].shift(1).rolling(7).mean()
    out["rolling_28"]=out["quantity"].shift(1).rolling(28).mean()
    return out.dropna().reset_index(drop=True)

def metrics(actual,predicted)->dict:
    a=np.asarray(actual,dtype=float);p=np.asarray(predicted,dtype=float)
    if len(a)==0: raise ValueError("Empty evaluation set")
    mae=float(np.mean(np.abs(a-p)))
    nonzero=a!=0
    mape=float(np.mean(np.abs((a[nonzero]-p[nonzero])/a[nonzero]))*100) if nonzero.any() else None
    return {"mae":round(mae,4),"mape":round(mape,4) if mape is not None else None,"evaluated_days":len(a),"excluded_zero_actuals":int((~nonzero).sum())}

def fit_model(rows:list[dict],sku:str,artifact_dir:str="artifacts")->dict:
    frame=build_features(daily_frame(rows))
    if len(frame)<40: raise ValueError("At least 68 consecutive calendar days of history needed")
    split=int(len(frame)*0.8)
    split=min(max(split,28),len(frame)-7)
    train=frame.iloc[:split];test=frame.iloc[split:]
    model=XGBRegressor(n_estimators=120,max_depth=3,learning_rate=0.06,subsample=0.9,colsample_bytree=0.9,random_state=42,n_jobs=1,objective="reg:squarederror")
    model.fit(train[FEATURES],train["quantity"])
    predictions=np.maximum(0,model.predict(test[FEATURES]))
    evaluation=metrics(test["quantity"].to_numpy(),predictions)
    path=Path(artifact_dir);path.mkdir(parents=True,exist_ok=True)
    version=uuid.uuid4().hex
    # Never use user-provided SKU to construct a filesystem path.
    model_path=path/(version+".json")
    model.save_model(str(model_path))
    metadata={"sku":sku,"version":version,"features":FEATURES,"last_train_date":str(train["date"].max().date()),"last_test_date":str(test["date"].max().date()),"metrics":evaluation}
    (path/(version+".meta.json")).write_text(json.dumps(metadata,indent=2))
    return {"model":model,"version":version,"artifact_path":str(model_path),"train_rows":len(train),"test_rows":len(test),**evaluation}

def predict_days(rows:list[dict],model:XGBRegressor,days:int=7)->list[dict]:
    if not 1<=days<=30: raise ValueError("Horizon must be 1–30 days")
    frame=daily_frame(rows)
    predictions=[]
    for _ in range(days):
        next_date=frame["date"].max()+pd.Timedelta(days=1)
        row=pd.concat([frame,pd.DataFrame([{"date":next_date,"quantity":np.nan}])],ignore_index=True)
        features=build_prediction_features(row)
        prediction=max(0,float(model.predict(pd.DataFrame([features],columns=FEATURES))[0]))
        predictions.append({"date":next_date.date().isoformat(),"forecast_qty":round(prediction,2)})
        frame=pd.concat([frame,pd.DataFrame([{"date":next_date,"quantity":prediction}])],ignore_index=True)
    return predictions

def build_prediction_features(frame:pd.DataFrame)->dict:
    observed=frame["quantity"].iloc[:-1].astype(float)
    day=pd.Timestamp(frame["date"].iloc[-1])
    if len(observed)<28: raise ValueError("Need 28 prior days")
    return {"dow":day.dayofweek,"month":day.month,"is_weekend":int(day.dayofweek>=5),"lag_1":float(observed.iloc[-1]),"lag_7":float(observed.iloc[-7]),"rolling_7":float(observed.iloc[-7:].mean()),"rolling_28":float(observed.iloc[-28:].mean())}

def load_model(version:str,artifact_dir:str="artifacts")->XGBRegressor:
    if len(version)!=32 or any(c not in "0123456789abcdef" for c in version):raise ValueError("Invalid version")
    path=Path(artifact_dir)/(version+".json")
    if not path.is_file():raise FileNotFoundError("Model artifact unavailable on this server")
    model=XGBRegressor();model.load_model(str(path));return model
