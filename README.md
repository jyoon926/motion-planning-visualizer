# Interactive Motion Planning Visualizer

## Getting Started

1. Clone the repository

```
git clone https://github.com/jyoon926/motion-planning-visualizer.git
cd motion-planning-visualizer
```

2. Install dependencies

```
npm install
```

3. Run the development server

```
npm run dev
```

4. Open [http://localhost:5173](http://localhost:5173) to view in the browser.

## Linting & Formatting

Run ESLint to check for issues:

```
npm run lint
```

Automatically fix ESLint & Prettier issues:

```
npm run format
```

A GitHub Actions workflow runs on push/pull requests to check ESLint rules automatically.

## Project structure

```
src/
├─ algorithms/      # Pathfinding & computational geometry logic
├─ components/      # React components for UI & visualization
├─ hooks/           # Custom React hooks for state & path computation
├─ utils/           # Types and other useful utils
```
