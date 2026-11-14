"""Local API benchmark; reports observed latency without assuming an improvement."""
import argparse,statistics,time,urllib.request,json
from uuid import uuid4
from datetime import date
def measure(url:str,count:int=30):
    times=[]
    for _ in range(count):
        begin=time.perf_counter()
        with urllib.request.urlopen(url,timeout=15) as r:
            if r.status!=200:raise RuntimeError(r.status)
            r.read()
        times.append((time.perf_counter()-begin)*1000)
    values=sorted(times)
    return {"requests":count,"mean_ms":round(statistics.mean(values),2),"p50_ms":round(statistics.median(values),2),"p95_ms":round(values[max(0,int(count*.95)-1)],2),"min_ms":round(min(values),2),"max_ms":round(max(values),2)}
if __name__=="__main__":
    parser=argparse.ArgumentParser();parser.add_argument("--url",default="http://127.0.0.1:8000/api/v1/analytics/quality");parser.add_argument("--count",type=int,default=30);args=parser.parse_args()
    if not args.url.startswith(("http://127.0.0.1:","http://localhost:")):parser.error("Benchmark only local API URLs")
    if args.count<1 or args.count>10000:parser.error("count must be 1..10000")
    print(json.dumps(measure(args.url,args.count),indent=2))
