# BgRemove - Privacy-First Background Removal Tool

🚀 A fast, client-side background removal web app that runs 100% in your browser.

## Features

- ✨ AI-powered background removal using U²-Net
- 🔒 Complete privacy - no data leaves your device
- ⚡ Hardware-accelerated (WebGPU/WebGL/WASM)
- 📱 Mobile and desktop support
- 🎨 Multiple background options
- ✏️ Refine brush with undo/redo
- 📦 Batch processing
- 💾 Installable PWA
- 🌐 Works offline

## Quick Start

1. Clone this repository
2. Add `u2netp.onnx` model to `/public/` directory
3. Serve via HTTP: `python -m http.server 8000`
4. Open http://localhost:8000

## Deploy to GitHub Pages

1. Push all files to GitHub
2. Go to Settings → Pages
3. Select source: `main` branch / root
4. Live at: `https://shaderindia.github.io/Bgtemove/`

## Model Download

Download U²-Net model (~4.7 MB):
- u2netp.onnx from [ONNX Model Zoo](https://github.com/onnx/models)

## Browser Support

- Chrome 94+ (WebGPU in 113+)
- Edge 94+
- Safari 16.4+
- Firefox 90+

## Performance

Mid-range laptop targets:
- WebGPU: < 1s for 12MP image
- WebGL: < 1.5s
- WASM: < 4s

## License

MIT License

## Privacy

100% client-side processing. No tracking, no analytics, no servers.
