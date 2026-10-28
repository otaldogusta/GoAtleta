import test from 'node:test';
import assert from 'node:assert/strict';
import {bindRendererLifecycle} from './renderer-lifecycle.mjs';

function fixture(){
 const canvas=new EventTarget(),document=Object.assign(new EventTarget(),{hidden:false}),window=new EventTarget(),calls=[];
 const lifecycle=bindRendererLifecycle({canvas,document,window,onSuspend:()=>calls.push('suspend'),onResume:()=>calls.push('redraw')});
 return {canvas,document,window,calls,lifecycle};
}

test('screen lock suspends drawing and requests a redraw on return',()=>{
 const f=fixture();
 f.document.hidden=true;f.document.dispatchEvent(new Event('visibilitychange'));
 assert.equal(f.lifecycle.isSuspended(),true);assert.deepEqual(f.calls,['suspend']);
 f.document.hidden=false;f.document.dispatchEvent(new Event('visibilitychange'));
 assert.equal(f.lifecycle.isSuspended(),false);assert.deepEqual(f.calls,['suspend','redraw']);
});

test('GPU loss is recoverable and only redraws after context restoration',()=>{
 const f=fixture(),lost=new Event('webglcontextlost',{cancelable:true});
 f.canvas.dispatchEvent(lost);
 assert.equal(lost.defaultPrevented,true);assert.equal(f.lifecycle.isSuspended(),true);
 f.document.dispatchEvent(new Event('visibilitychange'));
 assert.deepEqual(f.calls,['suspend']);
 f.canvas.dispatchEvent(new Event('webglcontextrestored'));
 assert.equal(f.lifecycle.isSuspended(),false);assert.deepEqual(f.calls,['suspend','redraw']);
});

test('GPU restoration while hidden waits for a visible page before redrawing',()=>{
 const f=fixture();f.document.hidden=true;
 f.canvas.dispatchEvent(new Event('webglcontextlost',{cancelable:true}));
 f.canvas.dispatchEvent(new Event('webglcontextrestored'));
 assert.deepEqual(f.calls,['suspend']);
 f.document.hidden=false;f.document.dispatchEvent(new Event('visibilitychange'));
 assert.deepEqual(f.calls,['suspend','redraw']);
});

test('BFCache pagehide stays suspended until pageshow and can repeat',()=>{
 const f=fixture();
 for(let i=0;i<3;i++){
  f.window.dispatchEvent(new Event('pagehide'));assert.equal(f.lifecycle.isSuspended(),true);
  f.document.dispatchEvent(new Event('visibilitychange'));assert.equal(f.calls.at(-1),'suspend');
  f.window.dispatchEvent(new Event('pageshow'));assert.equal(f.lifecycle.isSuspended(),false);assert.equal(f.calls.at(-1),'redraw');
 }
 assert.equal(f.calls.length,6);
});

test('disposing removes suspension listeners',()=>{
 const f=fixture();f.lifecycle.dispose();
 f.canvas.dispatchEvent(new Event('webglcontextlost',{cancelable:true}));
 f.canvas.dispatchEvent(new Event('webglcontextrestored'));
 f.window.dispatchEvent(new Event('pagehide'));f.window.dispatchEvent(new Event('pageshow'));
 f.document.dispatchEvent(new Event('visibilitychange'));assert.deepEqual(f.calls,[]);
});
