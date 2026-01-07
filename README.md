# Org Viz MVP

A high-performance organizational chart visualization tool built with React, Vite, and D3+Canvas.

## Features
- **Data Import**: Supports CSV and XLSX files with flexible schema validation.
- **Two Views**:
  - **Org Chart**: Classic top-down tree view with pan/zoom and SoC details.
  - **Layered Circle**: Concentric ring visualization for hierarchy depth and department sizing.
- **Interactive**:
  - Search by employee name.
  - Click to view details (Headcount, FTE, Manager, etc.).
  - Department-coded coloring (consistent departmental colors).
  - Span of Control (SoC) metrics visualization.
- **Performance**: Canvas-based rendering optimized for 10k+ nodes.

## Technology Stack
- **Frontend**: React, TypeScript, Vite
- **State**: Zustand
- **Visualization**: D3 (Hierarchy/Layout) + HTML5 Canvas (Rendering)
- **Data**: PapaParse (CSV), SheetJS (XLSX)

## Running Locally

### Prerequisites
- Docker & Docker Compose OR Node.js 20+

### Option A: Critical Path (Docker) - Recommended
The app is containerized for easy deployment.

```bash
docker compose up
```

Access the app at `http://localhost:8080`.

### Option B: Development Mode (Node)

```bash
npm install
npm run dev
```

## Data Schema

The upload expects a CSV or Excel file with the following columns:

| Column | Required | Description |
|--------|----------|-------------|
| `employee_id` | Yes | Unique ID |
| `employee_name` | Yes | Full Name |
| `reports_to_id` | Yes | ID of the manager |
| `department_name` | Yes | Department |
| `job_title` | No | Job Title |
| `location` | No | Location |
| `fte` | No | Full Time Equivalent (Default 1.0) |

A `sample_data.csv` is included in the project root for testing.

## Performance
Strategies used for 10k node scale:
- **Canvas Rendering**: Bypasses DOM overhead associated with thousands of SVG elements.
- **Efficient Layout**: D3 calculates coordinates once; Canvas redraws only on frame updates (transform/hover).
- **Hit Detection**: Linear spatial scan (optimized) for interaction.

## Architecture
- `src/data`: Schema definitions, Parser logic (CSV->Tree), Zustand Store.
- `src/components/views`: specific visualization components (`OrgChartView`, `LayeredCircleView`).
- `src/components/layout`: Application shell and sidebars.
