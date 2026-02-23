# Contribuindo com o Fluxhook

Obrigado pelo seu interesse em contribuir com o Fluxhook! Aceitamos contribuições de todos.

## 🌍 Contribuições de Tradução

Uma das formas mais fáceis de contribuir é adicionando traduções para tornar o Fluxhook acessível a mais usuários ao redor do mundo.

### Como Adicionar um Novo Idioma

1. **Faça um fork do repositório** e clone para sua máquina local

2. **Crie um novo arquivo de tradução**:
   - Navegue até a pasta `locales/`
   - Copie o arquivo `en.json` e renomeie para o código do seu idioma (ex: `es.json` para Espanhol, `fr.json` para Francês, `de.json` para Alemão)
   - Use [códigos ISO 639-1](https://pt.wikipedia.org/wiki/ISO_639)

3. **Traduza o conteúdo**:
   - Abra seu novo arquivo JSON
   - Traduza todos os valores de texto mantendo as chaves inalteradas
   - **NÃO modifique** as chaves (as partes antes do `:`)
   - **NÃO modifique** os placeholders de variáveis como `{count}`, `{error}`, `{current}`, `{total}`, etc.
   
   Exemplo:
   ```json
   {
     "header": {
       "multiMode": "Sua Tradução Aqui",
       "exportJson": "Sua Tradução Aqui"
     },
     "messages": {
       "confirmClearQueue": "⚠️ Sua tradução com a variável {count} aqui?"
     }
   }
   ```

4. **Atualize o módulo i18n**:
   - Abra o arquivo `i18n.js`
   - Adicione o código do seu idioma ao array `supportedLanguages`:
   ```javascript
   this.supportedLanguages = ['en', 'pt-BR', 'codigo-do-seu-idioma'];
   ```

5. **Atualize o seletor de idioma** (se ainda não estiver presente):
   - Abra `index.html`
   - Adicione a opção do seu idioma no dropdown `languageSelector`:
   ```html
   <select class="form-select form-select-sm" id="languageSelector">
     <option value="en">English</option>
     <option value="pt-BR">Português (Brasil)</option>
     <option value="seu-codigo">Nome do Seu Idioma</option>
   </select>
   ```

6. **Teste sua tradução**:
   - Execute a aplicação localmente
   - Selecione seu idioma no seletor de idioma
   - Verifique se todos os textos estão traduzidos corretamente
   - Confirme que as substituições de variáveis funcionam

7. **Envie um Pull Request**:
   - Faça commit das mudanças com uma mensagem clara: `Adicionar tradução em [Nome do Idioma]`
   - Envie para seu fork
   - Crie um Pull Request com uma descrição da sua tradução

### Diretrizes de Tradução

- **Seja consistente**: Use a mesma terminologia ao longo da tradução
- **Mantenha a formatação**: Preserve emojis, pontuação e caracteres especiais quando apropriado
- **Contexto importa**: Algumas palavras podem ter traduções diferentes dependendo do contexto
- **Teste completamente**: Certifique-se de que sua tradução cabe na interface (não é muito longa)
- **Placeholders de variáveis**: Nunca traduza ou modifique placeholders `{variavel}`
- **URLs e termos técnicos**: Não traduza URLs, nomes de arquivo ou termos técnicos como "webhook", "embed", "JSON"

### Estrutura do Arquivo de Tradução

```json
{
  "app": {
    "title": "Título da aplicação",
    "description": "Descrição da aplicação"
  },
  "header": {
    "multiMode": "Texto do botão",
    "multiModeTooltip": "Texto do tooltip"
  },
  "messages": {
    "noContent": "Mensagem de alerta",
    "confirmClearQueue": "Confirmação com variável {count}"
  }
}
```

## 🐛 Reportar Bugs

Se você encontrar um bug, por favor crie uma issue com:
- Uma descrição clara do problema
- Passos para reproduzir
- Comportamento esperado vs comportamento atual
- Screenshots se aplicável

## 💡 Sugestões de Recursos

Sugestões de novos recursos são bem-vindas! Por favor:
- Verifique se o recurso já foi solicitado
- Descreva claramente o recurso e seu caso de uso
- Explique por que seria valioso

## 🔧 Contribuições de Código

Se você quer contribuir com código:
1. Faça um fork do repositório
2. Crie uma branch de feature (`git checkout -b feature/recurso-incrivel`)
3. Faça suas alterações
4. Teste completamente
5. Faça commit com mensagens claras
6. Envie um Pull Request

### Estilo de Código

- Use nomes significativos para variáveis e funções
- Comente lógica complexa
- Siga os padrões de código existentes
- Mantenha funções focadas e modulares

## 📝 Documentação

Melhorias na documentação são sempre bem-vindas:
- Corrigir erros de digitação ou explicações confusas
- Adicionar exemplos
- Melhorar o README
- Adicionar comentários no código

## 🌟 Reconhecimento

Todos os contribuidores serão reconhecidos no projeto. Obrigado por tornar o Fluxhook melhor!

## Dúvidas?

Sinta-se à vontade para abrir uma issue se tiver alguma dúvida sobre como contribuir.

---

**Nota**: Ao contribuir com o Fluxhook, você concorda que suas contribuições serão licenciadas sob a GNU General Public License v3.0 (GNU GPLv3) do projeto.
