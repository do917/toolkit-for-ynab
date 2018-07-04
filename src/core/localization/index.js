import * as locales from './locales';

const toolkitTranslationKey = (featureName, key) => {
  return `toolkit.${featureName}.${key}`;
};

export class Localization {
  constructor(locale) {
    this._translations = {
      ...locales[locale]
    };
  }

  initializeEmberStrings() {
    if (Ember && Ember.I18n && Ember.I18n.translations) {
      Ember.I18n.translations = {
        ...Ember.I18n.translations,
        ...this._translations
      };

      this._translations = Ember.I18n.translations;
    }
  }

  l10n = (key, defaultString) => {
    const str = this._translations[key];
    return typeof str === 'undefined' ? defaultString : str;
  }

  l10nFeature = (featureName, keys) => {
    const l10nFeatureObject = {};

    Object.keys(keys).forEach((key) => {
      const l10nKey = toolkitTranslationKey(featureName, key);
      if (typeof this._translations[l10nKey] === 'undefined') {
        this._translations[l10nKey] = keys[key];
      }

      Object.defineProperty(l10nFeatureObject, key, {
        get: () => this.l10n(l10nKey, keys[key])
      });
    });

    return l10nFeatureObject;
  }
}
