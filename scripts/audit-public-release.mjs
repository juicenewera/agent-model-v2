import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = new URL('..', import.meta.url).pathname.replace(/^\/(?:[A-Za-z]:)/, (m) => m.slice(1));
const ignorados = new Set(['node_modules', '.git', 'package-lock.json']);
const extensoesTexto = new Set(['.js', '.json', '.md', '.txt', '.yml', '.yaml', '.env', '.example', '.html', '.css']);
const proibidos = [
  { nome: 'arquivo de ambiente real', re: /(^|[\\/])\.env(?:\.(?!example$)[^\\/]*)?$/i, somenteNome: true },
  { nome: 'token JWT', re: /\beyJ[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{10,}\b/ },
  { nome: 'chave OpenAI/OpenRouter', re: /\b(?:sk|sk-or)-[a-zA-Z0-9_-]{20,}\b/ },
  { nome: 'chave de API explícita', re: /(?:AKIA|AIza)[A-Za-z0-9_-]{16,}/ },
  { nome: 'número brasileiro completo', re: /\b(?!5511999999999\b)55\d{10,11}\b/ },
  { nome: 'QR/base64 de sessão', re: /data:image\/(?:png|jpeg);base64,[A-Za-z0-9+/]{200,}={0,2}/i },
  { nome: 'IP de produção', re: /\b(?!(?:127\.0\.0\.1|0\.0\.0\.0|10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.))(?:\d{1,3}\.){3}\d{1,3}\b/ },
  { nome: 'nome de domínio privado', re: /Clube\s+Carv[aã]o|Bel[ií]zia|Casa\s+Ziani|agenteSofia/i },
];

function arquivos(dir) {
  const out = [];
  for (const item of readdirSync(dir, { withFileTypes: true })) {
    if (ignorados.has(item.name)) continue;
    const caminho = join(dir, item.name);
    if (item.isDirectory()) out.push(...arquivos(caminho));
    else out.push(caminho);
  }
  return out;
}

const falhas = [];
for (const caminho of arquivos(root)) {
  const nome = relative(root, caminho);
  const ext = nome.toLowerCase().slice(nome.lastIndexOf('.'));
  for (const regra of proibidos) {
    if (regra.somenteNome) {
      if (regra.re.test(nome)) falhas.push(`${nome}: ${regra.nome}`);
      continue;
    }
    if (!extensoesTexto.has(ext)) continue;
    let texto;
    try { texto = readFileSync(caminho, 'utf8'); } catch { continue; }
    const linha = texto.split(/\r?\n/).findIndex((l) => regra.re.test(l));
    if (linha >= 0) falhas.push(`${nome}:${linha + 1}: ${regra.nome}`);
  }
}

if (existsSync(join(root, '.env'))) falhas.push('.env: arquivo real não pode ser publicado');
if (falhas.length) {
  console.error('AUDITORIA FALHOU:');
  for (const falha of falhas) console.error(`- ${falha}`);
  process.exit(1);
}
console.log('AUDITORIA OK: nenhum segredo, identificador privado ou dado de produção detectado.');
