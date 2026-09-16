import { useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import {
  Bold, Italic, Underline as UnderlineIcon, List, ListOrdered, Link2, RemoveFormatting,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface RichTextEditorProps {
  value: string;
  onChange: (html: string, text: string) => void;
  placeholder?: string;
  className?: string;
}

function ToolbarButton({
  active,
  onClick,
  label,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        'grid h-7 w-7 place-items-center rounded transition-colors',
        active ? 'bg-teal/15 text-teal' : 'text-muted-foreground hover:bg-surface-alt hover:text-foreground',
      )}
    >
      {children}
    </button>
  );
}

/** Editor de texto rico para o corpo das mensagens — ver módulo de comunicação (tarefa 31). */
export function RichTextEditor({ value, onChange, placeholder, className }: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: false, blockquote: false, codeBlock: false, horizontalRule: false }),
      Underline,
      Link.configure({ openOnClick: false, HTMLAttributes: { class: 'text-teal underline' } }),
      Placeholder.configure({ placeholder: placeholder ?? 'Escreva a mensagem…' }),
    ],
    content: value,
    editorProps: {
      attributes: {
        class: 'rich-text-content min-h-[160px] px-3 py-2.5 text-[14px] leading-relaxed focus:outline-none',
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML(), editor.getText()),
  });

  // Sincroniza quando o valor muda por fora (ex.: "Limpar rascunho", troca de template).
  // Como `value` só muda de verdade quando o pai não veio do próprio `onUpdate` (mesmo HTML),
  // isso não reseta o cursor durante a digitação normal.
  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [value, editor]);

  if (!editor) return null;

  const setLink = () => {
    const previous = editor.getAttributes('link').href as string | undefined;
    const url = window.prompt('URL do link', previous ?? 'https://');
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  return (
    <div className={cn('overflow-hidden rounded-md border border-border-strong bg-surface', className)}>
      <div className="flex items-center gap-0.5 border-b border-border bg-surface-alt/60 px-2 py-1.5">
        <ToolbarButton
          label="Negrito"
          active={editor.isActive('bold')}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          label="Itálico"
          active={editor.isActive('italic')}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          label="Sublinhado"
          active={editor.isActive('underline')}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <UnderlineIcon className="h-3.5 w-3.5" />
        </ToolbarButton>
        <span className="mx-1 h-4 w-px bg-border" />
        <ToolbarButton
          label="Lista com marcadores"
          active={editor.isActive('bulletList')}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          label="Lista numerada"
          active={editor.isActive('orderedList')}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered className="h-3.5 w-3.5" />
        </ToolbarButton>
        <span className="mx-1 h-4 w-px bg-border" />
        <ToolbarButton label="Inserir link" active={editor.isActive('link')} onClick={setLink}>
          <Link2 className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          label="Limpar formatação"
          onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
        >
          <RemoveFormatting className="h-3.5 w-3.5" />
        </ToolbarButton>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
