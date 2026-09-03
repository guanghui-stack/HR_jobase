import { buildApp } from "../server/_core/index";
import { serveStatic } from "../server/_core/vite";

// Vercel serverless entry: 1 Express app phuc vu /api/*.
// Front tĩnh do Vercel serve tu dist/public (vercel.json).
const app = buildApp();
serveStatic(app);

export default app;
