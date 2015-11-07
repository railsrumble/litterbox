var waitFor = require('waitFor'),
		customMapStyles = require('../modules/customMapStyles');

waitFor('body.searches-show', function() {
	var markers = [],
			$searchForm = $('.search-bar form'),
			$locationField = $searchForm.find('.location'),
			$searchResults = $('#search-results'),
			regularMarker = "/assets/images/regular-marker.png";
			searchResultsTemplate = require('../templates/searchResults.ejs');

	initMap = function() {
		var mapOptions = {
			zoom: 4,
			center: new google.maps.LatLng(39.50, -98.35),
			mapTypeControl: false,
			disableDefaultUI: true,
			mapTypeId: google.maps.MapTypeId.ROADMAP,
		};
		map = new google.maps.Map($('#map')[0], mapOptions);

		// set up custom styled map
		styledMap = new google.maps.StyledMapType(customMapStyles, {name: 'Hairbnb Map'});
		map.mapTypes.set('map_style', styledMap);
		map.setMapTypeId('map_style');

		idleListener = google.maps.event.addListener(map, 'idle', initSearch);
	},

	initSearch = function() {
		searchLocations();

		$searchForm.submit(function(e){
			e.preventDefault();
			searchLocations();
		});
	},

	searchLocations = function() {
		var location = $locationField.val();

		if(!!location) {
			getLitterBoxes();
		} else {
			alert('Enter a damn location.');
		}
	},

	getLitterBoxes = function() {
		$.ajax({
			type: 'POST',
			dataType: 'json',
			url: '/search',
			data: {
				lat: map.getCenter().lat(),
				lng: map.getCenter().lng(),
			}, success: function(litterboxes) {
				showMarkers(litterboxes);

				$searchResults.html(
					searchResultsTemplate({ litterboxes: litterboxes })
				);
			}}
		);
	},

	showMarkers = function(litterboxes) {
    deleteMarkers();
    litterboxes.forEach(function(litterbox){
    	addMarker(litterbox);
    });
	},

	// Adds a marker to the map and push to the array.
	addMarker = function(litterbox) {
		icon = regularMarker;

		var marker = new google.maps.Marker({
			position: {
				lat: litterbox.latitude,
				lng: litterbox.longitude
			},
			map: map,
			icon: icon,
		});

		marker.set('litterbox', litterbox);
		markers.push(marker);
	}

	// Deletes all markers in the array by removing references to them.
	deleteMarkers = function() {
		clearMarkers();
		markers = [];
	},

	// Removes the markers from the map, but keeps them in the array.
	clearMarkers = function() {
		setMapOnAll(null);
	},

	// Sets the map on all markers in the array.
	setMapOnAll = function(map) {
		for (var i = 0; i < markers.length; i++) {
			markers[i].setMap(map);
		}
	},

	init = function() {
		initMap();
	};

	init();
});