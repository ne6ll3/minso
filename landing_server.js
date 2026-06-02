// MineSO Landing — servidor estático para Render
// Serve index.html em qualquer rota
const http = require('http');
const fs   = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const HTML = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

http.createServer((req, res) => {
  res.writeHead(200, {
    'Content-Type':           'text/html; charset=utf-8',
    'Cache-Control':          'public, max-age=300',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(HTML);
}).listen(PORT, () => console.log('Landing a correr na porta ' + PORT));
