import express, { Application } from 'express';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadContent, LoadResult } from './loader.js';
import { createApiRoutes } from './routes/api.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Server configuration
 */
export interface ServerConfig {
  /** Port to listen on (default: 3000) */
  port: number;
  /** Content directory to load .md files from */
  contentDir: string;
}

/**
 * Create and configure the Express application
 */
export function createApp(data: LoadResult): Application {
  const app = express();
  
  // Middleware
  app.use(express.json());
  
  // API routes
  app.use('/api', createApiRoutes(data));
  
  // Health check
  app.get('/health', (_req, res) => {
    res.json({ 
      status: 'ok',
      entities: data.entityIndex.size,
      documents: data.corpus.size
    });
  });
  
  // Static files (for future client)
  const publicDir = path.join(__dirname, '..', 'public');
  app.use(express.static(publicDir));
  
  // Fallback for SPA routing (if index.html exists)
  app.use((req, res, next) => {
    // Skip API routes
    if (req.path.startsWith('/api')) {
      next();
      return;
    }
    
    const indexPath = path.join(publicDir, 'index.html');
    res.sendFile(indexPath, (err) => {
      if (err) {
        // No index.html yet, just return 404
        res.status(404).json({ error: 'Not found' });
      }
    });
  });
  
  return app;
}

/**
 * Start the server
 */
function bootstrap() {
  const args = process.argv.slice(2);
  const portArg = args.find(a => a.startsWith('--port='));
  const port = portArg ? parseInt(portArg.split('=')[1], 10) : 3000;
  
  // Default to workspace root (go up from dist/server.js)
  const contentDir = path.resolve(__dirname, '..');
  
  console.log(`Loading content from: ${contentDir}`);
  const data = loadContent({ contentDir });
  
  console.log(`Loaded ${data.corpus.size} documents, ${data.entityIndex.size} entities`);
  
  if (data.errors.length > 0) {
    console.warn('Warnings:', data.errors);
  }
  
  const app = createApp(data);
  
  const server = app.listen(port, () => {
    console.log(`Worldr API listening on http://localhost:${port}`);
  });
  
  // Graceful shutdown handler
  const shutdown = (signal: string) => {
    console.log(`\nReceived ${signal}, shutting down gracefully...`);
    
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
    
    // Force exit after 10 seconds
    setTimeout(() => {
      console.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  };
  
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap();
