/**
 * BACKEND — Comprovante de Entrega
 * ---------------------------------
 * Como instalar (veja o README.md para o passo a passo com prints):
 * 1. Crie uma planilha nova no Google Sheets.
 * 2. Menu Extensões > Apps Script.
 * 3. Apague o código de exemplo e cole este arquivo inteiro.
 * 4. Troque o valor de TOKEN abaixo por uma senha só sua.
 * 5. Implantar > Nova implantação > tipo "App da Web".
 *    - Executar como: Eu
 *    - Quem pode acessar: Qualquer pessoa
 * 6. Autorize as permissões pedidas e copie a URL gerada.
 * 7. Cole essa URL e a mesma senha no arquivo app.js do app (CONFIG).
 */

var TOKEN = '$Assa2004';
var NOME_ABA = 'Entregas';
var NOME_PASTA_DRIVE = 'Comprovantes de Entrega';

function doPost(e) {
  try {
    var dados = JSON.parse(e.postData.contents);

    if (dados.token !== TOKEN) {
      return responder({ status: 'error', message: 'Token inválido' });
    }
    if (!dados.pedido || !dados.motorista) {
      return responder({ status: 'error', message: 'Dados incompletos' });
    }

    var pasta = obterOuCriarPasta();
    var urlFoto = dados.foto ? salvarImagem(dados.foto, pasta, 'foto_' + dados.pedido) : '';
    var urlAssinatura = dados.assinatura ? salvarImagem(dados.assinatura, pasta, 'assinatura_' + dados.pedido) : '';

    var aba = obterOuCriarAba();
    aba.appendRow([
      new Date(dados.timestamp || Date.now()),
      dados.motorista,
      dados.pedido,
      dados.observacao || '',
      urlFoto,
      urlAssinatura
    ]);

    return responder({ status: 'ok' });
  } catch (err) {
    return responder({ status: 'error', message: String(err) });
  }
}

function doGet(e) {
  return ContentService.createTextOutput('API de comprovantes ativa ✅');
}

function responder(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function obterOuCriarPasta() {
  var pastas = DriveApp.getFoldersByName(NOME_PASTA_DRIVE);
  if (pastas.hasNext()) return pastas.next();
  return DriveApp.createFolder(NOME_PASTA_DRIVE);
}

function obterOuCriarAba() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var aba = ss.getSheetByName(NOME_ABA);
  if (aba) return aba;
  aba = ss.insertSheet(NOME_ABA);
  aba.appendRow(['Data/Hora', 'Motorista', 'Pedido', 'Observações', 'Foto', 'Assinatura']);
  aba.setFrozenRows(1);
  return aba;
}

function salvarImagem(base64, pasta, nomeBase) {
  var partes = base64.split(',');
  var mimeMatch = partes[0].match(/data:(.*);base64/);
  var mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
  var bytes = Utilities.base64Decode(partes[1]);
  var extensao = mime.indexOf('png') > -1 ? '.png' : '.jpg';
  var blob = Utilities.newBlob(bytes, mime, nomeBase + extensao);
  var arquivo = pasta.createFile(blob);
  arquivo.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return arquivo.getUrl();
}
