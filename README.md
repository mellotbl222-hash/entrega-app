# Comprovante de Entrega — App Offline para Motoristas

App web instalável (PWA) para o motorista registrar: motorista, nome do
recebedor, foto do comprovante e assinatura do cliente na tela. Funciona **sem internet**
(fila local no celular) e sincroniza sozinho quando a conexão volta, gravando
tudo automaticamente numa planilha.

Não precisa de nenhuma licença paga. O backend usa o Google Sheets + Google
Apps Script (gratuitos), e você exporta/sincroniza para Excel quando quiser.

---

## Como funciona, na prática

1. Motorista abre o app no celular (instalado na tela inicial, como um app normal).
2. **Na primeira vez**, aparece uma tela de login: ele escolhe o próprio nome
   numa lista e digita a **senha individual** dele (precisa de internet nesse
   momento, para o app confirmar a senha). Depois de entrar uma vez, o
   aparelho lembra quem é — nas próximas vezes, o app já abre direto,
   sem pedir login de novo.
   - Se o aparelho for usado por outra pessoa em algum dia, é só tocar em
     **"Sair"** (barrinha no topo do app) e fazer login com outro nome e senha.
3. Preenche o nome do recebedor, tira a foto, colhe a assinatura do cliente e toca em **Enviar**.
4. Se tiver internet, o comprovante já sai daquela tela sincronizado ("ENVIADO").
5. Se **não** tiver internet, fica guardado no celular como "PENDENTE" e é
   enviado sozinho assim que a conexão voltar — não precisa reabrir o app nem
   reenviar manualmente.
6. Cada comprovante vira uma linha na planilha "Entregas", com link direto
   para a foto e para a assinatura salvas no Google Drive.

---

## Passo 1 — Criar o backend (Google Sheets + Apps Script) — 5 min

1. Acesse [sheets.google.com](https://sheets.google.com) e crie uma planilha
   nova. Dê um nome, ex: **"Comprovantes de Entrega"**.
2. Menu **Extensões → Apps Script**.
3. Apague todo o código de exemplo (`function myFunction() {...}`) e cole o
   conteúdo do arquivo `backend/Code.gs` (está nesta pasta).
4. Na linha `var TOKEN = 'TROQUE_ESTA_SENHA';`, troque por uma senha simples
   que só você vai saber (ex: `entregas2026x`). Faça o mesmo na linha
   `var ADMIN_SENHA = 'TROQUE_ESTA_SENHA_DE_ADMIN';` — use uma senha
   **diferente** da anterior, essa é a senha do painel de administrador.
5. Logo abaixo tem `var SENHAS_MOTORISTAS = {...}` — troque pelos nomes reais
   dos seus motoristas e uma senha para cada um (pode ser simples, tipo
   `1234`). **O nome aqui precisa ser escrito exatamente igual** ao que vai
   no `config.js` (Passo 2) — maiúsculas/minúsculas e espaços contam.
   ```js
   var SENHAS_MOTORISTAS = {
     'João Silva': '1234',
     'Maria Souza': '5678',
     'Carlos Lima': '9012'
   };
   ```
6. Clique em **Implantar → Nova implantação**.
   - Tipo: **App da Web**
   - Executar como: **Eu**
   - Quem pode acessar: **Qualquer pessoa**
7. Clique em **Implantar**, autorize as permissões pedidas (é o próprio
   Google pedindo confirmação de que o script pode ler/escrever na sua planilha).
8. Copie a **URL do app da Web** gerada — você vai usar no Passo 2.

> Sempre que editar o `Code.gs`, é preciso fazer **"Gerenciar implantações →
> editar (ícone de lápis) → Nova versão → Implantar"** para as mudanças valerem.

---

## Passo 2 — Configurar o app

Abra o arquivo `config.js` e edite:

```js
const CONFIG = {
  API_URL: 'COLE_AQUI_A_URL_DO_APPS_SCRIPT',   // a URL do Passo 1.8
  TOKEN: 'TROQUE_ESTA_SENHA',                   // a MESMA senha TOKEN do Code.gs
  MOTORISTAS: ['João Silva', 'Maria Souza', 'Carlos Lima'] // os MESMOS nomes do SENHAS_MOTORISTAS
};
```

---

## Como adicionar um motorista novo (a qualquer momento)

São sempre 2 arquivos, e o nome precisa ser **idêntico** nos dois:

1. No `config.js`, acrescente o nome na lista `MOTORISTAS`.
2. No `Code.gs` (dentro do Apps Script, não no arquivo local), acrescente
   o nome e uma senha em `SENHAS_MOTORISTAS`.
3. Republique o Apps Script: **Gerenciar implantações → editar (lápis) →
   Nova versão → Implantar** (sem isso a senha nova não funciona).
4. Suba o `config.js` atualizado onde o app está hospedado.

Pronto — na próxima vez que o motorista novo abrir o link do app, o nome
dele já aparece na tela de login.

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

## Painel do administrador (só pelo computador)

Depois de publicar o app (Passo 3), abra `https://seu-link/admin.html` no
navegador do computador. Ele pede a senha de administrador (a que você
definiu em `ADMIN_SENHA` no `Code.gs`) e mostra uma tabela com todos os
comprovantes já sincronizados: data/hora, motorista, recebedor, observação,
uma miniatura da foto e um botão de status.

- **Foto:** clique na miniatura para abrir a imagem em tamanho grande, direto
  na página (sem abrir outra aba). Clique fora da imagem, no ✕, ou aperte Esc
  para fechar.
- **Assinatura:** continua sendo salva normalmente no Google Drive e o link
  fica gravado na planilha (coluna "Assinatura") — só não aparece mais no
  painel, porque agora o espaço dela virou o botão de status.
- **Finalizado:** clique no botão para marcar/desmarcar um comprovante como
  finalizado. Fica salvo na planilha na hora (coluna "Finalizado"), então
  vale pra qualquer computador que abrir o painel depois.
- Tem busca por nome de recebedor ou motorista, e um botão "Atualizar" para
  buscar comprovantes novos sem recarregar a página.
- A senha não fica salva no navegador — se atualizar a página, precisa
  digitar de novo. Isso é proposital, para não deixar sessão aberta em
  computador compartilhado.
- Comprovantes enviados **antes** dessa atualização não têm um ID salvo na
  planilha, então o botão "Finalizado" aparece desabilitado para eles. Dá pra
  liberar manualmente: na planilha, preencha a coluna "ID" dessa linha com
  qualquer texto único (ex: `antigo1`).

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
├── index.html          → tela do app do motorista
├── admin.html            → painel do administrador (login + tabela)
├── styles.css              → visual do app do motorista
├── admin.css                → visual do painel do administrador
├── config.js                  → URL do backend, senha do motorista e lista de motoristas
├── app.js                       → lógica do motorista: fila offline, câmera, assinatura, sincronização
├── admin.js                       → lógica do painel: login e listagem dos comprovantes
├── sw.js                            → service worker (cache offline, só no app do motorista)
├── manifest.json                     → configuração do "instalar na tela inicial"
├── icons/                              → ícones do app
└── backend/
    └── Code.gs                           → backend Google Apps Script (cole no Apps Script)
```

## Limites e pontos de atenção

- Cada motorista precisa **instalar o app na tela inicial** para o offline
  funcionar de forma confiável (principalmente no iPhone).
- As fotos são comprimidas automaticamente antes de guardar/enviar, para não
  pesar no celular nem na sincronização.
- O `TOKEN` é uma proteção simples contra spam na sua planilha — não é uma
  autenticação de usuário individual. Para controle de login por motorista,
  a próxima etapa seria migrar para Power Apps ou um backend com autenticação.
