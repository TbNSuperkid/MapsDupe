// Karte initialisieren
        const map = L.map('map', {
            zoomControl: false
        }).setView([51.1657, 10.4515], 6);

        // Tile Layer hinzufügen
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors'
        }).addTo(map);

        // Marker-Gruppe für Suchergebnisse
        let markersGroup = L.layerGroup().addTo(map);
        let currentLocationMarker = null;

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
            if (!e.target.closest('.search-container')) {
                const searchContainer = document.querySelector('.search-container');
                suggestionsDiv.style.display = 'none';
                searchContainer.classList.remove('has-suggestions');
            }
        });

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