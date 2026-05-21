const axios = require("axios");
const { jsonrepair } = require("jsonrepair");

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODELS = ["openrouter/free", "mistralai/mistral-7b-instruct:free"];

function cleanAIText(text) {
  let cleaned = text || "";
  cleaned = cleaned.trim();
  cleaned = cleaned
    .replace(/```json/g, "")
    .replace(/```javascript/g, "")
    .replace(/```js/g, "")
    .replace(/```/g, "")
    .trim();

  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");

  if (firstBrace !== -1 && lastBrace !== -1) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  }

  return cleaned;
}

function parseAIJson(text) {
  const cleaned = cleanAIText(text);
  try {
    return JSON.parse(cleaned);
  } catch (error) {
    try {
      const repaired = jsonrepair(cleaned);
      return JSON.parse(repaired);
    } catch (repairError) {
      throw new Error("AI returned invalid JSON");
    }
  }
}

function buildFullStackPrompt(userPrompt, theme) {
  return `
You are an expert MERN full-stack developer.

Create a complete full-stack web app based on this prompt: "${userPrompt}"

Theme: ${theme || "modern"}

Return ONLY valid JSON with this EXACT structure:

{
  "frontend": {
    "packageJson": "package.json with React + Vite dependencies",
    "indexHtml": "index.html file",
    "mainJsx": "src/main.jsx file",
    "appJsx": "src/App.jsx file with full React component",
    "appCss": "src/App.css file with styling"
  },
  "backend": {
    "packageJson": "package.json with Express dependencies",
    "serverJs": "server.js file with Express API",
    "envExample": ".env.example file"
  },
  "readme": "README.md with setup instructions"
}

Requirements:
FRONTEND:
- Use React functional components with hooks
- Use axios for API calls
- API URL: const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000"
- Create a beautiful, responsive UI based on the prompt
- Include loading states and error handling

BACKEND:
- Node.js + Express
- CORS enabled
- MongoDB connection using mongoose
- RESTful API endpoints based on the prompt
- Environment variables for PORT and MONGO_URI
- Error handling middleware

Make the app fully functional based on the user's prompt. If the prompt asks for a todo app, create todo CRUD. If it asks for a blog, create blog system. If it asks for an e-commerce, create product listing and cart.
`;
}

async function callOpenRouter(model, prompt) {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error("OPENROUTER_API_KEY missing in .env");
  }

  const response = await axios.post(
    OPENROUTER_URL,
    {
      model,
      messages: [
        {
          role: "system",
          content: "You are an expert MERN full-stack developer. Generate complete, working code. Return ONLY valid JSON.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.4,
      max_tokens: 8000,
    },
    {
      timeout: 180000,
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:5173",
        "X-Title": "Prompt2Site",
      },
    }
  );

  const text = response.data?.choices?.[0]?.message?.content;
  if (!text || !text.trim()) {
    throw new Error("AI returned empty response");
  }

  return parseAIJson(text);
}

async function generateFullStackCode(prompt, theme) {
  const finalPrompt = buildFullStackPrompt(prompt, theme);
  let lastError = null;

  for (const model of MODELS) {
    try {
      console.log(`Generating full-stack code with ${model}...`);
      const result = await callOpenRouter(model, finalPrompt);
      
      if (!result.frontend || !result.backend) {
        throw new Error("Missing frontend or backend");
      }
      
      if (!result.frontend.appJsx || !result.backend.serverJs) {
        throw new Error("Missing App.jsx or server.js");
      }
      
      console.log("✅ Full-stack code generated successfully");
      return result;
    } catch (error) {
      lastError = error;
      console.error(`Model ${model} failed:`, error.message);
    }
  }

  // Return mock data if AI fails
  return getMockFullStackCode(prompt, theme);
}

function getMockFullStackCode(prompt, theme) {
  const appName = prompt.substring(0, 30).replace(/[^a-z0-9]/gi, '-').toLowerCase();
  
  return {
    frontend: {
      packageJson: `{
  "name": "${appName}-frontend",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "axios": "^1.5.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "@vitejs/plugin-react": "^4.0.0",
    "vite": "^4.4.0"
  }
}`,
      indexHtml: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${prompt.substring(0, 50)}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>`,
      mainJsx: `import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './App.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)`,
      appJsx: `import { useState, useEffect } from 'react'
import axios from 'axios'
import './App.css'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

function App() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [formData, setFormData] = useState({})

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      const response = await axios.get(\`\${API_URL}/api/items\`)
      setData(response.data)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      await axios.post(\`\${API_URL}/api/items\`, formData)
      fetchData()
      setFormData({})
    } catch (err) {
      setError(err.message)
    }
  }

  const handleDelete = async (id) => {
    try {
      await axios.delete(\`\${API_URL}/api/items/\${id}\`)
      fetchData()
    } catch (err) {
      setError(err.message)
    }
  }

  if (loading) return <div className="loading">Loading...</div>
  if (error) return <div className="error">Error: {error}</div>

  return (
    <div className="app">
      <header className="header">
        <h1>${prompt.substring(0, 50)}</h1>
        <p>Full-Stack Application</p>
      </header>
      
      <main className="main">
        <form onSubmit={handleSubmit} className="form">
          <input
            type="text"
            placeholder="Enter item..."
            value={formData.name || ''}
            onChange={(e) => setFormData({ name: e.target.value })}
          />
          <button type="submit">Add</button>
        </form>
        
        <div className="items">
          {data.map((item) => (
            <div key={item._id} className="item">
              <span>{item.name}</span>
              <button onClick={() => handleDelete(item._id)}>Delete</button>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}

export default App`,
      appCss: `* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  min-height: 100vh;
}

.app {
  min-height: 100vh;
}

.header {
  background: white;
  padding: 2rem;
  text-align: center;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
}

.header h1 {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  margin-bottom: 0.5rem;
}

.main {
  max-width: 800px;
  margin: 2rem auto;
  padding: 0 1rem;
}

.form {
  display: flex;
  gap: 1rem;
  margin-bottom: 2rem;
}

.form input {
  flex: 1;
  padding: 0.75rem;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  font-size: 1rem;
}

.form button {
  padding: 0.75rem 1.5rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
}

.items {
  background: white;
  border-radius: 12px;
  padding: 1rem;
}

.item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border-bottom: 1px solid #e0e0e0;
}

.item button {
  padding: 0.25rem 0.75rem;
  background: #ff4444;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.loading, .error {
  text-align: center;
  padding: 2rem;
  font-size: 1.2rem;
}

.error {
  color: #ff4444;
}`
    },
    backend: {
      packageJson: `{
  "name": "${appName}-backend",
  "version": "1.0.0",
  "description": "Backend for full-stack app",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "mongoose": "^7.5.0",
    "dotenv": "^16.3.0"
  },
  "devDependencies": {
    "nodemon": "^3.0.1"
  }
}`,
      serverJs: `const express = require('express')
const cors = require('cors')
const mongoose = require('mongoose')
require('dotenv').config()

const app = express()

// Middleware
app.use(cors())
app.use(express.json())

// MongoDB Schema
const itemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
})

const Item = mongoose.model('Item', itemSchema)

// Routes
app.get('/api/items', async (req, res) => {
  try {
    const items = await Item.find().sort({ createdAt: -1 })
    res.json(items)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.post('/api/items', async (req, res) => {
  try {
    const item = new Item({ name: req.body.name })
    await item.save()
    res.status(201).json(item)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.delete('/api/items/:id', async (req, res) => {
  try {
    await Item.findByIdAndDelete(req.params.id)
    res.json({ message: 'Item deleted' })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' })
})

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/app')
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('MongoDB error:', err))

const PORT = process.env.PORT || 5000
app.listen(PORT, () => {
  console.log(\`✅ Server running on port \${PORT}\`)
})`,
      envExample: `PORT=5000
MONGO_URI=mongodb://localhost:27017/fullstack-app`
    },
    readme: `# ${prompt}

## Full-Stack Application

Generated by Prompt2Site

### Setup Instructions

#### Backend Setup
\`\`\`bash
cd backend
npm install
cp .env.example .env
# Edit .env with your MongoDB URI
npm run dev
\`\`\`

#### Frontend Setup
\`\`\`bash
cd frontend
npm install
npm run dev
\`\`\`

### Deployment

1. **Backend**: Deploy to Render/Railway/Heroku
2. **Frontend**: Deploy to Netlify/Vercel
3. Add \`VITE_API_URL\` to your frontend environment variables

### Features
- Full CRUD operations
- MongoDB database
- React frontend with Vite
- Express backend API

---
Generated with ❤️ by Prompt2Site`
  };
}

module.exports = { generateFullStackCode };