# ficha-pokemon
"Ficha de RPG para um sistema criado por mim de Pokemon."

## Save local V5.0

O indicador no canto inferior abre a central de saves. O banco local guarda as fichas completas, com as imagens locais deduplicadas, uma versão anterior e até 18 versões no histórico. As alterações comuns geram um ponto de histórico por minuto; saves manuais, mudanças na quantidade de Pokémon, importações e restaurações preservam a versão anterior imediatamente.

O save antigo de `pokemon_rpg_sheet_v13`, sua cópia leve e o antigo banco de recuperação são lidos na migração. As chaves antigas permanecem preservadas. A ficha aguarda a recuperação antes de liberar a edição e só confirma a gravação depois de a transação terminar.

Abas com alterações diferentes não sobrescrevem a versão principal automaticamente. A central permite escolher uma versão, recuperar uma anterior ou baixar um JSON. O botão de proteção pede armazenamento persistente ao navegador; o JSON continua sendo a cópia portátil para outro aparelho ou para fora do navegador.

O motor é `scripts/local-save-v5.js`; a central é `scripts/local-save-ui-v5.js`. O adaptador do HTML mantém `saveState`, `debouncedSave` e as integrações existentes. Novas alterações devem passar por esses métodos, sem gravar o estado diretamente no localStorage.

Para verificar as mudanças:

```sh
npm ci --ignore-scripts
npm test
```

Os testes exercitam migração, imagens maiores que o localStorage, gravações concorrentes, fechamento imediato, corrupção, recuperação e conflitos entre abas. A dependência de teste não é carregada pelo site.
