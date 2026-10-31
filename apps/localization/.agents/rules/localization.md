# Localization demonstration

`/localization` is an intentionally public, fixed-data documentation example. Keep product edits in memory and use the real i18n plugin for language persistence and session synchronization. It uses the template's existing shadcn components and LanguageSwitcher. The page calls useSyncServerLocale because optional routes render outside AppLayout; do not remove the shell's normal call.

Japanese resources are deliberately partial to demonstrate fallback, especially the omitted catalog.shipping key. Preserve the normal English/Chinese structural checks. Application overrides change the i18n plugin language.label, while the menu itself reads the application actions.language key.

Tests and source mappings are in README.MD. Do not turn this focused example into a full product-management system or remove authenticated administration just to make the demonstration public.
