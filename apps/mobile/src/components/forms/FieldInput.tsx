import { TextInput, type TextInputProps } from 'react-native';
import { BottomSheetTextInput, useBottomSheetInternal } from '@gorhom/bottom-sheet';

/**
 * The text input every form field uses. Inside a bottom sheet it is the sheet's own input, which is what lets the sheet rise above
 * the keyboard (a plain TextInput there leaves the field hidden behind it); anywhere else it is an ordinary TextInput.
 */
export function FieldInput(props: TextInputProps) {
  const insideSheet = useBottomSheetInternal(true) !== null;
  return insideSheet ? <BottomSheetTextInput {...props} /> : <TextInput {...props} />;
}
