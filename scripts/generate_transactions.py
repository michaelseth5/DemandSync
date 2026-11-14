"""Generate reproducible SYNTHETIC transactions for local ETL load-testing."""
import argparse,csv,random
from datetime import date,timedelta
from pathlib import Path

def generate(path:str,rows:int=150000,seed:int=42):
    if rows<1:raise ValueError("rows must be positive")
    rng=random.Random(seed)
    start=date(2024,1,1)
    dest=Path(path);dest.parent.mkdir(parents=True,exist_ok=True)
    with dest.open("w",newline="") as handle:
        writer=csv.DictWriter(handle,fieldnames=["external_id","sku","sold_on","quantity","unit_price","source"])
        writer.writeheader()
        for i in range(rows):
            sku=f"DEMO-{i%3+1:03}"
            day=start+timedelta(days=(i//3)%450)
            writer.writerow({"external_id":f"synthetic-{i}","sku":sku,"sold_on":day.isoformat(),"quantity":rng.randint(1,15),"unit_price":round(2+(i%3)*3+rng.random(),2),"source":"synthetic"})
    return rows

if __name__=="__main__":
    parser=argparse.ArgumentParser();parser.add_argument("--rows",type=int,default=150000);parser.add_argument("--output",default="data/synthetic_transactions.csv");args=parser.parse_args()
    print(f"Wrote {generate(args.output,args.rows):,} synthetic rows to {args.output}")
