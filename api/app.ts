import { buildApp } from "../server/_core/index";

// Vercel serverless entry: 1 Express app chi phuc vu /api/*.
// KHONG goi serveStatic() o day: front tinh do Vercel serve tu dist/public
// (xem vercel.json). Neu goi, catch-all "*" se sendFile mot index.html khong
// ton tai trong bundle serverless -> ENOENT 500 cho moi /api/* khong khop route.
const app = buildApp();

export default app;
