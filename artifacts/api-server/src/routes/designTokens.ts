import { Router } from "express";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const router = Router();

router.get("/design-tokens", (_req, res) => {
  const tokensPath = resolve(process.cwd(), "../../design/aforce-tokens.json");
  try {
    const content = readFileSync(tokensPath, "utf-8");
    res.setHeader("Content-Type", "application/json");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="aforce-tokens.json"',
    );
    res.send(content);
  } catch {
    res.status(404).json({ error: "Tokens file not found" });
  }
});

router.get("/design-guide", (_req, res) => {
  const mdPath = resolve(process.cwd(), "../../design/aforce-design-tokens.md");
  try {
    const md = readFileSync(mdPath, "utf-8");
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>AForce Design Guide</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#000;color:#fff;font-family:Inter,-apple-system,sans-serif;padding:40px 20px;max-width:900px;margin:0 auto;line-height:1.6}
h1{font-size:28px;font-weight:700;color:#C1281B;margin-bottom:8px}
h2{font-size:22px;font-weight:700;color:#fff;margin-top:48px;margin-bottom:16px;border-bottom:1px solid rgba(255,255,255,0.08);padding-bottom:8px}
h3{font-size:17px;font-weight:600;color:rgba(255,255,255,0.85);margin-top:32px;margin-bottom:12px}
p{color:rgba(255,255,255,0.65);margin-bottom:12px}
blockquote{border-left:3px solid #C1281B;padding-left:16px;margin:16px 0;color:rgba(255,255,255,0.55)}
strong{color:#fff}
em{color:rgba(255,255,255,0.55)}
code{background:rgba(255,255,255,0.06);padding:2px 6px;border-radius:4px;font-size:13px;color:#C1281B}
pre{background:rgba(255,255,255,0.04);padding:16px;border-radius:8px;overflow-x:auto;margin:12px 0}
pre code{background:none;padding:0}
table{width:100%;border-collapse:collapse;margin:16px 0}
th{text-align:left;padding:8px 12px;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:rgba(255,255,255,0.40);border-bottom:1px solid rgba(255,255,255,0.08)}
td{padding:8px 12px;font-size:14px;color:rgba(255,255,255,0.75);border-bottom:1px solid rgba(255,255,255,0.04)}
td code{font-size:12px}
hr{border:none;border-top:1px solid rgba(255,255,255,0.06);margin:32px 0}
ul,ol{padding-left:20px;margin-bottom:12px}
li{color:rgba(255,255,255,0.65);margin-bottom:4px}
li strong{color:#fff}
a{color:#0093E7;text-decoration:none}
a:hover{text-decoration:underline}
</style>
</head>
<body>
${markdownToHtml(md)}
</body>
</html>`;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  } catch {
    res.status(404).json({ error: "Design guide not found" });
  }
});

function markdownToHtml(md: string): string {
  return md
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/^> (.+)$/gm, '<blockquote><p>$1</p></blockquote>')
    .replace(/^---$/gm, '<hr>')
    .replace(/^\| *(.+)$/gm, (match) => {
      const cells = match.split('|').filter(c => c.trim()).map(c => c.trim());
      if (cells.every(c => /^-+$/.test(c))) return '';
      const tag = cells.every(c => /^-+$/.test(c)) ? 'th' : 'td';
      return '<tr>' + cells.map(c => '<' + tag + '>' + formatInline(c) + '</' + tag + '>').join('') + '</tr>';
    })
    .replace(/((<tr>.*<\/tr>\n?)+)/g, '<table>$1</table>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/((<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>')
    .replace(/\n{2,}/g, '\n')
    .replace(/^(?!<[a-z])(.*\S.*)$/gm, '<p>$1</p>')
    .replace(/<p><\/p>/g, '');
}

function formatInline(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
}

export default router;
