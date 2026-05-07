/// <reference lib="webworker" />

/**
 * Kodak Alchemy Processing Worker v2.0
 * Deep Chemical Simulation & 3D Pixel Physics
 */

onmessage = async (e: MessageEvent) => {
  const { imageData, width, height, settings } = e.data;
  const pixels = new Uint8ClampedArray(imageData); 
  
  if (pixels.length !== width * height * 4) {
    console.error('Worker: Dimension mismatch', { bufferLength: pixels.length, expected: width * height * 4 });
  }

  const output = new Uint8ClampedArray(pixels.length);
  
  // 1. Triple-Layer Latent Image System (Simulating independent R, G, B emulsion layers)
  // Each layer responds to different light frequencies, matching Kodak Portra chemistry
  const latentR = new Float32Array(width * height);
  const latentG = new Float32Array(width * height);
  const latentB = new Float32Array(width * height);
  
  const { 
    k = 10, x0 = 0.5, halationStrength = 0.5, 
    grainStrength = 0.2, radialSoftness = 0.5,
    volumetricPasses = 16, opticalSamples = 20
  } = settings;

  const sigmoid = (x: number, stockK: number, stockX0: number) => 1 / (1 + Math.exp(-stockK * (x - stockX0)));

  const centerX = width / 2;
  const centerY = height / 2;
  const maxDist = Math.sqrt(centerX * centerX + centerY * centerY);

  // --- PASS 1: TRIPLE-LAYER LATENT FORMATION (Silver Halide Sensitization) ---
  for (let i = 0; i < width * height; i++) {
    latentR[i] = pixels[i * 4] / 255;
    latentG[i] = pixels[i * 4 + 1] / 255;
    latentB[i] = pixels[i * 4 + 2] / 255;
  }

  // --- PASS 2: DEEP CHEMICAL REACTION & VOLUMETRIC DIFFUSION ---
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const li = y * width + x;
      
      let r = latentR[li];
      let g = latentG[li];
      let b = latentB[li];

      // 1. HIGH-DENSITY RADIAL SOFTNESS (Optical Vignetting Simulation)
      const dx = x - centerX;
      const dy = y - centerY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const blurRadius = (dist / maxDist) * radialSoftness * 40;
      
      if (blurRadius > 0.3) {
        let sr = 0, sg = 0, sb = 0;
        const samples = opticalSamples; 
        for (let s = 0; s < samples; s++) {
          const angle = (s / samples) * Math.PI * 2 + (x * 0.05) + (y * 0.05);
          // Complex spiral sampling for more organic blur
          const spiralOff = Math.sqrt(s / samples) * blurRadius;
          const offX = Math.floor(x + Math.cos(angle) * spiralOff);
          const offY = Math.floor(y + Math.sin(angle) * spiralOff);
          
          if (offX >= 0 && offX < width && offY >= 0 && offY < height) {
            const ni = offY * width + offX;
            sr += latentR[ni];
            sg += latentG[ni];
            sb += latentB[ni];
          } else {
            sr += r; sg += g; sb += b;
          }
        }
        r = sr / samples;
        g = sg / samples;
        b = sb / samples;
      }

      // 2. QUANTUM VOLUMETRIC PASSTHROUGH (Extreme Detail Recovery)
      let energySum = (r + g + b) / 3;
      
      for (let pass = 1; pass <= volumetricPasses; pass++) {
        // Chaotic photon pathing
        const theta = (x * 0.012 + y * 0.012 + pass * 2.1) * Math.PI;
        const phi = (x * 0.007 - y * 0.022 + pass * 1.3) * Math.PI;
        const noiseBase = Math.sin(x * 0.5) * Math.cos(y * 0.5);
        const omega = (dist * 0.00008 + pass * 0.4 + noiseBase * 0.1);
        
        const refraction = 0.005 * Math.pow(pass, 0.4);
        const rx = Math.sin(theta + omega) * Math.cos(phi) * refraction;
        const ry = Math.sin(theta - omega) * Math.sin(phi) * refraction;
        
        const nx = Math.min(width - 1, Math.max(0, Math.floor(x + rx * width)));
        const ny = Math.min(height - 1, Math.max(0, Math.floor(y + ry * height)));
        const nli = ny * width + nx;
        
        // Inter-layer dye interference
        const nr = latentR[nli];
        const ng = latentG[nli];
        const nb = latentB[nli];

        // Complex cross-channel bleed
        r += (nr - r) * (0.1 / pass) + (ng * 0.01 / pass);
        g += (ng - g) * (0.1 / pass) + (nb * 0.01 / pass);
        b += (nb - b) * (0.1 / pass) + (nr * 0.01 / pass);
        
        energySum = (energySum + (nr + ng + nb) / 3) * 0.5;
      }

      // 3. Halation (Enhanced Red Dye Saturation)
      if (energySum > 0.7) {
        const glow = Math.pow(energySum - 0.7, 1.5) * halationStrength * 2.0;
        r += glow;
        g += glow * 0.05;
        b += glow * 0.02;
      }

      // 4. Photochemical Noise (Organic Silver Halide Grain)
      const seed = (x * 12.9898 + y * 78.233 + energySum) % 1;
      const noise = (Math.sin(seed * 43758.5453) * 0.5 + 0.5);
      const grainIntensity = Math.pow(1.0 - Math.abs(energySum - 0.5) * 2, 2.5);
      const grain = (noise - 0.5) * grainStrength * grainIntensity;
      
      r += grain; g += grain; b += grain;

      // 5. Film Stock Tone Mapping (Complex Sigmoid Curves)
      // Kodak Portra 400 has a warm bias in mids and cold bias in extreme lows
      r = sigmoid(r * 1.05 + 0.02, k, x0);
      g = sigmoid(g * 0.98 + 0.01, k * 1.02, x0 * 0.98);
      b = sigmoid(b * 0.94 + 0.04, k * 0.95, x0 * 1.05);

      output[i] = Math.min(255, Math.max(0, r * 255));
      output[i+1] = Math.min(255, Math.max(0, g * 255));
      output[i+2] = Math.min(255, Math.max(0, b * 255));
      output[i+3] = 255;
    }

    // Row Progress Update (Batched for high-res)
    if (y % 8 === 0 || y === height - 1) {
        const startIdx = y * width * 4;
        const endIdx = (y + 1) * width * 4;
        const rowData = output.slice(startIdx, endIdx);
        postMessage({ 
            type: 'progress', 
            y, 
            rowData: rowData,
            progress: (y / height) * 100 
        });
        
        if (settings.slowProcess) {
            const delay = settings.delayMs || 50;
            const start = performance.now();
            while (performance.now() - start < delay) { }
        }
    }
  }


  // Final completion using Transferable for 8K efficiency
  const finalBuffer = output.buffer;
  postMessage({ type: 'complete', buffer: finalBuffer }, [finalBuffer]);
};

