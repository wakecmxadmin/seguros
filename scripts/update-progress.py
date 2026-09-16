"""Atualiza a barra de progresso e o contador de novas_tarefas.md."""
import re

WIDTH = 20
PATH = 'novas_tarefas.md'


def main():
    s = open(PATH, encoding='utf-8').read()

    body = s.split('## Pendentes\n', 1)[1]
    pending_block, done_block = body.split('## Concluídas\n', 1)

    pending = len(re.findall(r'- \[ \] \*\*', pending_block))
    # Marcadas que ainda não foram movidas.
    staged = len(re.findall(r'- \[x\] \*\*', pending_block))
    done = len(re.findall(r'- \[x\] \*\*', done_block))

    total = pending + staged + done
    finished = staged + done
    pct = round(finished / total * 100) if total else 0
    filled = round(pct / 100 * WIDTH)
    bar = '*' * filled + '-' * (WIDTH - filled)

    counter = f'**Total:** {total}  ·  **Pendentes:** {pending}'
    if staged:
        counter += f'  ·  **Feitas (aguardando fechamento):** {staged}'
    counter += f'  ·  **Concluídas:** {done}'

    header = f'`{bar}` **{pct}%**\n\n{counter}'

    s = re.sub(
        r'(# Tarefas\n\n)(?:`[*-]+`.*?\n\n)?\*\*Total:\*\*[^\n]*',
        lambda m: m.group(1) + header,
        s, count=1, flags=re.S,
    )
    open(PATH, 'w', encoding='utf-8').write(s)
    print(f'{bar}  {pct}%   ({finished}/{total})')


if __name__ == '__main__':
    main()
