/**
 * Five lines of blue EB Garamond on a white screen, top to bottom:
 *
 * 1. "office affluent" with no fontVariant: the font's common ligatures (ffi, ffl) on, as by default.
 * 2. The same text with fontVariant ['no-common-ligatures'].
 * 3. The same text with a zero-width non-joiner between the letters of each ligature, so it draws with no ligature:
 *    what line 2 looks like once 'no-common-ligatures' applies.
 * 4. "The strict act" with no fontVariant: the font's discretionary ligatures (Th, st, ct) off, as by default.
 * 5. The same text with fontVariant ['discretionary-ligatures'].
 *
 * @format
 */

import { StatusBar, StyleSheet, Text, View } from 'react-native';

const commonLigatures = 'office affluent';
const commonLigaturesBroken = 'of‌f‌ice af‌f‌luent';
const discretionaryLigatures = 'The strict act';

function App() {
  return (
    <View style={styles.screen}>
      <StatusBar hidden />
      <View style={styles.row}>
        <Text style={styles.text}>{commonLigatures}</Text>
      </View>
      <View style={styles.row}>
        <Text style={[styles.text, { fontVariant: ['no-common-ligatures'] }]}>{commonLigatures}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.text}>{commonLigaturesBroken}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.text}>{discretionaryLigatures}</Text>
      </View>
      <View style={styles.row}>
        <Text style={[styles.text, { fontVariant: ['discretionary-ligatures'] }]}>{discretionaryLigatures}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'white',
    paddingHorizontal: 24,
  },
  row: {
    height: 80,
    justifyContent: 'center',
  },
  text: {
    fontFamily: 'EBGaramond',
    fontSize: 40,
    color: '#0000ff',
  },
});

export default App;
