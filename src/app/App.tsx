import { useEffect, useState } from "react";
import { StatusBar } from "react-native";
import {
  DefaultTheme,
  NavigationContainer,
  Theme,
} from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AddLocationScreen } from "./screens/AddLocationScreen";
import { ActiveNavigationScreen } from "./screens/ActiveNavigationScreen";
import { ErrorStateScreen } from "./screens/ErrorStateScreen";
import { HomeScreen } from "./screens/HomeScreen";
import { NavigationInputScreen } from "./screens/NavigationInputScreen";
import { RoutePreviewScreen } from "./screens/RoutePreviewScreen";
import { SavedLocationsScreen } from "./screens/SavedLocationsScreen";
import { SearchResultsScreen } from "./screens/SearchResultsScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { VoiceOnlyModeScreen } from "./screens/VoiceOnlyModeScreen";
import { ArrivalScreen } from "./screens/ArrivalScreen";
import { useLiveLocation } from "./hooks/useLiveLocation";
import type {
  NewSavedLocation,
  RootStackParamList,
  SavedLocation,
} from "./types";
import { preloadAudioAssets } from "./services/preRecordedAudio";

const Stack = createNativeStackNavigator<RootStackParamList>();

const navTheme: Theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: "#020617",
    card: "#020617",
    border: "transparent",
    text: "#ffffff",
    primary: "#22d3ee",
    notification: "#22d3ee",
  },
};

export default function App() {
  const [savedLocations, setSavedLocations] = useState<SavedLocation[]>([]);
  const [homeSessionVersion, setHomeSessionVersion] = useState(0);
  const {
    currentLocationLabel,
    currentCoordinates,
    accuracyMeters,
    errorMessage: currentLocationError,
    retryLocation,
  } = useLiveLocation();

  const handleAddLocation = (location: NewSavedLocation) => {
    const newLocation: SavedLocation = {
      id: Date.now().toString(),
      ...location,
    };
    setSavedLocations((prev) => [...prev, newLocation]);
  };

  // Remounting Home replays the welcome prompt and starts a fresh voice session.
  const restartHomeSession = () => {
    setHomeSessionVersion((prev) => prev + 1);
  };

  useEffect(() => {
    preloadAudioAssets().catch((error) => {
      console.warn("Failed to preload audio:", error);
    });
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" />
      <NavigationContainer theme={navTheme}>
        <Stack.Navigator
          screenOptions={{ headerShown: false, animation: "default" }}
        >
          <Stack.Screen name="Home">
            {({ navigation }) => (
              <HomeScreen
                key={`home-session-${homeSessionVersion}`}
                currentLocation={currentLocationLabel}
                onStartVoiceNavigation={(destination) =>
                  navigation.navigate("RoutePreview", { destination })
                }
                onOpenSettings={() => navigation.navigate("Settings")}
              />
            )}
          </Stack.Screen>

          <Stack.Screen name="NavigationInput">
            {({ navigation }) => (
              <NavigationInputScreen
                onBack={() => navigation.goBack()}
                onSelectDestination={(destination) =>
                  navigation.navigate("RoutePreview", { destination })
                }
                onShowError={() =>
                  navigation.navigate("ErrorState", {
                    message: "I couldn't find that route",
                  })
                }
              />
            )}
          </Stack.Screen>

          <Stack.Screen name="SearchResults">
            {({ navigation, route }) => (
              <SearchResultsScreen
                query={route.params?.query}
                currentCoordinate={currentCoordinates}
                onBack={() => navigation.goBack()}
                onSelectLocation={(location) =>
                  navigation.navigate("RoutePreview", { destination: location })
                }
              />
            )}
          </Stack.Screen>

          <Stack.Screen name="ErrorState">
            {({ navigation, route }) => (
              <ErrorStateScreen
                message={route.params?.message}
                onBack={() => navigation.goBack()}
                onTryAgain={() => navigation.navigate("NavigationInput")}
                onUseSearch={() => navigation.navigate("NavigationInput")}
                onSelectSuggestion={(suggestion) =>
                  navigation.navigate("RoutePreview", {
                    destination: suggestion,
                  })
                }
              />
            )}
          </Stack.Screen>

          <Stack.Screen name="Settings">
            {({ navigation }) => (
              <SettingsScreen
                onBack={() => navigation.goBack()}
                onOpenSavedLocations={() =>
                  navigation.navigate("SavedLocations")
                }
              />
            )}
          </Stack.Screen>

          <Stack.Screen name="SavedLocations">
            {({ navigation }) => (
              <SavedLocationsScreen
                savedLocations={savedLocations}
                onBack={() => navigation.goBack()}
                onSelectLocation={(location) =>
                  navigation.navigate("RoutePreview", {
                    destination: location.name,
                  })
                }
                onAddLocation={() => navigation.navigate("AddLocation")}
                onUpdateLocations={setSavedLocations}
              />
            )}
          </Stack.Screen>

          <Stack.Screen name="AddLocation">
            {({ navigation }) => (
              <AddLocationScreen
                onBack={() => navigation.goBack()}
                onSave={(location) => {
                  handleAddLocation(location);
                  navigation.goBack();
                }}
              />
            )}
          </Stack.Screen>

          <Stack.Screen name="RoutePreview">
            {({ navigation, route }) => (
              <RoutePreviewScreen
                destination={route.params.destination}
                currentLocation={currentLocationLabel}
                currentCoordinate={currentCoordinates}
                locationError={currentLocationError}
                onRetryLocation={retryLocation}
                onBack={() => navigation.goBack()}
                onStartNavigation={() =>
                  navigation.navigate("ActiveNavigation", {
                    destination: route.params.destination,
                  })
                }
                onCancelVoiceConfirmation={() => {
                  restartHomeSession();
                  navigation.popToTop();
                }}
              />
            )}
          </Stack.Screen>

          <Stack.Screen name="ActiveNavigation">
            {({ navigation, route }) => (
              <ActiveNavigationScreen
                destination={route.params.destination}
                currentLocation={currentLocationLabel}
                currentCoordinate={currentCoordinates}
                locationAccuracyMeters={accuracyMeters}
                onEndNavigation={() => {
                  restartHomeSession();
                  navigation.popToTop();
                }}
                onSwitchToVoiceOnly={() =>
                  navigation.navigate("VoiceOnlyMode", {
                    destination: route.params.destination,
                  })
                }
              />
            )}
          </Stack.Screen>

          <Stack.Screen name="VoiceOnlyMode">
            {({ navigation, route }) => (
              <VoiceOnlyModeScreen
                destination={route.params.destination}
                currentLocation={currentLocationLabel}
                currentCoordinate={currentCoordinates}
                locationAccuracyMeters={accuracyMeters}
                onEndNavigation={() => {
                  restartHomeSession();
                  navigation.popToTop();
                }}
              />
            )}
          </Stack.Screen>

          <Stack.Screen name="Arrival">
            {({ navigation, route }) => (
              <ArrivalScreen
                destination={route.params.destination}
                durationSeconds={route.params.durationSeconds}
                distanceMeters={route.params.distanceMeters}
                onFinish={() => {
                  restartHomeSession();
                  navigation.popToTop();
                }}
              />
            )}
          </Stack.Screen>
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
