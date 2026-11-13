export interface MapCoord { latitude: number; longitude: number; }
export interface MapStop { label: string; coord: MapCoord; isOrigin?: boolean; isDestination?: boolean; isOutside?: boolean; isLivePickup?: boolean; }
export interface MapTown { name: string; coord: MapCoord; }
export interface MapOptions { routingExpected?: boolean; showRouteDetails?: boolean; labels?: Record<string, string>; followDriver?: boolean; vehicleType?: 'jeep' | 'bus'; }

export function buildMapHtml(stops: MapStop[], towns: MapTown[], isDark: boolean, servicePath?: MapCoord[], driverMode = false, options: MapOptions = {}): string {
  const valid = (coord: MapCoord) => Number.isFinite(coord.latitude) && Math.abs(coord.latitude) <= 90 && Number.isFinite(coord.longitude) && Math.abs(coord.longitude) <= 180;
  const safe = (value: unknown) => JSON.stringify(value).replace(/</g, '\\u003c');
  const data = stops.filter(stop => valid(stop.coord) && (options.showRouteDetails !== false || stop.isLivePickup)).map(stop => ({ ...stop, point: [stop.coord.longitude, stop.coord.latitude] }));
  const knownPath = options.showRouteDetails !== false && servicePath && servicePath.length > 1 && servicePath.every(valid) ? servicePath.map(point => [point.longitude, point.latitude]) : [];
  const styles = {
    light: process.env.EXPO_PUBLIC_MAP_STYLE_LIGHT_URL || 'https://tiles.openfreemap.org/styles/positron',
    streets: 'https://tiles.openfreemap.org/styles/liberty',
    bright: 'https://tiles.openfreemap.org/styles/bright',
    dark: process.env.EXPO_PUBLIC_MAP_STYLE_DARK_URL || 'https://tiles.openfreemap.org/styles/dark',
    terrain: process.env.EXPO_PUBLIC_MAP_STYLE_LIGHT_URL || 'https://tiles.openfreemap.org/styles/positron',
    '3d': 'https://tiles.openfreemap.org/styles/liberty',
  };
  const labels = Object.fromEntries(['Loading map…', 'Retry map', 'Map unavailable. Check your connection or device graphics support.', 'Map tiles unavailable. Locations are still visible.', 'Verified service route', 'Loading road route…', 'Road route preview', 'Road route unavailable', 'Driver GPS', 'Your location', 'You', 'Bus stop', 'Mapped bus stop. Confirm boarding with your driver.'].map(label => [label, options.labels?.[label] || label]));
  return `<!DOCTYPE html><html><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" /><meta name="color-scheme" content="only light" />
<link rel="stylesheet" href="https://unpkg.com/maplibre-gl@5.24.0/dist/maplibre-gl.css" />
<style>
html{color-scheme:only light}html[data-map-style="dark"]{color-scheme:dark}
html,body,#map{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:${isDark ? '#181a19' : '#f3f4f0'};font-family:system-ui,-apple-system,sans-serif}
.maplibregl-ctrl-attrib{font-size:9px!important}.maplibregl-ctrl-group{border-radius:13px!important;overflow:hidden}.maplibregl-ctrl-group button{width:38px;height:38px}.maplibregl-ctrl-bottom-right .maplibregl-ctrl-group{margin-bottom:35px}
.stop-marker{width:32px;height:40px;z-index:4}.pin{width:32px;height:40px;position:relative;color:white;font-size:12px;font-weight:800;filter:drop-shadow(0 2px 3px #0004)}.pin svg{display:block;width:32px;height:40px}.pin-symbol{position:absolute;top:7px;left:0;width:32px;height:18px;display:grid;place-items:center;line-height:18px}.route-label{position:absolute;bottom:46px;left:50%;transform:translateX(-50%);background:${isDark ? '#242624' : '#fff'};color:${isDark ? '#eee' : '#153b43'};border-radius:8px;font-size:10px;font-weight:700;padding:4px 7px;width:max-content;max-width:180px;white-space:normal;text-align:center;line-height:15px;overflow-wrap:break-word;box-shadow:0 2px 7px #0002}
.town{font-size:10px;color:${isDark ? '#aaa' : '#59747a'};text-shadow:0 1px 2px ${isDark ? '#111' : '#fff'};pointer-events:none}.car{width:46px;height:46px;z-index:5}.vehicle-shell{width:46px;height:46px;position:relative}.vehicle-body{width:40px;height:40px;border-radius:15px;background:#087f8c;display:grid;place-items:center;border:3px solid #fff;box-shadow:0 3px 8px #0006}.car.stale .vehicle-body{background:#68716d}.vehicle-heading{position:absolute;left:15px;top:-10px;transform-origin:8px 33px;width:0;height:0;border-left:8px solid transparent;border-right:8px solid transparent;border-bottom:11px solid #087f8c}
.user-location{width:24px;height:24px;z-index:6}.user-dot{width:18px;height:18px;border-radius:50%;background:#2879e3;border:3px solid white;box-shadow:0 0 0 5px #2879e333,0 2px 6px #0004}.user-location.stale .user-dot{background:#6f7b8b}.user-label{position:absolute;top:30px;left:50%;transform:translateX(-50%);font-size:12px;font-weight:800;color:#174e94;background:#fff;padding:3px 8px;border-radius:8px;white-space:nowrap;box-shadow:0 1px 4px #0003}
.vehicle-body{border-radius:16px;box-shadow:0 0 0 5px #087f8c14,0 4px 12px #172d2938}.route-label{padding:5px 9px;border:1px solid #e0e8e3;box-shadow:0 2px 6px #172d2914}.maplibregl-ctrl-attrib{border-radius:12px!important}.maplibregl-ctrl-group{box-shadow:0 2px 8px #172d2926!important}
html[data-map-style]:not([data-map-style="dark"]) .route-label,html[data-map-style]:not([data-map-style="dark"]) .route-note{background:#ffffffed;color:#3D4D47;border-color:#e0e8e3}html[data-map-style]:not([data-map-style="dark"]) .town{color:#75817A;text-shadow:0 1px 2px #fff}
html[data-map-style="dark"] .route-label,html[data-map-style="dark"] .route-note{background:#242424ed;color:#f0f0f0;border-color:#424242}html[data-map-style="dark"] .town{color:#ccc;text-shadow:0 1px 2px #181818}html[data-map-style="dark"] .maplibregl-ctrl-attrib,html[data-map-style="dark"] .maplibregl-ctrl-group{background:#292929;color:#eee}html[data-map-style="dark"] .maplibregl-ctrl-attrib a{color:#ddd}html[data-map-style="dark"] .maplibregl-ctrl-icon,html[data-map-style="dark"] .maplibregl-ctrl-attrib-button{filter:invert(1)}html[data-map-style="dark"] .vehicle-body{background:#087f8c;box-shadow:0 0 0 5px #68c9c21c,0 4px 14px #0006}
.route-note{position:absolute;z-index:8;bottom:${driverMode ? 80 : 26}px;left:10px;max-width:65%;border-radius:10px;padding:6px 9px;font-size:10px;line-height:15px;background:${isDark ? '#242624ed' : '#ffffffed'};color:${isDark ? '#eee' : '#153b43'};box-shadow:0 2px 9px #0002}.map-error{position:absolute;inset:0;z-index:9;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:12px;padding:25px;text-align:center;box-sizing:border-box;background:${isDark ? '#181a19' : '#f5f7f3'};color:${isDark ? '#eee' : '#153b43'};font-size:13px}.map-error button{border:0;border-radius:12px;background:#087f8c;color:white;padding:12px 18px;font-weight:700}.map-error[hidden],.route-note[hidden]{display:none}@media(max-height:360px){.maplibregl-ctrl-group{display:none}}@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important}}
</style></head><body><div id="map"></div><div id="route-note" class="route-note" hidden></div><div id="map-error" class="map-error"><span id="error-text"></span><button id="retry" hidden></button></div>
<script>
var stops=${safe(data)},towns=${safe(towns.filter(town => valid(town.coord)))},servicePath=${safe(knownPath)},driverMode=${driverMode},vehicleType=${safe(options.vehicleType || 'bus')},routeDetailsEnabled=${options.showRouteDetails !== false},routingExpected=${options.showRouteDetails !== false && (options.routingExpected ?? (data.length >= 2))},labels=${safe(labels)};
var map=null,car=null,userMarker=null,lastUserLocation=null,includeUser=true,following=driverMode||${safe(options.followDriver || false)},roadRoute=null,roadStatus=routingExpected?'loading':'idle',lastPoint=null,lastCaptured=0,lastLocation=null,frame=null,styleReady=false,interacted=false,lib=null;
var styleURLs=${safe(styles)},desiredStyleId=${safe(isDark ? 'dark' : 'light')},appliedStyleId=null,styleSequence=0,styleCache={},styleTasks={},restoreLayers=null,starting=false,terrainFailed=false;
var reducedMotion=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
function text(key){return labels[key]||key}
function postToHost(message){try{var value=JSON.stringify(message);if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(value);else if(window.parent!==window)window.parent.postMessage(value,'*')}catch(e){}}
function note(){var el=document.getElementById('route-note');el.hidden=driverMode&&roadStatus==='idle'&&!servicePath.length;el.textContent=servicePath.length>1?text('Verified service route'):roadStatus==='ready'?text('Road route preview')+' · OSRM':roadStatus==='loading'?text('Loading road route…'):roadStatus==='unavailable'?text('Road route unavailable'):'';if(!el.textContent)el.hidden=true;}
function coordsValid(point){return Array.isArray(point)&&point.length>=2&&Number.isFinite(point[0])&&Math.abs(point[0])<=180&&Number.isFinite(point[1])&&Math.abs(point[1])<=90}
function fit(){if(!map)return;var points=servicePath.length>1?servicePath:roadRoute&&roadRoute.coordinates.length>1?roadRoute.coordinates:stops.map(function(s){return s.point});if(!points.length){map.jumpTo({center:[120.9756,15.5781],zoom:10});return}if(points.length===1){map.jumpTo({center:points[0],zoom:13});return}var bounds=new lib.LngLatBounds(points[0],points[0]);points.forEach(function(point){bounds.extend(point)});map.fitBounds(bounds,{padding:40,maxZoom:17,duration:0});}
function lineData(points){return points.length>1?{type:'Feature',properties:{},geometry:{type:'LineString',coordinates:points}}:{type:'FeatureCollection',features:[]}}
function drawRoute(){if(!styleReady||!map)return;var points=servicePath.length>1?servicePath:roadRoute?roadRoute.coordinates:[];map.getSource('sakay-route').setData(lineData(points));map.setPaintProperty('sakay-route-line','line-dasharray',servicePath.length>1?[1,0]:[2,1]);note();}
function circleData(point,meters){if(!Number.isFinite(meters)||meters<=0)return{type:'FeatureCollection',features:[]};var ring=[];var lat=point[1]*Math.PI/180;for(var i=0;i<=64;i++){var angle=i/64*Math.PI*2;ring.push([point[0]+Math.cos(angle)*meters/(111320*Math.max(0.01,Math.cos(lat))),point[1]+Math.sin(angle)*meters/111320])}return{type:'Feature',properties:{},geometry:{type:'Polygon',coordinates:[ring]}}}
function drawAccuracy(){if(styleReady&&map)map.getSource('sakay-accuracy').setData(lastLocation?circleData([lastLocation.longitude,lastLocation.latitude],lastLocation.accuracy):{type:'FeatureCollection',features:[]})}
function drawUserAccuracy(){if(styleReady&&map&&map.getSource('sakay-user-accuracy'))map.getSource('sakay-user-accuracy').setData(lastUserLocation?circleData([lastUserLocation.longitude,lastUserLocation.latitude],lastUserLocation.accuracy):{type:'FeatureCollection',features:[]})}
function centerPeople(){
 if(!map)return;
 var points=[];if(car)points.push(car.getLngLat());if(userMarker)points.push(userMarker.getLngLat());
 if(!points.length){fit();return}if(points.length===1){map.jumpTo({center:points[0],zoom:14});return}
 var bounds=new lib.LngLatBounds(points[0],points[0]);points.forEach(function(point){bounds.extend(point)});map.fitBounds(bounds,{padding:65,maxZoom:16,duration:0});
}
function setUserLocation(coord){
 if(!map){lastUserLocation=coord;return}
 if(!coord){if(userMarker)userMarker.remove();userMarker=null;lastUserLocation=null;drawUserAccuracy();return}
 var point=[coord.longitude,coord.latitude];if(!coordsValid(point))return;
 var captured=Date.parse(coord.capturedAt||coord.updatedAt||'');
 if(lastUserLocation&&captured<Date.parse(lastUserLocation.capturedAt||lastUserLocation.updatedAt||''))return;
 lastUserLocation=coord;
 if(!userMarker){var el=document.createElement('div');el.className='user-location';el.setAttribute('aria-label',text('Your location'));var dot=document.createElement('div');dot.className='user-dot';var label=document.createElement('span');label.className='user-label';label.textContent=text('You');el.appendChild(dot);el.appendChild(label);userMarker=new lib.Marker({element:el,anchor:'center'}).setLngLat(point).addTo(map)}else userMarker.setLngLat(point);
 drawUserAccuracy();if(following&&includeUser)centerPeople();
}
function fresh(){var age=Date.now()-lastCaptured;return lastCaptured>0&&age>=0&&age<60000}
function updateStatus(){if(userMarker){var age=Date.now()-Date.parse(lastUserLocation.capturedAt||lastUserLocation.updatedAt||'');userMarker.getElement().classList.toggle('stale',!Number.isFinite(age)||age<0||age>=60000)}if(car){car.getElement().classList.toggle('stale',!fresh());if(!fresh())car.getElement().querySelector('.vehicle-heading').hidden=true}}
function setFollowing(value){following=value;if(!value&&map)map.stop()}
function centerDriver(){if(!map)return;if(car)map.easeTo({center:car.getLngLat(),zoom:Math.max(map.getZoom(),16),duration:reducedMotion?0:600});else fit()}
function distance(a,b){var radians=function(n){return n*Math.PI/180};var dLat=radians(b[1]-a[1]),dLng=radians(b[0]-a[0]);var h=Math.sin(dLat/2)**2+Math.cos(radians(a[1]))*Math.cos(radians(b[1]))*Math.sin(dLng/2)**2;return 6371000*2*Math.atan2(Math.sqrt(h),Math.sqrt(Math.max(0,1-h)))}
function vehicleIcon(){
 var shape=vehicleType==='jeep'?'<path d="M3 16v-5l3-1V6h12v4l3 2v4H3Z"/><path d="M6 10h12M10 6v4m4-4v4M6 6V4m12 2V4M3 13h3m12 0h3"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/>':'<rect x="5" y="3" width="14" height="16" rx="3"/><path d="M5 11h14M8 19v2m8-2v2M8 6h8"/><circle cx="8" cy="15" r="1"/><circle cx="16" cy="15" r="1"/>';
 return '<svg data-vehicle-type="'+vehicleType+'" width="27" height="27" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'+shape+'</svg>';
}
function setLocation(coord){
 if(!map){lastLocation=coord;return}
 if(!coord){if(frame)cancelAnimationFrame(frame);if(car)car.remove();car=null;lastPoint=null;lastLocation=null;lastCaptured=0;drawAccuracy();return}
 var point=[coord.longitude,coord.latitude];if(!coordsValid(point))return;var captured=Date.parse(coord.capturedAt||coord.updatedAt||'');if(Number.isFinite(captured)&&captured<lastCaptured)return;lastCaptured=Number.isFinite(captured)?captured:0;lastLocation=coord;if(frame)cancelAnimationFrame(frame);
 if(!car){var el=document.createElement('div');el.className='car';el.setAttribute('aria-label',text('Driver GPS'));el.innerHTML='<div class="vehicle-shell"><div class="vehicle-heading" hidden></div><div class="vehicle-body">'+vehicleIcon()+'</div></div>';car=new lib.Marker({element:el,anchor:'center'}).setLngLat(point).addTo(map);if(following||!stops.length)map.jumpTo({center:point,zoom:driverMode?16:14});}
 else{var start=car.getLngLat(),from=[start.lng,start.lat],duration=reducedMotion||!fresh()||distance(from,point)>500?0:900,began=performance.now();function animate(now){if(!car)return;var t=duration?Math.min(1,(now-began)/duration):1;car.setLngLat([from[0]+(point[0]-from[0])*t,from[1]+(point[1]-from[1])*t]);if(t<1)frame=requestAnimationFrame(animate)}frame=requestAnimationFrame(animate)}
 if(lastPoint&&fresh()&&distance(lastPoint,point)>Math.max(8,Number(coord.accuracy)||0)){var a=lastPoint[1]*Math.PI/180,b=point[1]*Math.PI/180,delta=(point[0]-lastPoint[0])*Math.PI/180;var bearing=Math.atan2(Math.sin(delta)*Math.cos(b),Math.cos(a)*Math.sin(b)-Math.sin(a)*Math.cos(b)*Math.cos(delta))*180/Math.PI;var arrow=car.getElement().querySelector('.vehicle-heading');arrow.style.transform='rotate('+bearing+'deg)';arrow.hidden=false}
 lastPoint=point;drawAccuracy();if(following&&fresh()){if(includeUser&&userMarker)centerPeople();else map.easeTo({center:point,duration:reducedMotion?0:800})}updateStatus();
}
function receive(event){if(window.parent!==window&&event.source!==window.parent)return;try{var message=typeof event.data==='string'?JSON.parse(event.data):event.data;if(!message)return;if(message.type==='setMapStyle'){if(Object.prototype.hasOwnProperty.call(styleURLs,message.value))void changeStyle(message.value);return}if(message.type==='setLocation')setLocation(message.value);if(message.type==='setUserLocation')setUserLocation(message.value);if(message.type==='showPeople'){includeUser=true;setFollowing(true);centerPeople()}if(message.type==='recenter'){includeUser=false;setFollowing(true);centerDriver()}if(message.type==='overview'){setFollowing(false);fit()}if(message.type==='setRoadRoute'){var route=routeDetailsEnabled?message.value:null;if(route&&(!Array.isArray(route.coordinates)||!route.coordinates.every(coordsValid)))return;roadRoute=route;roadStatus=routeDetailsEnabled?message.status||'ready':'idle';drawRoute();if(map&&!interacted&&(!following||(!car&&!userMarker)))fit();if(route&&Number.isFinite(route.durationMin)&&Number.isFinite(route.distanceKm))postToHost({type:'ready',durationMin:route.durationMin,distanceKm:route.distanceKm})}}catch(e){}}
window.addEventListener('message',receive);document.addEventListener('message',receive);
function gray(value){if(Array.isArray(value))return value.map(gray);if(typeof value!=='string')return value;var rgb=value.match(/^rgba?\\(\\s*([\\d.]+)\\s*,\\s*([\\d.]+)\\s*,\\s*([\\d.]+)(.*)$/i);if(rgb){var n=Math.round(Number(rgb[1])*.2126+Number(rgb[2])*.7152+Number(rgb[3])*.0722);return(value.startsWith('rgba')?'rgba(':'rgb(')+n+','+n+','+n+rgb[4]}return value.replace(/^(hsla?\\([^,]+,)\\s*[^,]+,/i,'$1 0%,')}
function styleStatus(id,status){postToHost({type:'styleStatus',value:{id:id,status:status}})}
function numericFilter(value){
 if(!Array.isArray(value)||value[0]==='literal')return value;
 var result=value.map(numericFilter);
 if(['<','<=','>','>='].includes(result[0])&&typeof result[2]==='number'&&Array.isArray(result[1])&&result[1][0]==='get'){
  var fallback=result[1][1]==='rank'?999:-1;
  result[1]=['to-number',['coalesce',result[1],fallback],fallback];
 }
 return result;
}
function styleMainRoads(style,id){
 style.layers.forEach(function(layer){
  if(layer.type!=='line'||layer['source-layer']!=='transportation'||!layer.paint||!layer.paint['line-color'])return;
  var casing=layer.id.includes('casing')||layer.id.includes('outline');
  layer.paint['line-color']=['match',['get','class'],['motorway','trunk','primary','secondary'],casing?(id==='dark'?'#766134':'#D8B55C'):(id==='dark'?'#C6A653':'#F7D477'),layer.paint['line-color']];
 });return style;
}
function styleView(style,id){
 if(id==='terrain'){
  var dem={type:'raster-dem',tiles:['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],encoding:'terrarium',tileSize:256,maxzoom:15,attribution:'<a href="https://github.com/tilezen/joerd/blob/master/docs/attribution.md" target="_blank" rel="noopener">Mapzen terrain · USGS/NOAA &amp; contributors</a>'};
  style.sources['sakay-elevation']=JSON.parse(JSON.stringify(dem));style.sources['sakay-hillshade']=JSON.parse(JSON.stringify(dem));
  var first=style.layers.findIndex(function(layer){return layer.type==='symbol'||layer['source-layer']==='transportation'});
  style.layers.splice(first<0?style.layers.length:first,0,{id:'sakay-hills',type:'hillshade',source:'sakay-hillshade',paint:{'hillshade-exaggeration':0.35,'hillshade-shadow-color':'#65795D','hillshade-highlight-color':'#FAF5DB','hillshade-accent-color':'#9CAE87'}});
  style.terrain={source:'sakay-elevation',exaggeration:1};
 }
 // Keep ordinary map views flat; the dedicated 3D choice uses the provider's mapped heights.
 if(id!=='3d')style.layers=style.layers.filter(function(layer){return layer.type!=='fill-extrusion'});
 return style;
}
function applyView(){var pitch=appliedStyleId==='3d'?55:appliedStyleId==='terrain'?50:0;map.jumpTo({pitch:pitch})}
var busStopFilter=['any',['==',['get','class'],'bus'],['match',['get','subclass'],['bus_stop','bus_station','bus_terminal'],true,false]];
function styleBusStops(style,id){
 if(!style.sources.openmaptiles)return style;
 var dark=id==='dark';
 style.layers.forEach(function(layer){if(layer.type==='symbol'&&layer['source-layer']==='poi')layer.filter=['all',layer.filter||true,['!',busStopFilter]]});
 var layer={id:'sakay-bus-stops',type:'symbol',source:'openmaptiles','source-layer':'poi',minzoom:14,filter:['all',['match',['geometry-type'],['Point','MultiPoint'],true,false],busStopFilter],layout:{
  'icon-image':'sakay-bus-stop-icon','icon-size':1,'icon-allow-overlap':false,'icon-padding':6,
  'text-field':['coalesce',['get','name'],['get','name_en'],['get','name:latin'],text('Bus stop')],
  'text-font':['Noto Sans Regular'],'text-size':['interpolate',['linear'],['zoom'],14,11,17,13],
  'text-anchor':'top','text-offset':[0,1.35],'text-max-width':10,'text-padding':6,'text-optional':true,
  'text-allow-overlap':false,'text-ignore-placement':false,'symbol-sort-key':['to-number',['coalesce',['get','rank'],999],999]
 },paint:{'text-color':dark?'#A7E4DD':'#086B71','text-halo-color':dark?'#202020':'#FAFCF7','text-halo-width':1.7,'text-halo-blur':0.2,'text-opacity':['interpolate',['linear'],['zoom'],14,0,15,1]}};
 var first=style.layers.findIndex(function(layer){return layer.type==='symbol'&&layer['source-layer']==='poi'});
 if(first<0)style.layers.push(layer);else style.layers.splice(first,0,layer);return style;
}
function addMissingIcon(id){
 if(typeof id!=='string'||!id||map.hasImage(id))return;
 if(id==='sakay-bus-stop-icon'){addBusStopIcon();return}
 // A neutral landmark icon keeps labels usable when the provider's sprite
 // does not contain an icon for a mapped category.
 var canvas=document.createElement('canvas');canvas.width=24;canvas.height=24;var ctx=canvas.getContext('2d');
 ctx.fillStyle=appliedStyleId==='dark'?'#BDCDBF':'#55765D';ctx.strokeStyle='#FFFFFF';ctx.lineWidth=2;
 ctx.beginPath();ctx.arc(12,12,7,0,Math.PI*2);ctx.fill();ctx.stroke();
 map.addImage(id,ctx.getImageData(0,0,24,24),{pixelRatio:2});
}
function addBusStopIcon(){
 if(map.hasImage('sakay-bus-stop-icon'))return;
 var canvas=document.createElement('canvas');canvas.width=48;canvas.height=48;var ctx=canvas.getContext('2d');
 ctx.fillStyle='#087F8C';ctx.strokeStyle='#FFFFFF';ctx.lineWidth=3;
 ctx.beginPath();ctx.roundRect(2,2,44,44,13);ctx.fill();ctx.stroke();
 ctx.lineWidth=2.5;ctx.beginPath();ctx.roundRect(14,10,20,26,4);ctx.stroke();
 ctx.beginPath();ctx.moveTo(14,25);ctx.lineTo(34,25);ctx.moveTo(18,16);ctx.lineTo(30,16);ctx.moveTo(17,36);ctx.lineTo(17,40);ctx.moveTo(31,36);ctx.lineTo(31,40);ctx.stroke();
 ctx.fillStyle='#FFFFFF';[19,29].forEach(function(x){ctx.beginPath();ctx.arc(x,31,1.7,0,Math.PI*2);ctx.fill()});
 map.addImage('sakay-bus-stop-icon',ctx.getImageData(0,0,48,48),{pixelRatio:2});
}
function styleBuildings(style,id){
 var dark=id==='dark',fill=dark?'#484848':'#DED9D0',edge=dark?'#626262':'#BDB7AC';
 style.layers.forEach(function(layer){
  if(layer['source-layer']!=='building')return;
  var paint=layer.paint||(layer.paint={});
  if(layer.type==='fill'){paint['fill-color']=fill;paint['fill-outline-color']=edge;paint['fill-antialias']=true}
  if(layer.type==='fill-extrusion'){paint['fill-extrusion-color']=fill;paint['fill-extrusion-height']=['max',0,['to-number',['get','render_height'],0]];paint['fill-extrusion-base']=['max',0,['to-number',['get','render_min_height'],0]];}
 });return style;
}
function styleEstablishments(style,id){
 var dark=id==='dark';
 var poi=style.layers.filter(function(layer){return layer.type==='symbol'&&layer['source-layer']==='poi'});
 if(!poi.length&&style.sources.openmaptiles){
  [{id:'sakay-poi-major',min:0,max:7,zoom:15},{id:'sakay-poi-local',min:7,max:20,zoom:16},{id:'sakay-poi-detail',min:20,max:100000,zoom:17}].forEach(function(group){
   var layer={id:group.id,type:'symbol',source:'openmaptiles','source-layer':'poi',minzoom:group.zoom,filter:['all',['match',['geometry-type'],['Point','MultiPoint'],true,false],['>=',['to-number',['coalesce',['get','rank'],999],999],group.min],['<',['to-number',['coalesce',['get','rank'],999],999],group.max]],layout:{'symbol-placement':'point','text-variable-anchor':['top','bottom','left','right'],'text-radial-offset':0.5},paint:{}};
   style.layers.push(layer);poi.push(layer);
  });
 }
 poi.forEach(function(layer){
  var layout=layer.layout||(layer.layout={}),paint=layer.paint||(layer.paint={});
  layout['text-field']=['coalesce',['get','name'],['get','name_en'],['get','name:latin'],''];
  layout['text-font']=['Noto Sans Regular'];layout['text-size']=['interpolate',['linear'],['zoom'],15,11.5,17,12.5,19,14];
  layout['text-max-width']=10;layout['text-line-height']=1.15;layout['text-letter-spacing']=0;layout['text-transform']='none';
  layout['text-padding']=6;layout['text-allow-overlap']=false;layout['text-ignore-placement']=false;
  layout['icon-allow-overlap']=false;layout['icon-ignore-placement']=false;layout['icon-padding']=4;layout['icon-optional']=true;
  layout['symbol-sort-key']=['to-number',['coalesce',['get','rank'],999],999];
  paint['text-color']=dark?'#D6DDD7':'#405B48';paint['text-halo-color']=dark?'#202020':'#FAFCF7';paint['text-halo-width']=1.7;paint['text-halo-blur']=0.2;
 });return style;
}
function customizeStyle(style,id){
 if(id!=='light'&&id!=='streets'&&id!=='dark')return style;
 var dark=id==='dark',p=dark?{land:'#191919',residential:'#202020',park:'#252525',wood:'#282828',water:'#303030',road:'#777777',minor:'#515151',edge:'#353535',label:'#dedede',muted:'#a6a6a6',halo:'#202020'}:{land:'#D3E9D6',residential:'#F3F2ED',park:'#C3E0C9',wood:'#B4D6BB',water:'#B9DEE9',road:'#FFFFFF',minor:'#FFFFFF',edge:'#D1DCCF',label:'#4F5C50',muted:'#768471',halo:'#E8F1E6'};
 style.layers.forEach(function(layer){
  var paint=layer.paint||(layer.paint={}),source=layer['source-layer']||'',name=layer.id;
  if(dark)Object.keys(paint).forEach(function(key){if(key.includes('color'))paint[key]=gray(paint[key])});
  if(layer.type==='background')paint['background-color']=p.land;
  if(layer.type==='fill'){
   if(source==='water')paint['fill-color']=p.water;
   else if(source==='park'||name.includes('park'))paint['fill-color']=p.park;
   else if(name.includes('wood'))paint['fill-color']=p.wood;
   else if(source==='landcover'&&!name.includes('ice')&&!name.includes('glacier'))paint['fill-color']=p.park;
   else if(source==='landuse')paint['fill-color']=p.residential;
  }
  if(layer.type==='line'){
   if(source==='waterway')paint['line-color']=p.water;
   else if(source==='transportation'&&!name.includes('railway'))paint['line-color']=name.includes('casing')?p.edge:name.includes('minor')||name.includes('path')?p.minor:p.road;
   else if(source==='boundary'){paint['line-color']=p.muted;paint['line-opacity']=0.35}
  }
  if(layer.type==='symbol'&&layer.layout&&layer.layout['text-field']){paint['text-color']=source==='place'||source==='transportation_name'?p.label:p.muted;paint['text-halo-color']=p.halo;paint['text-halo-width']=1.2;paint['text-halo-blur']=0.5}
 });return style;
}
function loadStyle(id){
 if(styleCache[id])return Promise.resolve(JSON.parse(JSON.stringify(styleCache[id])));
 if(!styleTasks[id])styleTasks[id]=(async function(){var controller=new AbortController(),timer=setTimeout(function(){controller.abort()},8000);try{var response=await fetch(styleURLs[id],{signal:controller.signal});if(!response.ok)throw new Error('Map style unavailable');var style=await response.json();if(style.version!==8||!Array.isArray(style.layers)||!style.sources)throw new Error('Invalid map style');customizeStyle(style,id==='terrain'?'light':id==='3d'?'streets':id);styleBuildings(style,id);styleEstablishments(style,id);styleBusStops(style,id);styleMainRoads(style,id);styleView(style,id);style.layers.forEach(function(layer){if(layer.filter)layer.filter=numericFilter(layer.filter)});styleCache[id]=style;return style}finally{clearTimeout(timer)}})().finally(function(){delete styleTasks[id]});
 return styleTasks[id].then(function(style){return JSON.parse(JSON.stringify(style))});
}
async function changeStyle(id){
 desiredStyleId=id;if(!map){if(!starting)void start();return}if(appliedStyleId===id&&styleReady&&!(id==='terrain'&&terrainFailed)){styleStatus(id,'ready');return}
 var sequence=++styleSequence;styleStatus(id,'loading');
 try{var style=await loadStyle(id);if(sequence!==styleSequence||desiredStyleId!==id)return;var previous=appliedStyleId;styleReady=false;appliedStyleId=id;terrainFailed=false;try{map.stop();if(map.getTerrain())map.setTerrain(null);map.setStyle(style,{diff:false});if(map.isStyleLoaded()&&restoreLayers)restoreLayers()}catch(error){appliedStyleId=previous;styleReady=!!map.getSource('sakay-route');throw error}}
 catch(error){if(sequence===styleSequence&&desiredStyleId===id)styleStatus(id,'error')}
}
async function start(){
 if(starting)return;starting=true;styleStatus(desiredStyleId,'loading');
 var panel=document.getElementById('map-error'),retry=document.getElementById('retry');panel.hidden=false;retry.hidden=true;document.getElementById('error-text').textContent=text('Loading map…');
 try{
  lib=window.maplibregl||await new Promise(function(resolve,reject){var script=document.createElement('script'),timer=setTimeout(function(){script.remove();reject(new Error('Map script timed out'))},12000);script.src='https://unpkg.com/maplibre-gl@5.24.0/dist/maplibre-gl.js';script.onload=function(){clearTimeout(timer);window.maplibregl?resolve(window.maplibregl):reject(new Error('Map library unavailable'))};script.onerror=function(){clearTimeout(timer);script.remove();reject(new Error('Map script unavailable'))};document.head.appendChild(script)});
  var initialStyle=desiredStyleId,style=await loadStyle(initialStyle);
  if(map)map.remove();car=null;userMarker=null;styleReady=false;appliedStyleId=initialStyle;map=new lib.Map({container:'map',style:style,center:[120.9756,15.5781],zoom:10,pitch:0,bearing:0,attributionControl:false});
  map.on('styleimagemissing',function(event){addMissingIcon(event.id)});
  map.dragRotate.disable();map.touchZoomRotate.disableRotation();
  map.addControl(new lib.AttributionControl({compact:true,customAttribution:'<a href="https://openfreemap.org/" target="_blank" rel="noopener">OpenFreeMap</a> · <a href="https://project-osrm.org/" target="_blank" rel="noopener">OSRM</a>'}),driverMode?'bottom-left':'bottom-right');
  document.querySelector('.maplibregl-ctrl-attrib').classList.remove('maplibregl-compact-show');
  if(!driverMode)map.addControl(new lib.NavigationControl({showCompass:false}),'bottom-right');
  map.on('dragstart',function(){interacted=true;setFollowing(false)});
  map.on('click','sakay-bus-stops',function(event){var feature=event.features&&event.features[0];if(!feature)return;var content=document.createElement('div'),title=document.createElement('strong'),detail=document.createElement('div');title.textContent=feature.properties.name||feature.properties.name_en||text('Bus stop');detail.textContent=text('Mapped bus stop. Confirm boarding with your driver.');detail.style.cssText='font-size:11px;line-height:17px;margin-top:5px';content.appendChild(title);content.appendChild(detail);new lib.Popup({closeButton:true,maxWidth:'240px'}).setLngLat(event.lngLat).setDOMContent(content).addTo(map)});
  map.on('mouseenter','sakay-bus-stops',function(){map.getCanvas().style.cursor='pointer'});map.on('mouseleave','sakay-bus-stops',function(){map.getCanvas().style.cursor=''});
  map.on('error',function(event){if(appliedStyleId==='terrain'&&!terrainFailed&&(event.sourceId==='sakay-elevation'||event.sourceId==='sakay-hillshade')){terrainFailed=true;map.setTerrain(null);if(map.getLayer('sakay-hills'))map.setLayoutProperty('sakay-hills','visibility','none');styleStatus('terrain','error')}document.getElementById('map').setAttribute('aria-label',text('Map tiles unavailable. Locations are still visible.'))});
  stops.forEach(function(stop){var el=document.createElement('div');el.className='stop-marker';el.setAttribute('role','img');el.setAttribute('aria-label',stop.label);var pin=document.createElement('div');pin.className='pin';var color=stop.isOrigin?'#087f8c':stop.isDestination?'#d86749':'#68716d';pin.innerHTML='<svg viewBox="0 0 32 40" aria-hidden="true"><path d="M16 38C13 34 2 25 2 16a14 14 0 1 1 28 0c0 9-11 18-14 22Z" fill="'+color+'" stroke="white" stroke-width="2.5" stroke-linejoin="round"/></svg>';var symbol=document.createElement('span');symbol.className='pin-symbol';symbol.textContent=stop.isOrigin?'A':stop.isDestination?'B':'•';pin.appendChild(symbol);var label=document.createElement('span');label.className='route-label';label.textContent=stop.label;el.appendChild(pin);el.appendChild(label);new lib.Marker({element:el,anchor:'bottom'}).setLngLat(stop.point).addTo(map)});
  towns.slice(0,80).forEach(function(town){if(stops.some(function(stop){return distance(stop.point,[town.coord.longitude,town.coord.latitude])<100}))return;var el=document.createElement('span');el.className='town';el.textContent=town.name;new lib.Marker({element:el,anchor:'left'}).setLngLat([town.coord.longitude,town.coord.latitude]).addTo(map)});
  function setupLayers(){if(styleReady)return;styleReady=true;document.documentElement.setAttribute('data-map-style',appliedStyleId);addBusStopIcon();applyView();var empty={type:'FeatureCollection',features:[]};map.addSource('sakay-accuracy',{type:'geojson',data:empty});map.addLayer({id:'sakay-accuracy-fill',type:'fill',source:'sakay-accuracy',paint:{'fill-color':'#087f8c','fill-opacity':0.035}});map.addLayer({id:'sakay-accuracy-line',type:'line',source:'sakay-accuracy',paint:{'line-color':'#087f8c','line-width':1,'line-opacity':0.3,'line-dasharray':[3,3]}});map.addSource('sakay-route',{type:'geojson',data:empty});map.addLayer({id:'sakay-route-outline',type:'line',source:'sakay-route',layout:{'line-join':'round','line-cap':'round'},paint:{'line-color':appliedStyleId==='dark'?'#242624':'#fff','line-width':9}});map.addLayer({id:'sakay-route-line',type:'line',source:'sakay-route',layout:{'line-join':'round','line-cap':'round'},paint:{'line-color':appliedStyleId==='dark'?'#62C6C0':'#087f8c','line-width':5}});map.addSource('sakay-user-accuracy',{type:'geojson',data:empty});map.addLayer({id:'sakay-user-accuracy-fill',type:'fill',source:'sakay-user-accuracy',paint:{'fill-color':'#2879e3','fill-opacity':0.08}});drawRoute();drawAccuracy();drawUserAccuracy();document.getElementById('map').setAttribute('data-map-ready','true');styleStatus(appliedStyleId,'ready')};restoreLayers=setupLayers;map.on('style.load',setupLayers);if(map.isStyleLoaded())setupLayers();
  fit();if(lastLocation)setLocation(lastLocation);if(lastUserLocation)setUserLocation(lastUserLocation);panel.hidden=true;note();postToHost({type:'loaded'});
 }catch(error){panel.hidden=false;document.getElementById('error-text').textContent=text('Map unavailable. Check your connection or device graphics support.');retry.textContent=text('Retry map');retry.hidden=false;styleStatus(desiredStyleId,'error');postToHost({type:'mapError'})}finally{starting=false}
}
document.getElementById('retry').onclick=start;start();setInterval(updateStatus,5000);if(window.ResizeObserver)new ResizeObserver(function(){if(map)map.resize()}).observe(document.getElementById('map'));
</script></body></html>`;
}
