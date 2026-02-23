/**
 * i18n - Internationalization Module
 * 
 * Simple internationalization system for Fluxhook
 * Supports multiple languages with easy fallback to English
 */

class I18n {
  constructor() {
    this.currentLanguage = 'en';
    this.translations = {};
    this.supportedLanguages = ['en', 'pt-BR'];
    this.defaultLanguage = 'en';
  }

  /**
   * Initialize the i18n system
   * Detects browser language and loads appropriate translations
   */
  async init() {
    // Detect browser language
    const browserLang = navigator.language || navigator.userLanguage;
    
    // Check if we have a saved language preference
    const savedLang = localStorage.getItem('fluxhook-language');
    
    // Determine which language to use
    let targetLang = this.defaultLanguage;
    
    if (savedLang && this.supportedLanguages.includes(savedLang)) {
      targetLang = savedLang;
    } else if (this.supportedLanguages.includes(browserLang)) {
      targetLang = browserLang;
    } else if (browserLang.startsWith('pt')) {
      targetLang = 'pt-BR';
    }
    
    // Load translations
    await this.loadLanguage(targetLang);
    
    // Update HTML lang attribute
    document.documentElement.setAttribute('lang', targetLang === 'pt-BR' ? 'pt-br' : targetLang);
    
    return targetLang;
  }

  /**
   * Load translation file for a specific language
   */
  async loadLanguage(lang) {
    try {
      const response = await fetch(`/locales/${lang}.json`);
      if (!response.ok) {
        throw new Error(`Failed to load language: ${lang}`);
      }
      
      this.translations[lang] = await response.json();
      this.currentLanguage = lang;
      
      // Save preference
      localStorage.setItem('fluxhook-language', lang);
      
      // Update HTML lang attribute
      document.documentElement.setAttribute('lang', lang === 'pt-BR' ? 'pt-br' : lang);
      
      return true;
    } catch (error) {
      console.error(`Error loading language ${lang}:`, error);
      
      // Fallback to default language if not already trying to load it
      if (lang !== this.defaultLanguage) {
        return this.loadLanguage(this.defaultLanguage);
      }
      
      return false;
    }
  }

  /**
   * Get translation for a key
   * Supports nested keys using dot notation (e.g., 'header.multiMode')
   * Supports variable replacement (e.g., '{count}' in string)
   */
  t(key, variables = {}) {
    const keys = key.split('.');
    let value = this.translations[this.currentLanguage];
    
    // Navigate through nested keys
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        // Fallback to English if key not found
        value = this.translations[this.defaultLanguage];
        for (const fallbackKey of keys) {
          if (value && typeof value === 'object' && fallbackKey in value) {
            value = value[fallbackKey];
          } else {
            console.warn(`Translation key not found: ${key}`);
            return key;
          }
        }
        break;
      }
    }
    
    // If we got a string, replace variables
    if (typeof value === 'string') {
      return this.replaceVariables(value, variables);
    }
    
    console.warn(`Translation key is not a string: ${key}`);
    return key;
  }

  /**
   * Replace variables in a translation string
   * Example: "Hello {name}" with {name: "World"} -> "Hello World"
   */
  replaceVariables(str, variables) {
    return str.replace(/\{(\w+)\}/g, (match, key) => {
      return variables[key] !== undefined ? variables[key] : match;
    });
  }

  /**
   * Get current language
   */
  getLanguage() {
    return this.currentLanguage;
  }

  /**
   * Get list of supported languages
   */
  getSupportedLanguages() {
    return this.supportedLanguages;
  }

  /**
   * Change language and reload translations
   */
  async changeLanguage(lang) {
    if (!this.supportedLanguages.includes(lang)) {
      console.error(`Language not supported: ${lang}`);
      return false;
    }
    
    await this.loadLanguage(lang);
    
    // Trigger a custom event so the app can update UI
    window.dispatchEvent(new CustomEvent('languageChanged', { 
      detail: { language: lang } 
    }));
    
    return true;
  }
}

// Create global instance
const i18n = new I18n();

// Export for use in modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = i18n;
}
