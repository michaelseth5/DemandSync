"""Inventory reorder planning with lead-time coverage and safety stock."""
from math import ceil,sqrt
from statistics import mean,pstdev

def recommend(on_hand:int,on_order:int,lead_time_days:int,daily_forecast:list[float],service_z:float=1.65)->dict:
    if on_hand<0 or on_order<0 or lead_time_days<1 or not daily_forecast or not 0<=service_z<=4:
        raise ValueError("Invalid inventory planning inputs")
    if any(v<0 for v in daily_forecast):raise ValueError("Forecast cannot be negative")
    demand=mean(daily_forecast)
    volatility=pstdev(daily_forecast) if len(daily_forecast)>1 else 0
    safety=ceil(service_z*volatility*sqrt(lead_time_days))
    lead_demand=ceil(demand*lead_time_days)
    reorder_point=lead_demand+safety
    position=on_hand+on_order
    suggested=max(0,reorder_point-position)
    return {"avg_daily_demand":round(demand,2),"safety_stock":safety,"lead_time_demand":lead_demand,"reorder_point":reorder_point,"inventory_position":position,"suggested_order_quantity":suggested,"decision":"reorder" if suggested else "hold"}
