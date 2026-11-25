# rn-font-variant-ligatures

`fontVariant`'s ligature values have no effect on React Native's new architecture.

`ReproducerApp/App.tsx` draws five lines of blue [EB Garamond](https://github.com/google/fonts/tree/main/ofl/ebgaramond)
(bundled in `ReproducerApp/android/app/src/main/assets/fonts/`, under the SIL Open Font License beside it), top to bottom:

1. `office affluent` with no `fontVariant`: the font's common ligatures (ffi, ffl) on, as by default.
2. The same text with `fontVariant: ['no-common-ligatures']`.
3. The same text with a zero-width non-joiner between the letters of each ligature, so it draws with no ligature:
   what line 2 looks like once `'no-common-ligatures'` applies.
4. `The strict act` with no `fontVariant`: the font's discretionary ligatures (Th, st, ct) off, as by default.
5. The same text with `fontVariant: ['discretionary-ligatures']`.

## Run it

With an Android device on adb (`ANDROID_SERIAL` picks one):

```sh
./reproduce-android.sh
```

It builds the app in Release, installs and launches it, takes a screenshot (`screenshot.png`), and runs
`node measure.mjs screenshot.png`, which finds the five lines and compares their pixels.

- **Expected:** line 2 differs from line 1, and line 5 differs from line 4; the script exits 0.
- **Actual:** line 2 draws the same pixels as line 1, and line 5 the same as line 4; the script exits 1.

It exits 2 when a step fails or the screenshot cannot tell, for one when line 3 draws the same as line 1.
