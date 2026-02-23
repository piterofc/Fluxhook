const express = require('express');
const path = require('path');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware para JSON
app.use(express.json({ limit: '50mb' }));

// Servir arquivos estáticos da pasta raiz
app.use(express.static(__dirname));

// Criar agente HTTPS customizado para resolver problemas de SSL
const httpsAgent = new https.Agent({
  keepAlive: false, // Desabilita keep-alive para evitar socket hang up
  rejectUnauthorized: true,
  timeout: 30000, // Timeout de 30 segundos
});

// Rota proxy para enviar webhooks (evita problemas de CORS)
app.post('/send-webhook', async (req, res) => {
  const { url, payload } = req.body;

  if (!url || !payload) {
    return res.status(400).json({ error: 'URL e payload são obrigatórios' });
  }

  try {
    const fetch = (await import('node-fetch')).default;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'User-Agent': 'Fluxhook/1.0'
      },
      body: JSON.stringify(payload),
      agent: httpsAgent, // Usa o agente HTTPS customizado
      timeout: 30000 // Timeout de 30 segundos
    });

    if (response.status === 204 || response.ok) {
      res.json({ success: true, status: response.status });
    } else {
      const text = await response.text();
      res.status(response.status).json({ error: text });
    }
  } catch (error) {
    console.error('Erro ao enviar webhook:', error);
    res.status(500).json({ error: error.message });
  }
});

// Rota principal
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Fluxhook rodando em http://localhost:${PORT}`);
});
