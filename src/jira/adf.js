/**
 * Converte um documento ADF (Atlassian Document Format) em texto puro,
 * preservando parágrafos, listas e blocos de código de forma legível.
 *
 * @param {object|null|undefined} adf
 * @returns {string}
 */
export function adfToText(adf) {
  if (!adf || !adf.content) return '';

  function renderNode(node, indent = 0, listInfo = null) {
    if (!node) return '';

    switch (node.type) {
      case 'text':
        return node.text || '';
      case 'hardBreak':
        return '\n';
      case 'paragraph': {
        const text = (node.content || []).map(n => renderNode(n)).join('');
        return text;
      }
      case 'heading': {
        const text = (node.content || []).map(n => renderNode(n)).join('');
        return text;
      }
      case 'bulletList': {
        return (node.content || [])
          .map(item => renderNode(item, indent + 1, { type: 'bullet' }))
          .join('\n');
      }
      case 'orderedList': {
        return (node.content || [])
          .map((item, i) => renderNode(item, indent + 1, { type: 'ordered', index: i + 1 }))
          .join('\n');
      }
      case 'listItem': {
        const prefix = '  '.repeat(indent - 1) + (
          listInfo?.type === 'ordered' ? `${listInfo.index}. ` : '• '
        );
        const text = (node.content || []).map(n => renderNode(n, indent)).join('\n');
        return prefix + text.trim();
      }
      case 'codeBlock': {
        const text = (node.content || []).map(n => renderNode(n)).join('');
        return text;
      }
      case 'blockquote': {
        const text = (node.content || []).map(n => renderNode(n, indent)).join('\n');
        return text.split('\n').map(line => `  ${line}`).join('\n');
      }
      default:
        if (node.content) {
          return node.content.map(n => renderNode(n, indent, listInfo)).join('');
        }
        return '';
    }
  }

  const blocks = adf.content.map(node => renderNode(node));
  return blocks.filter(b => b.trim() !== '').join('\n\n');
}