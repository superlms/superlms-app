import React from 'react';
import { View, StyleProp, ViewStyle } from 'react-native';
import AntDesign from 'react-native-vector-icons/AntDesign';
import Feather from 'react-native-vector-icons/Feather';
import FontAwesome from 'react-native-vector-icons/FontAwesome';
import FontAwesome5 from 'react-native-vector-icons/FontAwesome5';
import FontAwesome6 from 'react-native-vector-icons/FontAwesome6';
import Foundation from 'react-native-vector-icons/Foundation';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Octicons from 'react-native-vector-icons/Octicons';
import Entypo from 'react-native-vector-icons/Entypo';
import EvilIcons from 'react-native-vector-icons/EvilIcons';
import Fontisto from 'react-native-vector-icons/Fontisto';
import SimpleLineIcons from 'react-native-vector-icons/SimpleLineIcons';
import Zocial from 'react-native-vector-icons/Zocial';

interface VectorIconProps {
  iconSet: any;
  iconName: any;
  size?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
}

const VectorIcon = ({
  iconSet,
  iconName,
  size = 24,
  color = '#000',
  style,
}: VectorIconProps) => {
  let IconComponent: any;

  switch (iconSet) {
    case 'AntDesign':
      IconComponent = AntDesign;
      break;
    case 'Feather':
      IconComponent = Feather;
      break;
    case 'FontAwesome':
      IconComponent = FontAwesome;
      break;
    case 'FontAwesome5':
      IconComponent = FontAwesome5;
      break;
    case 'FontAwesome6':
      IconComponent = FontAwesome6;
      break;
    case 'Foundation':
      IconComponent = Foundation;
      break;
    case 'Ionicons':
      IconComponent = Ionicons;
      break;
    case 'MaterialIcons':
      IconComponent = MaterialIcons;
      break;
    case 'MaterialCommunityIcons':
      IconComponent = MaterialCommunityIcons;
      break;
    case 'Octicons':
      IconComponent = Octicons;
      break;
    case 'Entypo':
      IconComponent = Entypo;
      break;
    case 'EvilIcons':
      IconComponent = EvilIcons;
      break;
    case 'Fontisto':
      IconComponent = Fontisto;
      break;
    case 'SimpleLineIcons':
      IconComponent = SimpleLineIcons;
      break;
    case 'Zocial':
      IconComponent = Zocial;
      break;
    default:
      console.warn(`Unknown icon set: ${iconSet}`);
      return null;
  }

  return (
    <View style={style}>
      <IconComponent name={iconName} size={size} color={color} />
    </View>
  );
};

export default VectorIcon;
