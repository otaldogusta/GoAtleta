import { videoInitialSideKey } from '../video/VideoInitialSide.web';

test('initial side preference is isolated by account, organization, game and video', () => {
    const base = ['user', 'org', 'game', 'youtube:abcdefghijk'];
    const key = videoInitialSideKey(...base as [string, string, string, string]);
    for (let index = 0; index < base.length; index++) {
        const other = [...base]; other[index] += '-other';
        expect(videoInitialSideKey(...other as [string, string, string, string])).not.toBe(key);
    }
    expect(() => videoInitialSideKey('', 'org', 'game', 'video')).toThrow('incompleto');
    expect(videoInitialSideKey('a:b', 'c', 'd', 'e')).not.toBe(videoInitialSideKey('a', 'b:c', 'd', 'e'));
});
