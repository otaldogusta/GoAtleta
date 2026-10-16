import test from 'node:test';
import assert from 'node:assert/strict';
import {syncRendererResolution} from './renderer-resolution.mjs';

function fakeRenderer(){
 let ratio=1,width=1063,height=704;
 const canvas={width,height},calls=[];
 const renderer={
  getPixelRatio:()=>ratio,
  setPixelRatio(value){ratio=value;calls.push(['density',value]);canvas.width=Math.floor(width*ratio);canvas.height=Math.floor(height*ratio);},
  getSize:target=>target.set(width,height),
  setSize(w,h,updateStyle){width=w;height=h;calls.push(['size',w,h,updateStyle]);canvas.width=Math.floor(width*ratio);canvas.height=Math.floor(height*ratio);},
 };
 return {renderer,canvas,calls};
}

test('a changed display density refreshes the framebuffer even when CSS dimensions stay unchanged',()=>{
 const {renderer,canvas,calls}=fakeRenderer();
 syncRendererResolution(renderer,1063,704,1);
 assert.deepEqual(calls,[]);
 const result=syncRendererResolution(renderer,1063,704,2);
 assert.equal(result.changed,true);
 assert.deepEqual(canvas,{width:2126,height:1408});
 assert.deepEqual(calls,[['density',2]]);
 assert.equal(syncRendererResolution(renderer,1063,704,2).changed,false);
 assert.equal(calls.length,1,'steady frames must not allocate the drawing buffer again');
});

test('fractional container sizes retain physical pixels on resize and high densities remain bounded',()=>{
 const {renderer,canvas,calls}=fakeRenderer();
 syncRendererResolution(renderer,1328.75,880,1.6);
 assert.deepEqual(canvas,{width:2126,height:1408});
 assert.deepEqual(calls.at(-1),['size',1328.75,880,false]);
 syncRendererResolution(renderer,390,844,3);
 assert.deepEqual(canvas,{width:780,height:1688});
 assert.equal(renderer.getPixelRatio(),2);
});
