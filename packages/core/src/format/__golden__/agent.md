# peons: 2 findings from 1 peon in 4.3s

## [HIGH] src/a.tsx:4 · a11y/img-alt
Image has no alt attribute.
```
<img src="/logo.png" />
```
Fix: Add alt="Company logo".

## [MEDIUM] src/a.tsx:10-12 · a11y/interactive-name
Icon button has no accessible name.
```
<button>
  <Icon />
</button>
```

---
Summary: critical 0 · high 1 · medium 1 · low 0 · info 0
Peons: a11y@1.0.0 ok (4.2s, 1200 in / 80 out, 900 cached)
Redactions: 1
Exit code 1: at least one finding meets the block severity
