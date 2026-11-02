"""Recover ONLY JSON string scouting records from an isolated physical snapshot.
Requires Google's dfindexeddb in an explicitly supplied local tools directory.
Never points this at a live browser database; no network or source writes.
"""
import argparse,contextlib,io,json,sys,types
from pathlib import Path

def recover(root, tools):
 root=root.resolve(strict=True)
 if not root.name.startswith('recovery-'):raise ValueError('Use an isolated recovery-* directory.')
 sys.path.insert(0,str(tools.resolve(strict=True)))
 import cramjam
 # Windows diagnostic adapter for the same Zstandard decompression API.
 sys.modules['zstd']=types.SimpleNamespace(decompress=lambda data:bytes(cramjam.zstd.decompress(data)))
 from dfindexeddb.indexeddb.chromium import record,v8,blink
 # This adapter accepts only JSON strings, whose encoding is unchanged in v16.
 # Application parsers independently validate the decoded content afterward.
 v8.ValueDeserializer.LATEST_VERSION=16
 reader=record.FolderReader(root/'http_localhost_8081.indexeddb.leveldb')
 latest={}
 with contextlib.redirect_stderr(io.StringIO()):
  for r in reader.GetRecords(use_manifest=True,parse_value=False,include_raw_data=True):
   if isinstance(r.key,record.ObjectStoreDataKey):k=(r.database_id,r.object_store_id,'data',r.key.encoded_user_key.value)
   elif isinstance(r.key,record.BlobEntryKey):k=(r.database_id,r.object_store_id,'blob',r.key.user_key.value)
   else:continue
   if k not in latest or r.sequence_number>latest[k].sequence_number:latest[k]=r
 result=[]
 for (db,store,kind,key),r in latest.items():
  if kind!='data' or not isinstance(key,str) or not key.startswith(('goatleta:scouting-video:', 'goatleta:video-analysis:', 'goatleta:scouting-video-links:')):continue
  if not r.raw_value:continue # deleted record
  value=r.key.ParseValue(r.raw_value)
  decoded=value.value
  if decoded is None and value.blob_offset is not None:
   entry=latest.get((db,store,'blob',key))
   if entry is None:raise ValueError('Missing live blob reference.')
   external=entry.key.ParseValue(entry.raw_value)
   blobs=list(reader.blob_folder_reader.ReadBlobsFromExternalObjectEntries(db,external.entries))
   _,raw=blobs[value.blob_offset]
   if raw is None:raise ValueError('Missing live blob data.')
   decoded=blink.V8ScriptValueDecoder.FromBytes(raw)
  if not isinstance(decoded,str):raise ValueError('Expected JSON string.')
  json.loads(decoded)
  result.append({'key':key,'value':decoded})
 if not result:raise ValueError('No scouting records recovered.')
 return result

if __name__=='__main__':
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--root',required=True,type=Path);p.add_argument('--tools',required=True,type=Path);p.add_argument('--output',required=True,type=Path);a=p.parse_args()
 records=recover(a.root,a.tools)
 with a.output.open('x',encoding='utf8') as f:json.dump(records,f)
 print(json.dumps({'recordsRecovered':len(records),'output':str(a.output)}))

