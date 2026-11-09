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

## Animações e Pokédex V6

`styles/sheet-polish-v6.css` e `scripts/sheet-motion-v6.js` organizam textos que ficavam cortados ou apertados e animam a ficha: troca de página, troca de Pokémon, radar de status, números e golpes novos. Tudo respeita a opção "reduzir movimento" do sistema.

`styles/pokedex-device-v6.css` e `scripts/pokedex-device-v6.js` transformam o Modo Pokédex em um aparelho. Ao ligar o modo, a Pokédex inicia e mostra um visor com o Pokémon escaneado, o registro dos jogos (EN/ES, via PokéAPI), status, tipos, golpes e Ability. Controles:

- ← → trocam a seção; ↑ ↓ trocam o Pokémon (também pelo teclado da equipe).
- A toca o grito; B narra o registro; S alterna a arte shiny.
- O visor pode ser fechado e lembra a seção, o idioma, o som e o shiny em `state.dexDevice`.

Fakemon usam os dados do banco H&H. Sem conexão, o visor mostra o que a ficha já tem.
