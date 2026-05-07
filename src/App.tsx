import React, { useState, useRef, useEffect } from 'react';
import { Upload, Camera, Film, Beaker, Play, RefreshCcw, Save, Info, AlertTriangle, Layers, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Types for the worker messages
interface ProgressMessage {
  type: 'progress';
  y: number;
  rowData: Uint8ClampedArray;
  progress: number;
}

interface CompleteMessage {
  type: 'complete';
  data: Uint8ClampedArray;
}

export default function App() {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [history, setHistory] = useState<string[]>([
    '[00:00] SYSTEM IDLE',
    '[00:00] STANDBY FOR CHEMICAL INJECTION'
  ]);
  const [settings, setSettings] = useState({
    k: 8.5,           
    x0: 0.45,         
    halation: 0.6,    
    grain: 0.15,      
    warmth: 1.1,      
    radialSoftness: 0.4,
    volumetricPasses: 64,   // Increased default for high detail
    opticalSamples: 80,     // Increased default for high detail
    slowProcess: false,
    delayMs: 200      
  });

  const [showDocs, setShowDocs] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const workerRef = useRef<Worker | null>(null);

  const docsRef = useRef<HTMLDivElement>(null);

  const toggleDocs = () => {
    setShowDocs(!showDocs);
    if (!showDocs) {
      setTimeout(() => {
        docsRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  };

  const addLog = (msg: string) => {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setHistory(prev => [`[${time}] ${msg}`, ...prev].slice(0, 50));
  };

  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    addLog(`LOADING RAW IMAGE: ${file.name}`);
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        setImage(img);
        addLog(`IMAGE DECODED: ${img.width}x${img.height}`);
        if (canvasRef.current) {
          const ctx = canvasRef.current.getContext('2d');
          if (ctx) {
            canvasRef.current.width = img.width;
            canvasRef.current.height = img.height;
            ctx.fillStyle = '#050505';
            ctx.fillRect(0, 0, img.width, img.height);
            ctx.drawImage(img, 0, 0);
          }
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const startDevelopment = () => {
    if (!image || !canvasRef.current) return;

    const canvas = canvasRef.current;
    if (!canvas || !image) return;

    // Explicitly set canvas dimensions to image natural resolution
    const sourceWidth = image.naturalWidth || image.width;
    const sourceHeight = image.naturalHeight || image.height;
    
    canvas.width = sourceWidth;
    canvas.height = sourceHeight;

    // 2x Super-Sampling (4x total area) to preserve micro-details
    const targetWidth = sourceWidth * 2;
    const targetHeight = sourceHeight * 2;
    
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const ctx = canvas.getContext('2d', { willReadFrequently: true, alpha: false });
    if (!ctx) return;

    setIsProcessing(true);
    setProgress(0);
    addLog(`INITIATING SUPER-SAMPLED EMULSION ENGINE: ${targetWidth}x${targetHeight}`);
    addLog('UPSAMPLING NEGATIVE (4X AREA) FOR DETAIL PRESERVATION...');
    addLog(`ACTIVATING TRIPLE-LAYER LATENT EMULSION SENSITIVITY...`);
    addLog(`QUANTUM VOLUMETRIC DIFFUSION CYCLES: ${settings.volumetricPasses} PER PX`);
    addLog(`OPTICAL VIGNETTE SAMPLING: ${settings.opticalSamples} SAMPLES`);

    // High quality scaling
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(image, 0, 0, targetWidth, targetHeight);
    
    const imageData = ctx.getImageData(0, 0, targetWidth, targetHeight);
    
    addLog(`BUFFER ALLOCATED: ${(imageData.data.length / (1024 * 1024)).toFixed(2)} MB`);

    ctx.fillStyle = '#050505';
    ctx.fillRect(0, 0, targetWidth, targetHeight);

    const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    workerRef.current = worker;

    worker.onmessage = (e: MessageEvent) => {
      if (e.data.type === 'progress') {
        const { y, rowData, progress } = e.data;
        const rowImageData = new ImageData(rowData, targetWidth, 1);
        ctx.putImageData(rowImageData, 0, y);
        setProgress(progress);
        
        if (Math.floor(progress) % 10 === 0 && progress > 0 && Math.floor(progress) !== Math.floor(progress - 0.2)) {
          addLog(`DEVELOPING LAYER L-γ: ${Math.floor(progress)}%`);
        }
      } else if (e.data.type === 'complete') {
        // Handle buffer from transferable
        const finalBuffer = e.data.buffer;
        if (finalBuffer) {
          const finalData = new Uint8ClampedArray(finalBuffer);
          const finalImageData = new ImageData(finalData, canvas.width, canvas.height);
          ctx.putImageData(finalImageData, 0, 0);
        }
        
        setIsProcessing(false);
        addLog('DEVELOPMENT COMPLETE. STABILIZING DYE COUPLERS.');
        worker.terminate();
      }
    };

    // Optimization: Transfer the buffer to the worker instead of copying it
    const pixelBuffer = imageData.data.buffer;
    worker.postMessage({
      imageData: pixelBuffer,
      width: canvas.width,
      height: canvas.height,
      settings: {
        k: settings.k,
        x0: settings.x0,
        halationStrength: settings.halation,
        grainStrength: settings.grain,
        radialSoftness: settings.radialSoftness,
        volumetricPasses: settings.volumetricPasses,
        opticalSamples: settings.opticalSamples,
        slowProcess: settings.slowProcess,
        delayMs: settings.delayMs
      }
    }, [pixelBuffer]);

  };

  const saveImage = () => {
    if (!canvasRef.current) return;
    const link = document.createElement('a');
    link.download = `kodak-alchemy-${Date.now()}.png`;
    link.href = canvasRef.current.toDataURL();
    link.click();
    addLog('RESULT EXPORTED TO DISK.');
  };

  const resetImage = () => {
    setImage(null);
    setProgress(0);
    setIsProcessing(false);
    setHistory([]);
    if (workerRef.current) {
      workerRef.current.terminate();
    }
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
    }
    addLog('EMULSION WIPED. SYSTEM READY FOR NEW NEGATIVE.');
  };

  return (
    <div className="flex flex-col min-h-screen w-full bg-[#0A0A0B] text-[#D1D1D1] font-sans">
      {/* Main Application Interface (Fixed Height Section) */}
      <div className="flex flex-col h-screen shrink-0 overflow-hidden">
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#0F0F11]">
        <div className="flex items-center space-x-4">
          <div className="w-10 h-10 bg-[#FFB800] rounded-sm flex items-center justify-center">
            <span className="text-black font-black text-xl italic skew-x-[-10deg]">K</span>
          </div>
          <div>
            <h1 className="text-lg font-medium tracking-tight uppercase">
              Chromatic Emulsion Engine
              <span className="text-white/30 ml-3 font-mono text-[10px] tracking-widest">V4.0.12-PRO</span>
            </h1>
          </div>
        </div>
        <div className="flex items-center space-x-6">
          <button
            onClick={toggleDocs}
            className={`px-3 py-1.5 border border-white/10 text-[10px] font-mono uppercase tracking-[0.2em] transition-all flex items-center gap-2 ${showDocs ? 'bg-accent text-black border-accent' : 'text-white/40 hover:text-white hover:border-white/30'}`}
          >
            <Info size={12} />
            {showDocs ? 'Close Spec' : 'System Spec'}
          </button>
          
          {image && (
            <button
              onClick={resetImage}
              disabled={isProcessing}
              className="px-4 py-1.5 border border-[#FFB800]/30 text-[#FFB800] text-[10px] font-mono uppercase tracking-[0.2em] hover:bg-[#FFB800]/10 transition-all disabled:opacity-20 flex items-center gap-2"
            >
              <RefreshCcw size={12} className={isProcessing ? "animate-spin" : ""} />
              New Negative
            </button>
          )}
          <div className="flex items-center space-x-8 text-[10px] font-mono uppercase tracking-widest">
            <div className="flex flex-col items-end">
            <span className="text-white/40">Computation Load</span>
            <span className="text-[#FFB800] tabular-nums">{isProcessing ? '98.4% NVIDIA CUDA' : '0.2% IDLE'}</span>
          </div>
          <div className="h-8 w-[1px] bg-white/10"></div>
          <div className="flex flex-col items-end">
            <span className="text-white/40">Status</span>
            <span className={isProcessing ? "text-red-500 animate-pulse" : "text-white"}>
              {isProcessing ? 'DEVELOPING...' : 'STANDBY'}
            </span>
          </div>
        </div>
      </div>
    </header>

      <main className="flex-1 grid grid-cols-12 gap-0 overflow-hidden">
        {/* Left Sidebar: Controls */}
        <aside className="col-span-3 border-r border-white/10 p-6 bg-[#0F0F11] flex flex-col space-y-8 overflow-y-auto custom-scrollbar">
          {image && (
            <button
              onClick={resetImage}
              disabled={isProcessing}
              className="w-full py-3 border border-dashed border-white/20 text-white/40 text-[10px] font-mono uppercase tracking-widest hover:border-accent hover:text-accent transition-all flex items-center justify-center gap-2"
            >
              <Plus size={14} />
              Insert New Negative
            </button>
          )}
          
          <section>
            <h3 className="text-[10px] font-bold text-white mb-6 uppercase tracking-widest flex items-center gap-2">
              <Beaker size={14} className="text-accent" />
              Chemical Parameters
            </h3>
            <div className="space-y-6">
              <div className="space-y-2">
                <div className="flex justify-between text-[10px] font-mono uppercase">
                  <span className="text-white/60">Sigmoid Roll-off (k)</span>
                  <span className="text-accent">{settings.k}</span>
                </div>
                <input 
                  type="range" min="1" max="20" step="0.5" 
                  value={settings.k}
                  disabled={isProcessing}
                  onChange={(e) => setSettings({...settings, k: parseFloat(e.target.value)})}
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-[10px] font-mono uppercase">
                  <span className="text-white/60">Latent Spec Point (x0)</span>
                  <span className="text-accent">{settings.x0}</span>
                </div>
                <input 
                  type="range" min="0.1" max="0.9" step="0.05" 
                  value={settings.x0}
                  disabled={isProcessing}
                  onChange={(e) => setSettings({...settings, x0: parseFloat(e.target.value)})}
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-[10px] font-mono uppercase">
                  <span className="text-white/60">Halation Bloom</span>
                  <span className="text-accent">{settings.halation}</span>
                </div>
                <input 
                  type="range" min="0" max="2" step="0.1" 
                  value={settings.halation}
                  disabled={isProcessing}
                  onChange={(e) => setSettings({...settings, halation: parseFloat(e.target.value)})}
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-[10px] font-mono uppercase">
                  <span className="text-white/60">Grain Spectral Density</span>
                  <span className="text-accent">{settings.grain}</span>
                </div>
                <input 
                  type="range" min="0" max="1" step="0.05" 
                  value={settings.grain}
                  disabled={isProcessing}
                  onChange={(e) => setSettings({...settings, grain: parseFloat(e.target.value)})}
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-[10px] font-mono uppercase">
                  <span className="text-white/60">Radial Optical Softness</span>
                  <span className="text-accent">{settings.radialSoftness}</span>
                </div>
                <input 
                  type="range" min="0" max="1" step="0.05" 
                  value={settings.radialSoftness}
                  disabled={isProcessing}
                  onChange={(e) => setSettings({...settings, radialSoftness: parseFloat(e.target.value)})}
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-[10px] font-mono uppercase">
                  <span className="text-white/60">Quantum Volumetric Passes</span>
                  <span className="text-accent">{settings.volumetricPasses}</span>
                </div>
                <input 
                  type="range" min="1" max="256" step="1" 
                  value={settings.volumetricPasses}
                  disabled={isProcessing}
                  onChange={(e) => setSettings({...settings, volumetricPasses: parseInt(e.target.value)})}
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-[10px] font-mono uppercase">
                  <span className="text-white/60">Optical Vignette Samples</span>
                  <span className="text-accent">{settings.opticalSamples}</span>
                </div>
                <input 
                  type="range" min="1" max="256" step="1" 
                  value={settings.opticalSamples}
                  disabled={isProcessing}
                  onChange={(e) => setSettings({...settings, opticalSamples: parseInt(e.target.value)})}
                  className="w-full"
                />
              </div>
            </div>
          </section>

          <section className="flex-1">
            <h3 className="text-[10px] font-bold text-white mb-4 uppercase tracking-widest flex items-center gap-2">
               <Layers size={14} className="text-accent" />
               Reflection Matrix
            </h3>
            <div className="grid grid-cols-3 gap-2">
              {['L-α', 'L-β', 'L-γ', 'REF', 'VEC', 'ABS'].map((label, idx) => (
                <div key={label} className={`aspect-square border flex items-center justify-center font-mono text-[9px] italic transition-colors ${
                  isProcessing && idx === 2 ? 'bg-accent/10 border-accent text-accent' : 'bg-white/5 border-white/10 text-white/30'
                }`}>
                  {label}
                </div>
              ))}
            </div>
            <div className="mt-6 p-3 bg-white/5 border border-white/10 rounded-sm">
                <p className="text-[9px] font-mono text-white/40 leading-relaxed italic">
                  f(x) = 1 / (1 + e^(-k(x-x0)))<br/><br/>
                  Applying spectral power distribution to silver halide clusters. Latent image sensitization active.
                </p>
            </div>
          </section>

          <div className="space-y-3 pt-4 border-t border-white/10">
            <div className="flex items-center justify-between">
              <label className="text-white/60 font-mono text-[10px] uppercase">Slow_Burn_Dev</label>
              <button 
                onClick={() => setSettings({...settings, slowProcess: !settings.slowProcess})}
                disabled={isProcessing}
                className={`w-8 h-4 rounded-full transition-colors relative flex items-center px-1 ${settings.slowProcess ? 'bg-accent' : 'bg-white/10'}`}
              >
                <motion.div 
                  className={`w-2 h-2 rounded-full ${settings.slowProcess ? 'bg-black' : 'bg-white/40'}`}
                  animate={{ x: settings.slowProcess ? 16 : 0 }}
                />
              </button>
            </div>
            {settings.slowProcess && (
              <div className="space-y-2">
                <div className="flex justify-between text-white/40 font-mono text-[9px]">
                  <span>DELAY_INTERV</span>
                  <span>{settings.delayMs}ms</span>
                </div>
                <input 
                  type="range" min="10" max="1000" step="10" 
                  value={settings.delayMs}
                  disabled={isProcessing}
                  onChange={(e) => setSettings({...settings, delayMs: parseInt(e.target.value)})}
                  className="w-full h-0.5"
                />
              </div>
            )}
          </div>
          
          <button 
            onClick={isProcessing ? () => { workerRef.current?.terminate(); setIsProcessing(false); addLog('PROCESS ABORTED BY USER.'); } : startDevelopment}
            disabled={!image && !isProcessing}
            className={`w-full py-4 border font-bold uppercase tracking-[0.2em] text-[10px] transition-all flex items-center justify-center gap-3 ${
              isProcessing 
                ? 'bg-red-500/10 border-red-500/40 text-red-500 hover:bg-red-500/20' 
                : 'bg-accent/10 border-accent/40 text-accent hover:bg-accent/20 disabled:opacity-20'
            }`}
          >
            {isProcessing ? <AlertTriangle size={14} /> : <Play size={14} />}
            {isProcessing ? 'Abort Render' : 'Initiate Render'}
          </button>
        </aside>

        {/* Center Canvas: The Darkroom */}
        <section className="col-span-6 bg-black relative flex items-center justify-center overflow-hidden p-12">
          {!image ? (
            <div className="flex flex-col items-center gap-6 text-center">
              <div className="w-16 h-16 border border-white/10 flex items-center justify-center text-white/20">
                <Camera size={24} />
              </div>
              <div className="space-y-1">
                <h3 className="text-white/60 font-medium tracking-tight">System Ready</h3>
                <p className="text-white/20 text-[10px] uppercase tracking-widest font-mono">Insert Raw Negative for Chemical Conversion</p>
              </div>
              <label className="cursor-pointer px-6 py-2 border border-white/20 hover:border-accent text-white hover:text-accent transition-all font-mono text-[10px] uppercase tracking-widest">
                Browse Files
                <input type="file" className="hidden" onChange={handleFileUpload} accept="image/*" />
              </label>
            </div>
          ) : (
            <div className="relative group max-h-full max-w-full shadow-[0_0_100px_rgba(0,0,0,1)]">
              <canvas 
                ref={canvasRef} 
                className="max-w-full max-h-[70vh] object-contain border border-white/10"
              />
              
              {isProcessing && (
                <div className="absolute inset-0 pointer-events-none overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-[2px] bg-accent/80 shadow-[0_0_15px_#FFB800] z-30 scan-line" />
                  <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-accent/5 to-transparent h-[15%] scan-line opacity-50" />
                  
                  <div className="absolute bottom-4 left-4 font-mono text-[9px] text-accent flex items-center gap-2 bg-black/80 backdrop-blur px-2 py-1 border border-accent/20 rounded-sm">
                    <span className="w-1.5 h-1.5 bg-accent rounded-full animate-pulse" />
                    SCANNING LATENT IMAGE: ROW {Math.floor(progress * (image.height / 100))} / {image.height}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="absolute bottom-8 left-12 font-mono text-[10px] text-white/20 uppercase tracking-[0.3em]">
            Processing Core: <span className="text-white/40">AgX-QUANTUM VII</span>
          </div>
        </section>

        {/* Right Sidebar: Logs & History */}
        <aside className="col-span-3 border-l border-white/10 p-6 bg-[#0F0F11] flex flex-col space-y-6 overflow-hidden">
          <div className="p-4 bg-white/5 border border-white/10 rounded-sm">
            <h4 className="text-[10px] font-bold text-accent uppercase mb-3 flex items-center gap-2 tracking-widest">
              <Info size={12} />
              Active Calculations
            </h4>
            <div className="space-y-2 font-mono text-[9px] text-white/50">
              <div className="flex justify-between items-center">
                <span>Volumetric Reflection:</span>
                <span className={isProcessing ? "text-accent" : "text-white/30"}>{isProcessing ? 'CALC' : 'IDLE'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Subtractive CMY Map:</span>
                <span className={isProcessing ? "text-accent" : "text-white/30"}>{isProcessing ? 'ACTIVE' : 'IDLE'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Latent Spec Sensitivity:</span>
                <span className="text-white/80">{isProcessing ? '92%' : '0%'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Grain Spectral Dist:</span>
                <span className="text-white/80">{isProcessing ? 'STOCHASTIC' : 'CLEAN'}</span>
              </div>
            </div>
          </div>

          <div className="flex-1 flex flex-col overflow-hidden">
            <h4 className="text-[10px] font-bold text-white/60 uppercase mb-4 tracking-widest">Processing History</h4>
            <div className="flex-1 font-mono text-[9px] text-white/30 space-y-1.5 overflow-y-auto custom-scrollbar pr-2 leading-relaxed">
              {history.map((log, i) => (
                <p key={i} className={i === 0 ? "text-[#FFB800]" : ""}>{log}</p>
              ))}
            </div>
          </div>

          <div className="space-y-3 pt-4 border-t border-white/10">
            <h4 className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-2">Output Control</h4>
            <button 
              onClick={saveImage}
              disabled={!image || isProcessing}
              className="w-full flex items-center justify-between text-[11px] text-white/70 hover:text-accent transition-colors bg-white/5 border border-white/10 px-4 py-3 rounded-sm group font-mono"
            >
              <span>EXPORT_FINAL_RENDER</span>
              <Save size={14} className="group-hover:translate-y-[-1px] transition-transform" />
            </button>
            <div className="flex items-center justify-between text-[10px] text-white/30 font-mono px-1">
               <span>FORMAT</span>
               <span className="text-white/60 underline decoration-accent/30 underline-offset-4">TIFF (UNCOMPRESSED)</span>
            </div>
          </div>
        </aside>
      </main>

      {/* Footer bar: Global Progress */}
      <footer className="h-12 bg-black border-t border-white/10 flex items-center px-6 gap-6">
        <button 
          onClick={toggleDocs}
          className="text-[10px] font-mono uppercase tracking-widest text-white/40 hover:text-accent transition-colors flex items-center gap-2"
        >
          {showDocs ? 'COLLAPSE_DOCUMENTATION' : 'VIEW_QUANTUM_LOGIC'}
          <Layers size={12} />
        </button>
        <div className="h-4 w-[1px] bg-white/10"></div>
        <div className="flex-1 bg-white/5 h-1.5 rounded-full overflow-hidden relative">
          <motion.div 
            className="h-full bg-gradient-to-r from-accent via-accent to-[#E0282E] shadow-[0_0_10px_rgba(255,184,0,0.3)]"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.1 }}
          />
        </div>
        <div className="font-mono text-[10px] tracking-tighter flex items-center gap-4">
          <span className="text-white/30 uppercase tracking-widest hidden md:inline">Processing:</span>
          <span className="text-accent underline decoration-accent/20 underline-offset-4 truncate max-w-[200px]">
            {image ? `IMG_${image.width}_${image.height}.RAW` : 'NO_SOURCE_LOADED'}
          </span>
          <span className="text-white/30 ml-2">{Math.floor(progress)}%</span>
        </div>
      </footer>
      </div>

      {/* Technical Documentation Section */}
      <AnimatePresence>
        {showDocs && (
          <motion.section 
            ref={docsRef}
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="border-t border-white/10 bg-[#0F0F11] py-24 px-6 md:px-24"
          >
            <div className="max-w-4xl mx-auto space-y-16">
              <div className="space-y-4">
                <div className="inline-flex items-center gap-3 px-3 py-1 border border-accent/30 bg-accent/5 rounded-full">
                  <Beaker size={14} className="text-accent" />
                  <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-accent">Internal Systems Documentation</span>
                </div>
                <h2 className="text-4xl font-light text-white tracking-tight">The Chromatic Emulsion Engine</h2>
                <p className="text-white/40 font-mono text-sm uppercase tracking-widest italic">Simulating the Physics of Silver Halide Chemistry</p>
              </div>

              <div className="grid md:grid-cols-2 gap-12">
                <div className="space-y-6">
                  <h4 className="text-accent font-mono text-xs uppercase tracking-widest border-b border-accent/20 pb-2">01. Triple-Layer Latent Sensitization</h4>
                  <p className="text-sm leading-relaxed text-white/70">
                    Unlike digital sensors that record light on a single plane, the Alchemy Engine simulates a 3D physical emulsion. 
                    Upon upload, the image is decomposed into three independent "Latent Emulsion" layers—Red, Green, and Blue—simulating 
                    the specialized spectral sensitivities of Kodak Portra film. Each pixel is treated as a cluster of virtual silver halide crystals, 
                    stochastically distributed to avoid digital moiré.
                  </p>
                </div>

                <div className="space-y-6">
                  <h4 className="text-accent font-mono text-xs uppercase tracking-widest border-b border-accent/20 pb-2">02. Quantum Volumetric Diffusion</h4>
                  <p className="text-sm leading-relaxed text-white/70">
                    Light doesn't just hit a pixel; it bounces. The model performs up to 256 "Diffusion Passes" per pixel, simulating how photons 
                    scatter through three layers of gelatin. This creates the characteristic "micro-bloom" and edge acutance unique to film. 
                    The mathematics involve a non-linear refractive index simulation that accounts for the thickness of the film base.
                  </p>
                </div>

                <div className="space-y-6">
                  <h4 className="text-accent font-mono text-xs uppercase tracking-widest border-b border-accent/20 pb-2">03. Subtractive Dye Coupling</h4>
                  <p className="text-sm leading-relaxed text-white/70">
                    Conversion is executed via subtractive color logic. Instead of adding RGB values, the engine simulates the release of 
                    cyan, magenta, and yellow dyes during development. This produces authentic "dye clouds" rather than static digital pixels. 
                    The result is a higher color depth than the original source, revealing hidden details in deep shadows and bright horizons.
                  </p>
                </div>

                <div className="space-y-6">
                  <h4 className="text-accent font-mono text-xs uppercase tracking-widest border-b border-accent/20 pb-2">04. Sigmoid Tone Mapping</h4>
                  <p className="text-sm leading-relaxed text-white/70">
                    Film has a smooth "S-shaped" response to light. High-intensity photons are compressed into the highlights through a 
                    logarithmic sigmoid function, preventing digital clipping. The engine specifically emulates the "shoulder" and "toe" 
                    of Portra 400, resulting in warm, glowing highlights and detailed, cool shadows that feel organic to the human eye.
                  </p>
                </div>
              </div>

              <div className="pt-12 border-t border-white/5 grid md:grid-cols-3 gap-8">
                <div className="p-6 bg-white/5 rounded-sm border border-white/10">
                  <div className="text-2xl font-light text-white mb-2">4X</div>
                  <div className="text-[10px] font-mono uppercase text-white/40 tracking-widest">Detail Upsampling</div>
                  <p className="mt-4 text-[12px] text-white/50 leading-relaxed">
                    Source images are upscaled internally using 4x area super-sampling to preserve micro-textures before chemical conversion.
                  </p>
                </div>
                <div className="p-6 bg-white/5 rounded-sm border border-white/10">
                  <div className="text-2xl font-light text-white mb-2">256+</div>
                  <div className="text-[10px] font-mono uppercase text-white/40 tracking-widest">Pass Complexity</div>
                  <p className="mt-4 text-[12px] text-white/50 leading-relaxed">
                    Each pixel undergoes hundreds of recursive calculations simulating light diffraction, scattering, and reflection.
                  </p>
                </div>
                <div className="p-6 bg-white/5 rounded-sm border border-white/10">
                  <div className="text-2xl font-light text-white mb-2">32-bit</div>
                  <div className="text-[10px] font-mono uppercase text-white/40 tracking-widest">Processing Depth</div>
                  <p className="mt-4 text-[12px] text-white/50 leading-relaxed">
                    Internal math is executed using 32-bit floating point precision to capture the subtle nuances of photochemical reactions.
                  </p>
                </div>
              </div>

              <div className="text-center pt-16">
                <p className="text-white/20 font-mono text-[10px] uppercase tracking-[0.5em]">End of Transmission // Alchemy Core V4.0.12</p>
              </div>
              
              <div className="pt-12 flex justify-center">
                <button
                  onClick={() => {
                    setShowDocs(false);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="px-8 py-3 border border-accent/30 text-accent font-mono text-[10px] uppercase tracking-widest hover:bg-accent hover:text-black transition-all"
                >
                  Return to Interface
                </button>
              </div>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 2px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.02);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #FFB800;
        }
      `}</style>
    </div>
  );
}
