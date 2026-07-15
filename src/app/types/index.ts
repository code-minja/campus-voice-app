export type GeoCoordinates = {
  latitude: number;
  longitude: number;
};

export type SavedLocation = {
  id: string;
  name: string;
  subtitle: string;
  isFavorite: boolean;
};

export type NewSavedLocation = Omit<SavedLocation, "id">;

export type RootStackParamList = {
  Home: undefined;
  NavigationInput: undefined;
  SearchResults: { query?: string } | undefined;
  ErrorState: { message?: string } | undefined;
  Settings: undefined;
  SavedLocations: undefined;
  AddLocation: undefined;
  RoutePreview: { destination: string };
  ActiveNavigation: { destination: string };
  VoiceOnlyMode: { destination: string };
  Arrival: { destination: string; durationSeconds: number; distanceMeters: number };
};
