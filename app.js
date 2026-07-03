// A configuração (API_URL, TOKEN, MOTORISTAS) vem de config.js,
// incluído antes deste arquivo no index.html.

// ============================================================
// BANCO LOCAL (IndexedDB) — guarda os comprovantes no aparelho
// mesmo sem internet, e mantém a fila até conseguir sincronizar.
// ============================================================
const DB_NAME = 'comprovantes-db';
const DB_VERSION = 1;
const STORE_FILA = 'fila';       // registros completos (com fotos) pendentes de envio
const STORE_HISTORICO = 'historico'; // registros leves para exibir a lista recente

function abrirDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_FILA)) {
        db.createObjectStore(STORE_FILA, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_HISTORICO)) {
        const h = db.createObjectStore(STORE_HISTORICO, { keyPath: 'id' });
        h.createIndex('timestamp', 'timestamp');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function dbAdd(storeName, valor) {
  const db = await abrirDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).put(valor);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function dbDelete(storeName, id) {
  const db = await abrirDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function dbGetAll(storeName) {
  const db = await abrirDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ============================================================
// COMPRESSÃO DE IMAGEM — mantém o app rápido e leve para
// sincronizar mesmo em 3G/4G fraco.
// ============================================================
function comprimirImagem(file, maxWidth = 1280, qualidade = 0.7) {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let w = img.width, h = img.height;
        if (w > maxWidth) { h = Math.round(h * (maxWidth / w)); w = maxWidth; }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', qualidade));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    leitor.onerror = reject;
    leitor.readAsDataURL(file);
  });
}

// ============================================================
// ASSINATURA (canvas)
// ============================================================
let assinaturaVazia = true;
function iniciarAssinatura() {
  const canvas = document.getElementById('assinatura');
  const ctx = canvas.getContext('2d');
  const ajustarTamanho = () => {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#12203A';
  };
  ajustarTamanho();

  let desenhando = false;
  const pos = (e) => {
    const rect = canvas.getBoundingClientRect();
    const t = e.touches ? e.touches[0] : e;
    return { x: t.clientX - rect.left, y: t.clientY - rect.top };
  };
  const iniciar = (e) => { desenhando = true; assinaturaVazia = false; const p = pos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); e.preventDefault(); };
  const mover = (e) => { if (!desenhando) return; const p = pos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); e.preventDefault(); };
  const parar = () => { desenhando = false; };

  canvas.addEventListener('mousedown', iniciar);
  canvas.addEventListener('mousemove', mover);
  window.addEventListener('mouseup', parar);
  canvas.addEventListener('touchstart', iniciar, { passive: false });
  canvas.addEventListener('touchmove', mover, { passive: false });
  canvas.addEventListener('touchend', parar);

  document.getElementById('limparAssinatura').addEventListener('click', () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    assinaturaVazia = true;
  });
}

// ============================================================
// ENVIO / SINCRONIZAÇÃO
// ============================================================
function gerarId() {
  return 'c_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
}

async function enviarParaServidor(registro) {
  const resp = await fetch(CONFIG.API_URL, {
    method: 'POST',
    // text/plain evita o preflight CORS que o Apps Script não trata bem
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({
      token: CONFIG.TOKEN,
      id: registro.id,
      motorista: registro.motorista,
      recebedor: registro.recebedor,
      observacao: registro.observacao,
      foto: registro.foto,
      assinatura: registro.assinatura,
      timestamp: registro.timestamp
    })
  });
  if (!resp.ok) throw new Error('HTTP ' + resp.status);
  const data = await resp.json();
  if (data.status !== 'ok') throw new Error(data.message || 'Falha no servidor');
}

let sincronizando = false;
async function sincronizarFila() {
  if (sincronizando || !navigator.onLine) { atualizarStatus(); return; }
  sincronizando = true;
  atualizarStatus('Sincronizando…');
  const pendentes = await dbGetAll(STORE_FILA);
  for (const registro of pendentes) {
    try {
      await enviarParaServidor(registro);
      await dbDelete(STORE_FILA, registro.id);
      await dbAdd(STORE_HISTORICO, { ...leveDe(registro), status: 'enviado' });
    } catch (err) {
      // deixa na fila, tenta de novo na próxima sincronização
      console.warn('Falha ao sincronizar', registro.id, err);
    }
  }
  sincronizando = false;
  await atualizarStatus();
  await renderHistorico();
}

function leveDe(registro) {
  return { id: registro.id, motorista: registro.motorista, recebedor: registro.recebedor, timestamp: registro.timestamp };
}

// ============================================================
// UI
// ============================================================
async function atualizarStatus(mensagemForcada) {
  const bolinha = document.getElementById('statusDot');
  const texto = document.getElementById('statusTexto');
  const pendentes = await dbGetAll(STORE_FILA);
  const badge = document.getElementById('badgePendentes');

  if (mensagemForcada) {
    texto.textContent = mensagemForcada;
  } else if (!navigator.onLine) {
    bolinha.className = 'dot dot-offline';
    texto.textContent = pendentes.length
      ? `Offline — ${pendentes.length} pendente(s) no aparelho`
      : 'Offline — pronto para registrar entregas';
  } else {
    bolinha.className = 'dot dot-online';
    texto.textContent = pendentes.length ? `Online — sincronizando ${pendentes.length}…` : 'Online — tudo sincronizado';
  }

  if (pendentes.length > 0) {
    badge.textContent = pendentes.length;
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }
}

async function renderHistorico() {
  const lista = document.getElementById('listaHistorico');
  const todos = await dbGetAll(STORE_HISTORICO);
  todos.sort((a, b) => b.timestamp - a.timestamp);
  const ultimos = todos.slice(0, 8);
  lista.innerHTML = '';
  if (ultimos.length === 0) {
    lista.innerHTML = '<p class="vazio">Nenhum comprovante enviado ainda hoje.</p>';
    return;
  }
  for (const item of ultimos) {
    const li = document.createElement('div');
    li.className = 'item-historico';
    const hora = new Date(item.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    li.innerHTML = `
      <div class="item-info">
        <span class="item-recebedor">${escapeHtml(item.recebedor)}</span>
        <span class="item-meta">${escapeHtml(item.motorista)} · ${hora}</span>
      </div>
      <span class="carimbo carimbo-${item.status === 'enviado' ? 'ok' : 'pendente'}">
        ${item.status === 'enviado' ? 'ENVIADO' : 'PENDENTE'}
      </span>`;
    lista.appendChild(li);
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ============================================================
// LOGIN DO MOTORISTA — nome + senha individual, verificados no
// backend. Depois do primeiro login, o aparelho lembra o
// motorista (não pede de novo, a não ser que ele toque em "Sair").
// ============================================================
const CHAVE_MOTORISTA = 'comprovantes:motorista';
let motoristaEscolhido = null;
let assinaturaIniciada = false;

function obterMotoristaSalvo() {
  try { return localStorage.getItem(CHAVE_MOTORISTA); } catch (e) { return null; }
}

function salvarMotoristaLocal(nome) {
  try { localStorage.setItem(CHAVE_MOTORISTA, nome); } catch (e) { /* armazenamento indisponível — segue sem salvar */ }
}

function limparMotoristaLocal() {
  try { localStorage.removeItem(CHAVE_MOTORISTA); } catch (e) { /* nada a fazer */ }
}

function montarSelectLogin() {
  document.getElementById('loginMotoristaSelect').innerHTML = CONFIG.MOTORISTAS
    .map((nome) => `<option value="${escapeHtml(nome)}">${escapeHtml(nome)}</option>`)
    .join('');
}

function mostrarErroLogin(msg) {
  const erro = document.getElementById('loginErro');
  erro.textContent = msg;
  erro.classList.remove('hidden');
}

async function fazerLogin() {
  const nome = document.getElementById('loginMotoristaSelect').value;
  const senha = document.getElementById('loginSenha').value;
  const botao = document.getElementById('btnLoginEntrar');
  document.getElementById('loginErro').classList.add('hidden');

  if (!senha) { mostrarErroLogin('Digite sua senha.'); return; }

  botao.disabled = true;
  botao.textContent = 'Entrando…';
  try {
    const resp = await fetch(CONFIG.API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ acao: 'loginMotorista', motorista: nome, senha })
    });
    const data = await resp.json();
    if (data.status !== 'ok') {
      mostrarErroLogin(data.message || 'Senha incorreta.');
      return;
    }
    salvarMotoristaLocal(nome);
    document.getElementById('loginSenha').value = '';
    entrarComoMotorista(nome);
  } catch (err) {
    mostrarErroLogin('Sem conexão — é preciso internet para entrar pela primeira vez.');
  } finally {
    botao.disabled = false;
    botao.textContent = 'Entrar';
  }
}

function entrarComoMotorista(nome) {
  motoristaEscolhido = nome;
  document.getElementById('motoristaLogadoNome').textContent = nome;
  document.getElementById('telaLogin').classList.add('hidden');
  document.getElementById('appPrincipal').classList.remove('hidden');
  // o canvas de assinatura só pode ser dimensionado depois de visível na tela
  if (!assinaturaIniciada) {
    iniciarAssinatura();
    assinaturaIniciada = true;
  }
}

function sairMotorista() {
  limparMotoristaLocal();
  motoristaEscolhido = null;
  document.getElementById('loginSenha').value = '';
  document.getElementById('appPrincipal').classList.add('hidden');
  document.getElementById('telaLogin').classList.remove('hidden');
}

function iniciarLogin() {
  montarSelectLogin();
  document.getElementById('btnLoginEntrar').addEventListener('click', fazerLogin);
  document.getElementById('loginSenha').addEventListener('keydown', (e) => { if (e.key === 'Enter') fazerLogin(); });
  document.getElementById('btnSairMotorista').addEventListener('click', sairMotorista);

  const salvo = obterMotoristaSalvo();
  if (salvo && CONFIG.MOTORISTAS.includes(salvo)) {
    entrarComoMotorista(salvo);
  }
  // se não tiver ninguém salvo, a tela de login já fica visível por padrão
}


let fotoBase64 = null;
function iniciarFoto() {
  const input = document.getElementById('fotoInput');
  const preview = document.getElementById('fotoPreview');
  const rotulo = document.getElementById('fotoRotulo');
  input.addEventListener('change', async () => {
    const file = input.files[0];
    if (!file) return;
    rotulo.textContent = 'Processando foto…';
    fotoBase64 = await comprimirImagem(file);
    preview.src = fotoBase64;
    preview.classList.remove('hidden');
    rotulo.textContent = 'Trocar foto';
  });
}

function validarFormulario() {
  const recebedor = document.getElementById('recebedor').value.trim();
  const erros = [];
  if (!motoristaEscolhido) erros.push('Selecione quem está entregando.');
  if (!recebedor) erros.push('Informe o nome do recebedor.');
  if (!fotoBase64) erros.push('Tire uma foto do comprovante.');
  if (assinaturaVazia) erros.push('Colete a assinatura do cliente.');
  return erros;
}

async function aoEnviar(e) {
  e.preventDefault();
  const erros = validarFormulario();
  const avisoEl = document.getElementById('aviso');
  if (erros.length) {
    avisoEl.textContent = erros.join(' ');
    avisoEl.classList.remove('hidden');
    return;
  }
  avisoEl.classList.add('hidden');

  const canvas = document.getElementById('assinatura');
  const registro = {
    id: gerarId(),
    motorista: motoristaEscolhido,
    recebedor: document.getElementById('recebedor').value.trim(),
    observacao: document.getElementById('observacao').value.trim(),
    foto: fotoBase64,
    assinatura: canvas.toDataURL('image/png'),
    timestamp: Date.now()
  };

  await dbAdd(STORE_FILA, registro);
  await dbAdd(STORE_HISTORICO, { ...leveDe(registro), status: 'pendente' });

  if (navigator.vibrate) navigator.vibrate(60);
  limparFormularioParaProximo();
  await atualizarStatus();
  await renderHistorico();

  if (navigator.onLine) sincronizarFila();
}

function limparFormularioParaProximo() {
  document.getElementById('recebedor').value = '';
  document.getElementById('observacao').value = '';
  document.getElementById('fotoInput').value = '';
  document.getElementById('fotoPreview').classList.add('hidden');
  fotoBase64 = null;
  document.getElementById('fotoRotulo').textContent = 'Tirar foto do comprovante';
  const canvas = document.getElementById('assinatura');
  canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
  assinaturaVazia = true;
  document.getElementById('recebedor').focus();
}

// ============================================================
// INICIALIZAÇÃO
// ============================================================
window.addEventListener('DOMContentLoaded', () => {
  iniciarLogin();
  iniciarFoto();
  document.getElementById('formEntrega').addEventListener('submit', aoEnviar);
  document.getElementById('btnSincronizar').addEventListener('click', sincronizarFila);

  window.addEventListener('online', () => { atualizarStatus(); sincronizarFila(); });
  window.addEventListener('offline', () => atualizarStatus());

  atualizarStatus();
  renderHistorico();
  setInterval(() => { if (navigator.onLine) sincronizarFila(); }, 30000);

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch((err) => console.warn('SW falhou:', err));
  }
});
