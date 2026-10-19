import {expect,test} from 'vitest';
import {impactPoint,IMPACT_SOUNDS} from '../../src/presentation-v3/impact.js';
test('cosmetic impact projection stays on the blade without introducing another rule axis',()=>{
 const rect={left:100,top:100,width:1000,height:400};expect(impactPoint(rect,null)).toEqual({x:.58,y:.6});
 expect(impactPoint(rect,{clientX:-50,clientY:900})).toEqual({x:.27,y:.64});expect(impactPoint(rect,{clientX:1800,clientY:0})).toEqual({x:.85,y:.54});
 expect(impactPoint({left:0,top:0,width:0,height:0},{clientX:0,clientY:0})).toEqual({x:.27,y:.54});
});
test('new percussive palette keeps the existing bounded three-source voice budget',()=>{
 for(const sound of Object.values(IMPACT_SOUNDS)){expect(sound.tones).toHaveLength(3);expect(sound.duration).toBeGreaterThan(0);expect(sound.duration).toBeLessThanOrEqual(.4);for(const f of sound.tones){expect(f).toBeGreaterThan(0);expect(f).toBeLessThan(4000);}expect(sound.fall).toBeGreaterThan(0);}
});
