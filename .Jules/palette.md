## 2023-10-27 - Localization of Tab Navigation

**Learning:** When creating a Japanese-themed app, replacing bottom navigation labels with short Kanji/Katakana characters (like ホーム instead of Home, or 学ぶ instead of Learn) dramatically enhances the immersive UX experience. However, because they are icon-only visually for users who don't read Japanese, adding explicit ARIA labels in their native language (e.g. `aria-label="Ke halaman Kuis"`) is critical for accessibility.
**Action:** Always pair immersive localized text with descriptive `aria-label` attributes to ensure screen readers can announce the functionality correctly to all users regardless of their visual language comprehension.
