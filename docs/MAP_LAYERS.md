# Map layers

The Layers button on route maps opens a responsive style picker. Passenger maps also offer fullscreen. Driver Home already fills the dashboard with its map, so it shows Layers and GPS recenter without a fullscreen button.

| Choice | OpenFreeMap style |
| --- | --- |
| Automatic | Positron in light mode; Dark in dark mode |
| Light | Custom Positron: pastel green land, deeper green parks/woods, white roads, pale blue water and dark gray labels |
| Streets | Liberty with the same pastel green palette, retaining its street and landmark detail |
| Bright | Bright |
| Dark | Custom charcoal and gray palette with bright teal routes |
| Terrain | Positron with Mapzen elevation on AWS Open Data, hillshade and a 50° camera |
| 3D buildings | Liberty with mapped building heights and a 55° camera |

Choices persist locally with AsyncStorage. Style changes update the existing MapLibre map, retaining GPS markers, route geometry, accuracy overlay, camera and follow state. Failed style downloads leave the existing map available and offer retry. These are OpenFreeMap styles; the picker does not use third-party commercial layers from the reference screenshot.

GPS accuracy retains its true radius with a subtle fill and dashed outline so streets stay readable. Labels, map controls and route markers follow the selected map style, including a manual light/dark selection independent of the app theme.

Building footprints use warm gray with a soft darker outline across all light styles, and medium neutral gray in Dark. The 3D view's buildings share the footprint color; building heights and zoom-dependent visibility remain sourced from the map data.

Major road classes (motorway, trunk, primary and secondary) are yellow, with darker edges and a muted gold in Dark. This indicates road classification, not congestion. Ordinary map styles are flat; only 3D buildings shows extrusions. View changes preserve center, zoom, GPS, routes and bus stops while setting the appropriate pitch. Terrain uses separate Terrarium DEM sources for elevation and hillshade at true exaggeration (1×); naturally flat areas remain flat. It adds no traffic data or live imagery. Satellite and live traffic are deferred until an imagery/traffic provider is configured; existing travel times remain transit planning estimates.

Establishment labels use upright text, local names with English/Latin fallback, a contrasting halo and collision spacing. Light and Dark include text-only POI layers from the existing vector tiles; Streets and Bright retain their category icons. Ranked establishments appear progressively from zoom 15 through 17. No external place search or invented establishments are used for map labels.

Mapped bus stops and terminals use a dedicated teal bus icon from zoom 14, with names from zoom 15. The POI bus class and bus_stop/bus_station/bus_terminal subclasses are included; rail stops are not labeled as bus stops. Bus features are excluded from generic POI layers to prevent duplicate labels. Tapping a stop shows its name and a reminder to confirm boarding with the driver. Coverage depends on the underlying OpenStreetMap-derived vector tiles and does not imply that a specific app route serves that stop. Verified operator stops, when present in the route catalog, remain separate route pins.

Validation: build the client with `npm --prefix client run build:web`, then run `npm --prefix server run test:map-layers:browser` and `npm --prefix server run test:maps:browser`. Browser checks cover real styles and tiles, state preservation, fullscreen, persistence, network/storage failure recovery and a narrow screen.
