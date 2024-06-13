/*
日产智联签到
仅QX测试，nodejs，其他自测
2024-06-13
获取Cookie方法 ，QX开重写，进入【日产智联】

======调试区|忽略======
# ^https:\/\/oneapph5\.dongfeng-nissan\.com\.cn\/mb-gw\/dndc-gateway\/community\/api\/v2\/user$ url script-response-body http://192.168.2.170:8080/nissan.js
======调试区|忽略======

====================================
[rewrite_local]
^https:\/\/oneapph5\.dongfeng-nissan\.com\.cn\/mb-gw\/dndc-gateway\/community\/api\/v2\/user$ url script-response-body https://raw.githubusercontent.com/wf021325/qx/master/task/nissan.js

[task_local]
1 0 * * * https://raw.githubusercontent.com/wf021325/qx/master/task/nissan.js, tag= 日产智联签到, enabled=true

[mitm]
hostname = oneapph5.dongfeng-nissan.com.cn
====================================

# 青龙环境变量     nissan_val = `{"token":"xxxxxxxxxxxxx","uuid":"xxxxxxxx"}`
# 手动拼接 nissan_val
在https://oneapph5.dongfeng-nissan.com.cn/mb-gw/dndc-gateway/community/api/v2/user 找到以下参数
# token = $request.headers['token']
# uuid = $response.body.rows['one_id']
 */

const $ = new Env("日产智联签到");
const _key = 'nissan_val';
var CK_Val = $.getdata(_key) || ($.isNode() ? process.env[_key] : '');
let message = '';

!(async () => {
  if (typeof $request != "undefined") {
    getCk();
    return;
  }
  await main();
  console.log(message);//node,青龙日志
  await SendMsg(message);
})().catch((e) => {
  $.log("", `❌失败! 原因: ${e}!`, "");
})
    .finally(() => {
      $.done();
    });

function getCk() {
  if ($request && $request.method != 'OPTIONS') {
    const head = $request.headers;
    const token = head['Token'] || head['token'];
    const uuid = $.toObj($response.body).rows['one_id'];
    if (token) {
      const ckVal = $.toStr({token, uuid});
      $.setdata(ckVal, _key);
      $.msg($.name, '获取ck成功🎉', ckVal);
    } else {
      $.msg($.name, '', '❌获取ck失败');
    }
  }
}

async function main() {
  if (CK_Val) {
    const {token, uuid} = $.toObj(CK_Val);
    $.token = token;
    $.uuid = uuid;
  } else {
    $.msg($.name, '', '❌请先获取ck🎉');
    return;
  }
  intSha();
  //获取最新版本号
  $.appversion = $.toObj((await $.http.get(`https://itunes.apple.com/cn/lookup?id=1341994593`)).body).results[0].version;
  $.log(`最新版本号：${$.appversion}`)

  var {result, msg} = await signIn();//签到
  message += `签到：${msg}\n`;
if (result == 0 || result == 1) {
    var {result, msg, data} = await growthScore();
    message += (result == 1) ? `成长值：${data?.growthScore}\n` : '\n';
  } else {
    return;//签到错误停止运行
  }
  var {result, msg, rows} = await sort_push();//获取帖子
  const find_id = rows.find(item => item.style_type === 'Postings_style');//Postings_style为帖子
  $.push_id = find_id ? find_id?.data.id : null;//帖子id
  $.tittle = find_id?.data['feed_title'];//帖子标题
  if ($.push_id) {
    message += `帖子：${$.tittle}\n`;
    var {result, msg} = await sort_view();//浏览器帖子
    message += `浏览帖子：${msg}\n`;
    var {result, msg} = await sort_like();//点赞
    message += `点赞帖子：${msg}\n`;
    var {result, msg} = await sort_unlike();// 取消点赞
    message += (result == 1) ? '取消点赞：成功\n' : `取消点赞：${msg}\n`;
  } else {
    message += `帖子：${msg}\n`;
  }
}

// 签到
async function signIn() {
  url = `/mb-gw/vmsp-me/ly/busicen/member/reward/pointsreturn/memberPointsRechargetRequestSign`;
  body = `{"requestId":"$$timestamp$$","version":"202304","channel":"1","wechat_trade_type":"APP","token":"${$.token}","uuid":"${$.uuid}"}`;
  return await httpPost(url, body)
}

// 查成长值
async function growthScore() {
  url = `/mb-gw/dfn-growth/rest/ly-mp-growth-service/ly/mgs/growth/growthvalue/medal`;
  body = '{}'
  return await httpPost(url, body)
}

// 推荐帖子
async function sort_push() {
  url = `/mb-gw/dfn-recommend/recommend/info/manager/sort/push`;
  body = `{"volc":{"clientVersion":"${$.appversion}","os":"IOS","channel_id":1,"dt":"iPhone","os_version":"17.0.0","use_volc":1,"device_brand":"Apple"},"advert":{"rows":"10","page":1},"entrance":{"deviceType":"1","appversion":"${$.appversion}"},"recommends":{"page":1}}`;
  return await httpPost(url, body)
}
// 浏览帖子
async function sort_view() {
  url = `/mb-gw/dndc-gateway/community/api/v2/comments?commentable_id=${$.push_id}&commentable_type=feeds&limit=10&page=1&reply_all=0&sort_type=2&use_volc=0`;
  return await httpPost(url)
}

// 点赞
async function sort_like() {
  url = `/mb-gw/dndc-gateway/community/api/v2/feeds/${$.push_id}/like`;
  body = `{"use_volc":false}`;
  return await httpPost(url, body)
}

// 取消点赞
async function sort_unlike() {
  url = `/mb-gw/dndc-gateway/community/api/v2/feeds/${$.push_id}/unlike?use_volc=0`;
  return await httpPost(url, body = '', method = 'delete')
}

async function httpPost(url, body, method) {
  timestamp = Math.floor(Date.now() / 1000);
  url = `https://oneapph5.dongfeng-nissan.com.cn${url}`;
  body = body ? body?.replace('$$timestamp$$', timestamp) : body;
  noncestr = getNonce();
  sign = CryptoJS.SHA512(`nissanapp${timestamp}${$.token}${noncestr}1${$.uuid}`).toString();
  appversion = $.appversion || '3.1.5';
  headers = {
    'User-Agent': `dong feng ri chan/${appversion}} (iPhone; iOS 17.0.0; Scale/2.00)`,
    clientid: 'nissanapp',
    appVersion: appversion,
    appCode: 'nissan',
    appSkin: 'NISSANAPP',
    sign: sign,
    noncestr: noncestr,
    token: $.token,
    timestamp: timestamp,
    Range: 1,
    'From-Type': 4,
    'Content-Type': 'application/json',
    urid: noncestr
  };
  const rest = {url, headers, body, method};
  return await httpRequest(rest);
}

// 无 rest.method => (无rest.body, method为get), (有rest.body, method为post)
// 有 rest.method => (为[get,post], method为本身)，(非[get,post], method为post)
function httpRequest(rest){rest="string"==typeof rest?{url:rest}:rest;const method=rest?.method?(['get','post'].includes(rest.method.toLowerCase())?rest.method.toLowerCase():'post'):rest?.body?'post':'get';return new Promise((resolve,reject)=>{$[method](rest,(error,response,body)=>{if(error){reject(error);}else{try{body=JSON.parse(body);}catch(error){}resolve(body);}});});}

//noncestr
function getNonce(){return Array.from({length:32},(r,n)=>12===n?"4":"0123456789abcdef"[Math.floor(16*Math.random())]).join("").toUpperCase()};

//SHA
function intSha(){var t,n,i,e,r;CryptoJS=function(t,n){var i;if("undefined"!=typeof window&&window.crypto&&(i=window.crypto),"undefined"!=typeof self&&self.crypto&&(i=self.crypto),"undefined"!=typeof globalThis&&globalThis.crypto&&(i=globalThis.crypto),!i&&"undefined"!=typeof window&&window.msCrypto&&(i=window.msCrypto),!i&&"undefined"!=typeof global&&global.crypto&&(i=global.crypto),!i&&"function"==typeof require)try{i=require("crypto")}catch(t){}var e=function(){if(i){if("function"==typeof i.getRandomValues)try{return i.getRandomValues(new Uint32Array(1))[0]}catch(t){}if("function"==typeof i.randomBytes)try{return i.randomBytes(4).readInt32LE()}catch(t){}}throw new Error("Native crypto module could not be used to get secure random number.")},r=Object.create||function(){function t(){}return function(n){var i;return t.prototype=n,i=new t,t.prototype=null,i}}(),o={},s=o.lib={},h=s.Base={extend:function(t){var n=r(this);return t&&n.mixIn(t),n.hasOwnProperty("init")&&this.init!==n.init||(n.init=function(){n.$super.init.apply(this,arguments)}),n.init.prototype=n,n.$super=this,n},create:function(){var t=this.extend();return t.init.apply(t,arguments),t},init:function(){},mixIn:function(t){for(var n in t)t.hasOwnProperty(n)&&(this[n]=t[n]);t.hasOwnProperty("toString")&&(this.toString=t.toString)},clone:function(){return this.init.prototype.extend(this)}},a=s.WordArray=h.extend({init:function(t,n){t=this.words=t||[],this.sigBytes=null!=n?n:4*t.length},toString:function(t){return(t||u).stringify(this)},concat:function(t){var n=this.words,i=t.words,e=this.sigBytes,r=t.sigBytes;if(this.clamp(),e%4)for(var o=0;o<r;o++){var s=i[o>>>2]>>>24-o%4*8&255;n[e+o>>>2]|=s<<24-(e+o)%4*8}else for(var h=0;h<r;h+=4)n[e+h>>>2]=i[h>>>2];return this.sigBytes+=r,this},clamp:function(){var n=this.words,i=this.sigBytes;n[i>>>2]&=4294967295<<32-i%4*8,n.length=t.ceil(i/4)},clone:function(){var t=h.clone.call(this);return t.words=this.words.slice(0),t},random:function(n){var i,r=[],o=function(n){n=n;var i=987654321,e=4294967295;return function(){var r=((i=36969*(65535&i)+(i>>16)&e)<<16)+(n=18e3*(65535&n)+(n>>16)&e)&e;return r/=4294967296,(r+=.5)*(t.random()>.5?1:-1)}},s=!1;try{e(),s=!0}catch(t){}for(var h,c=0;c<n;c+=4)s?r.push(e()):(h=987654071*(i=o(4294967296*(h||t.random())))(),r.push(4294967296*i()|0));return new a.init(r,n)}}),c=o.enc={},u=c.Hex={stringify:function(t){for(var n=t.words,i=t.sigBytes,e=[],r=0;r<i;r++){var o=n[r>>>2]>>>24-r%4*8&255;e.push((o>>>4).toString(16)),e.push((15&o).toString(16))}return e.join("")},parse:function(t){for(var n=t.length,i=[],e=0;e<n;e+=2)i[e>>>3]|=parseInt(t.substr(e,2),16)<<24-e%8*4;return new a.init(i,n/2)}},l=c.Latin1={stringify:function(t){for(var n=t.words,i=t.sigBytes,e=[],r=0;r<i;r++){var o=n[r>>>2]>>>24-r%4*8&255;e.push(String.fromCharCode(o))}return e.join("")},parse:function(t){for(var n=t.length,i=[],e=0;e<n;e++)i[e>>>2]|=(255&t.charCodeAt(e))<<24-e%4*8;return new a.init(i,n)}},f=c.Utf8={stringify:function(t){try{return decodeURIComponent(escape(l.stringify(t)))}catch(t){throw new Error("Malformed UTF-8 data")}},parse:function(t){return l.parse(unescape(encodeURIComponent(t)))}},d=s.BufferedBlockAlgorithm=h.extend({reset:function(){this._data=new a.init,this._nDataBytes=0},_append:function(t){"string"==typeof t&&(t=f.parse(t)),this._data.concat(t),this._nDataBytes+=t.sigBytes},_process:function(n){var i,e=this._data,r=e.words,o=e.sigBytes,s=this.blockSize,h=o/(4*s),c=(h=n?t.ceil(h):t.max((0|h)-this._minBufferSize,0))*s,u=t.min(4*c,o);if(c){for(var l=0;l<c;l+=s)this._doProcessBlock(r,l);i=r.splice(0,c),e.sigBytes-=u}return new a.init(i,u)},clone:function(){var t=h.clone.call(this);return t._data=this._data.clone(),t},_minBufferSize:0}),p=(s.Hasher=d.extend({cfg:h.extend(),init:function(t){this.cfg=this.cfg.extend(t),this.reset()},reset:function(){d.reset.call(this),this._doReset()},update:function(t){return this._append(t),this._process(),this},finalize:function(t){return t&&this._append(t),this._doFinalize()},blockSize:16,_createHelper:function(t){return function(n,i){return new t.init(i).finalize(n)}},_createHmacHelper:function(t){return function(n,i){return new p.HMAC.init(t,i).finalize(n)}}}),o.algo={});return o}(Math),t=CryptoJS,n=t.lib,i=n.Base,e=n.WordArray,(r=t.x64={}).Word=i.extend({init:function(t,n){this.high=t,this.low=n}}),r.WordArray=i.extend({init:function(t,n){t=this.words=t||[],this.sigBytes=null!=n?n:8*t.length},toX32:function(){for(var t=this.words,n=t.length,i=[],r=0;r<n;r++){var o=t[r];i.push(o.high),i.push(o.low)}return e.create(i,this.sigBytes)},clone:function(){for(var t=i.clone.call(this),n=t.words=this.words.slice(0),e=n.length,r=0;r<e;r++)n[r]=n[r].clone();return t}}),function(){var t=CryptoJS,n=t.lib.Hasher,i=t.x64,e=i.Word,r=i.WordArray,o=t.algo;function s(){return e.create.apply(e,arguments)}var h=[s(1116352408,3609767458),s(1899447441,602891725),s(3049323471,3964484399),s(3921009573,2173295548),s(961987163,4081628472),s(1508970993,3053834265),s(2453635748,2937671579),s(2870763221,3664609560),s(3624381080,2734883394),s(310598401,1164996542),s(607225278,1323610764),s(1426881987,3590304994),s(1925078388,4068182383),s(2162078206,991336113),s(2614888103,633803317),s(3248222580,3479774868),s(3835390401,2666613458),s(4022224774,944711139),s(264347078,2341262773),s(604807628,2007800933),s(770255983,1495990901),s(1249150122,1856431235),s(1555081692,3175218132),s(1996064986,2198950837),s(2554220882,3999719339),s(2821834349,766784016),s(2952996808,2566594879),s(3210313671,3203337956),s(3336571891,1034457026),s(3584528711,2466948901),s(113926993,3758326383),s(338241895,168717936),s(666307205,1188179964),s(773529912,1546045734),s(1294757372,1522805485),s(1396182291,2643833823),s(1695183700,2343527390),s(1986661051,1014477480),s(2177026350,1206759142),s(2456956037,344077627),s(2730485921,1290863460),s(2820302411,3158454273),s(3259730800,3505952657),s(3345764771,106217008),s(3516065817,3606008344),s(3600352804,1432725776),s(4094571909,1467031594),s(275423344,851169720),s(430227734,3100823752),s(506948616,1363258195),s(659060556,3750685593),s(883997877,3785050280),s(958139571,3318307427),s(1322822218,3812723403),s(1537002063,2003034995),s(1747873779,3602036899),s(1955562222,1575990012),s(2024104815,1125592928),s(2227730452,2716904306),s(2361852424,442776044),s(2428436474,593698344),s(2756734187,3733110249),s(3204031479,2999351573),s(3329325298,3815920427),s(3391569614,3928383900),s(3515267271,566280711),s(3940187606,3454069534),s(4118630271,4000239992),s(116418474,1914138554),s(174292421,2731055270),s(289380356,3203993006),s(460393269,320620315),s(685471733,587496836),s(852142971,1086792851),s(1017036298,365543100),s(1126000580,2618297676),s(1288033470,3409855158),s(1501505948,4234509866),s(1607167915,987167468),s(1816402316,1246189591)],a=[];!function(){for(var t=0;t<80;t++)a[t]=s()}();var c=o.SHA512=n.extend({_doReset:function(){this._hash=new r.init([new e.init(1779033703,4089235720),new e.init(3144134277,2227873595),new e.init(1013904242,4271175723),new e.init(2773480762,1595750129),new e.init(1359893119,2917565137),new e.init(2600822924,725511199),new e.init(528734635,4215389547),new e.init(1541459225,327033209)])},_doProcessBlock:function(t,n){for(var i=this._hash.words,e=i[0],r=i[1],o=i[2],s=i[3],c=i[4],u=i[5],l=i[6],f=i[7],d=e.high,p=e.low,w=r.high,g=r.low,y=o.high,v=o.low,_=s.high,m=s.low,B=c.high,S=c.low,x=u.high,b=u.low,H=l.high,C=l.low,A=f.high,z=f.low,k=d,I=p,R=w,W=g,P=y,U=v,J=_,M=m,O=B,T=S,j=x,D=b,E=H,F=C,q=A,L=z,V=0;V<80;V++){var X=a[V];if(V<16)var $=X.high=0|t[n+2*V],N=X.low=0|t[n+2*V+1];else{var G=a[V-15],K=G.high,Q=G.low,Y=(K>>>1|Q<<31)^(K>>>8|Q<<24)^K>>>7,Z=(Q>>>1|K<<31)^(Q>>>8|K<<24)^(Q>>>7|K<<25),tt=a[V-2],nt=tt.high,it=tt.low,et=(nt>>>19|it<<13)^(nt<<3|it>>>29)^nt>>>6,rt=(it>>>19|nt<<13)^(it<<3|nt>>>29)^(it>>>6|nt<<26),ot=a[V-7],st=ot.high,ht=ot.low,at=a[V-16],ct=at.high,ut=at.low;$=($=($=Y+st+((N=Z+ht)>>>0<Z>>>0?1:0))+et+((N+=rt)>>>0<rt>>>0?1:0))+ct+((N+=ut)>>>0<ut>>>0?1:0),X.high=$,X.low=N}var lt,ft=O&j^~O&E,dt=T&D^~T&F,pt=k&R^k&P^R&P,wt=I&W^I&U^W&U,gt=(k>>>28|I<<4)^(k<<30|I>>>2)^(k<<25|I>>>7),yt=(I>>>28|k<<4)^(I<<30|k>>>2)^(I<<25|k>>>7),vt=(O>>>14|T<<18)^(O>>>18|T<<14)^(O<<23|T>>>9),_t=(T>>>14|O<<18)^(T>>>18|O<<14)^(T<<23|O>>>9),mt=h[V],Bt=mt.high,St=mt.low,xt=q+vt+((lt=L+_t)>>>0<L>>>0?1:0),bt=yt+wt;q=E,L=F,E=j,F=D,j=O,D=T,O=J+(xt=(xt=(xt=xt+ft+((lt+=dt)>>>0<dt>>>0?1:0))+Bt+((lt+=St)>>>0<St>>>0?1:0))+$+((lt+=N)>>>0<N>>>0?1:0))+((T=M+lt|0)>>>0<M>>>0?1:0)|0,J=P,M=U,P=R,U=W,R=k,W=I,k=xt+(gt+pt+(bt>>>0<yt>>>0?1:0))+((I=lt+bt|0)>>>0<lt>>>0?1:0)|0}p=e.low=p+I,e.high=d+k+(p>>>0<I>>>0?1:0),g=r.low=g+W,r.high=w+R+(g>>>0<W>>>0?1:0),v=o.low=v+U,o.high=y+P+(v>>>0<U>>>0?1:0),m=s.low=m+M,s.high=_+J+(m>>>0<M>>>0?1:0),S=c.low=S+T,c.high=B+O+(S>>>0<T>>>0?1:0),b=u.low=b+D,u.high=x+j+(b>>>0<D>>>0?1:0),C=l.low=C+F,l.high=H+E+(C>>>0<F>>>0?1:0),z=f.low=z+L,f.high=A+q+(z>>>0<L>>>0?1:0)},_doFinalize:function(){var t=this._data,n=t.words,i=8*this._nDataBytes,e=8*t.sigBytes;return n[e>>>5]|=128<<24-e%32,n[30+(e+128>>>10<<5)]=Math.floor(i/4294967296),n[31+(e+128>>>10<<5)]=i,t.sigBytes=4*n.length,this._process(),this._hash.toX32()},clone:function(){var t=n.clone.call(this);return t._hash=this._hash.clone(),t},blockSize:32});t.SHA512=n._createHelper(c),t.HmacSHA512=n._createHmacHelper(c)}()};

//通知
async function SendMsg(message){$.isNode()?await notify.sendNotify($.name,message):$.msg($.name,"",message);}

//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ENV
function Env(t,e){class s{constructor(t){this.env=t}send(t,e="GET"){t="string"==typeof t?{url:t}:t;let s=this.get;return"POST"===e&&(s=this.post),new Promise((e,a)=>{s.call(this,t,(t,s,r)=>{t?a(t):e(s)})})}get(t){return this.send.call(this.env,t)}post(t){return this.send.call(this.env,t,"POST")}}return new class{constructor(t,e){this.name=t,this.http=new s(this),this.data=null,this.dataFile="box.dat",this.logs=[],this.isMute=!1,this.isNeedRewrite=!1,this.logSeparator="\n",this.encoding="utf-8",this.startTime=(new Date).getTime(),Object.assign(this,e),this.log("",`🔔${this.name}, 开始!`)}getEnv(){return"undefined"!=typeof $environment&&$environment["surge-version"]?"Surge":"undefined"!=typeof $environment&&$environment["stash-version"]?"Stash":"undefined"!=typeof module&&module.exports?"Node.js":"undefined"!=typeof $task?"Quantumult X":"undefined"!=typeof $loon?"Loon":"undefined"!=typeof $rocket?"Shadowrocket":void 0}isNode(){return"Node.js"===this.getEnv()}isQuanX(){return"Quantumult X"===this.getEnv()}isSurge(){return"Surge"===this.getEnv()}isLoon(){return"Loon"===this.getEnv()}isShadowrocket(){return"Shadowrocket"===this.getEnv()}isStash(){return"Stash"===this.getEnv()}toObj(t,e=null){try{return JSON.parse(t)}catch{return e}}toStr(t,e=null){try{return JSON.stringify(t)}catch{return e}}getjson(t,e){let s=e;const a=this.getdata(t);if(a)try{s=JSON.parse(this.getdata(t))}catch{}return s}setjson(t,e){try{return this.setdata(JSON.stringify(t),e)}catch{return!1}}getScript(t){return new Promise(e=>{this.get({url:t},(t,s,a)=>e(a))})}runScript(t,e){return new Promise(s=>{let a=this.getdata("@chavy_boxjs_userCfgs.httpapi");a=a?a.replace(/\n/g,"").trim():a;let r=this.getdata("@chavy_boxjs_userCfgs.httpapi_timeout");r=r?1*r:20,r=e&&e.timeout?e.timeout:r;const[i,o]=a.split("@"),n={url:`http://${o}/v1/scripting/evaluate`,body:{script_text:t,mock_type:"cron",timeout:r},headers:{"X-Key":i,Accept:"*/*"},timeout:r};this.post(n,(t,e,a)=>s(a))}).catch(t=>this.logErr(t))}loaddata(){if(!this.isNode())return{};{this.fs=this.fs?this.fs:require("fs"),this.path=this.path?this.path:require("path");const t=this.path.resolve(this.dataFile),e=this.path.resolve(process.cwd(),this.dataFile),s=this.fs.existsSync(t),a=!s&&this.fs.existsSync(e);if(!s&&!a)return{};{const a=s?t:e;try{return JSON.parse(this.fs.readFileSync(a))}catch(t){return{}}}}}writedata(){if(this.isNode()){this.fs=this.fs?this.fs:require("fs"),this.path=this.path?this.path:require("path");const t=this.path.resolve(this.dataFile),e=this.path.resolve(process.cwd(),this.dataFile),s=this.fs.existsSync(t),a=!s&&this.fs.existsSync(e),r=JSON.stringify(this.data);s?this.fs.writeFileSync(t,r):a?this.fs.writeFileSync(e,r):this.fs.writeFileSync(t,r)}}lodash_get(t,e,s){const a=e.replace(/\[(\d+)\]/g,".$1").split(".");let r=t;for(const t of a)if(r=Object(r)[t],void 0===r)return s;return r}lodash_set(t,e,s){return Object(t)!==t?t:(Array.isArray(e)||(e=e.toString().match(/[^.[\]]+/g)||[]),e.slice(0,-1).reduce((t,s,a)=>Object(t[s])===t[s]?t[s]:t[s]=Math.abs(e[a+1])>>0==+e[a+1]?[]:{},t)[e[e.length-1]]=s,t)}getdata(t){let e=this.getval(t);if(/^@/.test(t)){const[,s,a]=/^@(.*?)\.(.*?)$/.exec(t),r=s?this.getval(s):"";if(r)try{const t=JSON.parse(r);e=t?this.lodash_get(t,a,""):e}catch(t){e=""}}return e}setdata(t,e){let s=!1;if(/^@/.test(e)){const[,a,r]=/^@(.*?)\.(.*?)$/.exec(e),i=this.getval(a),o=a?"null"===i?null:i||"{}":"{}";try{const e=JSON.parse(o);this.lodash_set(e,r,t),s=this.setval(JSON.stringify(e),a)}catch(e){const i={};this.lodash_set(i,r,t),s=this.setval(JSON.stringify(i),a)}}else s=this.setval(t,e);return s}getval(t){switch(this.getEnv()){case"Surge":case"Loon":case"Stash":case"Shadowrocket":return $persistentStore.read(t);case"Quantumult X":return $prefs.valueForKey(t);case"Node.js":return this.data=this.loaddata(),this.data[t];default:return this.data&&this.data[t]||null}}setval(t,e){switch(this.getEnv()){case"Surge":case"Loon":case"Stash":case"Shadowrocket":return $persistentStore.write(t,e);case"Quantumult X":return $prefs.setValueForKey(t,e);case"Node.js":return this.data=this.loaddata(),this.data[e]=t,this.writedata(),!0;default:return this.data&&this.data[e]||null}}initGotEnv(t){this.got=this.got?this.got:require("got"),this.cktough=this.cktough?this.cktough:require("tough-cookie"),this.ckjar=this.ckjar?this.ckjar:new this.cktough.CookieJar,t&&(t.headers=t.headers?t.headers:{},void 0===t.headers.Cookie&&void 0===t.cookieJar&&(t.cookieJar=this.ckjar))}get(t,e=(()=>{})){switch(t.headers&&(delete t.headers["Content-Type"],delete t.headers["Content-Length"],delete t.headers["content-type"],delete t.headers["content-length"]),t.params&&(t.url+="?"+this.queryStr(t.params)),this.getEnv()){case"Surge":case"Loon":case"Stash":case"Shadowrocket":default:this.isSurge()&&this.isNeedRewrite&&(t.headers=t.headers||{},Object.assign(t.headers,{"X-Surge-Skip-Scripting":!1})),$httpClient.get(t,(t,s,a)=>{!t&&s&&(s.body=a,s.statusCode=s.status?s.status:s.statusCode,s.status=s.statusCode),e(t,s,a)});break;case"Quantumult X":this.isNeedRewrite&&(t.opts=t.opts||{},Object.assign(t.opts,{hints:!1})),$task.fetch(t).then(t=>{const{statusCode:s,statusCode:a,headers:r,body:i,bodyBytes:o}=t;e(null,{status:s,statusCode:a,headers:r,body:i,bodyBytes:o},i,o)},t=>e(t&&t.error||"UndefinedError"));break;case"Node.js":let s=require("iconv-lite");this.initGotEnv(t),this.got(t).on("redirect",(t,e)=>{try{if(t.headers["set-cookie"]){const s=t.headers["set-cookie"].map(this.cktough.Cookie.parse).toString();s&&this.ckjar.setCookieSync(s,null),e.cookieJar=this.ckjar}}catch(t){this.logErr(t)}}).then(t=>{const{statusCode:a,statusCode:r,headers:i,rawBody:o}=t,n=s.decode(o,this.encoding);e(null,{status:a,statusCode:r,headers:i,rawBody:o,body:n},n)},t=>{const{message:a,response:r}=t;e(a,r,r&&s.decode(r.rawBody,this.encoding))})}}post(t,e=(()=>{})){const s=t.method?t.method.toLocaleLowerCase():"post";switch(t.body&&t.headers&&!t.headers["Content-Type"]&&!t.headers["content-type"]&&(t.headers["content-type"]="application/x-www-form-urlencoded"),t.headers&&(delete t.headers["Content-Length"],delete t.headers["content-length"]),this.getEnv()){case"Surge":case"Loon":case"Stash":case"Shadowrocket":default:this.isSurge()&&this.isNeedRewrite&&(t.headers=t.headers||{},Object.assign(t.headers,{"X-Surge-Skip-Scripting":!1})),$httpClient[s](t,(t,s,a)=>{!t&&s&&(s.body=a,s.statusCode=s.status?s.status:s.statusCode,s.status=s.statusCode),e(t,s,a)});break;case"Quantumult X":t.method=s,this.isNeedRewrite&&(t.opts=t.opts||{},Object.assign(t.opts,{hints:!1})),$task.fetch(t).then(t=>{const{statusCode:s,statusCode:a,headers:r,body:i,bodyBytes:o}=t;e(null,{status:s,statusCode:a,headers:r,body:i,bodyBytes:o},i,o)},t=>e(t&&t.error||"UndefinedError"));break;case"Node.js":let a=require("iconv-lite");this.initGotEnv(t);const{url:r,...i}=t;this.got[s](r,i).then(t=>{const{statusCode:s,statusCode:r,headers:i,rawBody:o}=t,n=a.decode(o,this.encoding);e(null,{status:s,statusCode:r,headers:i,rawBody:o,body:n},n)},t=>{const{message:s,response:r}=t;e(s,r,r&&a.decode(r.rawBody,this.encoding))})}}time(t,e=null){const s=e?new Date(e):new Date;let a={"M+":s.getMonth()+1,"d+":s.getDate(),"H+":s.getHours(),"m+":s.getMinutes(),"s+":s.getSeconds(),"q+":Math.floor((s.getMonth()+3)/3),S:s.getMilliseconds()};/(y+)/.test(t)&&(t=t.replace(RegExp.$1,(s.getFullYear()+"").substr(4-RegExp.$1.length)));for(let e in a)new RegExp("("+e+")").test(t)&&(t=t.replace(RegExp.$1,1==RegExp.$1.length?a[e]:("00"+a[e]).substr((""+a[e]).length)));return t}queryStr(t){let e="";for(const s in t){let a=t[s];null!=a&&""!==a&&("object"==typeof a&&(a=JSON.stringify(a)),e+=`${s}=${a}&`)}return e=e.substring(0,e.length-1),e}msg(e=t,s="",a="",r){const i=t=>{switch(typeof t){case void 0:return t;case"string":switch(this.getEnv()){case"Surge":case"Stash":default:return{url:t};case"Loon":case"Shadowrocket":return t;case"Quantumult X":return{"open-url":t};case"Node.js":return}case"object":switch(this.getEnv()){case"Surge":case"Stash":case"Shadowrocket":default:{let e=t.url||t.openUrl||t["open-url"];return{url:e}}case"Loon":{let e=t.openUrl||t.url||t["open-url"],s=t.mediaUrl||t["media-url"];return{openUrl:e,mediaUrl:s}}case"Quantumult X":{let e=t["open-url"]||t.url||t.openUrl,s=t["media-url"]||t.mediaUrl,a=t["update-pasteboard"]||t.updatePasteboard;return{"open-url":e,"media-url":s,"update-pasteboard":a}}case"Node.js":return}default:return}};if(!this.isMute)switch(this.getEnv()){case"Surge":case"Loon":case"Stash":case"Shadowrocket":default:$notification.post(e,s,a,i(r));break;case"Quantumult X":$notify(e,s,a,i(r));break;case"Node.js":}if(!this.isMuteLog){let t=["","==============📣系统通知📣=============="];t.push(e),s&&t.push(s),a&&t.push(a),console.log(t.join("\n")),this.logs=this.logs.concat(t)}}log(...t){t.length>0&&(this.logs=[...this.logs,...t]),console.log(t.join(this.logSeparator))}logErr(t,e){switch(this.getEnv()){case"Surge":case"Loon":case"Stash":case"Shadowrocket":case"Quantumult X":default:this.log("",`❗️${this.name}, 错误!`,t);break;case"Node.js":this.log("",`❗️${this.name}, 错误!`,t.stack)}}wait(t){return new Promise(e=>setTimeout(e,t))}done(t={}){const e=(new Date).getTime(),s=(e-this.startTime)/1e3;switch(this.log("",`🔔${this.name}, 结束! 🕛 ${s} 秒`),this.log(),this.getEnv()){case"Surge":case"Loon":case"Stash":case"Shadowrocket":case"Quantumult X":default:$done(t);break;case"Node.js":process.exit(1)}}}(t,e)}