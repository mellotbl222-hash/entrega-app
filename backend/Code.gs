/**
 * BACKEND — Comprovante de Entrega
 * ---------------------------------
 * Como instalar (veja o README.md para o passo a passo com prints):
 * 1. Crie uma planilha nova no Google Sheets.
 * 2. Menu Extensões > Apps Script.
 * 3. Apague o código de exemplo e cole este arquivo inteiro.
 * 4. Troque o valor de TOKEN e ADMIN_SENHA abaixo por senhas só suas.
 * 5. Implantar > Nova implantação > tipo "App da Web".
 *    - Executar como: Eu
 *    - Quem pode acessar: Qualquer pessoa
 * 6. Autorize as permissões pedidas e copie a URL gerada.
 * 7. Cole essa URL e as senhas no arquivo config.js do app.
 *
 * Toda vez que editar este arquivo: Gerenciar implantações > editar
 * (lápis) > Nova versão > Implantar — senão as mudanças não valem.
 */

var TOKEN = 'TROQUE_ESTA_SENHA';
var ADMIN_SENHA = 'TROQUE_ESTA_SENHA_DE_ADMIN';
var NOME_ABA = 'Entregas';
var NOME_PASTA_DRIVE = 'Comprovantes de Entrega';
var CABECALHO = ['Data/Hora', 'Motorista', 'Recebedor', 'Observações', 'Foto', 'Assinatura', 'ID', 'Finalizado'];

// Senha individual de cada motorista (login do app). O nome aqui
// precisa ser IDÊNTICO ao nome em CONFIG.MOTORISTAS no config.js.
// Para adicionar um motorista novo: acrescente uma linha aqui E
// no config.js, depois publique uma nova versão (veja o README).
var SENHAS_MOTORISTAS = {
  'Motorista 1': '1111',
  'Motorista 2': '2222',
  'Motorista 3': '3333'
};

function doPost(e) {
  try {
    var dados = JSON.parse(e.postData.contents);

    if (dados.acao === 'finalizar') {
      return marcarFinalizado(dados);
    }
    if (dados.acao === 'loginMotorista') {
      return loginMotorista(dados);
    }

    // envio normal de um novo comprovante (motorista)
    if (dados.token !== TOKEN) {
      return responder({ status: 'error', message: 'Token inválido' });
    }
    if (!dados.recebedor || !dados.motorista) {
      return responder({ status: 'error', message: 'Dados incompletos' });
    }

    var pasta = obterOuCriarPasta();
    var urlFoto = dados.foto ? salvarImagem(dados.foto, pasta, 'foto_' + dados.recebedor) : '';
    var urlAssinatura = dados.assinatura ? salvarImagem(dados.assinatura, pasta, 'assinatura_' + dados.recebedor) : '';

    var aba = obterOuCriarAba();
    aba.appendRow([
      new Date(dados.timestamp || Date.now()),
      dados.motorista,
      dados.recebedor,
      dados.observacao || '',
      urlFoto,
      urlAssinatura,
      dados.id || '',
      false
    ]);

    return responder({ status: 'ok' });
  } catch (err) {
    return responder({ status: 'error', message: String(err) });
  }
}

function loginMotorista(dados) {
  var senhaCorreta = SENHAS_MOTORISTAS[dados.motorista];
  if (senhaCorreta === undefined) {
    return responder({ status: 'error', message: 'Motorista não encontrado.' });
  }
  if (String(dados.senha) !== String(senhaCorreta)) {
    return responder({ status: 'error', message: 'Senha incorreta.' });
  }
  return responder({ status: 'ok' });
}

function marcarFinalizado(dados) {
  if (dados.senha !== ADMIN_SENHA) {
    return responder({ status: 'error', message: 'Senha incorreta' });
  }
  if (!dados.id) {
    return responder({ status: 'error', message: 'Comprovante sem ID' });
  }
  var aba = obterOuCriarAba();
  var valores = aba.getDataRange().getValues();
  for (var i = 1; i < valores.length; i++) {
    if (String(valores[i][6]) === String(dados.id)) {
      aba.getRange(i + 1, 8).setValue(!!dados.valor); // coluna H = Finalizado
      return responder({ status: 'ok' });
    }
  }
  return responder({ status: 'error', message: 'Comprovante não encontrado' });
}

function doGet(e) {
  if (e.parameter.acao === 'listar') {
    return listarComprovantes(e.parameter.senha);
  }
  return ContentService.createTextOutput('API de comprovantes ativa ✅');
}

function listarComprovantes(senha) {
  if (senha !== ADMIN_SENHA) {
    return responder({ status: 'error', message: 'Senha incorreta' });
  }
  var aba = obterOuCriarAba();
  var valores = aba.getDataRange().getValues();
  valores.shift(); // remove a linha de cabeçalho

  var registros = valores
    .filter(function (linha) { return linha[1] || linha[2]; }) // ignora linhas vazias
    .map(function (linha) {
      var idDrive = extrairIdDrive(linha[4]);
      return {
        dataHora: linha[0] instanceof Date ? linha[0].toISOString() : String(linha[0]),
        motorista: linha[1],
        recebedor: linha[2],
        observacao: linha[3],
        foto: linha[4],
        fotoImg: idDrive ? ('https://drive.google.com/thumbnail?id=' + idDrive + '&sz=w1600') : '',
        id: linha[6] ? String(linha[6]) : '',
        finalizado: linha[7] === true || String(linha[7]).toLowerCase() === 'true'
      };
    })
    .reverse(); // mais recentes primeiro

  return responder({ status: 'ok', registros: registros });
}

function extrairIdDrive(url) {
  if (!url) return '';
  var m = String(url).match(/\/d\/([^/]+)/);
  return m ? m[1] : '';
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
  if (!aba) {
    aba = ss.insertSheet(NOME_ABA);
    aba.appendRow(CABECALHO);
    aba.setFrozenRows(1);
    return aba;
  }
  // migração automática: garante que planilhas já existentes ganhem
  // as colunas novas (ID, Finalizado) sem perder dados antigos
  var ultimaColuna = aba.getLastColumn();
  if (ultimaColuna < CABECALHO.length) {
    aba.getRange(1, ultimaColuna + 1, 1, CABECALHO.length - ultimaColuna)
      .setValues([CABECALHO.slice(ultimaColuna)]);
  }
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
