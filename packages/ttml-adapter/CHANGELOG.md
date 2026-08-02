# @sub37/ttml-adapter

## **1.0.4** (02 Aug 2026)

- Fixed region derivation not inheriting correctly special semantics syntax properties (`tts:origin`, `tts:extent`...) when they were applied on a `div`;

---

## **1.0.3** (01 Aug 2026)

- Fixed region styles not being refencially-inherited. A style attribute applied to `region` element wasn't letting styles passing through cues flowed in it (#33)

---

## **1.0.1** (06 Jun 2026)

- Added missing support to encoded and predefined entities decoding (#23)
- Fixed special semantics support when default region applies (#25)

---

## **1.0.0** (19 Jun 2026)

- First version released
