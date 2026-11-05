#!/usr/bin/env node

/*
 * Versão simplificada do parseHtmlTable para debugar a lógica de extração de células.
 * 
 * Pequena diferença: aqui o laço continua mesmo quando tag de fechamento detectada,
 * enquanto na versão teórica eu assumi break.
 */

function parseHtmlTable(html) {
  const rows = [];
  let currentRow = null;
  let inHeader = false;
  const tagRe = /<\/?[a-z][a-z0-9]*[^>]*>/gi;

  for (const m of html.matchAll(tagRe)) {
    const tag = m[0].toLowerCase();
    console.log('match:', m[0], 'index:', m.index, 'texto entre tags:', html.slice(m.index + m[0].length, (html.indexOf('<', m.index + m[0].length) >= 0 ? html.indexOf('<', m.index + m[0].length) : html.length)).trim().slice(0, 60));

    if (tag.startsWith('</th') || tag.startsWith('<th')) {
      if (currentRow && currentRow.length) rows.push(currentRow);
      currentRow = null;
      inHeader = tag.startsWith('<th');
      continue;
    }

    if (tag.startsWith('</tr') || (tag.startsWith('<tr') && !currentRow)) {
      if (currentRow && currentRow.length) rows.push(currentRow);
      currentRow = [];
      continue;
    }

    if (tag.startsWith('<td') || tag.startsWith('</td')) {
      if (currentRow == null) currentRow = [];
      if (!tag.includes('/')) {
        const closingTagIndex = html.indexOf('<', m.index + m[0].length + 1);
        const text = html.slice(m.index + m[0].length, closingTagIndex >= 0 ? closingTagIndex : html.length).trim();
        currentRow.push(text);
      }
    }
  }

  if (currentRow && currentRow.length) rows.push(currentRow);

  console.log('linhas acumuladas no fim:', rows);
  return rows;
}

const html = `<table><thead><tr><th>titulo</th><th>loja</th><th>copy</th><th>site</th><th>rede</th><th>data_inicio</th></tr></thead><tbody><tr><td>Promoção Black Friday</td><td>Loja Promo</td><td>Até 60% de desconto em eletrônicos</td><td>lojamercado.com.br</td><td>facebook</td><td>2026-11-20</td></tr></tbody></table>`;

const result = parseHtmlTable(html);
console.log(result);
console.log(result.length);

import { writeFileSync } from 'fs';
writeFileSync('/tmp/debug_html_result.json', JSON.stringify(result, null, 2));
