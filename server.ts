import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Example: Advanced Matching Logic
  // This could be called from the frontend to get personalized recommendations
  app.post('/api/recommendations', (req, res) => {
    const { userProfile, allStudents } = req.body;
    
    if (!userProfile || !allStudents) {
      return res.status(400).json({ error: 'Missing user profile or student list' });
    }

    // Simple interest-based scoring
    const scoredStudents = allStudents
      .filter((s: any) => s.uid !== userProfile.uid)
      .map((student: any) => {
        const commonInterests = student.interests.filter((i: string) => 
          userProfile.interests.includes(i)
        );
        
        let score = commonInterests.length * 10;
        
        // Bonus for same department
        if (student.department === userProfile.department) {
          score += 5;
        }
        
        // Bonus for same level
        if (student.level === userProfile.level) {
          score += 3;
        }

        return { ...student, matchScore: score };
      })
      .sort((a: any, b: any) => b.matchScore - a.matchScore);

    res.json(scoredStudents.slice(0, 10));
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
