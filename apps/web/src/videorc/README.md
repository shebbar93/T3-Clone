# Videorc look

A skin for `apps/web`, on by default, that applies the light-skeuomorphic look of
[Videorc UI](https://ui.videorc.com): chrome primary buttons, switches, and checkboxes,
glass chips, keycaps, and floating panels with drop shadows.
It also turns on font ligatures and a block caret in the prompt box.

It is plain CSS that matches the `data-slot` attributes of `components/ui`. No component is changed.

## Remove

1. Delete this folder.
2. Delete the line `import "./videorc/videorc.css";` in `apps/web/src/main.tsx`.

## License

Style values come from Videorc UI, MIT License, Copyright (c) 2026 Uros Miric (TheOrcDev).
