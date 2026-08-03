import { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextStyle,
} from 'react-native';
import { useAppTheme } from '@/theme/ThemeContext';

interface PasswordInputProps {
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  editable?: boolean;
  onSubmitEditing?: () => void;
  /** Style du champ, repris de l'écran appelant pour rester cohérent. */
  inputStyle?: StyleProp<TextStyle>;
  returnKeyType?: 'done' | 'go' | 'next' | 'send';
  autoComplete?: 'current-password' | 'new-password';
}

/**
 * Champ mot de passe avec bascule d'affichage.
 *
 * Le bouton œil est superposé au champ, dont on augmente la marge droite pour
 * que le texte ne passe pas dessous. Zone tactile de 44 px : sous cette taille,
 * la cible est difficile à atteindre au pouce.
 */
export default function PasswordInput({
  value,
  onChangeText,
  placeholder = '••••••••',
  editable = true,
  onSubmitEditing,
  inputStyle,
  returnKeyType = 'done',
  autoComplete = 'current-password',
}: PasswordInputProps) {
  const { colors } = useAppTheme();
  const [visible, setVisible] = useState(false);

  return (
    <View style={styles.wrap}>
      <TextInput
        style={[inputStyle, styles.input]}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={!visible}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete={autoComplete}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        editable={editable}
        returnKeyType={returnKeyType}
        onSubmitEditing={onSubmitEditing}
      />
      <Pressable
        onPress={() => setVisible((v) => !v)}
        disabled={!editable}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityState={{ selected: visible }}
        accessibilityLabel={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
        style={styles.toggle}
      >
        <Text style={[styles.toggleText, { color: visible ? colors.gold : colors.textMuted }]}>
          {visible ? 'Masquer' : 'Afficher'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', position: 'relative', justifyContent: 'center' },
  // Réserve la place du bouton pour que le texte saisi ne passe pas dessous.
  input: { paddingRight: 92 },
  toggle: {
    position: 'absolute',
    right: 0,
    height: 44,
    minWidth: 84,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  toggleText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});
