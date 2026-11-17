import JSZip from 'jszip';

/**
 * Merge dos modelos de proposta (.docx) com a sintaxe do legado: `[nomeDoCampo]`
 * em texto corrido (docs/16-legado-documentos.md § 7.2). Mantida idêntica para
 * reaproveitar os modelos atuais sem reeditá-los.
 *
 * Os modelos de 2026 têm cada marcador inteiro dentro de um único `<w:t>`, mas
 * o Word costuma partir texto em vários runs ao editar. Por isso, quando um
 * marcador não aparece inteiro no XML, o parágrafo é normalizado: o texto dos
 * runs é juntado no primeiro run do marcador.
 */

const PLACEHOLDER = /\[([A-Za-z][A-Za-z0-9]*)\]/g;

/** Partes do pacote que podem conter texto visível. */
const TEXT_PART = /^word\/(document|header\d*|footer\d*|footnotes|endnotes)\.xml$/;

export interface MergeResult {
  buffer: Buffer;
  /** Marcadores do modelo para os quais não havia valor — ficam como estão. */
  unresolved: string[];
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Junta o texto de runs consecutivos de um parágrafo quando um marcador foi
 * partido entre eles ("[de" + "Cliente]"). Preserva a formatação do run em
 * que o marcador começa.
 */
function healSplitPlaceholders(xml: string) {
  return xml.replace(/<w:p[ >][\s\S]*?<\/w:p>/g, (paragraph) => {
    const texts = [...paragraph.matchAll(/(<w:t(?:\s[^>]*)?>)([^<]*)(<\/w:t>)/g)];
    if (texts.length < 2) return paragraph;

    const full = texts.map((t) => t[2]).join('');
    const whole = full.match(PLACEHOLDER) ?? [];
    const inline = texts.flatMap((t) => t[2].match(PLACEHOLDER) ?? []);
    if (whole.length === inline.length) return paragraph;

    // Reescreve: cada <w:t> recebe seu trecho, mas um marcador partido vai
    // inteiro para o run onde começou e some dos seguintes.
    let carry = '';
    let index = 0;
    return paragraph.replace(/(<w:t(?:\s[^>]*)?>)([^<]*)(<\/w:t>)/g, (_m, open, text, close) => {
      index++;
      let current = carry + text;
      carry = '';
      const lastOpen = current.lastIndexOf('[');
      if (lastOpen > current.lastIndexOf(']') && index < texts.length) {
        carry = current.slice(lastOpen);
        current = current.slice(0, lastOpen);
      }
      const openTag = open.includes('xml:space') ? open : open.replace('<w:t', '<w:t xml:space="preserve"');
      return `${openTag}${current}${close}`;
    });
  });
}

/** Lista os marcadores usados em um modelo (para validar no upload). */
export async function listPlaceholders(docx: Buffer): Promise<string[]> {
  const zip = await JSZip.loadAsync(docx);
  const found = new Set<string>();
  for (const path of Object.keys(zip.files)) {
    if (!TEXT_PART.test(path)) continue;
    const xml = healSplitPlaceholders(await zip.file(path)!.async('string'));
    const text = [...xml.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g)].map((m) => m[1]).join('\n');
    for (const match of text.matchAll(PLACEHOLDER)) found.add(match[1]);
  }
  return [...found].sort();
}

export async function mergeDocx(
  docx: Buffer,
  values: Record<string, string | number | null | undefined>,
): Promise<MergeResult> {
  const zip = await JSZip.loadAsync(docx);
  const unresolved = new Set<string>();

  for (const path of Object.keys(zip.files)) {
    if (!TEXT_PART.test(path)) continue;
    const original = await zip.file(path)!.async('string');
    const merged = healSplitPlaceholders(original).replace(
      /(<w:t(?:\s[^>]*)?>)([^<]*)(<\/w:t>)/g,
      (_m, open, text: string, close) =>
        open +
        text.replace(PLACEHOLDER, (token, key: string) => {
          const value = values[key];
          if (value === undefined || value === null) {
            unresolved.add(key);
            return token;
          }
          return escapeXml(String(value));
        }) +
        close,
    );
    zip.file(path, merged);
  }

  const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  return { buffer, unresolved: [...unresolved].sort() };
}
