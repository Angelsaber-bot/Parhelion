/** Honest recovery guidance: a missing graphics context is not a network/download failure. */
export function worldBootFailure(message:string):[string,string]{
 if(/WebGL|graphics context/i.test(message))return[
  '当前浏览器无法创建 WebGL 2 图形上下文。请使用支持 WebGL 2 的浏览器与图形环境；重置游戏进度不会解决此问题。',
  'This browser cannot create a WebGL 2 graphics context. Use a browser and graphics environment with WebGL 2 support. Resetting game progress will not fix this.',
 ];
 return [`地图加载失败：${message}。请检查网络后重试。`,`World loading failed: ${message}. Check the connection and retry.`];
}
