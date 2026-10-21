const CHAVE_CSV = "oracoes:csv";
const CHAVE_ESCALA = "oracoes:escala";
const ESCALAS = [1, 1.15, 1.3, 1.5];

const $ = (id) => document.getElementById(id);

let oracoes = [];
let buscaAproximada = null;
let rolagemDaLista = 0;
let veioDaLista = false;

function lerArmazenado(chave) {
  try { return localStorage.getItem(chave); } catch { return null; }
}

function salvarArmazenado(chave, valor) {
  try { localStorage.setItem(chave, valor); } catch {}
}

// RFC 4180: quoted fields may contain commas, newlines and "" escapes.
function parseCsv(texto) {
  const linhas = [];
  let linha = [];
  let campo = "";
  let entreAspas = false;

  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (entreAspas) {
      if (c !== '"') campo += c;
      else if (texto[i + 1] === '"') { campo += '"'; i++; }
      else entreAspas = false;
    } else if (c === '"') {
      entreAspas = true;
    } else if (c === ",") {
      linha.push(campo);
      campo = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && texto[i + 1] === "\n") i++;
      linha.push(campo);
      linhas.push(linha);
      linha = [];
      campo = "";
    } else {
      campo += c;
    }
  }
  if (campo || linha.length) {
    linha.push(campo);
    linhas.push(linha);
  }
  return linhas;
}

// Lowercase without accents, so "oracao" matches "Oração".
function normalizar(texto) {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

// Columns are read by position so renaming the sheet headers doesn't break the site.
function paraOracoes(linhas) {
  const usados = new Set();
  return linhas
    .slice(1)
    .map(([titulo = "", texto = ""]) => ({ titulo: titulo.trim(), texto: texto.trim() }))
    .filter((o) => o.titulo && o.texto)
    .map((o) => {
      const base = normalizar(o.titulo).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "oracao";
      let slug = base;
      for (let n = 2; usados.has(slug); n++) slug = `${base}-${n}`;
      usados.add(slug);
      return { ...o, slug, tituloBusca: normalizar(o.titulo), busca: normalizar(`${o.titulo} ${o.texto}`) };
    });
}

async function carregar() {
  try {
    const resposta = await fetch(window.CONFIG.csvUrl, { cache: "no-store" });
    if (!resposta.ok) throw new Error(resposta.status);
    const csv = await resposta.text();
    salvarArmazenado(CHAVE_CSV, csv);
    return csv;
  } catch (erro) {
    // Offline or Google unreachable: fall back to the last list this device saw.
    const salvo = lerArmazenado(CHAVE_CSV);
    if (salvo) return salvo;
    throw erro;
  }
}

function criarCartao(oracao) {
  const item = document.createElement("li");
  const link = document.createElement("a");
  link.className = "cartao";
  link.href = `#/${oracao.slug}`;

  const titulo = document.createElement("span");
  titulo.className = "cartao-titulo";
  titulo.textContent = oracao.titulo;

  const inicio = document.createElement("span");
  inicio.className = "cartao-inicio";
  inicio.textContent = oracao.texto;

  link.append(titulo, inicio);
  item.append(link);
  return item;
}

// Typo-tolerant fallback; null when the Fuse.js script failed to load.
function criarBuscaAproximada(lista) {
  if (!window.Fuse) return null;
  return new Fuse(lista, {
    keys: [{ name: "tituloBusca", weight: 2 }, { name: "busca", weight: 1 }],
    useExtendedSearch: true,
    ignoreLocation: true,
    ignoreFieldNorm: true,
    threshold: 0.4,
    includeScore: true,
  });
}

// Exact matches win; fuzzy results only appear when no prayer contains every word.
function buscar(palavras) {
  const exatas = oracoes.filter((o) => palavras.every((p) => o.busca.includes(p)));
  if (exatas.length || !palavras.length || !buscaAproximada) return { encontradas: exatas, aproximadas: false };

  // In extended search a space means AND, and symbols are operators, so they are stripped.
  const consulta = palavras.join(" ").replace(/[^a-z0-9]+/g, " ").trim();
  const encontradas = buscaAproximada
    .search(consulta)
    .filter((r) => r.score <= 0.2)
    .map((r) => r.item);
  return { encontradas, aproximadas: true };
}

function renderizarLista() {
  const consulta = $("busca").value;
  const palavras = normalizar(consulta).split(/\s+/).filter(Boolean);
  const { encontradas, aproximadas } = buscar(palavras);

  $("limpar").hidden = !consulta;
  $("resultados").replaceChildren(...encontradas.map(criarCartao));

  const status = $("status");
  if (!oracoes.length) status.textContent = "Ainda não há orações publicadas.";
  else if (!encontradas.length) status.textContent = `Nenhuma oração encontrada para “${consulta.trim()}”.`;
  else if (aproximadas) status.textContent = `Nenhuma oração tem exatamente “${consulta.trim()}”. Veja as mais parecidas:`;
  else if (palavras.length) status.textContent = encontradas.length === 1 ? "1 oração encontrada." : `${encontradas.length} orações encontradas.`;
  else status.textContent = "";
}

function mostrarRota() {
  const slug = decodeURIComponent(location.hash.replace(/^#\/?/, ""));
  const oracao = oracoes.find((o) => o.slug === slug);

  if (!oracao) {
    $("oracao").hidden = true;
    $("lista").hidden = false;
    document.title = "Orações · Fraternidade Espírita Fonte de Amor";
    window.scrollTo(0, rolagemDaLista);
    return;
  }

  if (!$("lista").hidden) {
    rolagemDaLista = window.scrollY;
    veioDaLista = true;
  }
  $("lista").hidden = true;
  $("oracao").hidden = false;
  $("oracao-titulo").textContent = oracao.titulo;
  $("oracao-texto").textContent = oracao.texto;
  document.title = `${oracao.titulo} · Fraternidade Espírita Fonte de Amor`;
  window.scrollTo(0, 0);
  $("oracao-titulo").focus();
}

function aplicarEscala(indice) {
  document.documentElement.style.setProperty("--escala", ESCALAS[indice]);
  $("menor").disabled = indice === 0;
  $("maior").disabled = indice === ESCALAS.length - 1;
  salvarArmazenado(CHAVE_ESCALA, String(indice));
}

function configurarEscala() {
  const salvo = Number(lerArmazenado(CHAVE_ESCALA));
  let indice = ESCALAS[salvo] ? salvo : 0;
  aplicarEscala(indice);
  $("menor").addEventListener("click", () => aplicarEscala((indice = Math.max(0, indice - 1))));
  $("maior").addEventListener("click", () => aplicarEscala((indice = Math.min(ESCALAS.length - 1, indice + 1))));
}

function configurar() {
  configurarEscala();

  if (window.CONFIG.formUrl) {
    $("enviar").href = window.CONFIG.formUrl;
    $("enviar-caixa").hidden = false;
  }

  $("busca").addEventListener("input", renderizarLista);
  $("limpar").addEventListener("click", () => {
    $("busca").value = "";
    renderizarLista();
    $("busca").focus();
  });

  $("voltar").addEventListener("click", () => {
    if (veioDaLista) history.back();
    else location.hash = "";
  });

  if (navigator.share) {
    $("compartilhar").hidden = false;
    $("compartilhar").addEventListener("click", () => {
      navigator.share({ title: $("oracao-titulo").textContent, url: location.href }).catch(() => {});
    });
  }

  window.addEventListener("hashchange", mostrarRota);
}

async function iniciar() {
  configurar();
  try {
    oracoes = paraOracoes(parseCsv(await carregar()));
    buscaAproximada = criarBuscaAproximada(oracoes);
  } catch {
    $("status").textContent = "Não foi possível carregar as orações. Verifique a internet e tente novamente.";
    return;
  }
  renderizarLista();
  mostrarRota();
}

iniciar();
