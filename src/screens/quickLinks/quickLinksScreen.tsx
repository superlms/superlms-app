import { StyleSheet, Text, View } from 'react-native';
import React from 'react';
import { theme, onThemeChange } from '../../utils/theme';

const quickLinksScreen = () => {
  return (
    <View>
      <Text>quickLinksScreen</Text>
    </View>
  );
};

export default quickLinksScreen;

const __mk_styles = () => StyleSheet.create({});


// Themed stylesheets — rebuilt on light/dark toggle.
let styles = __mk_styles();
onThemeChange(() => { styles = __mk_styles(); });
