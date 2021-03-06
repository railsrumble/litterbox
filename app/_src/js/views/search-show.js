var waitFor = require('waitFor'),
		customMapStyles = require('../modules/customMapStyles'),
		geocode = require('../modules/geocode.js'),
		moment = require('moment'),
		nstSlider = require('../lib/jquery.nstSlider');

waitFor('body.searches-show', function() {
	var paginationPageAmount = 20,
			paginationPage = 1,
			infowindow,
			markers = [],
			returned_litterboxes = [],
			$nstSlider = $('.nstSlider'),
			$searchForm = $('.search-bar form'),
			$locationField = $searchForm.find('.location'),
			$startDateField = $searchForm.find('.start-date'),
			$endDateField = $searchForm.find('.end-date'),
			$radiusField = $searchForm.find('#radius'),
			$searchResults = $('#search-results'),
			$searchResultsContainer = $('.sec-search .results'),
			$filterForm = $('#filters'),
			$numberOfCatsField = $filterForm.find('#number_of_cats'),
			$kidFriendlyField = $filterForm.find('#kid_friendly'),
			regularMarker = '/assets/images/regular-marker.png',
			selectedMarker = '/assets/images/selected-marker.png',
			searchResultsTemplate = require('../templates/searchResults.ejs'),
			singleSearchResults = require('../templates/singleSearchResults.ejs'),
			infowindowSearchResults = require('../templates/infowindowSearchResults.ejs'),
			minPriceRange = 0, maxPriceRange = 500;

	var initHover = function() {
		$searchResults.on('mouseenter', '.single-result', function(){
			$this = $(this);
			markers.forEach(function(marker){
				if(parseInt(marker.litterbox.id) == parseInt($this.data('litterbox-id'))) {
					setMarkerDetails(markers, marker, false);
				}
			})
		});

		$searchResults.on('mouseleave', '.single-result', function(){
			markers.forEach(function(m){m.setIcon(regularMarker);});
			// infowindow.close();
		});
	};

	var initPriceSlider = function() {
		slider = $nstSlider.nstSlider({
			"crossable_handles": false,
			"left_grip_selector": ".leftGrip",
			"right_grip_selector": ".rightGrip",
			"value_bar_selector": ".bar",
			"value_changed_callback": function(cause, leftValue, rightValue) {
				minPriceRange = leftValue;
				maxPriceRange = rightValue;
				$(this).parent().find('.leftLabel').text(leftValue);
				$(this).parent().find('.rightLabel').text(rightValue);
				displayMarkers(returned_litterboxes);
			}
		});
	};

	var updatePriceSlider = function(litterboxes) {
		minPrice = 0;
		maxPrice = 0;

		litterboxes.forEach(function(litterbox, i){
			if(i == 0 ) {
				minPrice = litterbox.price;
				maxPrice = litterbox.price;
			}

			if(minPrice > litterbox.price){
				minPrice = litterbox.price;
			}

			if(maxPrice < litterbox.price){
				maxPrice = litterbox.price;
			}
		})

		$nstSlider.nstSlider('set_range', minPrice, maxPrice).nstSlider('refresh');
		minPriceRange = minPrice;
		maxPriceRange = maxPrice;
	};

	var initMap = function() {
		var mapOptions = {
			zoom: 4,
			center: new google.maps.LatLng(39.50, -98.35),
			mapTypeControl: false,
			disableDefaultUI: true,
			mapTypeId: google.maps.MapTypeId.ROADMAP,
		};
		map = new google.maps.Map($('#map')[0], mapOptions);

		infowindow = new google.maps.InfoWindow({
			content: "holding..."
		})

		// set up custom styled map
		styledMap = new google.maps.StyledMapType(customMapStyles, {name: 'Litterbox Map'});
		map.mapTypes.set('map_style', styledMap);
		map.setMapTypeId('map_style');

		idleListener = google.maps.event.addListener(map, 'idle', initSearch);
	};

	var initUpdateEndDate = function() {
		$startDateField.change(function(){
			endDate = moment($endDateField.val());
			startDate = moment(this.value);

			if($endDateField.val() == "" || endDate < startDate) {
				$endDateField.val(startDate.add(1, 'days').format('L'));
			}
		});
	};

	var initFilter = function() {
		$filterForm.find('input, select').change(function(){
			displayMarkers(returned_litterboxes);
		});
	};

	var initInfiniteScroll = function() {
		flag = true;
		$searchResultsContainer.scroll(function(){
			if($searchResultsContainer.height() + $searchResultsContainer.scrollTop() - $searchResults.height() > 0) {
				if(flag) {
					flag = false;
					paginationPage += 1

					markers.slice((paginationPage - 1) * paginationPageAmount, paginationPage * paginationPageAmount).forEach(function(marker){
						$('.results-list').append(singleSearchResults({ litterbox: marker.litterbox }));
					})

					if((paginationPage * paginationPageAmount) <= markers.length) {
						flag = true;
					}
				}
			}
		});
	};

	var filterLitterBox = function(litterbox) {
		return filterNumberofCats(litterbox)
			&& filterKidFriendly(litterbox)
			&& filterPriceRange(litterbox);
	};

	var filterKidFriendly = function(litterbox) {
		return !($kidFriendlyField.prop('checked') && litterbox.number_of_children > 0)
	};

	var filterPriceRange = function(litterbox) {
		return minPriceRange <= litterbox.price && maxPriceRange >= litterbox.price;
	};

	var filterNumberofCats = function(litterbox) {
		return $numberOfCatsField.val() <= litterbox.capacity;
	};

	var initSearch = function() {
		searchLitterBoxes();

		$searchForm.submit(function(e){
			e.preventDefault();
			$searchResultsContainer.animate({ scrollTop: 0 });
			searchLitterBoxes();
		});

		google.maps.event.removeListener(idleListener);
	};

	var searchLitterBoxes = function() {
		var location = $locationField.val();

		if(!!location) {
			updateUrl();
			geocode({address: location}, function(results, status){
				map.fitBounds(results[0].geometry.viewport);
				getLitterBoxes({
					lat: map.getCenter().lat(),
					lng: map.getCenter().lng(),
					start_date: $startDateField.val(),
					end_date: $endDateField.val(),
					radius: $radiusField.val(),
				});
			});
		} else {
			getGeolocation();
		}
	};

	var getGeolocation = function() {
		if (navigator.geolocation) {
			navigator.geolocation.getCurrentPosition(function(position) {
				var pos = {
					lat: position.coords.latitude,
					lng: position.coords.longitude
				};

				geocode({location: pos}, function(results, status){
					$locationField.val(results[0].formatted_address);
					$searchForm.submit();
			  });
			}, function() {
				//if we need to handle them saying no this is where it goes
				$locationField.addClass('animated shake invalid');
			});
		} else {
			// Browser doesn't support Geolocation
			$locationField.addClass('animated shake invalid');
		}
	};

	var updateUrl = function() {
		url = "/search?location=" + encodeURIComponent($locationField.val())
					+ "&start_date=" + encodeURIComponent($startDateField.val())
					+ "&end_date=" + encodeURIComponent($endDateField.val())
					+ "&radius=" + encodeURIComponent($radiusField.val());

		history.pushState({}, '', url);
	};

	var getLitterBoxes = function(search_params) {
		$.ajax({
			type: 'POST',
			dataType: 'json',
			url: '/search',
			data: {
				search: search_params,
			}, success: function(litterboxes) {
				updatePriceSlider(litterboxes);
				displayMarkers(litterboxes);
			}}
		);
	};

	var displayMarkers = function(litterboxes) {
		paginationPage = 1;
		returned_litterboxes = litterboxes;
		showMarkers(returned_litterboxes);
		$searchResults.html(
			searchResultsTemplate({ markers: markers.slice((paginationPage - 1) * paginationPageAmount, paginationPage * paginationPageAmount), count: markers.length })
		);
	};

	var showMarkers = function(litterboxes) {
		deleteMarkers();

    litterboxes.forEach(function(litterbox){
    	if(filterLitterBox(litterbox)) {
	    	addMarker(litterbox);
    	}
    });
	};

	// Adds a marker to the map and push to the array.
	var addMarker = function(litterbox) {
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

		google.maps.event.addListener(marker, 'click', function () {
			setMarkerDetails(markers, marker, true);
		});

	};

	var setMarkerDetails = function(markers, marker, openWindow) {
		markers.forEach(function(m){m.setIcon(regularMarker);});
		marker.setIcon(selectedMarker);

		infowindow.setContent(infowindowSearchResults({ litterbox: marker.litterbox }));

		if (openWindow)
			infowindow.open(map, marker);
	};

	// Deletes all markers in the array by removing references to them.
	var deleteMarkers = function() {
		clearMarkers();
		markers = [];
	};

	// Removes the markers from the map, but keeps them in the array.
	var clearMarkers = function() {
		setMapOnAll(null);
	};

	// Sets the map on all markers in the array.
	var setMapOnAll = function(map) {
		for (var i = 0; i < markers.length; i++) {
			markers[i].setMap(map);
		}
	};

	var init = function() {
		initMap();
		initPriceSlider();
		initFilter();
		initUpdateEndDate();
		initInfiniteScroll();
		$locationField.on('focus', function () {
			$locationField.removeClass('animated shake invalid');
		});
		initHover();
	};

	init();
});