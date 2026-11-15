"""Compile the bundled CSV snapshots into compressed assets for the browser."""
from pathlib import Path
import gzip
import csv
import json

ROOT=Path(__file__).resolve().parent
METRICS=('likes','comments_count','shares','views','days_since_post')
def rows(path):
    opener=gzip.open if path.suffix=='.gz' else open
    with opener(path,'rt',encoding='utf-8-sig',newline='') as f:
        records=list(csv.DictReader(f))
    for row in records:
        for field in METRICS:
            if field in row:
                row[field]=int(row[field]) if row[field] else None
    return records

def main():
    for mode in ('observed','demo'):
        suffix='.csv.gz' if mode=='demo' else '.csv'
        data={kind:rows(ROOT/'data'/(mode+'_'+kind+suffix)) for kind in ('posts','comments')}
        ids={p['post_id'] for p in data['posts']}
        assert len(ids)==len(data['posts'])
        assert len({c['comment_id'] for c in data['comments']})==len(data['comments'])
        assert all(c['post_id'] in ids for c in data['comments'])
        assert all(r['provenance']==('simulated' if mode=='demo' else 'observed') for table in data.values() for r in table)
        content=json.dumps(data,ensure_ascii=False,separators=(',',':')).encode('utf-8')
        (ROOT/'web'/(mode+'.json.gz')).write_bytes(gzip.compress(content,compresslevel=7,mtime=0))
        print(mode,len(data['posts']),len(data['comments']))
if __name__=='__main__':main()
