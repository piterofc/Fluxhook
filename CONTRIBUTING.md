# Contributing to Fluxhook

Thank you for your interest in contributing to Fluxhook! We welcome contributions from everyone.

## 🌍 Translation Contributions

One of the easiest ways to contribute is by adding translations to make Fluxhook accessible to more users worldwide.

### How to Add a New Language

1. **Fork the repository** and clone it to your local machine

2. **Create a new translation file**:
   - Navigate to the `locales/` folder
   - Copy the `en.json` file and rename it to your language code (e.g., `es.json` for Spanish, `fr.json` for French, `de.json` for German)
   - Use [ISO 639-1 language codes](https://en.wikipedia.org/wiki/List_of_ISO_639-1_codes)

3. **Translate the content**:
   - Open your new JSON file
   - Translate all text values while keeping the keys unchanged
   - **Do not modify** the keys (the parts before the `:`)
   - **Do not modify** variable placeholders like `{count}`, `{error}`, `{current}`, `{total}`, etc.
   
   Example:
   ```json
   {
     "header": {
       "multiMode": "Your Translation Here",
       "exportJson": "Your Translation Here"
     },
     "messages": {
       "confirmClearQueue": "⚠️ Your translation with {count} variable here?"
     }
   }
   ```

4. **Update the i18n module**:
   - Open `i18n.js`
   - Add your language code to the `supportedLanguages` array:
   ```javascript
   this.supportedLanguages = ['en', 'pt-BR', 'your-language-code'];
   ```

5. **Update the language selector** (if not already present):
   - Open `index.html`
   - Add your language option to the `languageSelector` dropdown:
   ```html
   <select class="form-select form-select-sm" id="languageSelector">
     <option value="en">English</option>
     <option value="pt-BR">Português (Brasil)</option>
     <option value="your-code">Your Language Name</option>
   </select>
   ```

6. **Test your translation**:
   - Run the application locally
   - Select your language from the language selector
   - Check that all texts are properly translated
   - Verify that variable replacements work correctly

7. **Submit a Pull Request**:
   - Commit your changes with a clear message: `Add [Language Name] translation`
   - Push to your fork
   - Create a Pull Request with a description of your translation

### Translation Guidelines

- **Be consistent**: Use the same terminology throughout the translation
- **Keep formatting**: Maintain emoji, punctuation, and special characters where appropriate
- **Context matters**: Some words may have different translations depending on context
- **Test thoroughly**: Make sure your translation fits in the UI (not too long)
- **Variable placeholders**: Never translate or modify `{variable}` placeholders
- **URLs and technical terms**: Don't translate URLs, filenames, or technical terms like "webhook", "embed", "JSON"

### Translation File Structure

```json
{
  "app": {
    "title": "Application title",
    "description": "Application description"
  },
  "header": {
    "multiMode": "Button text",
    "multiModeTooltip": "Tooltip text"
  },
  "messages": {
    "noContent": "Alert message",
    "confirmClearQueue": "Confirmation with {count} variable"
  }
}
```

## 🐛 Bug Reports

If you find a bug, please create an issue with:
- A clear description of the problem
- Steps to reproduce
- Expected vs actual behavior
- Screenshots if applicable

## 💡 Feature Requests

Feature suggestions are welcome! Please:
- Check if the feature has already been requested
- Clearly describe the feature and its use case
- Explain why it would be valuable

## 🔧 Code Contributions

If you want to contribute code:
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Test thoroughly
5. Commit with clear messages
6. Submit a Pull Request

### Code Style

- Use meaningful variable and function names
- Comment complex logic
- Follow existing code patterns
- Keep functions focused and modular

## 📝 Documentation

Improvements to documentation are always welcome:
- Fix typos or unclear explanations
- Add examples
- Improve README
- Add code comments

## 🌟 Recognition

All contributors will be recognized in the project. Thank you for making Fluxhook better!

## Questions?

Feel free to open an issue if you have any questions about contributing.

---

**Note**: By contributing to Fluxhook, you agree that your contributions will be licensed under the project's GNU General Public License v3.0 (GNU GPLv3).
