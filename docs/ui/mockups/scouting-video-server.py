from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import os,re,json,tempfile,subprocess,zipfile,shutil
import imageio_ffmpeg
root=Path(__file__).parent
class Handler(SimpleHTTPRequestHandler):
 def __init__(self,*args,**kwargs):super().__init__(*args,directory=str(root),**kwargs)
 def do_POST(self):
  if self.path!='/export':self.send_error(404);return
  if self.headers.get('Origin') not in ('http://localhost:8093','http://127.0.0.1:8093'):self.send_error(403);return
  try:
   length=int(self.headers.get('Content-Length',0))
   if not 0<length<20000:raise ValueError('Invalid request')
   data=json.loads(self.rfile.read(length));source={'full':'full-video.mp4','demo':'video.mp4'}[data['source']];clips=data['clips']
   if not 1<=len(clips)<=100:raise ValueError('Invalid clips')
   limit=910.7 if data['source']=='full' else 30
   for c in clips:
    if not 0<=float(c['start'])<float(c['end'])<=limit+.1:raise ValueError('Invalid interval')
   with tempfile.TemporaryDirectory() as folder:
    outputs=[]
    for i,c in enumerate(clips):
     out=Path(folder)/('rally-%02d.mp4'%int(c.get('number',i+1)));outputs.append(out)
     subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(),'-hide_banner','-loglevel','error','-ss',str(c['start']),'-i',str(root/source),'-t',str(c['end']-c['start']),'-map','0:v:0','-map','0:a?','-c:v','libx264','-preset','ultrafast','-crf','20','-c:a','aac','-movflags','+faststart',str(out)],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE,timeout=180)
    result=outputs[0]
    if data.get('zip'):
     result=Path(folder)/'rallies.zip'
     with zipfile.ZipFile(result,'w',zipfile.ZIP_STORED) as z:
      for out in outputs:z.write(out,out.name)
    self.send_response(200);self.send_header('Content-Type','application/zip' if data.get('zip') else 'video/mp4');self.send_header('Content-Length',str(result.stat().st_size));self.end_headers()
    with result.open('rb') as f:shutil.copyfileobj(f,self.wfile)
  except Exception as e:self.send_error(400,'Export failed')
 def send_head(self):
  path=Path(self.translate_path(self.path))
  if path.is_file() and self.headers.get('Range'):
   size=path.stat().st_size;m=re.fullmatch(r'bytes=(\d+)-(\d*)',self.headers['Range'])
   if m:
    start=int(m[1]);end=min(int(m[2]) if m[2] else size-1,size-1)
    if start> end:self.send_error(416);return None
    self.send_response(206);self.send_header('Content-Type',self.guess_type(str(path)));self.send_header('Accept-Ranges','bytes');self.send_header('Content-Range',f'bytes {start}-{end}/{size}');self.send_header('Content-Length',str(end-start+1));self.end_headers()
    import io
    with path.open('rb') as f:f.seek(start);return io.BytesIO(f.read(end-start+1))
  return super().send_head()
ThreadingHTTPServer(('127.0.0.1',8093),Handler).serve_forever()
