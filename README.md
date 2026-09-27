# Gesture Games 🎮🖐️

A collection of web-based minigames controlled entirely by **hand gestures** through your webcam. Built with Vanilla JS, HTML5 Canvas, and the cutting-edge MediaPipe Tasks Vision API.

Designed to run smoothly even on "potato PCs" (low-end hardware) by utilizing CPU-optimized WASM models and highly performant 2D canvas rendering.

## 🕹️ Games Included

1. 🎈 **Balloon Pop** - Point your finger as a cursor and pinch to pop floating balloons. Dodge the bombs!
2. 🍉 **Fruit Slice** - Swipe your finger fast like a sword to slice flying fruits. Just like Fruit Ninja!
3. 🤘 **RPS Battle** - Play Rock, Paper, Scissors against the computer using real hand gestures!
4. 🏎️ **Car Drive** - Tilt your hand like a steering wheel to drive. Open your palm to accelerate, make a fist to brake.

## 🛠️ Tech Stack
- **Vanilla JavaScript (ES Modules)**
- **HTML5 Canvas 2D API** (No WebGL required)
- **MediaPipe Tasks Vision** (`@mediapipe/tasks-vision`)
- **Vite** (Dev server & bundler)
- **Web Audio API** (100% procedural sound effects, zero audio files to load)

## 🚀 How to Run Locally

1. Make sure you have [Node.js](https://nodejs.org/) installed.
2. Clone this repository.
3. Open a terminal in the project folder and run:

```bash
npm install
npm run dev
```

4. Open `http://localhost:5173` in your browser.
5. Allow camera permissions when prompted.

## 📸 Privacy Note
This game runs **100% locally** in your browser. No video data or images are ever sent to a server. The MediaPipe hand-tracking model is downloaded once to your machine and runs completely client-side.
