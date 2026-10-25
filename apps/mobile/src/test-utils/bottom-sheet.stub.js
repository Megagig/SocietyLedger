// Jest can't load @gorhom/bottom-sheet (reanimated/gesture-handler need a native runtime). Anything that renders a field only needs to
// know "am I inside a sheet?" (no) and to get an ordinary TextInput, so that is all this provides. Tests of sheets mock it themselves.
const { TextInput } = require('react-native');

module.exports = {
  useBottomSheetInternal: () => null,
  BottomSheetTextInput: TextInput,
};
