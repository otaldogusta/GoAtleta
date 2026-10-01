from pathlib import Path
import importlib.util,sys,json,unittest,contextlib,io,os
from unittest.mock import patch
BASE=Path(sys.argv.pop(1)) if len(sys.argv)>1 else Path(os.environ.get('CODEX_HOME', str(Path.home()/'.codex')))/'skills'
def load(name,file):
 spec=importlib.util.spec_from_file_location(name,BASE/file);m=importlib.util.module_from_spec(spec);sys.modules[name]=m;spec.loader.exec_module(m);return m
ci=load('checks','gh-fix-ci/scripts/inspect_pr_checks.py');comments=load('comments','gh-address-comments/scripts/fetch_comments.py')
def conn(nodes,next=False,cursor=None):return {'nodes':nodes,'pageInfo':{'hasNextPage':next,'endCursor':cursor}}
def payload(c,r,t):return {'data':{'repository':{'pullRequest':dict(number=17,url='https://github.com/base/repo/pull/17',title='Fixture',state='OPEN',comments=c,reviews=r,reviewThreads=t)}}}
class Regression(unittest.TestCase):
 def test_failed_and_pending_checks(self):
  for code in [0,1,8]:
   with patch.object(ci,'run_gh_command',return_value=ci.GhResult(code,'[{"name":"test","state":"FAILURE"}]','')): self.assertEqual(len(ci.fetch_checks('17',Path('.'))),1)
 def test_fallback_fields_failed_checks(self):
  with patch.object(ci,'run_gh_command',side_effect=[ci.GhResult(1,'','Unknown JSON field\nAvailable fields:\nname\nstate\nlink'),ci.GhResult(1,'[{"name":"test"}]','')]):self.assertEqual(ci.fetch_checks('17',Path('.')),[{'name':'test'}])
 def test_errors_not_success(self):
  for result in [ci.GhResult(1,'','auth failed'),ci.GhResult(2,'[]','bad'),ci.GhResult(1,'{}','')]:
   with patch.object(ci,'run_gh_command',return_value=result),contextlib.redirect_stderr(io.StringIO()):self.assertIsNone(ci.fetch_checks('17',Path('.')))
 def test_base_repository_for_fork(self):
  with patch.object(comments,'gh_pr_view_json',return_value={'number':17,'url':'https://github.example.com/base/repo/pull/17'}):self.assertEqual(comments.get_current_pr_ref(),('base','repo',17))
 def test_bad_url_rejected(self):
  with patch.object(comments,'gh_pr_view_json',return_value={'number':17,'url':'https://github.com/base/repo/issues/17'}):
   with self.assertRaises(RuntimeError):comments.get_current_pr_ref()
 def test_independent_pagination(self):
  first=payload(conn([{'id':'c1'}]),conn([{'id':'r1'}],True,'r1'),conn([]))
  second=payload(conn([{'id':'c1'}]),conn([{'id':'r2'}]),conn([]))
  with patch.object(comments,'gh_api_graphql',side_effect=[first,second]):result=comments.fetch_all('base','repo',17)
  self.assertEqual(len(result['conversation_comments']),1);self.assertEqual(len(result['reviews']),2)
 def test_nested_thread_pagination(self):
  t={'id':'thread','comments':conn([{'id':'t1'}],True,'page1')}
  with patch.object(comments,'gh_api_graphql',return_value=payload(conn([]),conn([]),conn([t]))),patch.object(comments,'_run_json',return_value={'data':{'node':{'comments':conn([{'id':'t2'}])}}}) as call:
   result=comments.fetch_all('base','repo',17)
  self.assertEqual(len(result['review_threads'][0]['comments']['nodes']),2);self.assertEqual(call.call_count,1)
 def test_graphql_failure(self):
  with patch.object(comments,'gh_api_graphql',return_value={'errors':[{'message':'fixture error'}]}):
   with self.assertRaises(RuntimeError):comments.fetch_all('base','repo',17)
unittest.main()
