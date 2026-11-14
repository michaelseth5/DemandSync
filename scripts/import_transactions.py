"""Stream a CSV file into the same validated ingestion path in manageable batches."""
import argparse,csv
from uuid import uuid4
from app.database import init_db,SessionLocal
import app.analytics.models
from app.analytics.pipeline import ingest

def import_csv(path:str,batch_size:int=1000):
    if batch_size<1 or batch_size>10000:raise ValueError("batch size must be 1..10000")
    init_db();counts={"accepted":0,"duplicates":0,"rejected":0}
    with SessionLocal() as db, open(path,newline="") as source:
        reader=csv.DictReader(source)
        batch=[]
        for raw in reader:
            batch.append(raw)
            if len(batch)==batch_size:
                result=ingest(db,batch,uuid4().hex)
                for k in counts:counts[k]+=result[k]
                batch=[]
        if batch:
            result=ingest(db,batch,uuid4().hex)
            for k in counts:counts[k]+=result[k]
    return counts

if __name__=="__main__":
    parser=argparse.ArgumentParser();parser.add_argument("path");parser.add_argument("--batch-size",type=int,default=1000);args=parser.parse_args()
    print(import_csv(args.path,args.batch_size))
