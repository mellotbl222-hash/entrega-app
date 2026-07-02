# Comprovante de Entrega — App Offline para Motoristas

App web instalável (PWA) para o motorista registrar: motorista, nº do pedido,
foto do comprovante e assinatura do cliente na tela. Funciona **sem internet**
(fila local no celular) e sincroniza sozinho quando a conexão volta, gravando
tudo automaticamente numa planilha.

Não precisa de nenhuma licença paga. O backend usa o Google Sheets + Google
Apps Script (gratuitos), e você exporta/sincroniza para Excel quando quiser.

---

## Como funciona, na prática

1. Motorista abre o app no celular (instalado na tela inicial, como um app normal).
2. Preenche o pedido, tira a foto, colhe a assinatura do cliente e toca em **Enviar**.
3. Se tiver internet, o comprovante já sai daquela tela sincronizado ("ENVIADO").
4. Se **não** tiver internet, fica guardado no celular como "PENDENTE" e é
   enviado sozinho assim que a conexão voltar — não precisa reabrir o app nem
   reenviar manualmente.
5. Cada comprovante vira uma linha na planilha "Entregas", com link direto
   para a foto e para a assinatura salvas no Google Drive.

---

## Passo 1 — Criar o backend (Google Sheets + Apps Script) — 5 min

1. Acesse [sheets.google.com](https://sheets.google.com) e crie uma planilha
   nova. Dê um nome, ex: **"Comprovantes de Entrega"**.
2. Menu **Extensões → Apps Script**.
3. Apague todo o código de exemplo (`function myFunction() {...}`) e cole o
   conteúdo do arquivo `backend/Code.gs` (está nesta pasta).
4. Na linha `var TOKEN = 'TROQUE_ESTA_SENHA';`, troque por uma senha simples
   que só você vai saber (ex: `entregas2026x`).
5. Clique em **Implantar → Nova implantação**.
   - Tipo: **App da Web**
   - Executar como: **Eu**
   - Quem pode acessar: **Qualquer pessoa**
6. Clique em **Implantar**, autorize as permissões pedidas (é o próprio
   Google pedindo confirmação de que o script pode ler/escrever na sua planilha).
7. Copie a **URL do app da Web** gerada — você vai usar no Passo 2.

> Sempre que editar o `Code.gs`, é preciso fazer **"Gerenciar implantações →
> editar (ícone de lápis) → Nova versão → Implantar"** para as mudanças valerem.

---

## Passo 2 — Configurar o app

Abra o arquivo `app.js` e edite as 3 primeiras linhas úteis:

```js
const CONFIG = {
  API_URL: 'COLE_AQUI_A_URL_DO_APPS_SCRIPT',   // a URL do Passo 1.6
  TOKEN: 'TROQUE_ESTA_SENHA',                   // a MESMA senha do Code.gs
  MOTORISTAS: ['Motorista 1', 'Motorista 2', 'Motorista 3'] // troque pelos nomes reais
};
```

---

## Passo 3 — Publicar o app (hospedagem gratuita) — 5 min

O app precisa estar em um endereço HTTPS para funcionar offline (é uma regra
de segurança dos navegadores para PWAs). A forma mais simples e gratuita:

**Opção A — Netlify Drop (mais rápido, sem conta de programador)**
1. Acesse [app.netlify.com/drop](https://app.netlify.com/drop)
2. Arraste a pasta inteira `entrega-app` (com index.html, app.js etc.) para a página.
3. Pronto — você recebe um link tipo `https://seu-app.netlify.app`.

**Opção B — GitHub Pages**
1. Crie um repositório novo no GitHub e suba os arquivos desta pasta.
2. Em Settings → Pages, ative o Pages apontando para a branch principal.
3. O link fica algo como `https://seu-usuario.github.io/entrega-app`.

Qualquer uma das duas funciona bem para até dezenas de motoristas.

---

## Passo 4 — Instalar no celular do motorista

- **Android (Chrome):** abrir o link → menu (⋮) → **"Adicionar à tela inicial"**.
- **iPhone (Safari):** abrir o link → botão de compartilhar → **"Adicionar à
  Tela de Início"**.

Depois de instalado, o app abre em tela cheia, como um app nativo, e o ícone
laranja/azul marinho fica na tela do celular.

> **Nota sobre iPhone:** o Safari é mais restritivo com armazenamento offline
> de apps não instalados. Por isso é importante orientar o motorista a
> **instalar na tela de início** (não só deixar aberto no navegador) — assim
> a fila offline fica salva de forma confiável.

---

## Passo 5 — Testar

1. Abra o app instalado, coloque o celular em **modo avião**.
2. Preencha um comprovante de teste e envie — deve aparecer como **PENDENTE**
   (carimbo laranja tracejado) e o topo mostra "Offline — 1 pendente".
3. Tire do modo avião — em poucos segundos o carimbo vira **ENVIADO** (verde)
   sozinho, e a linha aparece na planilha.

---

## Como ver isso no Excel

A planilha "Entregas" no Google Sheets já é a sua fonte de dados ao vivo.
Três formas de ter isso em Excel, da mais simples à mais automática:

1. **Baixar quando quiser:** no Google Sheets, `Arquivo → Fazer download →
   Microsoft Excel (.xlsx)`.
2. **Excel sempre atualizado, sem trabalho manual:** se vocês tiverem
   Microsoft 365, crie um fluxo no **Power Automate** com o gatilho *"Quando
   uma linha é adicionada"* (conector do Google Sheets) e a ação *"Adicionar
   linha a uma tabela"* (Excel Online, num arquivo no OneDrive/SharePoint).
   Isso replica cada comprovante automaticamente para um Excel de verdade.
3. **Consulta ao vivo:** no Excel, `Dados → Obter Dados → Do Google Sheets`
   (via link público de exportação CSV da planilha) e configurar atualização
   automática.

Se no futuro vocês migrarem para Microsoft 365 por completo, dá pra trocar
o backend por um Power Apps + SharePoint/Excel diretamente — me avise que eu
te ajudo a montar essa versão também.

---

## Estrutura dos arquivos

```
entrega-app/
├── index.html          → tela do app
├── styles.css           → visual
├── app.js                → lógica: fila offline, câmera, assinatura, sincronização
├── sw.js                  → service worker (cache offline)
├── manifest.json          → configuração do "instalar na tela inicial"
├── icons/                  → ícones do app
└── backend/
    └── Code.gs              → backend Google Apps Script (cole no Apps Script)
```

## Limites e pontos de atenção

- Cada motorista precisa **instalar o app na tela inicial** para o offline
  funcionar de forma confiável (principalmente no iPhone).
- As fotos são comprimidas automaticamente antes de guardar/enviar, para não
  pesar no celular nem na sincronização.
- O `TOKEN` é uma proteção simples contra spam na sua planilha — não é uma
  autenticação de usuário individual. Para controle de login por motorista,
  a próxima etapa seria migrar para Power Apps ou um backend com autenticação.
