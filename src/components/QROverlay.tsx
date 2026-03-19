'use client';

import { QRCodeCanvas } from 'qrcode.react';
import { FC, useState, useEffect, useRef } from 'react';
import { Maximize2, Minimize2, X, Clock, Play, Monitor, ChevronRight, StopCircle } from 'lucide-react';

const CSS = `
  @keyframes qrIn { from{opacity:0;transform:scale(0.95) translateY(8px)}to{opacity:1;transform:scale(1) translateY(0)} }
  @keyframes slideUp { from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)} }
  @keyframes glow { 0%,100%{box-shadow:0 0 0 0 rgba(0,122,255,0)}50%{box-shadow:0 0 55px 16px rgba(0,122,255,0.13)} }
  @keyframes scan { 0%{transform:translateY(0);opacity:.7}90%{transform:translateY(240px);opacity:0}100%{transform:translateY(240px);opacity:0} }
  @keyframes scanMini { 0%{transform:translateY(0);opacity:.7}90%{transform:translateY(110px);opacity:0}100%{transform:translateY(110px);opacity:0} }
  @keyframes pulse { 0%,100%{opacity:1}50%{opacity:.45} }
  @keyframes expand { from{opacity:0;transform:scale(0.88)}to{opacity:1;transform:scale(1)} }
  @keyframes float { 0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)} }
  @keyframes chipIn { from{opacity:0;transform:scale(0.55) translate(40px,-20px)}to{opacity:1;transform:scale(1) translate(0,0)} }
`;

type Mode = 'choose' | 'fullscreen' | 'mini' | 'pip';

function fmt(s: number) {
  return `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`;
}

interface Props { sesionId: string; onClose: () => void; }

export const QROverlay: FC<Props> = ({ sesionId, onClose }) => {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const qrUrl  = `${origin}/estudiante/sesion/${sesionId}`;

  const [mode,       setMode]       = useState<Mode>('choose');
  const [mins,       setMins]       = useState(15);
  const [secsLeft,   setSecsLeft]   = useState<number|null>(null);
  const [running,    setRunning]    = useState(false);
  const [hasSecs,    setHasSecs]    = useState(false);
  const [miniOn,     setMiniOn]     = useState(true);
  const [expanded,   setExpanded]   = useState(false);
  const [wantFs,     setWantFs]     = useState(false);
  const [pipOk,      setPipOk]      = useState(false);
  const [screenW,    setScreenW]    = useState(typeof window !== 'undefined' ? window.innerWidth : 1280);

  const fsRef    = useRef<HTMLDivElement>(null);
  const ivRef    = useRef<ReturnType<typeof setInterval>|null>(null);
  const pipRef   = useRef<Window|null>(null);

  // detect PiP support & screen size
  useEffect(() => {
    setPipOk('documentPictureInPicture' in window);
    const onR = () => setScreenW(window.innerWidth);
    window.addEventListener('resize', onR);
    return () => window.removeEventListener('resize', onR);
  }, []);

  // fullscreen trigger
  useEffect(() => {
    if (!wantFs || !fsRef.current) return;
    fsRef.current.requestFullscreen?.().catch(()=>{});
    setWantFs(false);
  }, [wantFs]);

  // cleanup on unmount
  useEffect(() => () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(()=>{});
    try { pipRef.current?.close(); } catch {}
    if (ivRef.current) clearInterval(ivRef.current);
  }, []);

  // timer tick — also updates PiP DOM
  useEffect(() => {
    if (!running || secsLeft === null) return;
    ivRef.current = setInterval(() => {
      setSecsLeft(prev => {
        if (prev === null || prev <= 1) {
          clearInterval(ivRef.current!);
          setRunning(false);
          setMiniOn(false);
          try { pipRef.current?.close(); pipRef.current = null; } catch {}
          return 0;
        }
        const next = prev - 1;
        // update PiP DOM elements
        try {
          const d = pipRef.current?.document;
          if (d) {
            const t = d.getElementById('pt');
            const b = d.getElementById('pb') as HTMLElement|null;
            if (t) t.textContent = fmt(next);
            if (b) b.style.width = `${Math.round((next / (mins * 60)) * 100)}%`;
            if (t) (t as HTMLElement).style.color = next < 60 ? '#FF9500' : 'rgba(255,255,255,0.75)';
            if (b) b.style.background = next < 60 ? '#FF9500' : '#007AFF';
          }
        } catch {}
        return next;
      });
    }, 1000);
    return () => { if (ivRef.current) clearInterval(ivRef.current); };
  }, [running, mins]);

  const exitFs = () => { try { if (document.fullscreenElement) document.exitFullscreen(); } catch {} };

  const closeFull = () => {
    if (ivRef.current) clearInterval(ivRef.current);
    exitFs();
    try { pipRef.current?.close(); pipRef.current = null; } catch {}
    onClose();
  };

  const goFullscreen = () => { setMode('fullscreen'); setWantFs(true); };

  const goMiniSameTab = (withT: boolean) => {
    if (withT) { setSecsLeft(mins*60); setRunning(true); setHasSecs(true); }
    setMiniOn(true); setExpanded(false);
    setMode('mini');
    // Do NOT enter fullscreen here — the chip should float over the normal page content.
    // Fullscreen is reserved for the dedicated fullscreen mode only.
  };

  // ── Document PiP ──────────────────────────────────────────────────────────
  const openPiP = async (withT: boolean) => {
    // CRITICAL: extract canvas SYNCHRONOUSLY before any await.
    // Any async break (setTimeout, etc.) severs Chrome's user-gesture chain
    // and causes requestWindow() to be silently rejected.
    const canvas = document.querySelector<HTMLCanvasElement>('#qr-hidden-wrap canvas');
    if (!canvas) { goMiniSameTab(withT); return; }
    const qrImg = canvas.toDataURL('image/png');

    const totalSecs = mins * 60;
    if (withT) { setSecsLeft(totalSecs); setRunning(true); setHasSecs(true); }

    try {
      const dPiP = (window as any).documentPictureInPicture;
      const pipWin: Window = await dPiP.requestWindow({
        width: 176, height: withT ? 234 : 198,
        preferInitialWindowPlacement: true,
      });
      pipRef.current = pipWin;

      const doc = pipWin.document;
      doc.documentElement.style.cssText = 'height:100%;margin:0;';
      doc.body.style.cssText = [
        'margin:0;padding:10px;box-sizing:border-box;height:100%;',
        'background:rgba(12,12,12,0.93);',
        'display:flex;flex-direction:column;align-items:center;justify-content:center;',
        'font-family:system-ui,sans-serif;',
      ].join('');

      const style = doc.createElement('style');
      style.textContent = [
        '@keyframes f{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}',
        '@keyframes sc{0%{transform:translateY(0);opacity:.75}88%{transform:translateY(152px);opacity:0}100%{transform:translateY(152px);opacity:0}}',
        'body{animation:f 4s ease-in-out infinite}',
        '#scl{position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent,rgba(0,122,255,.9),transparent);animation:sc 2.3s ease-in-out infinite;pointer-events:none;z-index:5}',
      ].join('');
      doc.head.appendChild(style);

      // QR image inside a relative wrapper for the scan-line overlay
      const wrap = doc.createElement('div');
      wrap.style.cssText = 'position:relative;background:#fff;padding:6px;border-radius:10px;margin-bottom:8px;overflow:hidden;';
      const scl = doc.createElement('div'); scl.id = 'scl';
      wrap.appendChild(scl);
      const img = doc.createElement('img');
      img.src = qrImg;
      img.style.cssText = 'width:154px;display:block;border-radius:6px;';
      wrap.appendChild(img);
      doc.body.appendChild(wrap);

      if (withT) {
        const timerEl = doc.createElement('div');
        timerEl.id = 'pt';
        timerEl.textContent = fmt(totalSecs);
        timerEl.style.cssText = 'color:rgba(255,255,255,0.75);font-size:13px;font-weight:700;font-variant-numeric:tabular-nums;margin-bottom:5px;text-align:center;';
        doc.body.appendChild(timerEl);

        const track = doc.createElement('div');
        track.style.cssText = 'width:154px;height:2.5px;background:rgba(255,255,255,0.1);border-radius:999px;overflow:hidden;';
        const bar = doc.createElement('div');
        bar.id = 'pb';
        bar.style.cssText = 'height:100%;width:100%;background:#007AFF;border-radius:999px;transition:width 1s linear,background .5s;';
        track.appendChild(bar);
        doc.body.appendChild(track);
      }

      const hint = doc.createElement('p');
      hint.textContent = 'QR · Asistencia';
      hint.style.cssText = 'color:rgba(255,255,255,0.22);font-size:8.5px;margin:7px 0 0;letter-spacing:.08em;text-transform:uppercase;font-weight:600;';
      doc.body.appendChild(hint);

      pipWin.addEventListener('pagehide', () => {
        pipRef.current = null;
        if (ivRef.current) clearInterval(ivRef.current);
        setRunning(false);
        // Don't close the class — just clean up the overlay state
        onClose();
      });

      setMode('pip');
    } catch (err) {
      // PiP failed (e.g. user denied) → fall back to same-tab mini
      console.warn('PiP failed, falling back:', err);
      goMiniSameTab(withT);
    }
  };

  const fsQrSize = Math.min(Math.round(screenW * 0.52), 520);

  // ── Hidden QR canvas (for PiP data-URL generation) ────────────────────────
  // Rendered off-screen; openPiP() queries it by id
  const hiddenWrapperId = 'qr-hidden-wrap';
  const hiddenCanvas = (
    <div id={hiddenWrapperId} style={{ position:'fixed', left:'-9999px', top:0, pointerEvents:'none', opacity:0, zIndex:-1, width:160, height:160 }}>
      <QRCodeCanvas value={qrUrl} size={160} level="H" includeMargin={false}/>
    </div>
  );

  // ── Mode: pip (PiP window is open — render nothing in main tab) ───────────
  if (mode === 'pip') {
    return (
      <>
        {hiddenCanvas}
        {/* Invisible sentinel — just keeps component alive for timer */}
        <div style={{ position:'fixed', zIndex:-1, opacity:0, pointerEvents:'none' }} aria-hidden />
      </>
    );
  }

  // ── Mode: choose ──────────────────────────────────────────────────────────
  if (mode === 'choose') {
    return (
      <div id="qr-choose" style={{
        position:'fixed',inset:0,zIndex:9999,
        display:'flex',alignItems:'center',justifyContent:'center',
        background:'rgba(0,0,0,0.84)',backdropFilter:'blur(28px)',WebkitBackdropFilter:'blur(28px)',
        padding:'24px 16px',boxSizing:'border-box',overflowY:'auto',
        animation:'qrIn .32s cubic-bezier(.22,1,.36,1) both',
      }}>
        <style dangerouslySetInnerHTML={{__html:CSS}} />
        {hiddenCanvas}

        <div style={{position:'relative',width:'100%',maxWidth:456,display:'flex',flexDirection:'column',animation:'qrIn .38s cubic-bezier(.22,1,.36,1) both'}}>
          {/* close */}
          <button onClick={closeFull} aria-label="Cerrar"
            style={{position:'absolute',top:-2,right:0,width:36,height:36,borderRadius:'50%',background:'rgba(255,255,255,0.09)',border:'1px solid rgba(255,255,255,0.13)',display:'flex',alignItems:'center',justifyContent:'center',color:'rgba(255,255,255,0.6)',cursor:'pointer'}}
            onMouseEnter={e => { const el=e.currentTarget as HTMLElement; el.style.background='rgba(255,59,48,0.32)'; el.style.color='#fff'; }}
            onMouseLeave={e => { const el=e.currentTarget as HTMLElement; el.style.background='rgba(255,255,255,0.09)'; el.style.color='rgba(255,255,255,0.6)'; }}
          ><X size={15}/></button>

          {/* title */}
          <div style={{textAlign:'center',marginBottom:26}}>
            <p style={{fontSize:10,fontWeight:700,letterSpacing:'0.15em',textTransform:'uppercase',color:'rgba(255,255,255,0.36)',margin:'0 0 10px'}}>QR de Asistencia</p>
            <h2 style={{fontSize:25,fontWeight:700,color:'#fff',letterSpacing:'-0.5px',lineHeight:1.2,margin:0}}>¿Cómo querés<br/>mostrar el QR?</h2>
          </div>

          {/* Option A: Fullscreen */}
          <button id="qr-go-fs" onClick={goFullscreen}
            style={{width:'100%',marginBottom:12,textAlign:'left',background:'linear-gradient(135deg,rgba(0,122,255,.22),rgba(0,122,255,.07))',border:'1px solid rgba(0,122,255,.3)',borderRadius:20,padding:'20px 22px',cursor:'pointer',transition:'transform .14s,background .14s',animation:'slideUp .42s .04s cubic-bezier(.22,1,.36,1) both'}}
            onMouseEnter={e=>{const el=e.currentTarget as HTMLElement; el.style.transform='scale(1.018)'; el.style.background='linear-gradient(135deg,rgba(0,122,255,.32),rgba(0,122,255,.13))';}}
            onMouseLeave={e=>{const el=e.currentTarget as HTMLElement; el.style.transform='scale(1)'; el.style.background='linear-gradient(135deg,rgba(0,122,255,.22),rgba(0,122,255,.07))';}}
          >
            <div style={{display:'flex',alignItems:'center',gap:15}}>
              <div style={{width:44,height:44,borderRadius:12,background:'rgba(0,122,255,.18)',border:'1px solid rgba(0,122,255,.36)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><Maximize2 size={20} color="#007AFF"/></div>
              <div style={{flex:1}}>
                <p style={{margin:'0 0 3px',fontSize:15,fontWeight:700,color:'#fff'}}>Pantalla completa</p>
                <p style={{margin:0,fontSize:12,color:'rgba(255,255,255,0.46)',lineHeight:1.45}}>El QR ocupa toda la pantalla. Ideal para que todos los alumnos lo vean.</p>
              </div>
              <ChevronRight size={16} color="rgba(255,255,255,0.26)"/>
            </div>
          </button>

          {/* Option B: Mini */}
          <div style={{width:'100%',background:'linear-gradient(135deg,rgba(88,86,214,.17),rgba(88,86,214,.05))',border:'1px solid rgba(88,86,214,.27)',borderRadius:20,padding:'20px 22px',animation:'slideUp .42s .12s cubic-bezier(.22,1,.36,1) both'}}>
            <div style={{display:'flex',alignItems:'flex-start',gap:15,marginBottom:16}}>
              <div style={{width:44,height:44,borderRadius:12,background:'rgba(88,86,214,.18)',border:'1px solid rgba(88,86,214,.3)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><Monitor size={20} color="#5856D6"/></div>
              <div style={{flex:1}}>
                <p style={{margin:'0 0 3px',fontSize:15,fontWeight:700,color:'#fff'}}>
                  Mini — flotante sobre otras pestañas
                  {pipOk && <span style={{marginLeft:8,fontSize:10,background:'rgba(52,199,89,0.2)',color:'#34C759',border:'1px solid rgba(52,199,89,0.3)',borderRadius:6,padding:'2px 6px',fontWeight:700,letterSpacing:'0.05em',verticalAlign:'middle'}}>PiP</span>}
                </p>
                <p style={{margin:0,fontSize:12,color:'rgba(255,255,255,0.46)',lineHeight:1.45}}>
                  {pipOk
                    ? 'Ventana flotante independiente que se superpone sobre otras apps y pestañas (Canva, PowerPoint, etc.).'
                    : 'QR en la esquina de esta pestaña. Para modo flotante multi-pestaña usá Chrome/Edge 116+.'
                  }
                </p>
              </div>
            </div>

            {/* Timer */}
            <div style={{background:'rgba(0,0,0,0.28)',borderRadius:13,padding:'13px 15px',border:'1px solid rgba(255,255,255,0.07)',marginBottom:13}}>
              <div style={{display:'flex',alignItems:'center',gap:7,marginBottom:11}}>
                <Clock size={12} color="rgba(255,255,255,0.38)"/>
                <p style={{margin:0,fontSize:10,fontWeight:700,color:'rgba(255,255,255,0.38)',letterSpacing:'0.1em',textTransform:'uppercase'}}>Timer de desaparición (opcional)</p>
              </div>
              <div style={{display:'flex',alignItems:'center',gap:10}}>
                <input id="qr-timer" type="range" min={1} max={60} value={mins} onChange={e=>setMins(Number(e.target.value))}
                  style={{flex:1,accentColor:'#5856D6',cursor:'pointer'}}/>
                <span style={{minWidth:56,textAlign:'center',flexShrink:0,fontSize:14,fontWeight:700,color:'#fff',background:'rgba(88,86,214,0.26)',borderRadius:8,padding:'4px 8px'}}>{mins} min</span>
              </div>
              <p style={{margin:'8px 0 0',fontSize:10,color:'rgba(255,255,255,0.28)'}}>El QR desaparece automáticamente — la clase continúa sin interrupciones.</p>
            </div>

            <div style={{display:'flex',gap:9}}>
              <button id="qr-mini-timer" onClick={() => pipOk ? openPiP(true) : goMiniSameTab(true)}
                style={{flex:1,padding:'12px 0',background:'linear-gradient(135deg,#5856D6,#007AFF)',border:'none',borderRadius:11,color:'#fff',fontSize:13,fontWeight:700,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:6,transition:'opacity .14s,transform .14s'}}
                onMouseEnter={e=>{const el=e.currentTarget as HTMLElement; el.style.opacity='0.85'; el.style.transform='scale(1.02)';}}
                onMouseLeave={e=>{const el=e.currentTarget as HTMLElement; el.style.opacity='1'; el.style.transform='scale(1)';}}
              ><Play size={13} fill="currentColor"/> Con timer ({mins} min)</button>
              <button id="qr-mini-no-timer" onClick={() => pipOk ? openPiP(false) : goMiniSameTab(false)}
                style={{padding:'12px 15px',flexShrink:0,background:'rgba(255,255,255,0.07)',border:'1px solid rgba(255,255,255,0.11)',borderRadius:11,color:'rgba(255,255,255,0.7)',fontSize:12,fontWeight:600,cursor:'pointer',transition:'background .14s'}}
                onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background='rgba(255,255,255,0.13)'}
                onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background='rgba(255,255,255,0.07)'}
              >Sin timer</button>
            </div>
          </div>
          <p style={{marginTop:13,fontSize:10,color:'rgba(255,255,255,0.2)',textAlign:'center'}}>En pantalla completa, presioná ESC para salir</p>
        </div>
      </div>
    );
  }

  // ── Mode: fullscreen ──────────────────────────────────────────────────────
  if (mode === 'fullscreen') {
    return (
      <div ref={fsRef} id="qr-fs" style={{position:'fixed',inset:0,zIndex:9999,background:'#000',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',animation:'qrIn .38s cubic-bezier(.22,1,.36,1) both'}}>
        <style dangerouslySetInnerHTML={{__html:CSS}}/>
        {hiddenCanvas}
        <button onClick={()=>{exitFs(); goMiniSameTab(false);}}
          style={{position:'absolute',top:22,left:22,background:'rgba(255,255,255,0.07)',border:'1px solid rgba(255,255,255,0.12)',borderRadius:11,padding:'9px 15px',color:'rgba(255,255,255,0.6)',fontSize:12,fontWeight:600,cursor:'pointer',display:'flex',alignItems:'center',gap:6}}
          onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background='rgba(255,255,255,0.13)'}
          onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background='rgba(255,255,255,0.07)'}
        ><Minimize2 size={13}/> Mini</button>
        <button onClick={closeFull} aria-label="Cerrar"
          style={{position:'absolute',top:22,right:22,width:44,height:44,borderRadius:'50%',background:'rgba(255,255,255,0.09)',border:'1px solid rgba(255,255,255,0.13)',display:'flex',alignItems:'center',justifyContent:'center',color:'rgba(255,255,255,0.65)',cursor:'pointer'}}
          onMouseEnter={e=>{const el=e.currentTarget as HTMLElement; el.style.background='rgba(255,59,48,0.38)'; el.style.color='#fff';}}
          onMouseLeave={e=>{const el=e.currentTarget as HTMLElement; el.style.background='rgba(255,255,255,0.09)'; el.style.color='rgba(255,255,255,0.65)';}}
        ><X size={18}/></button>

        <div style={{display:'flex',flexDirection:'column',alignItems:'center',animation:'qrIn .5s .1s cubic-bezier(.22,1,.36,1) both'}}>
          <p style={{margin:'0 0 22px',fontSize:12,fontWeight:700,letterSpacing:'0.15em',textTransform:'uppercase',color:'rgba(255,255,255,0.36)'}}>Escaneá para registrar asistencia</p>
          <div style={{position:'relative',padding:20,background:'#fff',borderRadius:28,animation:'glow 3.5s ease-in-out infinite'}}>
            <div style={{position:'absolute',top:20,left:20,right:20,height:2.5,background:'linear-gradient(90deg,transparent,#007AFF,transparent)',zIndex:5,pointerEvents:'none',animation:'scan 2.8s cubic-bezier(.22,1,.36,1) infinite'}}/>
            <QRCodeCanvas value={qrUrl} size={fsQrSize} level="H" includeMargin={false} style={{display:'block',borderRadius:8}}/>
          </div>
          <p style={{margin:'24px 0 0',fontSize:16,color:'rgba(255,255,255,0.3)',fontWeight:500}}>Apuntá la cámara al código QR</p>
        </div>
      </div>
    );
  }

  // ── Mode: mini (same-tab fallback) ────────────────────────────────────────
  if (mode === 'mini') {
    return (
      <div id="qr-mini" style={{position:'fixed',inset:0,zIndex:9998,background:'transparent',pointerEvents:'none'}}>
        <style dangerouslySetInnerHTML={{__html:CSS}}/>
        {hiddenCanvas}

        {miniOn && !expanded && (
          <div id="qr-chip" onClick={()=>setExpanded(true)}
            style={{position:'absolute',top:18,right:18,pointerEvents:'all',cursor:'pointer',borderRadius:20,boxShadow:'0 10px 38px rgba(0,0,0,0.55)',animation:'chipIn .5s cubic-bezier(.22,1,.36,1) both, float 4.5s .8s ease-in-out infinite'}}>
            <div style={{background:'rgba(10,10,10,0.88)',backdropFilter:'blur(22px)',WebkitBackdropFilter:'blur(22px)',border:'1px solid rgba(255,255,255,0.11)',borderRadius:20,padding:10,position:'relative',overflow:'hidden'}}>
              <div style={{position:'absolute',top:10,left:10,right:10,height:2,background:'linear-gradient(90deg,transparent,rgba(0,122,255,0.85),transparent)',zIndex:5,pointerEvents:'none',animation:'scanMini 2.2s ease-in-out infinite'}}/>
              <div style={{background:'#fff',borderRadius:11,padding:6}}><QRCodeCanvas value={qrUrl} size={116} level="H" includeMargin={false} style={{display:'block'}}/></div>
              {hasSecs && secsLeft !== null && (
                <div style={{marginTop:8}}>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:4,marginBottom:4}}>
                    <Clock size={10} color={secsLeft<60?'#FF9500':'rgba(255,255,255,0.45)'}/>
                    <span style={{fontSize:12,fontWeight:700,fontVariantNumeric:'tabular-nums',color:secsLeft<60?'#FF9500':'rgba(255,255,255,0.7)',animation:secsLeft<30?'pulse .9s ease-in-out infinite':'none'}}>{fmt(secsLeft)}</span>
                  </div>
                  <div style={{height:2.5,background:'rgba(255,255,255,0.1)',borderRadius:999,overflow:'hidden'}}>
                    <div style={{height:'100%',borderRadius:999,background:secsLeft<60?'#FF9500':'#007AFF',width:`${Math.round((secsLeft/(mins*60))*100)}%`,transition:'width 1s linear,background .5s'}}/>
                  </div>
                </div>
              )}
              <p style={{margin:'7px 0 0',fontSize:8.5,fontWeight:700,color:'rgba(255,255,255,0.26)',textAlign:'center',letterSpacing:'0.07em',textTransform:'uppercase'}}>Tocá para ampliar</p>
            </div>
          </div>
        )}

        {miniOn && expanded && (
          <div id="qr-expanded" style={{position:'absolute',inset:0,background:'rgba(0,0,0,0.9)',backdropFilter:'blur(28px)',WebkitBackdropFilter:'blur(28px)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',pointerEvents:'all',animation:'expand .3s cubic-bezier(.22,1,.36,1) both'}}>
            <button onClick={()=>setExpanded(false)} aria-label="Minimizar"
              style={{position:'absolute',top:22,right:22,width:44,height:44,borderRadius:'50%',background:'rgba(255,255,255,0.09)',border:'1px solid rgba(255,255,255,0.13)',display:'flex',alignItems:'center',justifyContent:'center',color:'rgba(255,255,255,0.65)',cursor:'pointer'}}
              onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background='rgba(255,255,255,0.16)'}
              onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background='rgba(255,255,255,0.09)'}
            ><Minimize2 size={18}/></button>
            <button onClick={closeFull}
              style={{position:'absolute',top:22,left:22,background:'rgba(255,59,48,0.13)',border:'1px solid rgba(255,59,48,0.24)',borderRadius:11,padding:'10px 16px',color:'#FF3B30',fontSize:13,fontWeight:700,cursor:'pointer',display:'flex',alignItems:'center',gap:6}}
              onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background='rgba(255,59,48,0.24)'}
              onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background='rgba(255,59,48,0.13)'}
            ><StopCircle size={14}/> Cerrar QR</button>
            <p style={{margin:'0 0 20px',fontSize:11,fontWeight:700,letterSpacing:'0.15em',textTransform:'uppercase',color:'rgba(255,255,255,0.3)'}}>Escaneá para registrar asistencia</p>
            <div style={{background:'#fff',borderRadius:24,padding:18,boxShadow:'0 28px 90px rgba(0,0,0,0.55)',position:'relative',overflow:'hidden',animation:'glow 3.5s ease-in-out infinite'}}>
              <div style={{position:'absolute',top:18,left:18,right:18,height:2.5,background:'linear-gradient(90deg,transparent,#007AFF,transparent)',animation:'scan 2.8s cubic-bezier(.22,1,.36,1) infinite',zIndex:5,pointerEvents:'none'}}/>
              <QRCodeCanvas value={qrUrl} size={Math.min(Math.round(screenW*.48),380)} level="H" includeMargin={false} style={{display:'block',borderRadius:8}}/>
            </div>
            {hasSecs && secsLeft !== null && (
              <div style={{marginTop:22,display:'flex',alignItems:'center',gap:9}}>
                <Clock size={15} color={secsLeft<60?'#FF9500':'rgba(255,255,255,0.36)'}/>
                <span style={{fontSize:18,fontWeight:700,fontVariantNumeric:'tabular-nums',color:secsLeft<60?'#FF9500':'rgba(255,255,255,0.6)',animation:secsLeft<30?'pulse .9s ease-in-out infinite':'none'}}>{fmt(secsLeft)}</span>
                <span style={{fontSize:13,color:'rgba(255,255,255,0.26)'}}>restantes</span>
              </div>
            )}
            <p style={{margin:'12px 0 0',fontSize:11,color:'rgba(255,255,255,0.2)'}}>Minimizá para volver al chip flotante</p>
          </div>
        )}
      </div>
    );
  }

  return null;
};
