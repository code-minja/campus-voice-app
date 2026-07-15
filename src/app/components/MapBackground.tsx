import { ImageBackground, StyleSheet, View } from "react-native";

const BACKGROUND_IMAGE =
  "https://images.unsplash.com/photo-1655543274920-06de452d0d02?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx1bml2ZXJzaXR5JTIwY2FtcHVzJTIwYWVyaWFsJTIwdmlld3xlbnwxfHx8fDE3NzYyNzg5MDN8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral";

type MapBackgroundProps = {
  overlayOpacity?: number;
  blurRadius?: number;
};

export function MapBackground({ overlayOpacity = 0.88, blurRadius = 32 }: MapBackgroundProps) {
  return (
    <>
      <ImageBackground
        source={{ uri: BACKGROUND_IMAGE }}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
        blurRadius={blurRadius}
      />
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: `rgba(2, 6, 23, ${overlayOpacity})` },
        ]}
      />
    </>
  );
}
