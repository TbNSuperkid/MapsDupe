// Karte initialisieren
        const map = L.map('map', {
            zoomControl: false
        }).setView([51.1657, 10.4515], 6);

        // Tile Layer hinzufügen
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors'
        }).addTo(map);

        // Globale Variablen
        let isRouteMode = false;
        let routeStartLocation = null;
        let routeDestinationLocation = null;
        let currentRouteLayer = null;
        
        // Marker-Gruppe für Suchergebnisse
        let markersGroup = L.layerGroup().addTo(map);
        let currentLocationMarker = null;

        // Route Mode Toggle - MUSS vor setupRouteSearch definiert werden
        function toggleRouteMode() {
            console.log('toggleRouteMode called!'); // Debug
            const searchBar = document.getElementById('searchBar');
            const singleSearch = document.getElementById('singleSearch');
            const routeContainer = document.getElementById('routeContainer');
            const searchInput = document.getElementById('searchInput');
            const destinationInput = document.getElementById('destinationInput');
            
            console.log('Elements found:', {searchBar, singleSearch, routeContainer}); // Debug
            
            isRouteMode = !isRouteMode;
            
            if (isRouteMode) {
                // Zu Route Mode wechseln
                searchBar.classList.add('route-mode');
                singleSearch.classList.add('hidden');
                routeContainer.classList.add('active');
                
                // Setup für Route-Suche beim ersten Mal
                setupRouteSearch();
                
                // Wenn bereits etwas in der Suchleiste steht, als Ziel übernehmen
                if (searchInput.value.trim()) {
                    destinationInput.value = searchInput.value;
                    searchInput.value = '';
                }
                
                // Focus auf Startpunkt
                setTimeout(() => {
                    const startInput = document.getElementById('startInput');
                    if (startInput) startInput.focus();
                }, 100);
            } else {
                // Zurück zu Single Search
                searchBar.classList.remove('route-mode');
                singleSearch.classList.remove('hidden');
                routeContainer.classList.remove('active');
                
                // Route löschen falls vorhanden
                if (currentRouteLayer) {
                    map.removeLayer(currentRouteLayer);
                    currentRouteLayer = null;
                }
                
                // Route-Daten zurücksetzen
                routeStartLocation = null;
                routeDestinationLocation = null;
                
                // Inputs leeren
                const startInput = document.getElementById('startInput');
                const destInput = document.getElementById('destinationInput');
                if (startInput) startInput.value = '';
                if (destInput) destInput.value = '';
            }
        }

        // Route Inputs vertauschen
        function swapRouteInputs() {
            const startInput = document.getElementById('startInput');
            const destinationInput = document.getElementById('destinationInput');
            
            const tempValue = startInput.value;
            startInput.value = destinationInput.value;
            destinationInput.value = tempValue;
            
            const tempLocation = routeStartLocation;
            routeStartLocation = routeDestinationLocation;
            routeDestinationLocation = tempLocation;
            
            if (routeStartLocation && routeDestinationLocation) {
                calculateRoute();
            }
        }
        //let currentLocationMarker = null;

        // Route-spezifische Suchfunktionen
        function setupRouteSearch() {
            console.log('setupRouteSearch called'); // Debug
            const startInput = document.getElementById('startInput');
            const destinationInput = document.getElementById('destinationInput');
            
            if (!startInput || !destinationInput) {
                console.log('Route inputs not found yet, retrying...'); // Debug
                setTimeout(setupRouteSearch, 100);
                return;
            }
            
            // Live-Suche für Startpunkt
            let startTimeout;
            startInput.addEventListener('input', function() {
                clearTimeout(startTimeout);
                const query = this.value.trim();
                
                if (query.length < 3) {
                    document.getElementById('startSuggestions').style.display = 'none';
                    document.getElementById('startContainer').classList.remove('has-suggestions');
                    return;
                }
                
                startTimeout = setTimeout(() => {
                    showRouteSuggestions(query, 'start');
                }, 300);
            });
            
            // Live-Suche für Zielort
            let destinationTimeout;
            destinationInput.addEventListener('input', function() {
                clearTimeout(destinationTimeout);
                const query = this.value.trim();
                
                if (query.length < 3) {
                    document.getElementById('destinationSuggestions').style.display = 'none';
                    document.getElementById('destinationContainer').classList.remove('has-suggestions');
                    return;
                }
                
                destinationTimeout = setTimeout(() => {
                    showRouteSuggestions(query, 'destination');
                }, 300);
            });
            
            // Enter-Taste Handling
            startInput.addEventListener('keypress', function(e) {
                if (e.key === 'Enter' && this.value.trim()) {
                    searchAndSetRouteLocation(this.value.trim(), 'start');
                }
            });
            
            destinationInput.addEventListener('keypress', function(e) {
                if (e.key === 'Enter' && this.value.trim()) {
                    searchAndSetRouteLocation(this.value.trim(), 'destination');
                }
            });
        }

        async function showRouteSuggestions(query, type) {
            const suggestionsDiv = document.getElementById(type + 'Suggestions');
            const container = document.getElementById(type + 'Container');
            
            try {
                const results = await searchOpenStreetMap(query, 5);
                
                if (results.length === 0) {
                    suggestionsDiv.style.display = 'none';
                    container.classList.remove('has-suggestions');
                    return;
                }
                
                suggestionsDiv.innerHTML = '';
                results.forEach(result => {
                    const item = document.createElement('div');
                    item.className = 'suggestion-item';
                    item.onclick = () => selectRouteLocation(result, type);
                    
                    item.innerHTML = `
                        <div class="suggestion-content">
                            <div class="suggestion-name">${getDisplayName(result)}</div>
                            <div class="suggestion-details">${result.type}</div>
                        </div>
                    `;
                    
                    suggestionsDiv.appendChild(item);
                });
                
                container.classList.add('has-suggestions');
                suggestionsDiv.style.display = 'block';
            } catch (error) {
                console.error('Fehler bei der Route-Suche:', error);
                suggestionsDiv.style.display = 'none';
                container.classList.remove('has-suggestions');
            }
        }

        function selectRouteLocation(location, type) {
            const input = document.getElementById(type + 'Input');
            const suggestionsDiv = document.getElementById(type + 'Suggestions');
            const container = document.getElementById(type + 'Container');
            
            // Input setzen
            input.value = getDisplayName(location);
            
            // Suggestions verstecken
            suggestionsDiv.style.display = 'none';
            container.classList.remove('has-suggestions');
            
            // Location speichern
            if (type === 'start') {
                routeStartLocation = location;
            } else {
                routeDestinationLocation = location;
            }
            
            // Route berechnen wenn beide Punkte gesetzt sind
            if (routeStartLocation && routeDestinationLocation) {
                calculateRoute();
            }
        }

        async function searchAndSetRouteLocation(query, type) {
            try {
                const results = await searchOpenStreetMap(query, 1);
                if (results.length > 0) {
                    selectRouteLocation(results[0], type);
                }
            } catch (error) {
                console.error('Fehler bei der Suche:', error);
            }
        }

        // Route berechnen (vereinfachte Version - gerade Linie)
        function calculateRoute() {
            if (!routeStartLocation || !routeDestinationLocation) {
                return;
            }
            
            // Alte Route entfernen
            if (currentRouteLayer) {
                map.removeLayer(currentRouteLayer);
            }
            
            // Neue Route als gerade Linie (für echte Routenberechnung wäre eine Routing-API nötig)
            const routeCoords = [
                [routeStartLocation.lat, routeStartLocation.lon],
                [routeDestinationLocation.lat, routeDestinationLocation.lon]
            ];
            
            currentRouteLayer = L.polyline(routeCoords, {
                color: '#4285f4',
                weight: 4,
                opacity: 0.8
            }).addTo(map);
            
            // Marker für Start und Ziel
            markersGroup.clearLayers();
            
            const startMarker = L.marker([routeStartLocation.lat, routeStartLocation.lon], {
                icon: L.icon({
                    iconUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iOCIgZmlsbD0iIzM0YTg1MyIvPgo8Y2lyY2xlIGN4PSIxMiIgY3k9IjEyIiByPSI0IiBmaWxsPSJ3aGl0ZSIvPgo8L3N2Zz4K',
                    iconSize: [24, 24],
                    iconAnchor: [12, 12]
                })
            }).bindPopup(`<b>Start:</b><br>${getDisplayName(routeStartLocation)}`);
            
            const destMarker = L.marker([routeDestinationLocation.lat, routeDestinationLocation.lon], {
                icon: L.icon({
                    iconUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iOCIgZmlsbD0iI2VhNDMzNSIvPgo8Y2lyY2xlIGN4PSIxMiIgY3k9IjEyIiByPSI0IiBmaWxsPSJ3aGl0ZSIvPgo8L3N2Zz4K',
                    iconSize: [24, 24],
                    iconAnchor: [12, 12]
                })
            }).bindPopup(`<b>Ziel:</b><br>${getDisplayName(routeDestinationLocation)}`);
            
            markersGroup.addLayer(startMarker);
            markersGroup.addLayer(destMarker);
            
            // Karte auf Route zentrieren
            map.fitBounds(currentRouteLayer.getBounds(), { padding: [20, 20] });
            
            // Entfernung berechnen
            const distance = map.distance(
                [routeStartLocation.lat, routeStartLocation.lon],
                [routeDestinationLocation.lat, routeDestinationLocation.lon]
            );
            
            showLocationInfo({
                name: `Route: ${getDisplayName(routeStartLocation)} → ${getDisplayName(routeDestinationLocation)}`,
                lat: (routeStartLocation.lat + routeDestinationLocation.lat) / 2,
                lon: (routeStartLocation.lon + routeDestinationLocation.lon) / 2,
                type: `Entfernung: ${(distance / 1000).toFixed(1)} km`
            });
        }

        // Deine OpenStreetMap-Suchfunktion
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
            
            // Search-Input NICHT leeren - entfernt!
        }

        function showLocationInfo(location) {
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
                    
                    currentLocationMarker.bindPopup('Ihr aktueller Standort').openPopup();
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
            if (!e.target.closest('.search-container') && !e.target.closest('.route-input-container')) {
                const searchContainer = document.querySelector('.search-container');
                suggestionsDiv.style.display = 'none';
                if (searchContainer) {
                    searchContainer.classList.remove('has-suggestions');
                }
                
                // Route suggestions auch verstecken
                document.getElementById('startSuggestions').style.display = 'none';
                document.getElementById('destinationSuggestions').style.display = 'none';
                document.getElementById('startContainer').classList.remove('has-suggestions');
                document.getElementById('destinationContainer').classList.remove('has-suggestions');
            }
        });

        // Initialisierung - Setup wird automatisch beim ersten Toggle aufgerufen
        console.log('Script loaded successfully'); // Debug

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
            
            // Reverse Geocoding (optional)
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