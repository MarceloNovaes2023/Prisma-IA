const htmlSimple = `<table><tr><th>titulo</th><th>loja</th><th>copy</th><th>site</th></tr><tr><td>Promoção Black Friday</td><td>Loja Promo</td><td>Até 60% de desconto</td><td>lojamercado.com.br</td></tr></table>`;
const htmlMultiRow = `<table><thead><tr><th>titulo</th><th>loja</th><th>copy</th><th>site</th></tr></thead><tbody>
<tr><td>Promoção final</td><td>Loja A</td><td>Até 50% OFF</td><td>loja-a.com.br</td></tr>
<tr><td>Black Friday</td><td>Loja B</td><td>Compre 1 Leve 2</td><td>loja-b.com.br</td></tr>
</tbody></table>`;

function parseHtmlTable(html) {
  const rows = [];

  const flatHtml = html.replace(/\n/g, " ");

  const trPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let trMatch;
  while ((trMatch = trPattern.exec(flatHtml)) !== null) {
    const lineContent = trMatch[1];
    const row = [];

    const tdPattern = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
    let tdMatch;
    while ((tdMatch = tdPattern.exec(lineContent)) !== null) {
      row.push(tdMatch[1]);
    }

    if (row.length > 0) {
      rows.push(row);
    }
  }

  if (rows.length < 2) {
    console.log("rows.length < 2, rows:", JSON.stringify(rows));
    return [];
  }

  const header = rows[0].map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));
  console.log("header:", JSON.stringify(header));
  console.log("rows:", JSON.stringify(rows));

  const result = rows.slice(1).map((row) => {
    const record = {};
    header.forEach((key, i) => { record[key] = (row[i] ?? "").trim(); });
    return record;
  });
  console.log("result:", JSON.stringify(result));

  return result;
}

console.log("=== htmlSimple ===");
console.log("records:", JSON.stringify(parseHtmlTable(htmlSimple)));
console.log("=== htmlMultiRow ===");
console.log("records:", JSON.stringify(parseHtmlTable(htmlMultiRow)));
