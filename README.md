# Gym Progress Report

> Web application enabling personal trainers to collect and analyze weekly progress reports from their clients.

## Table of Contents
1. [Project Description](#project-description)
2. [Tech Stack](#tech-stack)
3. [Getting Started Locally](#getting-started-locally)
4. [Available Scripts](#available-scripts)
5. [Project Scope](#project-scope)
6. [Project Status](#project-status)
7. [License](#license)

## Project Description
Gym Progress Report is a **Progressive Web App (PWA)** and trainer dashboard that streamlines the workflow of collecting progress data. Clients submit a weekly report containing three photos and body measurements, while trainers gain a consolidated view of trends and missing reports. A super-admin role has full system oversight.

## Tech Stack
- **Frontend**: Astro 5, React 19, TypeScript 5
- **Styling**: Tailwind 4, Shadcn/ui
- **Backend-as-a-Service**: Supabase (PostgreSQL, Auth, Storage)
- **AI Integration**: OpenRouter.ai for LLM access
- **Testing**: Vitest, React Testing Library, Playwright, MSW
- **CI/CD & Hosting**: GitHub Actions, Docker image on DigitalOcean
- **Tooling**: ESLint, Prettier, Husky, lint-staged

## Getting Started Locally
### Prerequisites
- **Node.js 22.14.0** (see `.nvmrc`)
- **pnpm** or **npm** (examples use `npm`)

```bash
# install dependencies
npm install

# start development server
npm run dev
```
The app is now live at <http://localhost:3000> with hot-reloading.

To build for production:
```bash
npm run build
```
Then preview the build locally:
```bash
npm run preview
```

## Available Scripts
| Script | Description |
|--------|-------------|
| `dev` | Start Astro in development mode with hot reload |
| `build` | Build a production-ready static site |
| `preview` | Preview the production build locally |
| `astro` | Run arbitrary Astro CLI commands |
| `lint` | Lint all source files with ESLint |
| `lint:fix` | Lint and automatically fix issues |
| `format` | Format code with Prettier |

## Project Scope
**In scope (MVP)**
- Roles: super-admin, trainer, client
- Client PWA for submitting reports (online-only writes)
- Trainer web panel for overview and visualisation
- Image upload (max 3 per report) with compression & 6-month retention
- KPI dashboard highlighting clients without a report this week

**Out of scope (MVP)**
- Native mobile apps
- AI-generated nutrition plans
- Paid subscriptions
- Push/SMS/e-mail notifications
- Self-service password reset
- Advanced analytics & PDF export

## Project Status
🚧 **Work in progress** – core MVP features are under active development.

Planned milestones:
1. Authentication & role management
2. Client PWA submission flow
3. Trainer dashboard visualisations
4. Super-admin oversight tools

## License
TBD – the project currently has no formal license. Consider adding an OSI-approved license (e.g. MIT) before public release.
