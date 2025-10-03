# Interactive Motion Planning Visualizer

## Description

This is an interactive web-based pedagogical aid that illustrates shortest-path computation through visibility graphs and maximum-clearance path planning with generalized Voronoi diagrams. The application allows users to define polygonal obstacles, manipulate start and end points, and visualize both motion-planning algorithms to examine their computation and traversal of the environment.

## Getting Started

1. Install Node.js

   Make sure you have the latest LTS version of Node.js installed. You can download it from [https://nodejs.org/en/download](https://nodejs.org/en/download).

   Run these commands to check that it is installed properly:

   ```
   node -v
   npm -v
   ```

2. Clone the repository

   ```
   git clone https://github.com/jyoon926/motion-planning-visualizer.git
   cd motion-planning-visualizer
   ```

3. Install dependencies

   ```
   npm install
   ```

4. Run the development server

   ```
   npm run dev
   ```

5. Open [http://localhost:5173](http://localhost:5173) to view in the browser.

## Linting & Formatting

1. Run ESLint to check for issues:

   ```
   npm run lint
   ```

2. Automatically fix ESLint & Prettier issues:

   ```
   npm run format
   ```

> A GitHub Actions workflow runs on push/pull requests to check ESLint rules automatically.

## Project structure

```
src/
├─ algorithms/      # Pathfinding & computational geometry logic
├─ components/      # React components for UI & visualization
```
