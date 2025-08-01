// Karte initialisieren
const map = L.map('map', {
    zoomControl: false
}).setView([51.1657, 10.4515], 6);

// Tile Layer hinzufügen
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

// Globale Variablen
let oceanRouteLayer = null;
let currentUserLocation = null;

// Marker-Gruppe für Suchergebnisse
let markersGroup = L.layerGroup().addTo(map);
let currentLocationMarker = null;

// OpenStreetMap-Suchfunktion
async function searchOpenStreetMap(query, maxResults = 10) {
    const baseUrl = 'https://nominatim.openstreetmap.org/search';
    const params = new URLSearchParams({
        q: query,
        format: 'json',
        limit: maxResults,
        addressdetails: 1
    });
    
    try {
        const response = await fetch(`${baseUrl}?${params}`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        const results = data.map(item => ({
            name: item.display_name,
            lat: parseFloat(item.lat),
            lon: parseFloat(item.lon),
            type: item.type,
            importance: item.importance,
            address: item.address,
            city: item.address?.city || item.address?.town || item.address?.village || '',
            country: item.address?.country || ''
        }));
        
        return results;
    } catch (error) {
        console.error('Error fetching from OpenStreetMap:', error);
        throw error;
    }
}

// Live-Suche implementieren
let searchTimeout;
const searchInput = document.getElementById('searchInput');
const suggestionsDiv = document.getElementById('suggestions');

searchInput.addEventListener('input', function() {
    clearTimeout(searchTimeout);
    const query = this.value.trim();
    
    if (query.length < 3) {
        suggestionsDiv.style.display = 'none';
        return;
    }
    
    searchTimeout = setTimeout(() => {
        showSuggestions(query);
    }, 300);
});

async function showSuggestions(query) {
    const searchContainer = document.querySelector('.search-container');
    
    try {
        const results = await searchOpenStreetMap(query, 5);
        
        if (results.length === 0) {
            suggestionsDiv.style.display = 'none';
            searchContainer.classList.remove('has-suggestions');
            return;
        }
        
        suggestionsDiv.innerHTML = '';
        results.forEach(result => {
            const item = document.createElement('div');
            item.className = 'suggestion-item';
            item.onclick = () => selectLocation(result);
            
            item.innerHTML = `
                <div class="suggestion-content">
                    <div class="suggestion-name">${getDisplayName(result)}</div>
                    <div class="suggestion-details">${result.type}</div>
                </div>
            `;
            
            suggestionsDiv.appendChild(item);
        });
        
        searchContainer.classList.add('has-suggestions');
        suggestionsDiv.style.display = 'block';
    } catch (error) {
        console.error('Fehler bei der Suche:', error);
        suggestionsDiv.style.display = 'none';
        searchContainer.classList.remove('has-suggestions');
    }
}

function getShortName(fullName) {
    return fullName.length > 60 ? fullName.substring(0, 60) + '...' : fullName;
}

function getDisplayName(result) {
    // Extrahiere Stadt/Ort und Land aus der Adresse
    const city = result.city || result.address?.city || result.address?.town || result.address?.village || '';
    const country = result.country || result.address?.country || '';
    
    // Wenn wir Stadt und Land haben, zeige "Stadt, Land"
    if (city && country) {
        return `${city}, ${country}`;
    }
    
    // Fallback: Versuche den ersten Teil des display_name zu extrahieren
    const parts = result.name.split(',');
    if (parts.length >= 2) {
        const firstPart = parts[0].trim();
        const lastPart = parts[parts.length - 1].trim();
        return `${firstPart}, ${lastPart}`;
    }
    
    // Letzter Fallback: Originalnamen kürzen
    return getShortName(result.name);
}

async function performSearch() {
    const query = searchInput.value.trim();
    if (!query) return;
    
    showLoading(true);
    
    try {
        const results = await searchOpenStreetMap(query, 1);
        if (results.length > 0) {
            selectLocation(results[0]);
        } else {
            alert('Keine Ergebnisse gefunden');
        }
    } catch (error) {
        alert('Fehler bei der Suche: ' + error.message);
    }
    
    showLoading(false);
}

function selectLocation(location) {
    const searchContainer = document.querySelector('.search-container');
    
    // Suggestions verstecken
    suggestionsDiv.style.display = 'none';
    searchContainer.classList.remove('has-suggestions');
    
    // Zur Location zoomen
    map.setView([location.lat, location.lon], 15);
    
    // Marker setzen
    markersGroup.clearLayers();
    const marker = L.marker([location.lat, location.lon])
        .bindPopup(`<b>${getDisplayName(location)}</b><br>Typ: ${location.type}`)
        .openPopup();
    markersGroup.addLayer(marker);
    
    // Location-Info anzeigen
    showLocationInfo(location);
}

function showLocationInfo(location) {
    currentUserLocation = location; // Aktuelle Location speichern
    const locationInfo = document.getElementById('locationInfo');
    const locationText = document.getElementById('locationText');
    
    locationText.innerHTML = `
        <strong>${getDisplayName(location)}</strong><br>
        <small>Koordinaten: ${location.lat.toFixed(4)}, ${location.lon.toFixed(4)}</small>
    `;
    
    locationInfo.style.display = 'block';
}

// Zoom-Kontrollen
function zoomIn() {
    map.zoomIn();
}

function zoomOut() {
    map.zoomOut();
}

// Benutzer-Standort
function locateUser() {
    if (!navigator.geolocation) {
        alert('Geolocation wird von diesem Browser nicht unterstützt');
        return;
    }
    
    showLoading(true);
    
    navigator.geolocation.getCurrentPosition(
        function(position) {
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;
            
            map.setView([lat, lon], 15);
            
            if (currentLocationMarker) {
                map.removeLayer(currentLocationMarker);
            }
            
            currentLocationMarker = L.marker([lat, lon], {
                icon: L.icon({
                    iconUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iNCIgZmlsbD0iIzQyODVmNCIvPgo8Y2lyY2xlIGN4PSIxMiIgY3k9IjEyIiByPSI4IiBzdHJva2U9IiM0Mjg1ZjQiIHN0cm9rZS13aWR0aD0iMiIgZmlsbD0ibm9uZSIvPgo8L3N2Zz4K',
                    iconSize: [24, 24],
                    iconAnchor: [12, 12]
                })
            }).addTo(map);
            
            // Standort als aktuelle Location setzen
            const location = {
                name: 'Ihr aktueller Standort',
                lat: lat,
                lon: lon,
                type: 'GPS-Position'
            };
            
            currentLocationMarker.bindPopup('Ihr aktueller Standort').openPopup();
            showLocationInfo(location);
            showLoading(false);
        },
        function(error) {
            alert('Standort konnte nicht ermittelt werden: ' + error.message);
            showLoading(false);
        }
    );
}

function showLoading(show) {
    document.getElementById('loading').style.display = show ? 'block' : 'none';
}

// Suggestions verstecken beim Klick außerhalb
document.addEventListener('click', function(e) {
    if (!e.target.closest('.search-container')) {
        const searchContainer = document.querySelector('.search-container');
        suggestionsDiv.style.display = 'none';
        if (searchContainer) {
            searchContainer.classList.remove('has-suggestions');
        }
    }
});

// Ocean Route Functions
async function findNearestOcean() {
    if (!currentUserLocation) {
        alert('Bitte wählen Sie zuerst einen Standort aus oder nutzen Sie die GPS-Funktion');
        return;
    }
    
    const oceanBtn = document.querySelector('.ocean-btn');
    oceanBtn.disabled = true;
    oceanBtn.textContent = '🌊 Suche...';
    
    try {
        // Bekannte Küstenstädte in Deutschland und Europa
        const coastalCities = [
            { name: 'Hamburg', lat: 53.5511, lon: 9.9937 },
            { name: 'Bremen', lat: 53.0793, lon: 8.8017 },
            { name: 'Kiel', lat: 54.3233, lon: 10.1228 },
            { name: 'Rostock', lat: 54.0887, lon: 12.1342 },
            { name: 'Stralsund', lat: 54.3091, lon: 13.0815 },
            { name: 'Wilhelmshaven', lat: 53.5293, lon: 8.1067 },
            { name: 'Cuxhaven', lat: 53.8667, lon: 8.7000 },
            { name: 'Amsterdam', lat: 52.3676, lon: 4.9041 },
            { name: 'Den Haag', lat: 52.0705, lon: 4.3007 },
            { name: 'Calais', lat: 50.9513, lon: 1.8587 },
            { name: 'Ostende', lat: 51.2287, lon: 2.9271 },
            { name: 'Oostende', lat: 51.2287, lon: 2.9271 },
            { name: 'Warnemünde', lat: 54.1775, lon: 12.0819 },
            { name: 'St. Peter-Ording', lat: 54.3127, lon: 8.6364 }
        ];
        
        // Nächste Küstenstadt finden
        let nearestCoast = null;
        let shortestDistance = Infinity;
        
        coastalCities.forEach(city => {
            const distance = getDistance(
                currentUserLocation.lat, currentUserLocation.lon,
                city.lat, city.lon
            );
            
            if (distance < shortestDistance) {
                shortestDistance = distance;
                nearestCoast = city;
            }
        });
        
        if (nearestCoast) {
            await calculateOceanRoute(currentUserLocation, nearestCoast);
        } else {
            alert('Keine Küste gefunden');
        }
        
    } catch (error) {
        console.error('Fehler bei der Meer-Suche:', error);
        alert('Fehler bei der Routenberechnung zum Meer');
    } finally {
        oceanBtn.disabled = false;
        oceanBtn.textContent = '🌊';
    }
}

async function calculateOceanRoute(start, destination) {
    try {
        const distance = getDistance(start.lat, start.lon, destination.lat, destination.lon);
        
        // Echte Route über OSRM API abrufen
        const routeUrl = `https://router.project-osrm.org/route/v1/driving/${start.lon},${start.lat};${destination.lon},${destination.lat}?overview=full&geometries=geojson`;
        
        const routeResponse = await fetch(routeUrl);
        const routeData = await routeResponse.json();
        
        if (routeData.routes && routeData.routes.length > 0) {
            const route = routeData.routes[0];
            const routeCoords = route.geometry.coordinates.map(coord => [coord[1], coord[0]]); // [lat, lon] Format für Leaflet
            
            // Echte Werte aus der API
            const drivingDistance = route.distance / 1000; // Meter zu Kilometer
            const estimatedTime = Math.round(route.duration / 60); // Sekunden zu Minuten
            
            // Route auf Karte zeichnen
            if (oceanRouteLayer) {
                map.removeLayer(oceanRouteLayer);
            }
            
            oceanRouteLayer = L.polyline(routeCoords, {
                color: '#1e88e5',
                weight: 5,
                opacity: 0.8
            }).addTo(map);
            
            // Route-Popup anzeigen
            showRoutePopup(destination.name, drivingDistance, estimatedTime);
        } else {
            // Fallback auf Luftlinie falls API nicht funktioniert
            const drivingDistance = distance * 1.3;
            const estimatedTime = Math.round(drivingDistance / 80 * 60);
            
            const routeCoords = [
                [start.lat, start.lon],
                [destination.lat, destination.lon]
            ];
            
            oceanRouteLayer = L.polyline(routeCoords, {
                color: '#1e88e5',
                weight: 5,
                opacity: 0.8,
                dashArray: '10, 5'
            }).addTo(map);
            
            showRoutePopup(destination.name, drivingDistance, estimatedTime);
        }
        
        // Marker für Ziel (bleibt gleich)
        const oceanMarker = L.marker([destination.lat, destination.lon], {
            icon: L.icon({
                iconUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iOCIgZmlsbD0iIzFlODhlNSIvPgo8dGV4dCB4PSI2IiB5PSIxNiIgZm9udC1zaXplPSIxNCIgZmlsbD0id2hpdGUiPvCfjIo8L3RleHQ+Cjwvc3ZnPgo=',
                iconSize: [24, 24],
                iconAnchor: [12, 12]
            })
        }).bindPopup(`<b>🌊 ${destination.name}</b><br>Nächste Küste`);
        
        markersGroup.addLayer(oceanMarker);
        
        // Karte auf Route zentrieren
        map.fitBounds(oceanRouteLayer.getBounds(), { padding: [20, 20] });
        
    } catch (error) {
        console.error('Fehler bei der Routenberechnung:', error);
        throw error;
    }
}

function showRoutePopup(destinationName, distance, timeMinutes) {
    const popup = document.getElementById('routePopup');
    const destinationEl = document.getElementById('oceanDestination');
    const distanceEl = document.getElementById('oceanDistance');
    const timeEl = document.getElementById('oceanDrivingTime');
    
    destinationEl.textContent = destinationName;
    distanceEl.textContent = `${Math.round(distance)} km`;
    
    const hours = Math.floor(timeMinutes / 60);
    const minutes = timeMinutes % 60;
    
    if (hours > 0) {
        timeEl.textContent = `${hours}h ${minutes}min`;
    } else {
        timeEl.textContent = `${minutes} min`;
    }
    
    popup.classList.add('active');
}

function closeRoutePopup() {
    const popup = document.getElementById('routePopup');
    popup.classList.remove('active');
    
    // Route löschen
    if (oceanRouteLayer) {
        map.removeLayer(oceanRouteLayer);
        oceanRouteLayer = null;
    }
    
    // Start- und Zielmarker löschen
    markersGroup.clearLayers();
}


// Haversine-Formel für Entfernungsberechnung
function getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Erdradius in km
    const dLat = toRadians(lat2 - lat1);
    const dLon = toRadians(lon2 - lon1);
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * 
        Math.sin(dLat/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

function toRadians(degrees) {
    return degrees * (Math.PI/180);
}

// Enter-Taste für Suche
searchInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        performSearch();
    }
});

// Karte-Events
map.on('click', function(e) {
    const lat = e.latlng.lat;
    const lon = e.latlng.lng;
    
    // Reverse Geocoding
    reverseGeocode(lat, lon);
});

async function reverseGeocode(lat, lon) {
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`);
        const data = await response.json();
        
        if (data && data.display_name) {
            const location = {
                name: data.display_name,
                lat: lat,
                lon: lon,
                type: 'Angeklickter Punkt'
            };
            
            markersGroup.clearLayers();
            const marker = L.marker([lat, lon])
                .bindPopup(`<b>Angeklickter Punkt</b><br>${getShortName(data.display_name)}`)
                .openPopup();
            markersGroup.addLayer(marker);
            
            showLocationInfo(location);
        }
    } catch (error) {
        console.error('Reverse Geocoding fehler:', error);
    }
}

function showRoutePopup(destinationName, distance, timeMinutes) {
    const popup = document.getElementById('routePopup');
    const destinationEl = document.getElementById('oceanDestination');
    const distanceEl = document.getElementById('oceanDistance');
    const timeEl = document.getElementById('oceanDrivingTime');
    const gmapsButton = document.getElementById('gmapsButton');
    
    destinationEl.textContent = destinationName;
    distanceEl.textContent = `${Math.round(distance)} km`;
    
    const hours = Math.floor(timeMinutes / 60);
    const minutes = timeMinutes % 60;
    
    timeEl.textContent = hours > 0 ? `${hours}h ${minutes}min` : `${minutes} min`;

    // Google Maps Button Funktion
    gmapsButton.onclick = () => {
        if (currentUserLocation) {
            const url = `https://www.google.com/maps/dir/?api=1&origin=${currentUserLocation.lat},${currentUserLocation.lon}&destination=${encodeURIComponent(destinationName)}&travelmode=driving`;
            window.open(url, '_blank');
        }
    };
    
    popup.classList.add('active');
}

function isMobile() {
    return (window.innerWidth <= 768) || /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

if (isMobile()) {
    console.log("Mobile erkannt");
}

document.addEventListener('DOMContentLoaded', () => {
    if (isMobile()) {
        // z. B. Popup anpassen
        document.body.classList.add('mobile-view');
    }
});


