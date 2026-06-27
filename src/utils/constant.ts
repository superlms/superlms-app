import { Dimensions, Platform } from 'react-native';

const constant = {
  API_BASE_URL: 'https://superlms.in/api/v1',
  /** screen */
  screen: Dimensions.get('window'),
  screenHeight:
    (Platform.OS === 'ios' && Dimensions.get('window').height) ||
    Dimensions.get('window').height - 24,
  screenWidth: Dimensions.get('window').width,
};

export default constant;