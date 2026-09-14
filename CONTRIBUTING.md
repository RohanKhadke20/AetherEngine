# Contributing to AetherEngine

Thank you for your interest in contributing to AetherEngine! Whether you are implementing new force field modifiers, optimizing the 2D Euclidean vector library, or contributing additional headless test assertions, we welcome your contributions.

---

## 🛠️ Development & Headless Testing

1. **Clone the Repo**:
   ```bash
   git clone https://github.com/RohanKhadke20/AetherEngine.git
   cd AetherEngine
   ```

2. **Run Headless Physics Assertions**:
   ```bash
   node test.mjs
   ```
   All 35 physics assertions must pass before submitting any pull request.

3. **Serve Locally**:
   ```bash
   python -m http.server 3000
   ```
   Open `http://localhost:3000` to test Canvas rendering and HUD interactions.
