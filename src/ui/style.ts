export const CSS = /* css */ `
:root{--acc:#e8a74a;--acc2:#f3c77a;--ink:#f1ece2;--mut:#b8ad9c;--bg:rgba(14,12,10,.8);--line:rgba(241,236,226,.14);--red:#e0523e;--blu:#6fb3e8;--grn:#8fcf7a}
*{box-sizing:border-box}
html,body{margin:0;height:100%;background:#000;overflow:hidden;font-family:"Segoe UI","Roboto","Helvetica Neue",Arial,sans-serif;color:var(--ink);user-select:none;-webkit-user-select:none}
canvas{display:block}
#ui{position:fixed;inset:0;pointer-events:none;z-index:5}
#ui .layer{position:absolute;inset:0}
.hidden{display:none!important}
#loading{background:radial-gradient(ellipse at 30% 60%,#3a2716 0%,#140e09 60%,#070504 100%);display:flex;flex-direction:column;align-items:flex-start;justify-content:flex-end;padding:7vh 8vw;pointer-events:auto;z-index:20}
#loading .logo{margin-bottom:auto;margin-top:18vh}
.logo .t1{font-size:clamp(34px,5.2vw,90px);font-weight:200;letter-spacing:.24em;line-height:1;color:#f4ead8;text-shadow:0 2px 30px rgba(232,167,74,.25);white-space:nowrap}
.logo .t1 b{font-weight:700;color:var(--acc)}
.logo .t2{margin-top:14px;font-size:clamp(12px,1.2vw,16px);letter-spacing:.6em;color:var(--mut);text-transform:uppercase}
#loading .bar{width:min(520px,70vw);height:3px;background:rgba(255,255,255,.08);border-radius:2px;overflow:hidden;margin-top:16px}
#loading .bar i{display:block;height:100%;width:0;background:linear-gradient(90deg,var(--acc),var(--acc2));transition:width .25s}
#loading .lbl{font-size:13px;letter-spacing:.2em;color:var(--mut);text-transform:uppercase}
#loading .go{margin-top:22px;font-size:14px;letter-spacing:.32em;text-transform:uppercase;color:var(--acc2);animation:pulse 1.8s ease-in-out infinite}
#loading.fade{transition:opacity .8s;opacity:0}
#loading .tip{margin-top:26px;max-width:620px;font-size:15px;color:#d8cdbb;line-height:1.5;opacity:.85}
.menu{pointer-events:auto;background:linear-gradient(90deg,rgba(10,8,6,.86) 0%,rgba(10,8,6,.55) 38%,rgba(10,8,6,0) 70%);display:flex;flex-direction:column;justify-content:center;padding:0 8vw}
.menu .logo{margin-bottom:6vh}
.menu .items{display:flex;flex-direction:column;gap:4px;align-items:flex-start}
.mbtn{position:relative;background:none;border:0;color:var(--ink);font:inherit;font-size:clamp(17px,1.6vw,22px);letter-spacing:.18em;text-transform:uppercase;padding:10px 0;cursor:pointer;transition:color .2s,padding .25s,opacity .2s;text-align:left;opacity:.86}
.mbtn::before{content:"";position:absolute;left:-22px;top:50%;width:0;height:2px;background:var(--acc);transition:width .25s;transform:translateY(-50%)}
.mbtn:hover{color:#fff;padding-left:14px;opacity:1}
.mbtn:hover::before{width:24px}
.mbtn[disabled]{opacity:.3;pointer-events:none}
.mbtn small{display:block;font-size:11px;letter-spacing:.14em;color:var(--mut);text-transform:none;margin-top:2px}
.menu .foot{position:absolute;bottom:4vh;left:8vw;font-size:12px;color:var(--mut);letter-spacing:.12em}
.menu .foot b{color:var(--acc)}
.overlay{pointer-events:auto;background:rgba(6,5,4,.62);backdrop-filter:blur(3px);display:flex;align-items:center;justify-content:center}
.panel{background:var(--bg);border:1px solid var(--line);border-radius:10px;box-shadow:0 30px 80px rgba(0,0,0,.5);padding:28px 32px;min-width:360px;max-width:min(940px,94vw);max-height:88vh;overflow:auto}
.panel h2{margin:0 0 18px;font-weight:300;letter-spacing:.3em;text-transform:uppercase;font-size:22px}
.panel h2 b{color:var(--acc);font-weight:600}
.panel .col{display:flex;flex-direction:column;gap:2px}
.panel .mbtn{font-size:18px}
.tabs{display:flex;gap:4px;margin-bottom:18px;border-bottom:1px solid var(--line)}
.tab{background:none;border:0;color:var(--mut);font:inherit;padding:10px 16px;cursor:pointer;letter-spacing:.14em;text-transform:uppercase;font-size:13px;border-bottom:2px solid transparent;margin-bottom:-1px}
.tab.on{color:var(--ink);border-color:var(--acc)}
.row{display:grid;grid-template-columns:1fr 260px;align-items:center;gap:18px;padding:9px 2px;border-bottom:1px solid rgba(255,255,255,.04);font-size:14px}
.row label{color:#ddd3c3}
.row .v{display:flex;align-items:center;gap:10px;justify-content:flex-end}
.row .v span{min-width:38px;text-align:right;color:var(--mut);font-size:12px}
input[type=range]{-webkit-appearance:none;appearance:none;width:170px;height:3px;background:rgba(255,255,255,.18);border-radius:2px;outline:none}
input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:14px;height:14px;border-radius:50%;background:var(--acc);cursor:pointer;box-shadow:0 0 0 4px rgba(232,167,74,.18)}
.seg{display:flex;border:1px solid var(--line);border-radius:6px;overflow:hidden}
.seg button{background:none;border:0;color:var(--mut);font:inherit;font-size:12px;padding:6px 10px;cursor:pointer;letter-spacing:.06em}
.seg button.on{background:rgba(232,167,74,.2);color:var(--ink)}
.key{display:inline-flex;align-items:center;justify-content:center;min-width:26px;height:24px;padding:0 7px;border:1px solid rgba(255,255,255,.4);border-bottom-width:2px;border-radius:5px;font-size:12px;font-weight:600;color:#fff;background:rgba(255,255,255,.07);letter-spacing:.02em;white-space:nowrap}
.bind{cursor:pointer;min-width:90px;pointer-events:auto}
.bind.wait{border-color:var(--acc);color:var(--acc)}
.btnrow{display:flex;gap:12px;margin-top:22px;justify-content:flex-end}
.btn{pointer-events:auto;background:rgba(255,255,255,.06);border:1px solid var(--line);color:var(--ink);font:inherit;font-size:13px;letter-spacing:.14em;text-transform:uppercase;padding:10px 18px;border-radius:6px;cursor:pointer}
.btn:hover{border-color:var(--acc);background:rgba(232,167,74,.12)}
.btn.pri{background:rgba(232,167,74,.2);border-color:rgba(232,167,74,.55)}
input[type=text]{background:rgba(255,255,255,.06);border:1px solid var(--line);color:var(--ink);font:inherit;padding:8px 10px;border-radius:6px;width:180px;outline:none;pointer-events:auto}
#cross{position:absolute;left:50%;top:50%;width:4px;height:4px;margin:-2px 0 0 -2px;border-radius:50%;background:rgba(255,255,255,.85);box-shadow:0 0 3px rgba(0,0,0,.8);transition:transform .15s}
#cross.act{transform:scale(1.7);background:#fff}
#ring{position:absolute;left:50%;top:50%;width:46px;height:46px;margin:-23px 0 0 -23px;transform:rotate(-90deg)}
#ring circle{fill:none;stroke-width:3}
#target{position:absolute;left:50%;top:calc(50% + 36px);transform:translateX(-50%);text-align:center;text-shadow:0 1px 3px rgba(0,0,0,.95),0 0 14px rgba(0,0,0,.55);min-width:300px}
#target .nm{font-size:17px;font-weight:600;letter-spacing:.03em}
#target .inf{font-size:13px;color:#e6dccb;margin-top:3px}
#target .inf.hl{color:var(--acc2);font-size:19px;font-weight:600}
#target .acts{margin-top:9px;display:flex;flex-direction:column;gap:5px;align-items:center}
#target .act{display:flex;align-items:center;gap:8px;font-size:14px}
#stats{position:absolute;left:22px;bottom:22px;display:flex;flex-direction:column;gap:7px}
.st{display:flex;align-items:center;gap:9px;opacity:.95;transition:opacity .4s}
.st svg{width:17px;height:17px;filter:drop-shadow(0 1px 2px rgba(0,0,0,.8))}
.st .b{width:150px;height:6px;background:rgba(0,0,0,.45);border:1px solid rgba(255,255,255,.12);border-radius:3px;overflow:hidden}
.st .b i{display:block;height:100%;border-radius:2px;transition:width .3s}
.st.low{animation:pulse 1s infinite}
@keyframes pulse{50%{opacity:.35}}
#hotbar{position:absolute;left:50%;bottom:20px;transform:translateX(-50%);display:flex;gap:8px;align-items:flex-end}
.slot{width:62px;height:62px;border:1px solid rgba(255,255,255,.16);background:rgba(10,9,8,.5);border-radius:8px;position:relative;display:flex;align-items:center;justify-content:center;overflow:hidden}
.slot img{width:58px;height:58px;object-fit:contain}
.slot .n{position:absolute;left:5px;top:3px;font-size:11px;color:var(--mut);font-weight:600}
.slot .q{position:absolute;right:5px;bottom:3px;font-size:10px;color:#fff;text-shadow:0 1px 2px #000}
.slot.hand{width:76px;height:76px;border-color:rgba(232,167,74,.55);margin-left:10px}
.slot.hand .n{color:var(--acc)}
#handname{position:absolute;left:50%;bottom:106px;transform:translateX(-50%);font-size:13px;color:#e8dcc8;text-shadow:0 1px 3px #000;letter-spacing:.04em;white-space:nowrap}
#toasts{position:absolute;right:24px;top:22px;display:flex;flex-direction:column;gap:8px;align-items:flex-end}
.toast{background:rgba(12,10,8,.74);border-left:3px solid var(--acc);padding:9px 14px;font-size:14px;border-radius:4px;animation:tin .35s ease;max-width:400px;transition:opacity .6s}
.toast.bad{border-color:var(--red)}
@keyframes tin{from{opacity:0;transform:translateX(20px)}}
#hint{position:absolute;left:50%;top:12%;transform:translateX(-50%);background:rgba(12,10,8,.72);border:1px solid rgba(232,167,74,.35);padding:12px 18px;border-radius:8px;font-size:15px;max-width:680px;text-align:center;line-height:1.55;text-shadow:0 1px 2px #000;transition:opacity .6s}
#hint small{display:block;color:var(--acc2);letter-spacing:.24em;font-size:11px;text-transform:uppercase;margin-bottom:4px}
#compass{position:absolute;left:50%;top:14px;transform:translateX(-50%);width:420px;height:32px;overflow:hidden;-webkit-mask-image:linear-gradient(90deg,transparent,#000 20%,#000 80%,transparent);mask-image:linear-gradient(90deg,transparent,#000 20%,#000 80%,transparent)}
#compass canvas{position:absolute;left:0;top:0}
#carhud{position:absolute;right:26px;bottom:24px;text-align:right;text-shadow:0 1px 4px rgba(0,0,0,.9)}
#carhud .spd{font-size:44px;font-weight:300;line-height:1}
#carhud .spd small{font-size:13px;color:var(--mut);margin-left:4px;letter-spacing:.1em}
#carhud .gear{display:inline-block;margin-left:10px;font-size:22px;font-weight:700;color:var(--acc);min-width:18px}
#carhud .row2{margin-top:6px;display:flex;gap:10px;justify-content:flex-end;align-items:center;font-size:12px;color:#ddd}
#carhud .fuel{width:110px;height:5px;background:rgba(0,0,0,.5);border-radius:3px;overflow:hidden;display:inline-block}
#carhud .fuel i{display:block;height:100%;background:var(--acc)}
#carhud .warn{color:var(--red);font-weight:700;letter-spacing:.08em}
#carhud .ficon{width:14px;height:14px;fill:#e8dcc8;opacity:.85}
#fps{position:absolute;right:10px;bottom:6px;font-size:11px;color:rgba(255,255,255,.55);font-family:monospace}
#radioname{position:absolute;left:50%;top:22%;transform:translateX(-50%);font-size:15px;letter-spacing:.2em;color:#f4d49a;text-shadow:0 1px 6px #000;text-transform:uppercase;transition:opacity .8s}
#blood{position:absolute;inset:0;background:radial-gradient(ellipse at center,rgba(120,0,0,0) 40%,rgba(150,10,5,.6) 100%);opacity:0}
#blackout{position:absolute;inset:0;background:#000;opacity:0;pointer-events:none;transition:opacity .9s}
#note .paper{pointer-events:auto;width:min(640px,90vw);max-height:84vh;overflow:auto;background:linear-gradient(180deg,#efe4c8,#e2d3b0);color:#2a2014;padding:40px 48px;border-radius:3px;box-shadow:0 30px 90px rgba(0,0,0,.6),inset 0 0 60px rgba(120,90,40,.25);font-family:Georgia,"Times New Roman",serif;font-style:italic;font-size:18px;line-height:1.65;white-space:pre-wrap;transform:rotate(-.6deg)}
#note .close{margin-top:18px;text-align:center;font-family:"Segoe UI",Arial,sans-serif;font-style:normal;font-size:12px;color:#5a4a34;letter-spacing:.2em;text-transform:uppercase}
#death{background:radial-gradient(ellipse at center,rgba(40,4,2,.72),rgba(0,0,0,.94));pointer-events:auto;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}
#death h1,#win h1{font-weight:200;letter-spacing:.5em;font-size:clamp(36px,5vw,64px);margin:0;color:#e8d8c8}
#death .cause{margin-top:10px;color:#d88a70;letter-spacing:.1em}
#win{background:radial-gradient(ellipse at center,rgba(60,40,10,.6),rgba(0,0,0,.9));pointer-events:auto;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}
.statsg{display:grid;grid-template-columns:repeat(4,auto);gap:10px 40px;margin:36px 0;text-align:left}
.statsg div{font-size:12px;color:var(--mut);letter-spacing:.14em;text-transform:uppercase}
.statsg b{display:block;font-size:24px;color:var(--ink);font-weight:300;letter-spacing:.02em;margin-top:4px}
.jgrid{display:grid;grid-template-columns:1fr 1fr;gap:20px}
.jbox{border:1px solid var(--line);border-radius:8px;padding:14px 16px}
.jbox h3{margin:0 0 10px;font-size:12px;letter-spacing:.24em;text-transform:uppercase;color:var(--acc2);font-weight:600}
.jl{display:flex;justify-content:space-between;font-size:14px;padding:4px 0;border-bottom:1px solid rgba(255,255,255,.04)}
.jl span:last-child{color:#fff}
.meter{height:4px;background:rgba(255,255,255,.1);border-radius:2px;overflow:hidden;margin:2px 0 6px}
.meter i{display:block;height:100%;background:var(--acc)}
.ctl{display:grid;grid-template-columns:auto 1fr;gap:7px 14px;font-size:13px;align-items:center}
.clickme{pointer-events:auto;position:absolute;inset:0;display:flex;align-items:flex-end;justify-content:center;padding-bottom:22vh;font-size:14px;letter-spacing:.3em;color:#e8dcc8;text-transform:uppercase;text-shadow:0 1px 4px #000;cursor:pointer;animation:pulse 2.4s infinite}
`;
